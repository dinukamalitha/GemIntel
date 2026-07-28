'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import {
  estimateCarat,
  estimateCaratManual,
  fetchCaratOptions,
  type CaratResult,
} from '@/services/caratApi';

const prettify = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface PickerProps {
  label: string;
  hint: string;
  onPick: (f: File | null) => void;
}

function ImagePicker({ label, hint, onPick }: PickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Manage the preview object URL in the event handler (not an effect) so we
  // never call setState inside an effect body.
  const setFile = (f: File | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = f ? URL.createObjectURL(f) : null;
    setPreview(urlRef.current);
    onPick(f);
    if (!f && inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2 w-full text-left">
      <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
        {label}
      </label>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="w-full h-44 object-cover" />
          <button
            type="button"
            onClick={() => setFile(null)}
            className="absolute top-2 right-2 bg-black/60 rounded-full p-1 text-white hover:bg-black/80"
            aria-label="Remove image"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-violet-500/40 rounded-xl h-44 flex flex-col items-center justify-center text-center bg-violet-500/5 cursor-pointer transition-all hover:bg-violet-500/10 hover:border-violet-500"
        >
          <Upload className="w-6 h-6 text-violet-300 mb-2" />
          <span className="text-xs text-gray-400 px-4">{hint}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

/**
 * Carat estimation tester. Two coin-referenced photos (top + side) ->
 * measured mm dimensions -> carat = volume x density. This is a measurement
 * pipeline, not a trained model; the coin is the scale reference.
 */
export default function CaratTester() {
  const [gemTypes, setGemTypes] = useState<string[]>([]);
  const [cutShapes, setCutShapes] = useState<string[]>([]);
  const [topImage, setTopImage] = useState<File | null>(null);
  const [sideImage, setSideImage] = useState<File | null>(null);
  const [gemType, setGemType] = useState('');
  const [cutShape, setCutShape] = useState('');
  const [coinDiameter, setCoinDiameter] = useState('28.5'); // Sri Lanka Rs.2 (older, large)
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaratResult | null>(null);

  // Estimate from photos (default) or from typed measurements.
  const [mode, setMode] = useState<'photos' | 'measurements'>('photos');
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [depthMm, setDepthMm] = useState('');

  useEffect(() => {
    fetchCaratOptions()
      .then((o) => {
        setGemTypes(o.gem_types);
        setCutShapes(o.cut_shapes);
        setGemType(o.gem_types[0] ?? '');
        setCutShape(o.cut_shapes[0] ?? '');
      })
      .catch(() => {
        // Fallback so the form still works if the options endpoint is unreachable.
        setGemTypes(['blue_sapphire', 'spinel', 'topaz']);
        setCutShapes(['round', 'oval', 'cushion', 'pear', 'square', 'marquise', 'octagon', 'heart']);
        setGemType('blue_sapphire');
        setCutShape('oval');
      });
  }, []);

  const handleSubmit = async () => {
    if (!topImage || !sideImage) {
      toast.error('Upload both a top and a side photo.');
      return;
    }
    const coin = parseFloat(coinDiameter);
    if (!coin || coin <= 0) {
      toast.error('Enter a valid coin diameter in mm.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await estimateCarat({
        topImage,
        sideImage,
        gemType,
        cutShape,
        coinDiameterMm: coin,
      });
      setResult(res);
      res.warnings?.forEach((w) => toast(w, { icon: '⚠️' }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    const L = parseFloat(lengthMm);
    const W = parseFloat(widthMm);
    const D = parseFloat(depthMm);
    if (!(L > 0) || !(W > 0) || !(D > 0)) {
      toast.error('Enter positive length, width and depth in mm.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await estimateCaratManual({
        gemType,
        cutShape,
        lengthMm: L,
        widthMm: W,
        depthMm: D,
      });
      setResult(res);
      res.warnings?.forEach((w) => toast(w, { icon: '⚠️' }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    'w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/50';

  return (
    <div className="glass-panel p-5 sm:p-8 flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Mode toggle: estimate from photos, or from typed measurements */}
      <div className="flex justify-center gap-2">
        {([['photos', 'From photos'], ['measurements', 'From measurements']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === mode) return;
              setMode(key);
              setResult(null);
              // reset the inputs of the mode being left so nothing stale carries over
              setLengthMm(''); setWidthMm(''); setDepthMm('');
              setTopImage(null); setSideImage(null);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              mode === key
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-transparent text-gray-400 border-white/10 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'photos' ? (
        <p className="text-xs sm:text-sm text-gray-400 text-center -mb-1">
          Upload a <strong>top</strong> and a <strong>side</strong> photo, each with the
          same coin in frame as a scale reference. Weight is measured (volume &times; density),
          not predicted.
        </p>
      ) : (
        <p className="text-xs sm:text-sm text-gray-400 text-center -mb-1">
          Enter the stone&apos;s measured <strong>length</strong>, <strong>width</strong> and{' '}
          <strong>depth</strong> in millimetres (e.g. from a caliper). Weight is computed
          (volume &times; density), not predicted.
        </p>
      )}

      {mode === 'photos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ImagePicker
            label="Top view"
            hint="Straight down on the stone, coin beside it"
            onPick={setTopImage}
          />
          <ImagePicker
            label="Side view"
            hint="Stone on its edge (shows depth), same coin"
            onPick={setSideImage}
          />
        </div>
      )}

      {/* Shared: gem type + cut shape */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2 text-left">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Gem type</label>
          <select className={selectClass} value={gemType} onChange={(e) => setGemType(e.target.value)}>
            {gemTypes.map((g) => (
              <option key={g} value={g} className="bg-slate-950">{prettify(g)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 text-left">
          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Cut shape</label>
          <select className={selectClass} value={cutShape} onChange={(e) => setCutShape(e.target.value)}>
            {cutShapes.map((c) => (
              <option key={c} value={c} className="bg-slate-950">{prettify(c)}</option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'photos' ? (
        <>
          <div className="flex flex-col gap-2 text-left">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Coin diameter (mm)</label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={coinDiameter}
              onChange={(e) => setCoinDiameter(e.target.value)}
              className={selectClass}
            />
          </div>
          <p className="text-xs text-gray-500 -mt-3 text-left">
            Reference: Sri Lanka Rs.2 = 22.0mm (2017+, notched edge) or 28.5mm (older) &middot;
            US quarter = 24.26mm &middot; €1 = 23.25mm
          </p>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {([['length', lengthMm, setLengthMm], ['width', widthMm, setWidthMm], ['depth', depthMm, setDepthMm]] as const).map(
            ([label, value, setter]) => (
              <div key={label} className="flex flex-col gap-2 text-left">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider capitalize">{label} (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder="0.0"
                  className={selectClass}
                />
              </div>
            ),
          )}
        </div>
      )}

      <button
        onClick={mode === 'photos' ? handleSubmit : handleManualSubmit}
        disabled={loading}
        className="btn-secondary w-full py-3.5 sm:py-4 text-sm sm:text-base disabled:opacity-50"
      >
        {loading ? 'Estimating…' : 'Estimate Carat'}
      </button>

      {result && (
        <div className="animate-fade-in flex flex-col gap-5 border-t border-white/10 pt-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-gray-400">Estimated weight</div>
            <div className="text-4xl font-bold text-cyan-400">{result.carat.toFixed(2)} ct</div>
            <div className="text-xs text-gray-500 mt-1">
              {prettify(result.gem_type)} &middot; {prettify(result.cut_shape)} &middot; SG {result.specific_gravity}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {(['length', 'width', 'depth'] as const).map((k) => (
              <div key={k} className="bg-white/5 border border-white/10 rounded-xl py-3">
                <div className="text-xs uppercase tracking-wider text-gray-400">{k}</div>
                <div className="text-lg font-semibold text-white">
                  {result.dimensions_mm[k].toFixed(2)}<span className="text-xs text-gray-400"> mm</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center">
            {result.scale_px_per_mm
              ? `Scale: ${result.scale_px_per_mm.top} / ${result.scale_px_per_mm.side} px/mm (top/side). `
              : ''}
            Estimate accuracy ≈ ±5–15%; not a substitute for a calibrated scale.
          </p>
          {result.warnings?.length > 0 && (
            <ul className="text-xs text-amber-400/90 list-disc list-inside space-y-1">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
