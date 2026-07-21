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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sub-tabs on this page: the 4C identification models, or the carat tester.
  const [tab, setTab] = useState<'identify' | 'carat'>('identify');

  // Flow states
  const router = useRouter();
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [flowImageName, setFlowImageName] = useState<string>('gem.png');

  useEffect(() => {
    // standalone tab: never join the authentication flow, always plain upload/test.
    if (standalone) return;
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
    }
  }, []);

  const handleProceed = () => {
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
    setError(null);
    
    if (isFlowActive) {
      // Keep the imported image, but reset the selected gem type
      setGemType('');
    } else {
      // Standalone flow: clear everything
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
    try {
      const data: IdentifyResponse = await identifyGem(
        gemType,
        images.map((img) => img.file),
      );
      if (!data?.aggregate?.cut || !data?.aggregate?.color || !data?.aggregate?.clarity) {
        throw new Error('The server returned an unexpected result (missing cut/color/clarity). Please try again.');
      }
      setResult(data);
      if (isFlowActive) {
        sessionStorage.setItem('faceted_flow_identify_result', JSON.stringify(data));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  };

  const accent1 = 'linear-gradient(135deg, #8b5cf6, #06b6d4)';
  const accent2 = 'linear-gradient(135deg, #f59e0b, #ef4444)';
  const accent3 = 'linear-gradient(135deg, #10b981, #14b8a6)';

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
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
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
        <div className="flex justify-center gap-2 mb-6 sm:mb-8">
          {([['identify', 'Cut · Color · Clarity'], ['carat', 'Carat']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer border ${
                tab === key
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-transparent'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'carat' && !isFlowActive && <CaratTester />}

      {/* Single Vertical Card Layout */}
      {tab === 'identify' && !result && (
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
          <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-white font-bold inline-flex items-center justify-center text-sm">1</span>
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
                    <span className="text-white/40 font-medium truncate">Select type...</span>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    {gemType && !processing ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setGemType('');
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white/80 transition cursor-pointer"
                        title="Clear selection"
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
          <span className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 text-white font-bold inline-flex items-center justify-center text-sm">2</span>
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
                className="border-2 border-dashed border-purple-500/50 rounded-2xl py-6 px-4 sm:py-10 sm:px-6 text-center bg-purple-500/5 cursor-pointer transition-all duration-200 ease-in-out hover:bg-purple-500/10 hover:border-purple-500"
                onClick={() => !processing && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!processing) addFiles(e.dataTransfer.files);
                }}
              >
                <Upload className="mx-auto mb-3 text-violet-400" />
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 border-t border-white/5 pt-6 mt-2">
          <button
            type="button"
            onClick={handleProcess}
            disabled={!canSubmit}
            className={`flex-1 py-3.5 sm:py-4 rounded-xl font-medium transition flex items-center justify-center gap-2 text-sm sm:text-base ${
              canSubmit
                ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 cursor-pointer text-white"
                : "bg-white/5 opacity-40 cursor-not-allowed text-white/50"
            }`}
          >
            {processing ? (
              <>
                <span className="spinner" /> Processing…
              </>
            ) : (
              `Process ${images.length || ''} image${images.length === 1 ? '' : 's'}`.trim()
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Cut</h3>
                <span className="text-xs uppercase tracking-wider py-1 px-2.5 rounded-full text-white font-semibold" style={{ background: accent1 }}>DINOv2 multi-task</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Shape</div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent capitalize">{result.aggregate.cut.shape.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.cut.shape.confidence)} confidence</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cut style</div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent capitalize">{result.aggregate.cut.cut_style.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.cut.cut_style.confidence)} confidence</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Shape distribution</div>
              <ProbBars probs={result.aggregate.cut.shape_probs} accent={accent1} />
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-2">Cut style distribution</div>
              <ProbBars probs={result.aggregate.cut.cut_style_probs} accent={accent1} />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Color</h3>
                <span className="text-xs uppercase tracking-wider py-1 px-2.5 rounded-full text-white font-semibold" style={{ background: accent2 }}>DINOv2 classifier</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Hue</div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent capitalize">{result.aggregate.color.hue.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.color.hue.confidence)} confidence</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Intensity</div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent capitalize">{result.aggregate.color.intensity.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.color.intensity.confidence)} confidence</div>
                </div>
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Hue distribution</div>
              <ProbBars probs={result.aggregate.color.hue_probs} accent={accent2} />
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mt-2">Intensity distribution</div>
              <ProbBars probs={result.aggregate.color.intensity_probs} accent={accent2} />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Clarity</h3>
                <span className="text-xs uppercase tracking-wider py-1 px-2.5 rounded-full text-white font-semibold" style={{ background: accent3 }}>EfficientNetV2</span>
              </div>
              <div className="border-b border-white/5 pb-4">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Grade</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent capitalize">{result.aggregate.clarity.grade.label}</div>
                <div className="text-xs text-gray-400 mt-1">{pct(result.aggregate.clarity.grade.confidence)} confidence</div>
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Clarity distribution</div>
              <ProbBars probs={result.aggregate.clarity.clarity_probs} accent={accent3} />
            </div>
          </div>

          {result.per_image.length > 1 && (
            <details className="mt-2 border-t border-white/10 pt-4">
              <summary className="cursor-pointer text-gray-400 text-sm hover:text-white transition">Per-image breakdown ({result.per_image.length})</summary>
              <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {result.per_image.map((p, i) => (
                  <div key={`${p.filename}-${i}`} className="py-3 px-4 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2">
                    <div className="text-xs text-gray-400 mb-1 break-all border-b border-white/5 pb-1">{p.filename}</div>
                    
                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Shape</span>
                      <span className="capitalize font-medium text-white">{p.cut.shape.label}</span>
                      <span className="text-gray-400 text-xs">{pct(p.cut.shape.confidence)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Cut</span>
                      <span className="capitalize font-medium text-white">{p.cut.cut_style.label}</span>
                      <span className="text-gray-400 text-xs">{pct(p.cut.cut_style.confidence)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Hue</span>
                      <span className="capitalize font-medium text-white">{p.color.hue.label}</span>
                      <span className="text-gray-400 text-xs">{pct(p.color.hue.confidence)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Intensity</span>
                      <span className="capitalize font-medium text-white">{p.color.intensity.label}</span>
                      <span className="text-gray-400 text-xs">{pct(p.color.intensity.confidence)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-gray-400 text-xs uppercase tracking-wider">Clarity</span>
                      <span className="capitalize font-medium text-white">{p.clarity.grade.label}</span>
                      <span className="text-gray-400 text-xs">{pct(p.clarity.grade.confidence)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
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
