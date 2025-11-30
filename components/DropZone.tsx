import React, { useRef, useState, useCallback } from 'react';
import { UploadIcon, XIcon } from './Icons';

interface DropZoneProps {
  accept: string;
  label: string;
  subLabel: string;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  icon: React.ReactNode;
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  accept, 
  label, 
  subLabel, 
  onFileSelect, 
  selectedFile, 
  onClear,
  icon
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (selectedFile) {
    return (
      <div className="relative group p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-4 shadow-sm hover:border-orange-300 transition-all">
        <div className="p-2 bg-orange-50 text-orange-500 rounded-lg">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{selectedFile.name}</p>
          <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="p-1.5 hover:bg-red-50 rounded-full text-slate-300 hover:text-red-500 transition-colors"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
        flex flex-col items-center justify-center text-center gap-3
        ${isDragging 
          ? 'border-orange-400 bg-orange-50' 
          : 'border-slate-300 bg-slate-50 hover:bg-orange-50/50 hover:border-orange-300'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleInputChange}
      />
      <div className={`p-3 rounded-full transition-colors ${isDragging ? 'bg-orange-100 text-orange-600' : 'bg-white text-orange-400 shadow-sm'}`}>
        <UploadIcon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-1">{subLabel}</p>
      </div>
    </div>
  );
};