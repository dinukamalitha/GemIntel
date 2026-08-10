'use client';

import { useState, useEffect } from 'react';
import ImageUploader from '@/components/ImageUploader';
import AuthPipelineModal, { StageState } from '@/components/AuthPipelineModal';

interface FeatureLayoutProps<T = unknown> {
  title: React.ReactNode;
  description: string;
  buttonText: string;
  mockDelay?: number;
  apiEndpoint?: string;
  gemType?: string;
  initialResult?: T | null;
  renderResult?: (result: T) => React.ReactNode;
  onSuccess?: (files: File[] | File, result: T) => void;
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
  initialResult,
  renderResult,
  onSuccess,
  customFooter,
  children
}: FeatureLayoutProps<T>) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [showResult, setShowResult] = useState<boolean>(Boolean(initialResult));
  const [analysisResult, setAnalysisResult] = useState<T | null>(initialResult || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (initialResult) {
      setAnalysisResult(initialResult);
      setShowResult(true);
    }
  }, [initialResult]);

  // Live stage tracking state
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [stageStatuses, setStageStatuses] = useState<{
    stage1: StageState;
    stage2: StageState;
    stage3: StageState;
  }>({
    stage1: 'pending',
    stage2: 'pending',
    stage3: 'pending',
  });

  const handleReset = () => {
    setResetKey(prev => prev + 1);
    setShowResult(false);
    setAnalysisResult(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
    setAnalysisStatus(null);
    setCurrentStage(1);
    setStageStatuses({ stage1: 'pending', stage2: 'pending', stage3: 'pending' });
  };

  const handleAnalyze = async (filesInput?: File[] | File | null) => {
    setErrorMessage(null);
    setShowResult(false);

    if (apiEndpoint) {
      const fileList = Array.isArray(filesInput)
        ? filesInput
        : filesInput
        ? [filesInput]
        : [];

      if (fileList.length === 0) {
        setErrorMessage('Please upload gemstone image(s) before authenticating.');
        return;
      }

      setIsAnalyzing(true);
      setCurrentStage(1);
      setStageStatuses({ stage1: 'processing', stage2: 'pending', stage3: 'pending' });
      setAnalysisStatus('Stage 1: Validating gemstone image domain features...');

      // Trigger API fetch in the background
      const fetchPromise = (async () => {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        const endpoint = `${baseUrl}${apiEndpoint}`;
        const formData = new FormData();
        fileList.forEach((f) => formData.append('files', f));
        if (fileList.length > 0) {
          formData.append('file', fileList[0]);
        }
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

      // Stage 1 visual step delay
      await new Promise(resolve => setTimeout(resolve, 700));

      try {
        const result = await fetchPromise;

        if (result && result.score !== undefined) {
          console.log(`[Telemetry] Score: ${result.score}`);
        }

        if (result.status === 'invalid input') {
          setStageStatuses({ stage1: 'error', stage2: 'pending', stage3: 'pending' });
          await new Promise(resolve => setTimeout(resolve, 500));
          setErrorMessage(result.message || 'The image entered is not a gem. Please input a valid gem image.');
          setIsAnalyzing(false);
          setAnalysisStatus(null);
          return;
        }

        // Stage 1 passed, move to Stage 2
        setStageStatuses({ stage1: 'done', stage2: 'processing', stage3: 'pending' });
        setCurrentStage(2);
        setAnalysisStatus('Stage 2: Scanning pixel frequency spectrum (FFT/DCT)...');
        await new Promise(resolve => setTimeout(resolve, 600));

        setAnalysisStatus('Stage 2: Evaluating CNN detector model & camera metadata...');
        await new Promise(resolve => setTimeout(resolve, 600));

        const isAi = result.status === 'ai_generated' || result.filter_result?.is_ai_generated;

        if (isAi) {
          setStageStatuses({ stage1: 'done', stage2: 'error', stage3: 'pending' });
          await new Promise(resolve => setTimeout(resolve, 500));
          setAnalysisResult(result);
          setShowResult(true);
          if (onSuccess) {
            onSuccess(fileList, result);
          }
        } else {
          // Stage 2 passed, move to Stage 3
          setStageStatuses({ stage1: 'done', stage2: 'done', stage3: 'processing' });
          setCurrentStage(3);
          setAnalysisStatus('Stage 3: Extracting inclusion features (EfficientNet-B4 + XGBoost)...');
          await new Promise(resolve => setTimeout(resolve, 700));

          setAnalysisStatus('Stage 3: Finalizing ensemble origin probability...');
          await new Promise(resolve => setTimeout(resolve, 700));

          setStageStatuses({ stage1: 'done', stage2: 'done', stage3: 'done' });
          await new Promise(resolve => setTimeout(resolve, 400));

          setAnalysisResult(result);
          setShowResult(true);
          if (onSuccess) {
            onSuccess(fileList, result);
          }
        }
      } catch (error) {
        setStageStatuses({ stage1: 'error', stage2: 'error', stage3: 'error' });
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

            {isAnalyzing && apiEndpoint === '/authenticate' && (
              <AuthPipelineModal
                isOpen={isAnalyzing}
                currentStage={currentStage}
                stageStatuses={stageStatuses}
                statusMessage={analysisStatus}
                error={errorMessage}
                onCancel={() => {
                  setIsAnalyzing(false);
                  setAnalysisStatus(null);
                }}
              />
            )}
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
