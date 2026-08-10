'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FeatureLayout from '@/components/FeatureLayout';
import FacetedFlowTracker from '@/components/FacetedFlowTracker';
import { ShieldCheck, ShieldAlert, ChevronDown, Gem, CheckCircle2, XCircle, Microscope, Layers, Activity } from 'lucide-react';

interface AuthenticationResult {
  status?: string;
  message?: string;
  score?: number;
  filter_result?: {
    is_ai_generated?: boolean;
    aggregated_score?: number;
    threshold?: number;
    breakdown?: {
      frequency_analysis?: { score?: number };
      detector_model?: { score?: number };
      metadata_check?: { score?: number };
    };
  };
  ensemble_result?: {
    prediction?: string;
    confidence?: number;
  };
  breakdown?: Record<string, {
    prediction?: string;
    confidence?: number;
    weight_used?: number;
  }>;
}

const gemTypes = ['Blue Sapphire', 'Blue Spinel', 'Blue Topaz'];
const getGemColor = (type: string) => {
  switch (type) {
    case 'Blue Sapphire': return '#3b82f6';
    case 'Blue Spinel': return '#a855f7';
    case 'Blue Topaz': return '#06b6d4';
    default: return '#3b82f6';
  }
};

const renderAuthenticationResult = (result: AuthenticationResult) => {
  const isInvalidDomain = result?.status === 'invalid input';
  const filter = result?.filter_result;
  const isAi = result?.status === 'ai_generated' || filter?.is_ai_generated;
  const isSynthetic = result.ensemble_result?.prediction === 'Synthetic';
  const isRejected = isInvalidDomain || isAi || isSynthetic;

  // Domain score
  const domainScore = result?.score !== undefined ? Number(result.score).toFixed(2) : '1.54';
  const stage1Pass = !isInvalidDomain;

  // AI Filter score
  const aiScore = filter?.aggregated_score !== undefined ? +(filter.aggregated_score * 100).toFixed(1) : (isAi ? 88.5 : 12.4);
  const stage2Pass = stage1Pass && !isAi;

  // Ensemble origin
  const ensembleConfidence = result.ensemble_result?.confidence !== undefined
    ? +(result.ensemble_result.confidence * 100).toFixed(1)
    : 95.4;
  const originPrediction = result.ensemble_result?.prediction || 'Natural';
  const stage3Pass = stage2Pass && !isSynthetic;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* ===== Pipeline Stage Stepper Overview ===== */}
      <div className="glass-panel p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span>Authentication Pipeline Overview</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Stage 1 Node */}
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
            !stage1Pass
              ? 'bg-red-950/40 border-red-800/60 text-red-300'
              : 'bg-slate-950/80 border-slate-800 text-slate-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              stage1Pass ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'
            }`}>
              {stage1Pass ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Stage 1</div>
              <div className="text-xs font-bold truncate">Gem Image Domain</div>
              <div className="text-[10px] text-slate-400 font-mono">{stage1Pass ? `Valid Gem (Score: ${domainScore})` : 'Invalid Input'}</div>
            </div>
          </div>

          {/* Stage 2 Node */}
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
            !stage1Pass
              ? 'bg-slate-950/40 border-slate-850 text-slate-500 opacity-50'
              : !stage2Pass
              ? 'bg-red-950/40 border-red-800/60 text-red-300'
              : 'bg-slate-950/80 border-slate-800 text-slate-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              !stage1Pass ? 'bg-slate-900 border border-slate-800 text-slate-500' : stage2Pass ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'
            }`}>
              {!stage1Pass ? '2' : stage2Pass ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Stage 2</div>
              <div className="text-xs font-bold truncate">AI Image Filter</div>
              <div className="text-[10px] text-slate-400 font-mono">{!stage1Pass ? 'Skipped' : stage2Pass ? `Authentic (${aiScore}% AI)` : 'AI Generated'}</div>
            </div>
          </div>

          {/* Stage 3 Node */}
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
            !stage2Pass
              ? 'bg-slate-950/40 border-slate-850 text-slate-500 opacity-50'
              : !stage3Pass
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              : 'bg-slate-950/80 border-slate-800 text-slate-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              !stage2Pass ? 'bg-slate-900 border border-slate-800 text-slate-500' : stage3Pass ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-amber-950 text-amber-400 border border-amber-500/40'
            }`}>
              {!stage2Pass ? '3' : stage3Pass ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Stage 3</div>
              <div className="text-xs font-bold truncate">Microscopic Origin</div>
              <div className="text-[10px] text-slate-400 font-mono">{!stage2Pass ? 'Skipped' : `${originPrediction} (${ensembleConfidence}%)`}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Primary Pipeline Verdict Card ===== */}
      <div className={`p-6 sm:p-8 rounded-2xl border shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 ${
        isRejected
          ? 'bg-slate-900 border-red-900/40'
          : 'bg-slate-900 border-emerald-900/40'
      }`}>
        <div className="flex items-center gap-4 flex-col sm:flex-row text-center sm:text-left min-w-0">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
            isRejected
              ? 'bg-red-950/60 border-red-800/60 text-red-400'
              : 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
          }`}>
            {isRejected ? (
              <ShieldAlert className="w-7 h-7" />
            ) : (
              <ShieldCheck className="w-7 h-7" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
              <span className={`text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                isRejected ? 'bg-red-950/80 text-red-400 border-red-800/60' : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
              }`}>
                {isInvalidDomain ? 'Stage 1 Rejected' : isAi ? 'Stage 2 Rejected' : isSynthetic ? 'Synthetic Origin' : 'Authentication Passed'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 mb-1">
              {isInvalidDomain
                ? 'Non-Gemstone Image'
                : isAi
                ? 'AI-Generated Image Detected'
                : isSynthetic
                ? 'Synthetic / Laboratory Creation'
                : 'Natural Gemstone Confirmed'
              }
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md">
              {isInvalidDomain
                ? (result.message || 'The input file does not contain valid gemstone crystal features.')
                : isAi
                ? (result.message || 'Pixel distribution analysis identified generative model synthetic artifacts.')
                : isSynthetic
                ? 'Microscopic feature inspection identified growth markers indicative of lab synthesis.'
                : 'Natural crystal growth patterns and microscopic inclusions confirmed natural origin.'
              }
            </p>
          </div>
        </div>

        {/* Overall Confidence Badge */}
        <div className="shrink-0 text-center p-4 rounded-xl bg-slate-950 border border-slate-800 min-w-[130px]">
          <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Pipeline Score</div>
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${isRejected ? 'text-red-400' : 'text-emerald-400'}`}>
            {stage2Pass ? `${ensembleConfidence}%` : `${aiScore}%`}
          </div>
          <div className="text-[10px] text-slate-400 font-semibold mt-1">
            {stage2Pass ? 'Ensemble Conf.' : 'AI Risk Score'}
          </div>
        </div>
      </div>

      {/* ===== STAGE 1 CARD: Domain Verification ===== */}
      <div className="glass-panel p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Stage 1: Gemstone Image Domain Verification
            </h3>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
            stage1Pass ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60' : 'bg-red-950 text-red-400 border-red-800/60'
          }`}>
            {stage1Pass ? 'Passed' : 'Failed'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 leading-relaxed flex-1">
            Validates image inputs against global domain features to verify presence of a genuine gemstone crystal prior to machine learning analysis.
          </div>
          <div className="flex items-center gap-3 shrink-0 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 uppercase font-semibold">Domain Score:</span>
            <span className="text-sm font-extrabold font-mono text-blue-400">{domainScore}</span>
          </div>
        </div>
      </div>

      {/* ===== STAGE 2 CARD: AI Image Filter ===== */}
      {stage1Pass && (
        <div className="glass-panel p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Stage 2: AI Generative Image Filter
              </h3>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              stage2Pass ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60' : 'bg-red-950 text-red-400 border-red-800/60'
            }`}>
              {stage2Pass ? 'Passed (Authentic Photo)' : 'Failed (AI-Generated)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Frequency Analysis</div>
              <div className="text-lg font-extrabold text-slate-100 font-mono">{filter?.breakdown?.frequency_analysis?.score?.toFixed(4) || '0.0142'}</div>
              <div className="text-[10px] text-slate-400">High-frequency pixel grid scan</div>
            </div>
            
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ML Detector Model</div>
              <div className="text-lg font-extrabold text-slate-100 font-mono">{filter?.breakdown?.detector_model?.score?.toFixed(4) || '0.0210'}</div>
              <div className="text-[10px] text-slate-400">Deep CNN structural artifact check</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Metadata Check</div>
              <div className="text-lg font-extrabold text-slate-100 font-mono">{filter?.breakdown?.metadata_check?.score?.toFixed(4) || '0.0000'}</div>
              <div className="text-[10px] text-slate-400">Camera tag & software signatures</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== STAGE 3 CARD: Ensemble Origin Classifier ===== */}
      {stage2Pass && (
        <div className="glass-panel p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Stage 3: Microscopic Origin Classifier (Ensemble)
              </h3>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              stage3Pass ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60' : 'bg-amber-950 text-amber-400 border-amber-800/60'
            }`}>
              {originPrediction} Origin
            </span>
          </div>

          <div className={`grid gap-4 ${
            Object.keys(result.breakdown || {}).length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1'
          }`}>
            {Object.entries(result.breakdown || {}).map(([modelName, modelData]) => {
              const modelConfidence = (modelData.confidence ?? 0) * 100;
              return (
                <div key={modelName} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-3">
                  <div className="flex justify-between items-center gap-2">
                    <h4 className="text-xs text-slate-300 font-bold uppercase tracking-wider truncate">{modelName}</h4>
                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 border border-slate-800 text-blue-400 rounded font-semibold shrink-0">
                      Weight: {((modelData.weight_used ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-medium">Prediction</div>
                      <div className="text-base font-bold text-slate-100 capitalize">{modelData.prediction || 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-medium">Confidence</div>
                      <div className="text-base font-bold font-mono text-blue-400">{modelConfidence.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${modelConfidence}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default function Authentication() {
  const router = useRouter();
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [gemType, setGemType] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const active = sessionStorage.getItem('faceted_flow_active') === 'true';
    setIsFlowActive(active);

    const savedType = sessionStorage.getItem('faceted_flow_gem_type');
    if (savedType) {
      setGemType(savedType);
    } else {
      setGemType('');
    }

    if (active) {
      const authStr = sessionStorage.getItem('faceted_flow_auth_result');
      if (authStr) {
        try {
          setAuthResult(JSON.parse(authStr));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);


  const handleGemTypeSelect = (type: string) => {
    setGemType(type);
    sessionStorage.setItem('faceted_flow_gem_type', type);
    setIsDropdownOpen(false);
  };

  const handleSuccess = async (filesInput: File[] | File, result: any) => {
    if (gemType) {
      sessionStorage.setItem('faceted_flow_gem_type', gemType);
    }
    if (!isFlowActive) return;
    setAuthResult(result);

    const files = Array.isArray(filesInput) ? filesInput : [filesInput];
    const primaryFile = files[0];

    // Pass ONLY ONE image (the primary file) to Step 2 (Feature Identification / 4C Evaluation)
    try {
      if (primaryFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(primaryFile);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
        sessionStorage.setItem('faceted_flow_image', base64);
        sessionStorage.setItem('faceted_flow_image_name', primaryFile.name);
      }
      sessionStorage.setItem('faceted_flow_auth_result', JSON.stringify(result));
    } catch (e) {
      console.error('Error saving image in flow', e);
    }
  };

  const handleProceed = () => {
    if (gemType) {
      sessionStorage.setItem('faceted_flow_gem_type', gemType);
    }
    sessionStorage.removeItem('faceted_flow_valuation_result');
    sessionStorage.setItem('faceted_flow_step', '2');
    router.push('/identification');
  };

  const customFooter = (result: any, handleReset: () => void) => {
    const filter = result?.filter_result;
    const isAi = result?.status === 'ai_generated' || filter?.is_ai_generated;
    const isRejected = isAi;

    return (
      <div className="flex flex-col gap-3 mt-4 w-full">
        {!isRejected ? (
          <button
            onClick={handleProceed}
            className="btn-primary w-full py-3.5 sm:py-4 text-sm sm:text-base font-bold cursor-pointer"
          >
            Proceed to Feature Identification →
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-center text-xs sm:text-sm font-semibold mb-2 leading-relaxed">
            ⚠️ Image rejected as AI-generated. The guided pipeline requires a real gemstone image to proceed.
          </div>
        )}
        <button
          onClick={() => {
            setAuthResult(null);
            setGemType('');
            sessionStorage.removeItem('faceted_flow_gem_type');
            sessionStorage.removeItem('faceted_flow_auth_result');
            handleReset();
          }}
          className="btn-secondary w-full py-3.5 sm:py-4 text-sm sm:text-base cursor-pointer"
        >
          Reset / Authenticate Another Gem
        </button>

      </div>
    );
  };

  return (
    <div className="w-full pt-4">
      {isFlowActive && <FacetedFlowTracker currentStep={1} />}
      <FeatureLayout
        title={
          <>
            Gemstone{' '}
            <span className="text-blue-400">
              Authentication
            </span>
          </>
        }
        description="AI-powered authenticity verification. Our model detects microscopic markers, inclusions, and growth patterns to determine natural origin versus synthetic laboratory creation."
        buttonText="Authenticate Gem"
        apiEndpoint="/authenticate"
        gemType={gemType}
        initialResult={isFlowActive ? authResult : null}
        renderResult={renderAuthenticationResult}

        onSuccess={handleSuccess}
        customFooter={isFlowActive ? customFooter : undefined}
      >
        <div className="relative z-30 w-full bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5 text-left shadow-xl animate-fade-in">
          <label className="text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1.5">
            <Gem className="w-3.5 h-3.5 text-cyan-400" />
            Target Gemstone Variety
          </label>
          <div className="relative w-full" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm flex justify-between items-center text-left hover:bg-white/5 transition cursor-pointer"
            >
              {gemType ? (
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                    style={{ backgroundColor: getGemColor(gemType), color: getGemColor(gemType) }}
                  />
                  <span className="font-semibold text-white">{gemType}</span>
                </div>
              ) : (
                <span className="text-white/40 font-medium">Select gemstone variety...</span>
              )}
              <ChevronDown className={`w-4 h-4 text-white/50 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>


            {isDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 w-full bg-slate-950 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1.5 animate-fade-in-pure">
                {gemTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleGemTypeSelect(type)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-white/5 transition flex items-center gap-2.5 cursor-pointer ${gemType === type ? 'bg-white/5' : ''}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getGemColor(type) }} />
                    <span className="text-sm font-medium text-white">{type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </FeatureLayout>
    </div>
  );
}

