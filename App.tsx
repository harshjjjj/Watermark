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
      return `${base}_edited.${outputFormat}`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 p-6 md:p-12 font-sans selection:bg-pink-100 selection:text-pink-600">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                WatermarkPro
              </span>
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Studio-grade vertical video processor.</p>
          </div>
          <div className="flex gap-2 text-xs font-bold tracking-wide text-pink-600 bg-pink-50 px-4 py-2 rounded-full border border-pink-100 self-start md:self-auto">
            <span className="w-2 h-2 bg-pink-500 rounded-full my-auto animate-pulse"></span>
            BROWSER-BASED
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-12 gap-10">
          
          {/* Left Column: Controls & Uploads */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* 1. Upload Section - ORANGE THEME */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white text-sm shadow-md shadow-orange-200">1</span>
                Upload Assets
              </h2>
              
              <DropZone 
                accept="video/mp4,video/webm,video/mov,video/quicktime"
                label="Drop Video Here"
                subLabel="MP4, WebM or MOV (Max 500MB)"
                icon={<VideoIcon className="w-8 h-8" />}
                onFileSelect={handleVideoSelect}
                selectedFile={videoFile}
                onClear={() => setVideoFile(null)}
              />
            </div>

            {/* 2. Configuration Section - PURPLE THEME */}
            <div className={`space-y-4 transition-all duration-500 ${videoFile ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-4 pointer-events-none grayscale'}`}>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm shadow-md shadow-purple-200">2</span>
                Customize Overlays
              </h2>

              {/* Tabs */}
              <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
                <button 
                  onClick={() => setActiveTab('logo')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                    ${activeTab === 'logo' 
                      ? 'bg-white text-purple-600 ring-1 ring-purple-100 shadow-sm' 
                      : 'text-slate-400 hover:text-purple-500'}`}
                >
                  <ImageIcon className="w-4 h-4" /> Logo
                </button>
                <button 
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                    ${activeTab === 'text' 
                      ? 'bg-white text-fuchsia-600 ring-1 ring-fuchsia-100 shadow-sm' 
                      : 'text-slate-400 hover:text-fuchsia-500'}`}
                >
                  <TypeIcon className="w-4 h-4" /> Text
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
                
                {/* Logo Settings */}
                {activeTab === 'logo' && (
                  <>
                     <DropZone 
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      label="Select Logo"
                      subLabel="PNG, JPG (Transparent)"
                      icon={<ImageIcon className="w-6 h-6" />}
                      onFileSelect={handleLogoSelect}
                      selectedFile={logoFile}
                      onClear={() => setLogoFile(null)}
                    />
                    
                    {logoFile && (
                      <div className="space-y-6 pt-4 border-t border-slate-100 animate-fadeIn">
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
                  <div className="space-y-5 animate-fadeIn">
                    <div className="flex items-center justify-between bg-fuchsia-50 p-3 rounded-lg border border-fuchsia-100">
                      <label className="text-sm font-semibold text-fuchsia-900">Enable Text Overlay</label>
                      <input 
                        type="checkbox" 
                        checked={textSettings.enabled}
                        onChange={(e) => setTextSettings({...textSettings, enabled: e.target.checked})}
                        className="w-5 h-5 rounded border-fuchsia-300 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer accent-fuchsia-500"
                      />
                    </div>

                    {textSettings.enabled && (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Content</label>
                          <textarea 
                            value={textSettings.content}
                            onChange={(e) => setTextSettings({...textSettings, content: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 outline-none text-slate-800 resize-none transition-all placeholder:text-slate-400"
                            rows={3}
                            placeholder="Enter your text here..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Color</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color" 
                                  value={textSettings.color}
                                  onChange={(e) => setTextSettings({...textSettings, color: e.target.value})}
                                  className="h-9 w-full rounded cursor-pointer border border-slate-200"
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

            {/* 3. Output Settings & Action - GREEN/TEAL THEME */}
            <div className={`space-y-4 transition-all duration-500 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-4 pointer-events-none grayscale'}`}>
               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500 text-white text-sm shadow-md shadow-teal-200">3</span>
                Export Video
              </h2>
              
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                 <span className="text-sm font-semibold text-slate-700">Output Format</span>
                 <div className="flex gap-4">
                   <label className="flex items-center gap-2 cursor-pointer group">
                     <div className="relative flex items-center justify-center">
                       <input 
                          type="radio" 
                          name="format" 
                          value="mp4" 
                          checked={outputFormat === 'mp4'} 
                          onChange={() => setOutputFormat('mp4')}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border-2 border-slate-300 rounded-full peer-checked:border-teal-500 peer-checked:border-4 transition-all"></div>
                     </div>
                     <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">MP4</span>
                   </label>
                   
                   <label className="flex items-center gap-2 cursor-pointer group">
                     <div className="relative flex items-center justify-center">
                       <input 
                          type="radio" 
                          name="format" 
                          value="mov" 
                          checked={outputFormat === 'mov'} 
                          onChange={() => setOutputFormat('mov')}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border-2 border-slate-300 rounded-full peer-checked:border-teal-500 peer-checked:border-4 transition-all"></div>
                     </div>
                     <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">MOV</span>
                   </label>
                 </div>
              </div>

              <button
                onClick={startProcessing}
                disabled={!isReady}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform duration-200
                  ${isReady 
                    ? 'bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-pink-600 hover:to-yellow-600 text-white hover:-translate-y-1 shadow-orange-500/30' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                {appState === AppState.PROCESSING ? (
                   <span className="flex items-center gap-2">
                     <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                     Processing...
                   </span>
                ) : (
                   <>
                     <PlayIcon className="w-5 h-5" /> Start Rendering
                   </>
                )}
              </button>
            </div>

          </div>

          {/* Right Column: 9:16 Preview */}
          <div className="lg:col-span-7 flex flex-col items-center">
            
            <div className="w-full max-w-[420px] sticky top-8">
              <div className="flex justify-between items-center mb-4 px-1">
                 <h2 className="text-lg font-bold text-slate-800">Live Preview</h2>
                 <span className="text-xs font-bold tracking-wider text-slate-500 bg-slate-200 px-3 py-1 rounded-full">1080 × 1920</span>
              </div>

              {/* Phone Aspect Ratio Container (9:16) */}
              <div className="relative w-full aspect-[9/16] bg-slate-900 rounded-[3rem] overflow-hidden shadow-2xl border-[8px] border-slate-800 ring-1 ring-slate-900/5 group">
                
                {/* Empty State */}
                {!videoFile && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50">
                    <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-6">
                      <VideoIcon className="w-10 h-10" />
                    </div>
                    <p className="font-bold text-lg text-slate-700">No Video Selected</p>
                    <p className="text-sm mt-2 text-slate-500">Upload a video to see the vertical preview</p>
                  </div>
                )}

                {/* Video Content */}
                {videoFile && appState !== AppState.COMPLETED && (
                  <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
                    {/* Background Blur for "Fit" effect */}
                    <div className="absolute inset-0 opacity-40 blur-2xl transform scale-150">
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
                  <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-8">
                    <div className="w-full max-w-[200px] space-y-6 text-center">
                      {/* Rainbow Spinner */}
                      <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-pink-500 border-r-yellow-500 border-b-green-500 border-l-blue-500 animate-spin mx-auto"></div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                          <span>Rendering</span>
                          <span className="text-pink-600">{Math.round(progress)}%</span>
                        </div>
                        {/* Rainbow Progress Bar */}
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-pink-500 via-yellow-500 to-teal-500 transition-all duration-100 ease-out"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completed State */}
                {appState === AppState.COMPLETED && processedUrl && (
                  <div className="relative w-full h-full bg-white flex flex-col items-center justify-center gap-8 p-8 text-center z-40 animate-fadeIn">
                     <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-sm">
                       <CheckIcon className="w-12 h-12" />
                     </div>
                     
                     <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-slate-800">Success!</h3>
                        <p className="text-slate-500 text-sm px-4">Your video is ready.</p>
                     </div>
                     
                     {processingStats && (
                       <div className="w-full bg-slate-50 rounded-xl p-5 text-sm space-y-3 border border-slate-100">
                         <div className="flex justify-between"><span className="text-slate-500 font-medium">Output</span> <span className="text-slate-800 font-bold font-mono">1080x1920</span></div>
                         <div className="flex justify-between"><span className="text-slate-500 font-medium">Size</span> <span className="text-slate-800 font-bold font-mono">{processingStats.processedSize}</span></div>
                         <div className="flex justify-between"><span className="text-slate-500 font-medium">Format</span> <span className="text-slate-800 font-bold font-mono uppercase">{outputFormat}</span></div>
                       </div>
                     )}

                     <a 
                       href={processedUrl}
                       download={getDownloadName()}
                       className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 shadow-teal-500/20"
                     >
                       <DownloadIcon className="w-5 h-5" /> Download File
                     </a>
                     
                     <button
                        onClick={() => setAppState(AppState.IDLE)}
                        className="text-slate-400 hover:text-slate-600 text-sm font-medium py-2 transition-colors"
                     >
                        Create New Video
                     </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-6 w-full max-w-[420px] bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-fadeIn">
                <div className="p-2 bg-red-100 text-red-500 rounded-full">
                   <AlertIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-red-700">Error</h4>
                  <p className="text-sm text-red-600/80 mt-1">{error.message}</p>
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