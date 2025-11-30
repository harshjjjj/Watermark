import { WatermarkSettings, TextOverlaySettings } from '../types';

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;

export class VideoProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mediaRecorder: MediaRecorder | null = null;
  private videoElement: HTMLVideoElement;
  private logoImage: HTMLImageElement;
  private chunks: Blob[] = [];
  private animationFrameId: number | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TARGET_WIDTH;
    this.canvas.height = TARGET_HEIGHT;
    
    // Alpha: false is important for video performance and proper black backgrounds
    // desynchronized: false ensures better sync between draw and capture
    const context = this.canvas.getContext('2d', { alpha: false, desynchronized: false }); 
    if (!context) throw new Error("Could not get canvas context");
    this.ctx = context;
    
    this.videoElement = document.createElement('video');
    this.videoElement.crossOrigin = 'anonymous';
    this.videoElement.muted = true; // Required for auto-play in many contexts
    this.videoElement.playsInline = true;
    this.videoElement.preload = 'auto';
    
    this.logoImage = new Image();
    this.logoImage.crossOrigin = 'anonymous';
  }

  /**
   * Aggressively try to find an MP4/H.264 supported mime type.
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // H.264 Constrained Baseline
      'video/mp4;codecs=avc1.4D401E,mp4a.40.2', // H.264 Main
      'video/mp4;codecs=avc1.64001E,mp4a.40.2', // H.264 High
      'video/mp4',
      'video/webm;codecs=h264', // Chrome/Edge often support H.264 in WebM container
      'video/webm;codecs=vp9,opus',
      'video/webm'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`Using mime type: ${type}`);
        return type;
      }
    }
    return ''; // Should default to browser default if empty, but we'll handle fallback
  }

  public async processVideo(
    videoFile: File,
    logoFile: File | null,
    settings: WatermarkSettings,
    textSettings: TextOverlaySettings,
    onProgress: (progress: number) => void
  ): Promise<{ blob: Blob; mimeType: string }> {
    
    this.cleanup(); // Ensure fresh state
    this.chunks = [];
    
    let mimeType = this.getSupportedMimeType();
    // Fallback if loop missed everything (unlikely)
    if (!mimeType) mimeType = 'video/webm';

    // 1. Load Resources
    await this.loadVideo(videoFile);
    if (logoFile) {
        await this.loadLogo(logoFile);
    }

    // 2. Setup Stream
    // 30 FPS is standard for mobile/social
    const stream = this.canvas.captureStream(30);
    
    // Add Audio Track if available (even if silent/muted source, we try to capture it)
    // Note: If videoElement is muted, captureStream audio is silent. 
    // To get real audio, we would need WebAudio, but that complicates 'autoplay' policies significantly.
    // For now, we accept silent audio if the browser enforces it on muted elements.
    // @ts-ignore
    const videoStream = (this.videoElement.captureStream || this.videoElement.mozCaptureStream)?.call(this.videoElement);
    if (videoStream) {
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
        }
    }

    // 3. Initialize Recorder
    try {
      this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          videoBitsPerSecond: 8000000 // 8 Mbps
      });
    } catch (e) {
      console.warn("High bitrate failed, falling back to default", e);
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    // 4. Processing Promise
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject("Recorder init failed");

      // SUCCESS HANDLER
      this.mediaRecorder.onstop = () => {
        const finalType = this.mediaRecorder?.mimeType || mimeType;
        const blob = new Blob(this.chunks, { type: finalType });
        
        if (blob.size === 0) {
           reject(new Error("Recording failed: Output file is empty. Browser might not support this codec combination."));
           return;
        }

        resolve({ blob, mimeType: finalType });
        this.cleanup();
      };

      // ERROR HANDLER
      this.mediaRecorder.onerror = (e) => {
        reject(new Error("MediaRecorder Error: " + JSON.stringify(e)));
        this.cleanup();
      };

      // VIDEO EVENTS - CRITICAL FOR STOPPING "STUCK" RENDERS
      this.videoElement.onended = () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
      };

      this.videoElement.onerror = () => {
        reject(new Error("Video Playback Error"));
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
      };

      // START
      this.mediaRecorder.start(100); // 100ms chunks for frequent updates

      this.videoElement.play().then(() => {
        this.renderLoop(settings, textSettings, logoFile !== null, onProgress);
      }).catch(e => {
        reject(new Error("Failed to start video playback: " + e.message));
      });
    });
  }

  private renderLoop(
    settings: WatermarkSettings, 
    textSettings: TextOverlaySettings,
    hasLogo: boolean,
    onProgress: (p: number) => void
  ) {
    if (this.videoElement.paused || this.videoElement.ended) {
      // If we are ended, the onended handler will stop the recorder.
      return;
    }

    // DRAW
    this.drawFrame(settings, textSettings, hasLogo);

    // PROGRESS
    const duration = this.videoElement.duration || 1;
    const progress = (this.videoElement.currentTime / duration) * 100;
    onProgress(Math.min(progress, 99.9));

    // NEXT FRAME
    this.animationFrameId = requestAnimationFrame(() => {
        this.renderLoop(settings, textSettings, hasLogo, onProgress);
    });
  }

  private drawFrame(
    settings: WatermarkSettings, 
    textSettings: TextOverlaySettings,
    hasLogo: boolean
  ) {
    // 1. Clear & Draw Background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    // 2. Draw Video (Contain/Fit Mode)
    const vW = this.videoElement.videoWidth;
    const vH = this.videoElement.videoHeight;
    
    // Scale to fill or fit? User asked for 1080x1920 dimensions.
    // 'contain' keeps aspect ratio and adds black bars.
    const scale = Math.min(TARGET_WIDTH / vW, TARGET_HEIGHT / vH);
    const dW = vW * scale;
    const dH = vH * scale;
    const dX = (TARGET_WIDTH - dW) / 2;
    const dY = (TARGET_HEIGHT - dH) / 2;

    this.ctx.drawImage(this.videoElement, dX, dY, dW, dH);

    // 3. Draw Overlays
    if (hasLogo && this.logoImage.complete && this.logoImage.naturalWidth > 0) {
        this.renderLogo(settings);
    }

    if (textSettings.enabled && textSettings.content) {
        this.renderText(textSettings);
    }
  }

  private renderLogo(settings: WatermarkSettings) {
    this.ctx.save();
    this.ctx.globalAlpha = settings.opacity;
    this.ctx.globalCompositeOperation = 'source-over';

    const logoAspect = this.logoImage.width / this.logoImage.height;
    const targetWidth = TARGET_WIDTH * (settings.size / 100);
    const targetHeight = targetWidth / logoAspect;

    const x = TARGET_WIDTH - targetWidth - settings.marginRight;
    const y = TARGET_HEIGHT - targetHeight - settings.marginBottom;

    this.ctx.drawImage(this.logoImage, x, y, targetWidth, targetHeight);
    this.ctx.restore();
  }

  private renderText(settings: TextOverlaySettings) {
    this.ctx.save();
    this.ctx.globalAlpha = settings.opacity;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = settings.color;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const fontSizePx = (TARGET_HEIGHT * settings.fontSize) / 100; 
    this.ctx.font = `bold ${fontSizePx}px Inter, sans-serif`;
    
    const x = TARGET_WIDTH / 2;
    const y = (TARGET_HEIGHT * settings.yPosition) / 100;
    
    // Shadow for better visibility
    this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    const lines = settings.content.split('\n');
    const lineHeight = fontSizePx * 1.2;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
        this.ctx.fillText(line, x, startY + (index * lineHeight));
    });

    this.ctx.restore();
  }

  private loadVideo(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.videoElement.src) {
          URL.revokeObjectURL(this.videoElement.src);
      }
      this.videoElement.src = URL.createObjectURL(file);
      this.videoElement.onloadedmetadata = () => {
          this.videoElement.currentTime = 0;
          resolve();
      };
      this.videoElement.onerror = () => reject(new Error("Could not load video file."));
    });
  }

  private loadLogo(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logoImage.src = URL.createObjectURL(file);
      this.logoImage.onload = () => resolve();
      this.logoImage.onerror = () => reject(new Error("Could not load logo image."));
    });
  }

  private cleanup() {
     if (this.animationFrameId) {
         cancelAnimationFrame(this.animationFrameId);
         this.animationFrameId = null;
     }
     if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
         this.mediaRecorder.stop();
     }
     // Don't revoke src here immediately to allow playback reference if needed
  }
}

export const videoProcessor = new VideoProcessor();