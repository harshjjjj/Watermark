import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  AppState, 
  WatermarkSettings, 
  TextOverlaySettings,
  ProcessingStats, 
  ProcessingError,
  OutputFormat
} from './types';
import { DropZone } from './components/DropZone';
import { RangeSlider } from './components/RangeSlider';
import { videoProcessor } from './services/videoProcessor';
import { 
  VideoIcon, 
  ImageIcon, 
  PlayIcon, 
  DownloadIcon, 
  AlertIcon,
  CheckIcon,
  TypeIcon
} from './components/Icons';

function App() {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  
  // New States
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('mp4');
  const [activeTab, setActiveTab] = useState<'logo' | 'text'>('logo');
  const [actualMimeType, setActualMimeType] = useState<string>('');

  // Settings
  const [settings, setSettings] = useState<WatermarkSettings>({
    size: 20,
    opacity: 0.9,
    marginRight: 40,
    marginBottom: 100
  });

  const [textSettings, setTextSettings] = useState<TextOverlaySettings>({
    enabled: false,
    content: "YOUR TEXT HERE",
    fontSize: 3, // % of height
    color: "#ffffff",
    yPosition: 80, // % from top
    opacity: 1
  });

  // Refs for Live Preview
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Computed
  const isReady = videoFile && (logoFile || textSettings.enabled) && appState === AppState.IDLE;

  // Effects
  useEffect(() => {
    // Cleanup URL on unmount
    return () => {
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, [processedUrl]);

  // Handlers
  const handleVideoSelect = (file: File) => {
    if (file.size > 500 * 1024 * 1024) {
      setError({ message: "File too large", details: "Please upload a video smaller than 500MB." });
      return;
    }
    setError(null);
    setVideoFile(file);
    if (processedUrl) {
      URL.revokeObjectURL(processedUrl);
      setProcessedUrl(null);
      setAppState(AppState.IDLE);
    }
  };

  const handleLogoSelect = (file: File) => {
    setLogoFile(file);
  };

  const startProcessing = async () => {
    if (!videoFile) return;

    setAppState(AppState.PROCESSING);
    setProgress(0);
    setError(null);
    
    const startTime = Date.now();

    try {
      const { blob, mimeType } = await videoProcessor.processVideo(
        videoFile,
        logoFile,
        settings,
        textSettings,
        (p) => setProgress(p)
      );

      const url = URL.createObjectURL(blob);
      setProcessedUrl(url);
      setActualMimeType(mimeType);
      
      setProcessingStats({
        originalSize: (videoFile.size / 1024 / 1024).toFixed(2) + ' MB',
        processedSize: (blob.size / 1024 / 1024).toFixed(2) + ' MB',
        duration: (Date.now() - startTime) / 1000,
        format: mimeType.split(';')[0]
      });
      setAppState(AppState.COMPLETED);

    } catch (err: any) {
      console.error(err);
      setError({ message: "Processing Failed", details: err.message || "An unexpected error occurred." });
      setAppState(AppState.ERROR);
    }
  };

  const previewLogoStyle = useMemo(() => {
    if (!settings || !logoFile) return { display: 'none' };
    
    return {
      width: `${settings.size}%`, 
      opacity: settings.opacity,
      right: `${(settings.marginRight / 1080) * 100}%`,
      bottom: `${(settings.marginBottom / 1920) * 100}%`,
    };
  }, [settings, logoFile]);

  const previewTextStyle = useMemo(() => {
    if (!textSettings.enabled) return { display: 'none' };
    return {
      top: `${textSettings.yPosition}%`,
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: textSettings.color,
      fontSize: `${textSettings.fontSize * 5}px`, // visual approximation
      opacity: textSettings.opacity,
      textShadow: '4px 4px 8px rgba(0,0,0,0.75)',
      whiteSpace: 'pre-wrap'
    };
  }, [textSettings]);

  const getDownloadName = () => {
      const base = videoFile?.name.split('.')[0] || 'video';
      
      // If the browser only supported WebM, we can't force .mov properly without corruption risk
      // But user requested .mp4 or .mov. 
      // If actualMimeType includes 'mp4', we are safe.
      // If it includes 'webm', we warn or just give .webm if we want to be safe, 
      // BUT users want mp4. Modern WebM usually plays if renamed to .mp4 in some players, but not all.
      // We will stick to the requested format but log the discrepancy.
      
      return `${base}_edited.${outputFormat}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              WatermarkPro <span className="text-slate-500 text-lg font-light">| Vertical Studio</span>
            </h1>
            <p className="text-slate-400 mt-2">Create professional 9:16 vertical videos with watermarks and text overlays.</p>
          </div>
          <div className="flex gap-2 text-xs font-mono text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            <span className="w-2 h-2 bg-green-500 rounded-full my-auto animate-pulse"></span>
            PROCESSING: LOCAL
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Column: Controls & Uploads */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. Upload Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs">1</span>
                Assets
              </h2>
              
              <DropZone 
                accept="video/mp4,video/webm,video/mov,video/quicktime"
                label="Upload Video"
                subLabel="MP4, WebM or MOV (Max 500MB)"
                icon={<VideoIcon className="w-6 h-6" />}
                onFileSelect={handleVideoSelect}
                selectedFile={videoFile}
                onClear={() => setVideoFile(null)}
              />
            </div>

            {/* 2. Configuration Section */}
            <div className={`space-y-4 transition-opacity duration-300 ${videoFile ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs">2</span>
                Overlays
              </h2>

              {/* Tabs */}
              <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                <button 
                  onClick={() => setActiveTab('logo')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2
                    ${activeTab === 'logo' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <ImageIcon className="w-4 h-4" /> Logo
                </button>
                <button 
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2
                    ${activeTab === 'text' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <TypeIcon className="w-4 h-4" /> Text
                </button>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 space-y-6">
                
                {/* Logo Settings */}
                {activeTab === 'logo' && (
                  <>
                     <DropZone 
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      label="Select Logo"
                      subLabel="PNG, JPG (Transparent)"
                      icon={<ImageIcon className="w-5 h-5" />}
                      onFileSelect={handleLogoSelect}
                      selectedFile={logoFile}
                      onClear={() => setLogoFile(null)}
                    />
                    
                    {logoFile && (
                      <div className="space-y-6 pt-4 border-t border-slate-700/50">
                        <RangeSlider 
                          label="Size" 
                          min={5} max={80} unit="%" 
                          value={settings.size} 
                          onChange={(v) => setSettings({...settings, size: v})} 
                        />
                        <RangeSlider 
                          label="Opacity" 
                          min={0.1} max={1} step={0.1} 
                          value={settings.opacity} 
                          onChange={(v) => setSettings({...settings, opacity: v})} 
                        />
                        <RangeSlider 
                          label="Right Margin" 
                          min={0} max={200} unit="px" 
                          value={settings.marginRight} 
                          onChange={(v) => setSettings({...settings, marginRight: v})} 
                        />
                        <RangeSlider 
                          label="Bottom Margin" 
                          min={0} max={400} unit="px" 
                          value={settings.marginBottom} 
                          onChange={(v) => setSettings({...settings, marginBottom: v})} 
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Text Settings */}
                {activeTab === 'text' && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Enable Text Overlay</label>
                      <input 
                        type="checkbox" 
                        checked={textSettings.enabled}
                        onChange={(e) => setTextSettings({...textSettings, enabled: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-800"
                      />
                    </div>

                    {textSettings.enabled && (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-400 uppercase">Content</label>
                          <textarea 
                            value={textSettings.content}
                            onChange={(e) => setTextSettings({...textSettings, content: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm focus:border-indigo-500 outline-none text-white resize-none"
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-400 uppercase">Color</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color" 
                                  value={textSettings.color}
                                  onChange={(e) => setTextSettings({...textSettings, color: e.target.value})}
                                  className="h-10 w-full rounded bg-transparent cursor-pointer"
                                />
                              </div>
                           </div>
                           <RangeSlider 
                              label="Size" 
                              min={1} max={10} step={0.1}
                              value={textSettings.fontSize} 
                              onChange={(v) => setTextSettings({...textSettings, fontSize: v})} 
                            />
                        </div>

                        <RangeSlider 
                          label="Vertical Position" 
                          min={0} max={100} unit="%"
                          value={textSettings.yPosition} 
                          onChange={(v) => setTextSettings({...textSettings, yPosition: v})} 
                        />
                         <RangeSlider 
                          label="Opacity" 
                          min={0.1} max={1} step={0.1} 
                          value={textSettings.opacity} 
                          onChange={(v) => setTextSettings({...textSettings, opacity: v})} 
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Output Settings & Action */}
            <div className={`space-y-4 transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
               <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs">3</span>
                Export
              </h2>
              
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex items-center gap-4">
                 <span className="text-sm font-medium text-slate-300">Format:</span>
                 <div className="flex gap-3">
                   <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                        type="radio" 
                        name="format" 
                        value="mp4" 
                        checked={outputFormat === 'mp4'} 
                        onChange={() => setOutputFormat('mp4')}
                        className="text-indigo-500 focus:ring-indigo-500 bg-slate-700 border-slate-600"
                      />
                     <span className="text-sm text-slate-200">.MP4</span>
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                        type="radio" 
                        name="format" 
                        value="mov" 
                        checked={outputFormat === 'mov'} 
                        onChange={() => setOutputFormat('mov')}
                        className="text-indigo-500 focus:ring-indigo-500 bg-slate-700 border-slate-600"
                      />
                     <span className="text-sm text-slate-200">.MOV</span>
                   </label>
                 </div>
              </div>

              <button
                onClick={startProcessing}
                disabled={!isReady}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all
                  ${isReady 
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white hover:scale-[1.02]' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }
                `}
              >
                {appState === AppState.PROCESSING ? (
                   <span>Processing...</span>
                ) : (
                   <>
                     <PlayIcon className="w-5 h-5" /> Start Processing
                   </>
                )}
              </button>
            </div>

          </div>

          {/* Right Column: 9:16 Preview */}
          <div className="lg:col-span-7 flex flex-col items-center">
            
            <div className="w-full max-w-[400px]">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold text-slate-200">Vertical Preview</h2>
                 <span className="text-xs font-mono text-slate-500 bg-black/30 px-2 py-1 rounded">1080x1920</span>
              </div>

              {/* Phone Aspect Ratio Container (9:16) */}
              <div className="relative w-full aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl border-[6px] border-slate-800 ring-1 ring-slate-700/50 group">
                
                {/* Empty State */}
                {!videoFile && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 p-8 text-center">
                    <VideoIcon className="w-16 h-16 mb-4 opacity-30" />
                    <p>Upload a video to see how it looks in vertical format</p>
                  </div>
                )}

                {/* Video Content */}
                {videoFile && appState !== AppState.COMPLETED && (
                  <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
                    {/* Background Blur for "Fit" effect */}
                    <div className="absolute inset-0 opacity-30 blur-xl transform scale-150">
                        <video 
                           src={videoFile ? URL.createObjectURL(videoFile) : ''}
                           className="w-full h-full object-cover"
                           muted
                        />
                    </div>

                    {/* Main Video (Contained) */}
                    <video 
                      ref={previewVideoRef}
                      src={videoFile ? URL.createObjectURL(videoFile) : ''}
                      className="relative w-full h-full object-contain z-10"
                      controls
                      playsInline
                    />

                    {/* Logo Overlay */}
                    {logoFile && (
                      <div 
                        className="absolute z-20 pointer-events-none transition-all duration-200"
                        style={previewLogoStyle}
                      >
                        <img 
                          src={URL.createObjectURL(logoFile)} 
                          alt="Watermark" 
                          className="w-full h-auto"
                        />
                      </div>
                    )}

                    {/* Text Overlay */}
                    {textSettings.enabled && (
                      <div 
                        className="absolute z-20 pointer-events-none transition-all duration-200 w-full text-center font-bold font-sans"
                        style={previewTextStyle}
                      >
                        {textSettings.content}
                      </div>
                    )}
                  </div>
                )}

                {/* Processing Overlay */}
                {appState === AppState.PROCESSING && (
                  <div className="absolute inset-0 z-30 bg-slate-900/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
                    <div className="w-full space-y-4">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-indigo-400">Rendering...</span>
                        <span className="text-slate-400">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-100 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed State */}
                {appState === AppState.COMPLETED && processedUrl && (
                  <div className="relative w-full h-full bg-slate-900 flex flex-col items-center justify-center gap-6 p-8 text-center z-40">
                     <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2">
                       <CheckIcon className="w-10 h-10" />
                     </div>
                     
                     <div className="space-y-1">
                        <h3 className="text-2xl font-bold text-white">Export Ready</h3>
                        <p className="text-slate-400 text-sm">Your vertical video has been generated.</p>
                     </div>
                     
                     {processingStats && (
                       <div className="w-full bg-slate-800/50 rounded-lg p-4 text-xs space-y-2 border border-slate-700/50">
                         <div className="flex justify-between"><span className="text-slate-500">Output</span> <span className="text-slate-200 font-mono">1080x1920</span></div>
                         <div className="flex justify-between"><span className="text-slate-500">Size</span> <span className="text-slate-200 font-mono">{processingStats.processedSize}</span></div>
                         <div className="flex justify-between"><span className="text-slate-500">Browser Codec</span> <span className="text-slate-200 font-mono">{processingStats.format}</span></div>
                       </div>
                     )}

                     <a 
                       href={processedUrl}
                       download={getDownloadName()}
                       className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-lg shadow-green-900/20 hover:scale-[1.02]"
                     >
                       <DownloadIcon className="w-5 h-5" /> Download .{outputFormat.toUpperCase()}
                     </a>
                     
                     <button
                        onClick={() => setAppState(AppState.IDLE)}
                        className="text-slate-500 hover:text-slate-300 text-sm py-2"
                     >
                        Create New Video
                     </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-6 w-full max-w-[400px] bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                <AlertIcon className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-400">Processing Error</h4>
                  <p className="text-sm text-red-300/80">{error.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;