'use client';

import { useState } from 'react';
import ImageUploader from '@/components/ImageUploader';

interface FeatureLayoutProps<T = unknown> {
  title: React.ReactNode;
  description: string;
  buttonText: string;
  mockDelay?: number;
  apiEndpoint?: string;
  gemType?: string;
  renderResult?: (result: T) => React.ReactNode;
  onSuccess?: (file: File, result: T) => void;
  customFooter?: (result: T, handleReset: () => void) => React.ReactNode;
  children?: React.ReactNode;
}

export default function FeatureLayout<T = unknown>({
  title,
  description,
  buttonText,
  mockDelay = 2500,
  apiEndpoint,
  gemType,
  renderResult,
  onSuccess,
  customFooter,
  children
}: FeatureLayoutProps<T>) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<T | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = () => {
    setResetKey(prev => prev + 1);
    setShowResult(false);
    setAnalysisResult(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
    setAnalysisStatus(null);
  };

  const handleAnalyze = async (file?: File | null) => {
    setErrorMessage(null);
    setShowResult(false);

    if (apiEndpoint) {
      if (!file) {
        setErrorMessage('Please upload a gemstone image before authenticating.');
        return;
      }

      setIsAnalyzing(true);

      // Step 1: Validation filter phase (Total 1.8s, rotating messages every 600ms)
      setAnalysisStatus('Scanning pixel grids for synthetic artifacts...');

      // Trigger API fetch in the background immediately
      const fetchPromise = (async () => {
        const endpoint = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'}${apiEndpoint}`;
        const formData = new FormData();
        formData.append('file', file);
        if (gemType) {
          formData.append('gem_type', gemType);
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });


        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.detail || response.statusText || 'Authentication request failed.');
        }

        return response.json();
      })();

      // Rotate messages with 600ms delays to enforce the 1.8s minimum validation time
      await new Promise(resolve => setTimeout(resolve, 600));
      setAnalysisStatus('Analyzing frequency spectrum distribution (FFT/DCT)...');

      await new Promise(resolve => setTimeout(resolve, 600));
      setAnalysisStatus('Running EfficientNet-B0 CNN validation filter...');

      await new Promise(resolve => setTimeout(resolve, 600));

      try {
        const result = await fetchPromise;

        if (result && result.score !== undefined) {
          console.log(`[Telemetry] Score: ${result.score}`);
        }

        if (result.status === 'invalid input') {
          setErrorMessage(result.message || 'The image entered is not a gem. Please input a valid gem image.');
          setIsAnalyzing(false);
          setAnalysisStatus(null);
          return;
        }

        const isAi = result.status === 'ai_generated' || result.filter_result?.is_ai_generated;

        if (isAi) {
          // If AI origin detected, validation fails - show results immediately
          setAnalysisResult(result);
          setShowResult(true);
          if (onSuccess && file) {
            onSuccess(file, result);
          }
        } else {
          // Step 2: Gemstone Authentication phase (Total 1.8s, rotating messages every 600ms)
          setAnalysisStatus('Initializing deep feature extractors...');
          await new Promise(resolve => setTimeout(resolve, 600));

          setAnalysisStatus('Evaluating inclusions (EfficientNet-B4 + XGBoost)...');
          await new Promise(resolve => setTimeout(resolve, 600));

          setAnalysisStatus('Finalizing origin classification payload...');
          await new Promise(resolve => setTimeout(resolve, 600));

          setAnalysisResult(result);
          setShowResult(true);
          if (onSuccess && file) {
            onSuccess(file, result);
          }
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsAnalyzing(false);
        setAnalysisStatus(null);
      }

      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus('Processing...');
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisStatus(null);
      setShowResult(true);
    }, mockDelay);
  };

  return (
    <div className="max-width-container pt-2 sm:pt-4 pb-16 sm:pb-20">
      <header className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-center mb-2 leading-tight px-2 text-white">
          {title}
        </h1>
        <p className="text-center text-sm sm:text-base opacity-60 max-w-2xl mx-auto px-4 text-gray-300">
          {description}
        </p>
      </header>

      <main className="flex flex-col gap-8 sm:gap-12 items-center w-full">
        {!showResult && (
          <div className="w-full max-w-xl flex flex-col items-center gap-6">
            {children}
            <ImageUploader
              key={resetKey}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              analysisStatus={analysisStatus}
              buttonText={buttonText}
            />
          </div>
        )}


        {errorMessage && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 flex flex-col items-center gap-4 text-center max-w-md">
            <span className="font-semibold text-sm">{errorMessage}</span>
            <button
              onClick={handleReset}
              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white py-1.5 px-5 rounded-lg cursor-pointer text-xs font-semibold transition"
            >
              Reset
            </button>
          </div>
        )}

        {showResult && (
          <div className="w-full glass-panel p-5 sm:p-8 flex flex-col gap-6 sm:gap-7 animate-fade-in max-w-3xl">
            {renderResult ? renderResult(analysisResult as T) : children}
            {customFooter ? (
              customFooter(analysisResult as T, handleReset)
            ) : (
              <button
                onClick={handleReset}
                className="btn-secondary w-full py-3.5 sm:py-4 text-sm sm:text-base mt-2"
              >
                Reset / Authenticate Another Gem
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
