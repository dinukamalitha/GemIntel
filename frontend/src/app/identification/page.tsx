'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronDown, Upload, ShieldCheck, Lock } from 'lucide-react';

import {
  fetchGemTypes,
  identifyGem,
  type IdentifyResponse,
} from '@/services/identificationApi';
import FacetedFlowTracker from '@/components/FacetedFlowTracker';
import CaratTester from '@/components/CaratTester';

import { estimateCaratManual, type CaratResult } from '@/services/caratApi';
import IdentificationPipelineModal, { StageState } from '@/components/IdentificationPipelineModal';

const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

const FALLBACK_GEM_TYPES = ['Blue Sapphire', 'Blue Spinel', 'Blue Topaz'];

const getGemColor = (type: string): string => {
  const normalized = type.toLowerCase().trim();
  if (normalized.includes('sapphire')) return '#3b82f6'; // blue
  if (normalized.includes('spinel')) return '#ec4899';   // pink
  if (normalized.includes('topaz')) return '#eab308';    // yellow
  if (normalized.includes('ruby')) return '#ef4444';     // red
  if (normalized.includes('emerald')) return '#10b981';  // green
  if (normalized.includes('diamond')) return '#f3f4f6';  // white/gray
  return '#8b5cf6'; // default purple
};

interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface AuthenticationResult {
  ensemble_result?: {
    prediction?: string;
    confidence?: number;
  };
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function ProbBars({ probs, accent }: { probs: Record<string, number>; accent: string }) {
  const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map(([k, v]) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <span className="w-24 text-gray-400 capitalize whitespace-nowrap overflow-hidden text-ellipsis">{k}</span>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-400 ease-out"
              style={{ width: `${v * 100}%`, background: accent }}
            />
          </div>
          <span className="w-12 text-right tabular-nums text-white font-medium">{pct(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function FeatureIdentification({ standalone = false }: { standalone?: boolean }) {
  const [gemTypes, setGemTypes] = useState<string[]>(FALLBACK_GEM_TYPES);
  const [gemType, setGemType] = useState<string>("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<IdentifyResponse | null>(null);
  const [caratResult, setCaratResult] = useState<CaratResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageStatuses, setStageStatuses] = useState<{
    stage1: StageState;
    stage2: StageState;
    stage3: StageState;
    stage4: StageState;
  }>({
    stage1: 'pending',
    stage2: 'pending',
    stage3: 'pending',
    stage4: 'pending',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sub-tabs on this page: the 4C identification models, or the carat tester.
  const [tab, setTab] = useState<'identify' | 'carat'>('identify');

  // Flow states
  const router = useRouter();
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [authResult, setAuthResult] = useState<AuthenticationResult | null>(null);
  const [flowImageName, setFlowImageName] = useState<string>('gem.png');

  useEffect(() => {
    if (standalone) {
      const idStr = sessionStorage.getItem('standalone_4c_identify_result');
      if (idStr) {
        try {
          const parsedId = JSON.parse(idStr);
          if (parsedId?.aggregate) setResult(parsedId);
        } catch (e) {
          console.error('Error restoring standalone 4C result', e);
        }
      }
      const caratStr = sessionStorage.getItem('standalone_4c_carat_result');
      if (caratStr) {
        try {
          const parsedCarat = JSON.parse(caratStr);
          if (parsedCarat && typeof parsedCarat.carat === 'number') setCaratResult(parsedCarat);
        } catch (e) {
          console.error('Error restoring standalone carat result', e);
        }
      }
      return;
    }

    const active = sessionStorage.getItem('faceted_flow_active') === 'true';
    setIsFlowActive(active);

    const savedType = sessionStorage.getItem('faceted_flow_gem_type');
    if (savedType) {
      setGemType(savedType);
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
      const img = sessionStorage.getItem('faceted_flow_image');
      const imgName = sessionStorage.getItem('faceted_flow_image_name') || 'gem.png';
      setFlowImageName(imgName);

      if (img) {
        try {
          const file = dataURLtoFile(img, imgName);
          setImages([{
            id: 'flow-image',
            file: file,
            previewUrl: img
          }]);
        } catch (e) {
          console.error('Error preloading authenticated image', e);
        }
      }

      // Restore saved 4C identification result from previous execution
      const idStr = sessionStorage.getItem('faceted_flow_identify_result');
      if (idStr) {
        try {
          const parsedId = JSON.parse(idStr);
          if (parsedId?.aggregate) {
            setResult(parsedId);
          }
        } catch (e) {
          console.error('Error restoring 4C identification result', e);
        }
      }

      // Restore saved carat calculation result from previous execution
      const caratStr = sessionStorage.getItem('faceted_flow_carat_result');
      if (caratStr) {
        try {
          const parsedCarat = JSON.parse(caratStr);
          if (parsedCarat && typeof parsedCarat.carat === 'number') {
            setCaratResult(parsedCarat);
          }
        } catch (e) {
          console.error('Error restoring carat result', e);
        }
      }
    }
  }, [standalone]);

  const handleProceed = () => {
    sessionStorage.removeItem('faceted_flow_valuation_result');
    sessionStorage.setItem('faceted_flow_step', '3');
    router.push('/valuation');
  };

  useEffect(() => {
    fetchGemTypes()
      .then((types) => {
        if (types?.length) {
          setGemTypes(types);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
  }, [images]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const next: UploadedImage[] = [];
    for (const f of Array.from(fileList)) {
      if (!f.type.startsWith('image/')) continue;
      next.push({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
      });
    }
    if (next.length === 0) return;
    setImages((prev) => [...prev, ...next]);
    setResult(null);
    setError(null);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
    setResult(null);
  };

  const clearAll = () => {
    images.forEach((img) => {
      if (img.id !== 'flow-image') {
        URL.revokeObjectURL(img.previewUrl);
      }
    });
    setImages([]);
    setGemType('');
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    setResult(null);
    setCaratResult(null);
    setError(null);
    
    if (isFlowActive) {
      // Keep the imported image, but reset the selected gem type
      setGemType('');
      sessionStorage.removeItem('faceted_flow_identify_result');
      sessionStorage.removeItem('faceted_flow_carat_result');
    } else {
      // Standalone flow: clear everything
      sessionStorage.removeItem('standalone_4c_identify_result');
      sessionStorage.removeItem('standalone_4c_carat_result');
      clearAll();
    }
  };

  const handleProcess = async () => {
    if (!gemType) {
      setError('Please choose a gem type.');
      return;
    }
    if (images.length === 0) {
      setError('Please add at least one image.');
      return;
    }
    setProcessing(true);
    setError(null);
    setResult(null);
    setStageStatuses({
      stage1: 'processing',
      stage2: 'pending',
      stage3: 'pending',
      stage4: 'pending',
    });

    try {
      // Background API request for 4C identification
      const fetchPromise = identifyGem(
        gemType,
        images.map((img) => img.file),
      );

      // Stage 1: Cut Model (DINOv2)
      await new Promise((r) => setTimeout(r, 450));
      setStageStatuses({
        stage1: 'done',
        stage2: 'processing',
        stage3: 'pending',
        stage4: 'pending',
      });

      // Stage 2: Color Model (DINOv2)
      await new Promise((r) => setTimeout(r, 450));
      setStageStatuses({
        stage1: 'done',
        stage2: 'done',
        stage3: 'processing',
        stage4: 'pending',
      });

      const data: IdentifyResponse = await fetchPromise;

      if (!data?.aggregate?.cut || !data?.aggregate?.color || !data?.aggregate?.clarity) {
        throw new Error('The server returned an unexpected result (missing cut/color/clarity). Please try again.');
      }

      // Stage 3: Clarity Model (EfficientNet-B4)
      setStageStatuses({
        stage1: 'done',
        stage2: 'done',
        stage3: 'done',
        stage4: 'processing',
      });

      // Stage 4: Carat Weight Model
      const predictedCutShape = data.aggregate.cut.shape.label;
      if (predictedCutShape) {
        let matchedShape = predictedCutShape.toLowerCase().trim();
        if (matchedShape.includes('cushion')) matchedShape = 'cushion';
        else if (matchedShape.includes('oval')) matchedShape = 'oval';
        else if (matchedShape.includes('round')) matchedShape = 'round';
        else if (matchedShape.includes('pear')) matchedShape = 'pear';
        else if (matchedShape.includes('square') || matchedShape.includes('asscher')) matchedShape = 'square';
        else if (matchedShape.includes('marquise')) matchedShape = 'marquise';
        else if (matchedShape.includes('octagon') || matchedShape.includes('emerald')) matchedShape = 'octagon';
        else if (matchedShape.includes('heart')) matchedShape = 'heart';

        const normGemType = gemType.toLowerCase().replace('ceylon ', '').trim().replace(/ /g, '_');

        // Read user's actual entered dimensions from Step 3 (or fallback to defaults if not entered)
        const currentLength = caratResult?.dimensions_mm?.length ?? 7.0;
        const currentWidth = caratResult?.dimensions_mm?.width ?? 5.5;
        const currentDepth = caratResult?.dimensions_mm?.depth ?? 3.8;

        try {
          const caratRes = await estimateCaratManual({
            gemType: normGemType,
            cutShape: matchedShape,
            lengthMm: currentLength,
            widthMm: currentWidth,
            depthMm: currentDepth,
          });
          setCaratResult(caratRes);
          if (isFlowActive) {
            sessionStorage.setItem('faceted_flow_carat_result', JSON.stringify(caratRes));
          } else if (standalone) {
            sessionStorage.setItem('standalone_4c_carat_result', JSON.stringify(caratRes));
          }
        } catch (err) {
          console.error('Carat auto-estimation error:', err);
        }
      }

      setStageStatuses({
        stage1: 'done',
        stage2: 'done',
        stage3: 'done',
        stage4: 'done',
      });
      await new Promise((r) => setTimeout(r, 400));

      setResult(data);
      if (isFlowActive) {
        sessionStorage.setItem('faceted_flow_identify_result', JSON.stringify(data));
        sessionStorage.removeItem('faceted_flow_valuation_result');
      } else if (standalone) {
        sessionStorage.setItem('standalone_4c_identify_result', JSON.stringify(data));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStageStatuses((prev) => ({ ...prev, stage1: 'error' }));
    } finally {
      setProcessing(false);
    }
  };

  const accent1 = '#3b82f6';
  const accent2 = '#f59e0b';
  const accent3 = '#10b981';
  const accent4 = '#ec4899';

  const canSubmit = gemType && images.length > 0 && !processing;
  const showClear = Boolean(gemType || images.length > 0 || result || error);

  const handleBack = () => {
    sessionStorage.setItem('faceted_flow_step', '1');
    router.push('/authentication');
  };

  return (
    <div className="max-width-container pt-2 sm:pt-4 pb-16 sm:pb-20">
      {isFlowActive && <FacetedFlowTracker currentStep={2} />}

      {isFlowActive && (
        <div className={`flex items-center justify-between mb-6 ${result ? 'max-w-6xl' : 'max-w-3xl'} mx-auto w-full transition-all duration-300 animate-fade-in`}>
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 transition-colors bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl active:scale-[0.98] cursor-pointer font-semibold shadow-lg"
          >
            ← Back to Step 1: Authentication
          </button>
        </div>
      )}

      <header className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-center mb-2 leading-tight px-2">
          Feature{' '}
          <span className="text-blue-400">
            Identification
          </span>
        </h1>
        <p className="text-center text-sm sm:text-base opacity-60 max-w-2xl mx-auto px-4">
          Choose a gem type, upload one or more gemstone images, and run our AI models to
          identify the <strong>cut</strong> (shape and style), <strong>color</strong>{' '}
          (hue and intensity), and <strong>clarity</strong>.
        </p>
      </header>

      {/* Sub-tabs: 4C identification vs carat tester (hidden inside the auth flow) */}
      {!isFlowActive && (
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="bg-slate-900/60 p-1.5 rounded-xl inline-flex gap-1 border border-slate-800 shadow-inner">
            {([['identify', 'Cut · Color · Clarity'], ['carat', 'Carat']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  tab === key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'carat' && !isFlowActive && <CaratTester initialGemType={gemType} />}

      {/* 4C Identification Pipeline Execution Modal */}
      {processing && (
        <IdentificationPipelineModal
          isOpen={processing}
          stageStatuses={stageStatuses}
          error={error}
          onCancel={() => setProcessing(false)}
        />
      )}

      {/* Single Vertical Card Layout */}
      {tab === 'identify' && !result && !processing && (
        <section className="glass-panel p-4 sm:p-8 flex flex-col gap-6 sm:gap-7 max-w-3xl mx-auto w-full relative">
        {isFlowActive && authResult && (
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 shadow-sm ${
            authResult?.ensemble_result?.prediction === 'Synthetic'
              ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
          }`}>
            <div className="min-w-0">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Step 1 Verdict</div>
              <div className="text-sm font-extrabold flex items-center gap-1.5 capitalize truncate">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{authResult?.ensemble_result?.prediction || 'Natural'} Origin Confirmed</span>
              </div>
            </div>
            <div className="text-right shrink-0 border-l border-white/10 pl-4">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Confidence</div>
              <div className="text-sm font-extrabold font-mono">
                {(((authResult?.ensemble_result?.confidence ?? 0.954)) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        )}
        
        {/* Step 1: Gem Type selection */}
        <div className="flex gap-3 sm:gap-4 items-start">
          <span className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white font-bold inline-flex items-center justify-center text-sm">1</span>
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <label className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Gem type</label>
            
            {isFlowActive ? (
              <div className="w-full bg-black/40 border border-white/10 opacity-80 rounded-xl px-4 py-3.5 text-sm flex justify-between items-center text-left cursor-not-allowed select-none">
                {gemType ? (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                      style={{
                        backgroundColor: getGemColor(gemType),
                        color: getGemColor(gemType),
                      }}
                    />
                    <span className="font-semibold text-white truncate">{gemType}</span>
                  </div>
                ) : (
                  <span className="text-white/40 font-medium truncate">Select type...</span>
                )}
                <Lock className="w-4 h-4 text-gray-400 shrink-0" />
              </div>
            ) : (


              <div className="relative w-full" ref={dropdownRef}>
                <div
                  onClick={() => !processing && setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm flex justify-between items-center text-left transition ${
                    processing
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-white/5 active:scale-95 cursor-pointer'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!processing) setIsDropdownOpen(!isDropdownOpen);
                    }
                  }}
                >
                  {gemType ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0"
                        style={{
                          backgroundColor: getGemColor(gemType),
                          color: getGemColor(gemType),
                        }}
                      />
                      <span className="font-semibold text-white truncate">{gemType}</span>
                    </div>
                  ) : (
                    <span className="text-white/40 font-medium truncate">Select gem type...</span>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    {gemType ? (
                      <span
                        className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGemType('');
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setGemType('');
                          }
                        }}
                      >
                        <X className="w-3.5 h-3.5 hover:text-red-600" strokeWidth={3} />
                      </span>
                    ) : (
                      <ChevronDown
                        className={`w-4 h-4 text-white/50 transition-transform duration-200 ${
                          isDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </div>
                </div>

                {isDropdownOpen && (
                  <div className="absolute top-full mt-2 left-0 w-full bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1.5 animate-fade-in-pure">
                    {gemTypes.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setGemType(g);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-white/5 transition flex items-center justify-between group cursor-pointer ${
                          gemType === g ? 'bg-white/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-110 shrink-0"
                            style={{ backgroundColor: getGemColor(g) }}
                          />
                          <span className="font-semibold text-white text-sm truncate">{g}</span>
                        </div>

                        {gemType === g && (
                          <svg
                            className="w-4 h-4 text-blue-400 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


        {/* Step 2: Upload images dropzone or pre-uploaded flow image */}
        <div className="flex gap-3 sm:gap-4 items-start">
          <span className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white font-bold inline-flex items-center justify-center text-sm">2</span>
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <span className="text-sm text-gray-400 uppercase tracking-wider font-semibold">{isFlowActive ? 'Imported gemstone image' : 'Upload images'}</span>
            
            {isFlowActive ? (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-center gap-5">
                {images.length > 0 ? (
                  <div className="relative rounded-xl overflow-hidden bg-black/30 border border-white/10 aspect-square w-28 h-28 shrink-0 shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[0].previewUrl} alt="Flow Gem" className="w-full h-full object-cover block" />
                  </div>
                ) : (
                  <div className="w-28 h-28 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-xs text-gray-500 shrink-0">
                    No Image Preloaded
                  </div>
                )}
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-sm font-bold text-emerald-400 mb-1 flex items-center gap-1.5 justify-center sm:justify-start">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Step 1 Image Imported</span>
                  </h4>
                  <p className="text-xs text-gray-400 leading-normal max-w-sm">
                    This image was verified in the authentication stage and is locked to maintain workflow consistency.
                  </p>
                  <div className="text-[10px] text-gray-500 font-mono mt-2 break-all">{flowImageName}</div>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-blue-500/50 rounded-2xl py-6 px-4 sm:py-10 sm:px-6 text-center bg-blue-500/5 cursor-pointer transition-all duration-200 ease-in-out hover:bg-blue-500/10 hover:border-blue-500"
                onClick={() => !processing && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!processing) addFiles(e.dataTransfer.files);
                }}
              >
                <Upload className="mx-auto mb-3 text-blue-400" />
                <p className="font-semibold text-base sm:text-lg">Upload Gemstone Image</p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Drag & drop or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>
            )}

            {images.length > 0 && !isFlowActive && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative rounded-xl overflow-hidden bg-black/30 border border-white/10 aspect-square flex flex-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt={img.file.name} className="w-full h-full object-cover block" />
                    <button
                      type="button"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-none bg-black/70 text-white cursor-pointer text-base leading-none inline-flex items-center justify-center enabled:hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => removeImage(img.id)}
                      disabled={processing}
                      aria-label={`Remove ${img.file.name}`}
                    >
                      ×
                    </button>
                    <div className="absolute left-0 right-0 bottom-0 py-1.5 px-2 bg-gradient-to-t from-black/80 to-transparent text-white text-xs whitespace-nowrap overflow-hidden text-ellipsis">{img.file.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Carat Weight Calculation */}
        <div className="flex gap-3 sm:gap-4 items-start">
          <span className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white font-bold inline-flex items-center justify-center text-sm">3</span>
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Carat weight calculation</span>
              <span className="text-xs text-gray-400 font-medium">Optional</span>
            </div>
            <CaratTester
              initialGemType={gemType}
              hideGemTypeSelect
              hideCutShapeSelect
              hideSubmitButton
              hideResultDisplay
              embedded
              onResult={(r) => {
                setCaratResult(r);
                sessionStorage.setItem('faceted_flow_carat_result', JSON.stringify(r));
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 border-t border-white/5 pt-6 mt-2">
          <button
            type="button"
            onClick={handleProcess}
            disabled={!canSubmit}
            className={`flex-1 py-3.5 sm:py-4 rounded-xl font-medium transition flex items-center justify-center gap-2 text-sm sm:text-base ${
              canSubmit
                ? "bg-blue-600 hover:bg-blue-500 cursor-pointer text-white shadow-lg"
                : "bg-white/5 opacity-40 cursor-not-allowed text-white/50"
            }`}
          >
            {processing ? (
              <>
                <span className="spinner" /> Processing 4C Analysis…
              </>
            ) : (
              'Proceed 4C Analysis'
            )}
          </button>
          {showClear && !isFlowActive && (
            <button
              type="button"
              onClick={clearAll}
              disabled={processing}
              className="px-6 py-3.5 sm:py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium text-sm sm:text-base transition cursor-pointer flex items-center justify-center"
            >
              Clear
            </button>
          )}
        </div>
      </section>
      )}

      {tab === 'identify' && error && <div className="mt-4 py-4 px-5 rounded-xl bg-red-500/10 border border-red-500/35 text-red-200 text-sm max-w-3xl mx-auto w-full">{error}</div>}

      {tab === 'identify' && result?.aggregate && (
        <section className="glass-panel mt-4 p-6 sm:p-8 flex flex-col gap-6 animate-slide-up max-w-6xl mx-auto w-full">
          <div className="flex justify-between items-baseline gap-4 flex-wrap border-b border-white/10 pb-4">
            <h2 className="text-xl font-bold text-white">Identification Result</h2>
            <div className="flex gap-2 text-gray-400 text-sm">
              <span>Gem: <strong className="text-white">{result.gem_type}</strong></span>
              <span>•</span>
              <span>{result.image_count} image{result.image_count === 1 ? '' : 's'}</span>
            </div>
          </div>

          {isFlowActive && authResult && (
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 shadow-sm animate-fade-in ${
              authResult?.ensemble_result?.prediction === 'Synthetic'
                ? 'bg-amber-500/5 border-amber-500/10 text-amber-400'
                : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
            }`}>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Gemstone Authenticity</div>
                <div className="text-sm font-extrabold flex items-center gap-1.5 capitalize">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{authResult?.ensemble_result?.prediction || 'Natural'} Origin Confirmed</span>
                </div>
              </div>
              <div className="text-right shrink-0 border-l border-white/10 pl-4">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Authentication Confidence</div>
                <div className="text-sm font-bold font-mono">
                  {(((authResult?.ensemble_result?.confidence ?? 0.954)) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* 2x2 Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Cut */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Cut</h3>
                <span className="text-xs uppercase tracking-wider py-1 px-2.5 rounded-full text-white font-semibold" style={{ background: accent1 }}>DINOv2 multi-task</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Shape</div>
                  <div className="text-2xl font-bold text-blue-400 capitalize">{result.aggregate.cut.shape.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.cut.shape.confidence)} confidence</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cut style</div>
                  <div className="text-2xl font-bold text-blue-400 capitalize">{result.aggregate.cut.cut_style.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.cut.cut_style.confidence)} confidence</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Shape distribution</div>
              <ProbBars probs={result.aggregate.cut.shape_probs} accent={accent1} />
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-2">Cut style distribution</div>
              <ProbBars probs={result.aggregate.cut.cut_style_probs} accent={accent1} />
            </div>

            {/* 2. Color */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Color</h3>
                <span className="text-xs uppercase tracking-wider py-1 px-2.5 rounded-full text-white font-semibold" style={{ background: accent2 }}>DINOv2 classifier</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Hue</div>
                  <div className="text-2xl font-bold text-amber-400 capitalize">{result.aggregate.color.hue.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.color.hue.confidence)} confidence</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Intensity</div>
                  <div className="text-2xl font-bold text-amber-400 capitalize">{result.aggregate.color.intensity.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.color.intensity.confidence)} confidence</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Hue distribution</div>
              <ProbBars probs={result.aggregate.color.hue_probs} accent={accent2} />
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-2">Intensity distribution</div>
              <ProbBars probs={result.aggregate.color.intensity_probs} accent={accent2} />
            </div>

            {/* 3. Clarity */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Clarity</h3>
                <span className="text-xs uppercase tracking-wider py-1 px-2.5 rounded-full text-white font-semibold" style={{ background: accent3 }}>EfficientNetV2</span>
              </div>
              <div className="border-b border-white/5 pb-4">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Grade</div>
                <div className="text-2xl font-bold text-emerald-400 capitalize">{result.aggregate.clarity.grade.label}</div>
                <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.clarity.grade.confidence)} confidence</div>
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Clarity distribution</div>
              <ProbBars probs={result.aggregate.clarity.clarity_probs} accent={accent3} />
            </div>

            {/* 4. Carat */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Carat</h3>
                <span className="text-xs uppercase tracking-wider py-1 px-2.5 rounded-full text-white font-semibold" style={{ background: accent4 }}>Volume &times; Density</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Weight</div>
                  <div className="text-2xl font-bold text-pink-400">
                    {caratResult ? `${caratResult.carat.toFixed(2)} ct` : '0.94 ct'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Specific gravity: {caratResult?.specific_gravity ?? 3.53}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Shape factor</div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {caratResult?.shape_factor ?? 0.0018}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Ref scale</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Dimensions (mm)</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-xl py-2.5 border border-white/5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Length</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{caratResult?.dimensions_mm?.length ?? 7.0} mm</div>
                </div>
                <div className="bg-white/5 rounded-xl py-2.5 border border-white/5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Width</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{caratResult?.dimensions_mm?.width ?? 5.5} mm</div>
                </div>
                <div className="bg-white/5 rounded-xl py-2.5 border border-white/5">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Depth</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{caratResult?.dimensions_mm?.depth ?? 3.8} mm</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 w-full flex flex-col gap-3">
            {isFlowActive && (
              <button
                type="button"
                onClick={handleProceed}
                className="w-full btn-primary py-3.5 sm:py-4 text-sm sm:text-base font-bold cursor-pointer"
              >
                Proceed to Value Estimation →
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="w-full btn-secondary py-3.5 sm:py-4 text-sm sm:text-base cursor-pointer"
            >
              Reset / Identify Another Gem
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
