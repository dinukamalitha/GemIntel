'use client';

import { Upload } from 'lucide-react';
import { useState, useRef } from 'react';

interface ImageUploaderProps {
  onAnalyze: (file?: File | null) => void;
  isAnalyzing: boolean;
  analysisStatus?: string | null;
  buttonText?: string;
}

export default function ImageUploader({ 
  onAnalyze, 
  isAnalyzing, 
  analysisStatus = null,
  buttonText = "Analyze Gem" 
}: ImageUploaderProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setSelectedFile(file);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {!imagePreview ? (
        <div 
          className="border-2 border-dashed border-violet-500/40 rounded-2xl py-8 px-4 sm:py-12 sm:px-8 text-center bg-violet-500/5 cursor-pointer transition-all duration-200 hover:bg-violet-500/10 hover:border-violet-500"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto mb-3 text-violet-400" />
          <p className="font-semibold text-base sm:text-lg">Upload Gemstone Image</p>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Drag & drop or click to browse
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            hidden 
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/40 aspect-square flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Gemstone Preview" className="w-full h-full object-cover block" />
            {!isAnalyzing && (
              <button 
                className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-red-600 text-white border-none rounded-full w-8 h-8 flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 z-10 font-bold" 
                onClick={clearImage}
              >
                ✕
              </button>
            )}
            
            {isAnalyzing && (
              <div className="absolute inset-0 bg-violet-500/20 pointer-events-none">
                <div className="w-full h-1 bg-gradient-to-r from-violet-500 to-cyan-500 absolute top-0 shadow-[0_0_10px_#8b5cf6,0_0_20px_#06b6d4] animate-scan"></div>
              </div>
            )}
          </div>
          {isAnalyzing && (
            <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-4 backdrop-blur-md shadow-2xl mt-2 animate-fade-in">
              <div className="w-6 h-6 border-2 border-white/10 rounded-full border-t-violet-500 animate-spin shrink-0"></div>
              <div className="flex flex-col gap-1 flex-grow">
                <div className="font-semibold text-sm text-violet-400">GemIntel Pipeline</div>
                <div className="text-xs text-gray-400 font-mono">{analysisStatus || 'Analyzing...'}</div>
              </div>
            </div>
          )}
          
          <button 
            className={`w-full max-w-sm py-3.5 sm:py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 text-sm sm:text-base ${
              !isAnalyzing
                ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 active:scale-95 cursor-pointer text-white"
                : "bg-white/5 opacity-40 cursor-not-allowed text-white/50"
            }`}
            onClick={() => onAnalyze(selectedFile)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "Analyzing..." : buttonText}
          </button>
        </div>
      )}
    </div>
  );
}
