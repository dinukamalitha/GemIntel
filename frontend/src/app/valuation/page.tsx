'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Gem,
  Info,
  Landmark,
  Sparkles,
} from 'lucide-react';
import FacetedFlowTracker from '@/components/FacetedFlowTracker';
import {
  fetchEconomicContext,
  fetchFactorOptions,
  predictPrice,
  type EconomicContext,
  type EconomicSnapshot,
  type FactorOptions,
  type GemFactors,
  type PredictionResult,
} from '@/services/valuesApi';

const GEM_COLORS: Record<string, string> = {
  'Blue Sapphire': '#3b82f6',
  'Blue Spinel': '#ec4899',
  'Blue Topaz': '#eab308',
  'Ceylon Blue Sapphire': '#3b82f6',
  'Ceylon Blue Spinel': '#ec4899',
  'Ceylon Blue Topaz': '#eab308',
};

type EconomicSnapshotDraft = {
  [K in keyof EconomicSnapshot]: number | '';
};

const EMPTY_ECONOMIC_FACTORS: EconomicSnapshotDraft = {
  ccpi: '',
  ccpi_yoy: '',
  slfr: '',
  gold_lkr: '',
  gdp_growth: '',
  exchange_rate: '',
};

const DEFAULT_CONFIDENCE_LEVEL = 0.9;

const getLocalDateString = () => {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 10);
};

const formatYearMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
};

const formatLkr = (value: number) =>
  new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 }).format(value);

interface CustomSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  dotColors?: Record<string, string>;
}

function CustomSelect({
  label,
  value,
  options,
  onChange,
  isOpen,
  onToggle,
  dotColors,
}: CustomSelectProps) {
  return (
    <div className="relative">
      <label className="block text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold text-gray-300">
        {label}
      </label>
      <button
        type="button"
        onClick={onToggle}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm flex justify-between items-center text-left transition hover:bg-white/5 active:scale-95 cursor-pointer text-white"
      >
        {value ? (
          <div className="flex items-center gap-2.5 min-w-0">
            {dotColors && dotColors[value] && (
              <span
                className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0"
                style={{
                  backgroundColor: dotColors[value],
                  color: dotColors[value],
                }}
              />
            )}
            <span className="font-semibold text-white truncate">{value}</span>
          </div>
        ) : (
          <span className="text-white/40 font-medium truncate">Select...</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-full bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1.5 animate-fade-in-pure max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                onToggle();
              }}
              className={`w-full px-4 py-2.5 text-left hover:bg-white/5 transition flex items-center justify-between group cursor-pointer ${value === opt ? 'bg-white/5' : ''
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {dotColors && dotColors[opt] && (
                  <span
                    className="w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-110 shrink-0"
                    style={{ backgroundColor: dotColors[opt] }}
                  />
                )}
                <span className="font-semibold text-white text-sm truncate">
                  {opt}
                </span>
              </div>
              {value === opt && (
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
  );
}

interface NumericInputProps {
  label: string;
  tooltip?: string;
  value: number | '';
  onChange: (value: number | '') => void;
  step: number;
  min?: number;
  max?: number;
  unit: string;
  precision?: number;
  readOnly?: boolean;
}

function NumericInput({
  label,
  tooltip,
  value,
  onChange,
  step,
  min,
  max,
  unit,
  precision = 2,
  readOnly = false,
}: NumericInputProps) {
  const handleDecrement = () => {
    const currentVal = value === '' ? 0 : value;
    let newVal = +(currentVal - step).toFixed(precision);
    if (min !== undefined) newVal = Math.max(min, newVal);
    onChange(newVal);
  };

  const handleIncrement = () => {
    const currentVal = value === '' ? 0 : value;
    let newVal = +(currentVal + step).toFixed(precision);
    if (max !== undefined) newVal = Math.min(max, newVal);
    onChange(newVal);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <label className="text-xs uppercase tracking-wide opacity-50 font-semibold text-gray-300">
          {label}
        </label>
        {tooltip && (
          <span className="relative group inline-flex">
            <button
              type="button"
              aria-label={`${label}: ${tooltip}`}
              className="text-gray-500 hover:text-violet-400 focus:text-violet-400 focus:outline-none transition-colors cursor-help"
            >
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-[11px] normal-case tracking-normal text-gray-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={readOnly}
          onClick={handleDecrement}
          className="w-10 h-10 shrink-0 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition flex items-center justify-center text-lg text-white/80 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          −
        </button>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          readOnly={readOnly}
          onChange={(e) => {
            if (readOnly) return;
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
              onChange(val);
            } else {
              onChange('');
            }
          }}
          onWheel={(e) => e.currentTarget.blur()}
          className={`flex-1 min-w-0 text-center bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-white focus:outline-none focus:border-violet-500 font-semibold text-sm ${readOnly ? 'cursor-not-allowed opacity-80' : ''}`}
        />
        <span className="text-xs opacity-50 px-2.5 py-1.5 border border-white/10 rounded shrink-0 bg-white/5 font-semibold text-gray-300">
          {unit}
        </span>
        <button
          type="button"
          disabled={readOnly}
          onClick={handleIncrement}
          className="w-10 h-10 shrink-0 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition flex items-center justify-center text-lg text-white/80 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}

interface EconomicInputsProps {
  values: EconomicSnapshotDraft;
  onChange: (field: keyof EconomicSnapshot, value: number | '') => void;
  readOnly?: boolean;
}

function EconomicInputs({ values, onChange, readOnly = false }: EconomicInputsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumericInput label="CCPI" tooltip="The Colombo Consumer Price Index measures changes in consumer prices in Colombo." value={values.ccpi} onChange={(value) => onChange('ccpi', value)} step={0.5} min={0} max={500} unit="idx" precision={1} readOnly={readOnly} />
      <NumericInput label="CCPI YoY" tooltip="The year-over-year CCPI shows the percentage change in consumer prices from the same month one year earlier." value={values.ccpi_yoy} onChange={(value) => onChange('ccpi_yoy', value)} step={0.1} min={-20} max={100} unit="%" precision={1} readOnly={readOnly} />
      <NumericInput label="SLFR" tooltip="The Standing Lending Facility Rate is the overnight lending rate set by the Central Bank of Sri Lanka." value={values.slfr} onChange={(value) => onChange('slfr', value)} step={0.05} min={0} max={50} unit="%" precision={2} readOnly={readOnly} />
      <NumericInput label="Average Gold Price" tooltip="The monthly average of the available daily XAU prices expressed in Sri Lankan rupees." value={values.gold_lkr} onChange={(value) => onChange('gold_lkr', value)} step={1000} min={0} max={5000000} unit="LKR" precision={0} readOnly={readOnly} />
      <NumericInput label="GDP Growth" tooltip="GDP growth is the percentage change in the value of goods and services produced by Sri Lanka's economy." value={values.gdp_growth} onChange={(value) => onChange('gdp_growth', value)} step={0.1} min={-50} max={50} unit="%" precision={1} readOnly={readOnly} />
      <NumericInput label="Average Exchange Rate" tooltip="The monthly average LKR/USD exchange rate is the number of Sri Lankan rupees required to purchase one US dollar." value={values.exchange_rate} onChange={(value) => onChange('exchange_rate', value)} step={0.5} min={0} max={1000} unit="LKR/USD" precision={2} readOnly={readOnly} />
    </div>
  );
}

export default function Valuation() {
  const [factorOptions, setFactorOptions] = useState<FactorOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // Flow states
  const router = useRouter();
  const [isFlowActive, setIsFlowActive] = useState(false);
  const [authResult, setAuthResult] = useState<any>(null);
  const [identifyResult, setIdentifyResult] = useState<any>(null);

  function computeFlowGemFactors(): GemFactors {
    const defaultFactors: GemFactors = {
      weight_ct: 1.5,
      gem_type: 'Blue Sapphire',
      hue: 'Royal Blue',
      colour_intensity: 'Vivid',
      clarity: 'VVS',
      shape: 'Cushion',
      cut: 'Mixed',
      natural_or_synthetic: 'Natural',
      heat_treatment: 'Not Heat Treated',
    };

    if (typeof window === 'undefined') return defaultFactors;

    const authStr = sessionStorage.getItem('faceted_flow_auth_result');
    const identifyStr = sessionStorage.getItem('faceted_flow_identify_result');
    const roughStr = sessionStorage.getItem('rough_flow_cut_result');

    let idRes: any = null;
    if (identifyStr) {
      try { idRes = JSON.parse(identifyStr); } catch (e) { console.error(e); }
    } else if (roughStr) {
      try { idRes = JSON.parse(roughStr); } catch (e) { console.error(e); }
    }

    if (!idRes) {
      const savedType = sessionStorage.getItem('faceted_flow_gem_type');
      if (savedType) {
        const cleanType = savedType.replace('Ceylon ', '');
        return { ...defaultFactors, gem_type: cleanType };
      }
      return defaultFactors;
    }

    let mappedGemType = 'Blue Sapphire';
    const incomingGemType = idRes.gem_type || sessionStorage.getItem('faceted_flow_gem_type');
    if (incomingGemType === 'Blue Sapphire' || incomingGemType === 'Ceylon Blue Sapphire') mappedGemType = 'Blue Sapphire';
    else if (incomingGemType === 'Blue Spinel' || incomingGemType === 'Ceylon Blue Spinel') mappedGemType = 'Blue Spinel';
    else if (incomingGemType === 'Blue Topaz' || incomingGemType === 'Ceylon Blue Topaz') mappedGemType = 'Blue Topaz';
    else if (incomingGemType) mappedGemType = String(incomingGemType).replace('Ceylon ', '');

    let mappedShape = 'Cushion';
    const rawShape =
      idRes.aggregate?.cut?.shape?.label ||
      idRes.shape ||
      idRes.cut_shape ||
      idRes.predicted_shape ||
      idRes.prediction?.cut;

    if (rawShape && typeof rawShape === 'string') {
      const cleanShape = rawShape.toLowerCase().trim();
      if (cleanShape.includes('square') || cleanShape.includes('asscher')) mappedShape = 'Asscher';
      else if (cleanShape.includes('cushion')) mappedShape = 'Cushion';
      else if (cleanShape.includes('octagon') || cleanShape.includes('emerald') || cleanShape.includes('baguette')) mappedShape = 'Emerald';
      else if (cleanShape.includes('heart')) mappedShape = 'Heart';
      else if (cleanShape.includes('marquise')) mappedShape = 'Marquise';
      else if (cleanShape.includes('oval')) mappedShape = 'Oval';
      else if (cleanShape.includes('pear') || cleanShape.includes('teardrop')) mappedShape = 'Pear';
      else if (cleanShape.includes('radiant') || cleanShape.includes('trillion') || cleanShape.includes('trilliant')) mappedShape = 'Radiant';
      else if (cleanShape.includes('round') || cleanShape.includes('circle')) mappedShape = 'Round';
    }

    let mappedCut = 'Mixed';
    const rawCut =
      idRes.aggregate?.cut?.cut_style?.label ||
      idRes.cut_style ||
      idRes.cut ||
      idRes.predicted_cut ||
      idRes.prediction?.cut_style;

    if (rawCut && typeof rawCut === 'string') {
      const cleanCut = rawCut.toLowerCase().trim();
      if (cleanCut.includes('brilliant')) mappedCut = 'Brilliant';
      else if (cleanCut.includes('step')) mappedCut = 'Step';
      else if (cleanCut.includes('mixed')) mappedCut = 'Mixed';
      else if (cleanCut.includes('asscher')) mappedCut = 'Asscher Cut';
      else if (cleanCut.includes('radiant')) mappedCut = 'Radiant Cut';
      else if (cleanCut.includes('emerald')) mappedCut = 'Emerald';
    }

    let mappedColorIntensity = 'Vivid';
    const rawIntensity = idRes.aggregate?.color?.intensity?.label || idRes.aggregate?.color?.saturation?.label;
    if (rawIntensity) {
      const cleanedInt = rawIntensity.toLowerCase().trim();
      if (cleanedInt.includes('vivid')) mappedColorIntensity = 'Vivid';
      else if (cleanedInt.includes('intense')) mappedColorIntensity = 'Intense';
      else if (cleanedInt.includes('deep')) mappedColorIntensity = 'Deep';
      else if (cleanedInt.includes('dark')) mappedColorIntensity = 'Dark';
      else if (cleanedInt.includes('light')) mappedColorIntensity = 'Light';
      else if (cleanedInt.includes('medium')) mappedColorIntensity = 'Medium';
    }

    let mappedHue = 'Royal Blue';
    const rawHue = idRes.aggregate?.color?.hue?.label;
    if (rawHue) {
      const normalizedHue = rawHue.toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
      const hueMap: Record<string, string> = {
        blue: 'Blue',
        cobalt: 'Cobalt Blue', cobalt_blue: 'Cobalt Blue',
        cornflower: 'Cornflower Blue', cornflower_blue: 'Cornflower Blue',
        london: 'London Blue', london_blue: 'London Blue',
        royal: 'Royal Blue', royal_blue: 'Royal Blue',
        sky: 'Sky Blue', sky_blue: 'Sky Blue',
        swiss: 'Swiss Blue', swiss_blue: 'Swiss Blue',
      };
      mappedHue = hueMap[normalizedHue] || rawHue.split(/[_-]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    let mappedClarity = 'VVS';
    const rawClarity = idRes.aggregate?.clarity?.grade?.label;
    if (rawClarity) {
      const cleanedClarity = rawClarity.toLowerCase().trim();
      if (cleanedClarity.includes('eye') || cleanedClarity.includes('clean')) mappedClarity = 'Eye-clean';
      else if (cleanedClarity.includes('if') || cleanedClarity.includes('flawless')) mappedClarity = 'IF';
      else if (cleanedClarity.includes('vvs')) mappedClarity = 'VVS';
      else if (cleanedClarity.includes('vs')) mappedClarity = 'VS';
    }

    const caratStr = sessionStorage.getItem('faceted_flow_carat_result');
    let mappedWeight = 1.5;
    if (caratStr) {
      try {
        const caratRes = JSON.parse(caratStr);
        if (caratRes && typeof caratRes.carat === 'number' && caratRes.carat > 0) {
          mappedWeight = +((caratRes.carat).toFixed(2));
        }
      } catch (err) {
        console.error('Error parsing carat result in valuation page', err);
      }
    }

    const authPrediction = authStr
      ? JSON.parse(authStr)?.ensemble_result?.prediction
      : 'Natural';

    return {
      weight_ct: mappedWeight,
      gem_type: mappedGemType,
      shape: mappedShape,
      cut: mappedCut,
      hue: mappedHue,
      clarity: mappedClarity,
      colour_intensity: mappedColorIntensity,
      natural_or_synthetic: String(authPrediction).toLowerCase().includes('synthetic') ? 'Synthetic' : 'Natural',
      heat_treatment: 'Not Heat Treated',
    };
  }

  useEffect(() => {
    const active = sessionStorage.getItem('faceted_flow_active') === 'true';
    setIsFlowActive(active);

    if (active) {
      const authStr = sessionStorage.getItem('faceted_flow_auth_result');
      const identifyStr = sessionStorage.getItem('faceted_flow_identify_result');
      const roughStr = sessionStorage.getItem('rough_flow_cut_result');

      if (authStr) {
        try { setAuthResult(JSON.parse(authStr)); } catch (e) { console.error(e); }
      }

      const valStr = sessionStorage.getItem('faceted_flow_valuation_result');
      if (valStr) {
        try {
          const valRes = JSON.parse(valStr);
          setResult(valRes);
          setShowResult(true);
        } catch (e) { console.error(e); }
      }

      let idRes = null;
      if (identifyStr) {
        try { idRes = JSON.parse(identifyStr); } catch (e) { console.error(e); }
      } else if (roughStr) {
        try { idRes = JSON.parse(roughStr); } catch (e) { console.error(e); }
      }

      if (idRes) {
        setIdentifyResult(idRes);
      }

      setGemFactors(computeFlowGemFactors());
    }
  }, []);


  // Gem Factors Form State
  const [gemFactors, setGemFactors] = useState<GemFactors>({
    weight_ct: 1.5,
    gem_type: 'Blue Sapphire',
    hue: 'Royal Blue',
    colour_intensity: 'Vivid',
    clarity: 'VVS',
    shape: 'Cushion',
    cut: 'Mixed',
    natural_or_synthetic: 'Natural',
    heat_treatment: 'Not Heat Treated',
  });

  // Economic Factors Form State
  const [economicFactors, setEconomicFactors] = useState<EconomicSnapshotDraft>(
    { ...EMPTY_ECONOMIC_FACTORS }
  );
  const [valuationDate, setValuationDate] = useState(getLocalDateString);
  const [economicContext, setEconomicContext] = useState<EconomicContext | null>(null);
  const [economicContextLoading, setEconomicContextLoading] = useState(true);
  const [economicContextError, setEconomicContextError] = useState<string | null>(null);
  const [economicContextReloadKey, setEconomicContextReloadKey] = useState(0);
  const [confidenceLevel, setConfidenceLevel] = useState(DEFAULT_CONFIDENCE_LEVEL);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch factor options on component mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const options = await fetchFactorOptions();
        setFactorOptions(options);
      } catch (error) {
        console.error('Error fetching factor options:', error);
        toast.error('Failed to load dropdown options');
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, []);

  // Keep the displayed indicators synchronized with the backend's economic
  // month resolution for the selected valuation date.
  useEffect(() => {
    if (!valuationDate) {
      setEconomicContext(null);
      setEconomicFactors({ ...EMPTY_ECONOMIC_FACTORS });
      setEconomicContextError(null);
      setEconomicContextLoading(false);
      return;
    }

    const controller = new AbortController();
    setEconomicContext(null);
    setEconomicFactors({ ...EMPTY_ECONOMIC_FACTORS });
    setEconomicContextError(null);
    setEconomicContextLoading(true);

    fetchEconomicContext(valuationDate, controller.signal)
      .then((context) => {
        setEconomicContext(context);
        setEconomicFactors(context.current);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error('Error fetching economic context:', error);
        setEconomicContextError(
          error instanceof Error ? error.message : 'Failed to load economic indicators'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setEconomicContextLoading(false);
      });

    return () => controller.abort();
  }, [valuationDate, economicContextReloadKey]);

  const handleGemFactorChange = (field: keyof typeof gemFactors, value: string | number) => {
    setGemFactors((prev) => ({ ...prev, [field]: value }));
  };

  const handleEconomicFactorChange = (field: keyof typeof economicFactors, value: number | '') => {
    setEconomicFactors((prev) => ({ ...prev, [field]: value }));
  };

  const handlePredict = async () => {
    if (!valuationDate) {
      toast.error('Please enter the valuation date.');
      return;
    }
    if (economicContextLoading) {
      toast.error('Economic indicators are still loading.');
      return;
    }
    if (!economicContext || economicContextError) {
      toast.error(economicContextError || 'Economic indicators are unavailable.');
      return;
    }

    setPredicting(true);
    try {
      const requestBase = {
        gem_factors: gemFactors,
        valuation_date: valuationDate,
        confidence_level: confidenceLevel,
      };
      const data = await predictPrice({
        ...requestBase,
        economic_source: 'historical',
      });
      setResult(data);
      setShowResult(true);
      if (isFlowActive) {
        sessionStorage.setItem('faceted_flow_valuation_result', JSON.stringify(data));
      }
      toast.success('Price prediction successful!');
    } catch (error) {
      console.error('Prediction error:', error);
      toast.error(error instanceof Error ? error.message : 'Prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  const handleReset = () => {
    setShowResult(false);
    setResult(null);
    sessionStorage.removeItem('faceted_flow_valuation_result');
    if (isFlowActive || (typeof window !== 'undefined' && sessionStorage.getItem('faceted_flow_identify_result'))) {
      setGemFactors(computeFlowGemFactors());
    } else {
      setGemFactors({
        weight_ct: 1.5,
        gem_type: 'Blue Sapphire',
        hue: 'Royal Blue',
        colour_intensity: 'Vivid',
        clarity: 'VVS',
        shape: 'Cushion',
        cut: 'Mixed',
        natural_or_synthetic: 'Natural',
        heat_treatment: 'Not Heat Treated',
      });
    }
    setValuationDate(getLocalDateString());
    setEconomicContextReloadKey((value) => value + 1);
    setConfidenceLevel(DEFAULT_CONFIDENCE_LEVEL);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="spinner" />
          <div className="text-gray-400 text-sm font-medium">Loading valuation form...</div>
        </div>
      </div>
    );
  }

  // Fallback options
  const rawGemTypes = factorOptions?.gem_factors.gem_type || [
    'Blue Sapphire',
    'Blue Spinel',
    'Blue Topaz',
  ];
  const gemTypeOptions = Array.from(new Set(rawGemTypes.map((gt) => gt.replace('Ceylon ', ''))));
  const hueOptions = factorOptions?.gem_factors.hue || [
    'Blue',
    'Cobalt Blue',
    'Cornflower Blue',
    'London Blue',
    'Royal Blue',
    'Sky Blue',
    'Swiss Blue',
  ];
  const colourOptions = factorOptions?.gem_factors.colour_intensity || [
    'Dark', 'Deep', 'Intense', 'Light', 'Medium', 'Vivid',
  ];
  const clarityOptions = factorOptions?.gem_factors.clarity || [
    'Eye-clean', 'IF', 'VS', 'VVS',
  ];
  const shapeOptions = factorOptions?.gem_factors.shape || [
    'Asscher', 'Cushion', 'Emerald', 'Heart', 'Marquise', 'Oval', 'Pear',
    'Radiant', 'Round',
  ];
  const cutOptions = factorOptions?.gem_factors.cut || [
    'Asscher Cut', 'Brilliant', 'Emerald', 'Mixed', 'Radiant Cut', 'Step',
  ];
  const originOptions = factorOptions?.gem_factors.natural_or_synthetic || [
    'Natural', 'Synthetic',
  ];
  const heatTreatmentOptions = factorOptions?.gem_factors.heat_treatment || [
    'Heat Treated', 'Not Heat Treated',
  ];

  const handleBack = () => {
    sessionStorage.removeItem('faceted_flow_valuation_result');
    sessionStorage.setItem('faceted_flow_step', '2');
    router.push('/identification');
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-2 sm:pt-4 pb-16 sm:pb-20">
      {isFlowActive && <FacetedFlowTracker currentStep={3} />}

      {isFlowActive && (
        <div className="flex items-center justify-between mb-6 max-w-6xl mx-auto w-full transition-all duration-300 animate-fade-in">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 transition-colors bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl active:scale-[0.98] cursor-pointer font-semibold shadow-lg"
          >
            ← Back to Step 2: Feature Identification
          </button>
        </div>
      )}

      {/* Header */}
      <header className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-center mb-2 leading-tight px-2 text-white">
          Dynamic Gem Valuation &{' '}
          <span className="text-blue-400">
            Price Estimator
          </span>
        </h1>
        <p className="text-center text-sm sm:text-base opacity-60 max-w-2xl mx-auto px-4 text-gray-300">
          Estimate price per carat and total market value using gem characteristics and current and recent economic indicators.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        {/* Form / Results Column */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8" ref={formRef}>
          {!showResult ? (
            <fieldset disabled={predicting} className="contents">
              {/* Gem Factors */}
              <div className="glass-panel p-5 sm:p-6 space-y-5">
                <h2 className="text-lg font-medium text-cyan-400 flex items-center gap-2">
                  <span className="opacity-50 text-sm font-semibold">01</span> Gem Characteristics
                </h2>

                {isFlowActive && identifyResult && (
                  <div className="p-4 rounded-xl border border-cyan-500/10 bg-cyan-500/5 text-cyan-400 text-xs flex flex-col gap-2 shadow-sm animate-fade-in">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI-Extracted Attributes & Origin Loaded</span>
                    </div>
                    <div className="text-gray-400 leading-relaxed space-y-1.5">
                      <p>
                        The attributes below (Gem Type, Shape, Cut, Intensity) have been auto-filled from the Feature Identification model. You can verify and adjust them before running the valuation model.
                      </p>
                      {authResult && (
                        <p className="flex items-center gap-1 flex-wrap">
                          <span className="font-semibold text-white">Gemstone Authenticity:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${authResult?.ensemble_result?.prediction === 'Synthetic'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                            {authResult?.ensemble_result?.prediction || 'Natural'} Origin
                          </span>
                          <span className="text-[10px] opacity-75">
                            ({((authResult?.ensemble_result?.confidence ?? 0.954) * 100).toFixed(1)}% confidence)
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 mb-2">
                    <NumericInput
                      label="Weight (carats)"
                      value={gemFactors.weight_ct}
                      onChange={(val) => handleGemFactorChange('weight_ct', val)}
                      step={0.1}
                      min={factorOptions?.gem_factors.weight_ct.min || 0.1}
                      max={factorOptions?.gem_factors.weight_ct.max || 5.0}
                      unit="ct"
                      precision={2}
                    />
                  </div>

                  <CustomSelect
                    label="Gem Type"
                    value={gemFactors.gem_type}
                    options={gemTypeOptions}
                    onChange={(val) => handleGemFactorChange('gem_type', val)}
                    isOpen={openDropdown === 'gem_type'}
                    onToggle={() =>
                      setOpenDropdown(openDropdown === 'gem_type' ? null : 'gem_type')
                    }
                    dotColors={GEM_COLORS}
                  />

                  <CustomSelect
                    label="Hue"
                    value={gemFactors.hue}
                    options={hueOptions}
                    onChange={(val) => handleGemFactorChange('hue', val)}
                    isOpen={openDropdown === 'hue'}
                    onToggle={() => setOpenDropdown(openDropdown === 'hue' ? null : 'hue')}
                  />

                  <CustomSelect
                    label="Colour Intensity"
                    value={gemFactors.colour_intensity}
                    options={colourOptions}
                    onChange={(val) => handleGemFactorChange('colour_intensity', val)}
                    isOpen={openDropdown === 'colour_intensity'}
                    onToggle={() =>
                      setOpenDropdown(
                        openDropdown === 'colour_intensity' ? null : 'colour_intensity'
                      )
                    }
                  />

                  <CustomSelect
                    label="Clarity"
                    value={gemFactors.clarity}
                    options={clarityOptions}
                    onChange={(val) => handleGemFactorChange('clarity', val)}
                    isOpen={openDropdown === 'clarity'}
                    onToggle={() =>
                      setOpenDropdown(openDropdown === 'clarity' ? null : 'clarity')
                    }
                  />

                  <CustomSelect
                    label="Shape"
                    value={gemFactors.shape}
                    options={shapeOptions}
                    onChange={(val) => handleGemFactorChange('shape', val)}
                    isOpen={openDropdown === 'shape'}
                    onToggle={() =>
                      setOpenDropdown(openDropdown === 'shape' ? null : 'shape')
                    }
                  />

                  <CustomSelect
                    label="Cut"
                    value={gemFactors.cut}
                    options={cutOptions}
                    onChange={(val) => handleGemFactorChange('cut', val)}
                    isOpen={openDropdown === 'cut'}
                    onToggle={() =>
                      setOpenDropdown(openDropdown === 'cut' ? null : 'cut')
                    }
                  />

                  <CustomSelect
                    label="Origin"
                    value={gemFactors.natural_or_synthetic}
                    options={originOptions}
                    onChange={(val) => handleGemFactorChange('natural_or_synthetic', val)}
                    isOpen={openDropdown === 'natural_or_synthetic'}
                    onToggle={() =>
                      setOpenDropdown(
                        openDropdown === 'natural_or_synthetic' ? null : 'natural_or_synthetic'
                      )
                    }
                  />

                  <CustomSelect
                    label="Heat Treatment"
                    value={gemFactors.heat_treatment}
                    options={heatTreatmentOptions}
                    onChange={(val) => handleGemFactorChange('heat_treatment', val)}
                    isOpen={openDropdown === 'heat_treatment'}
                    onToggle={() =>
                      setOpenDropdown(
                        openDropdown === 'heat_treatment' ? null : 'heat_treatment'
                      )
                    }
                  />
                </div>
              </div>

              {/* Economic Factors */}
              <div className="glass-panel p-5 sm:p-6 space-y-5">
                <h2 className="text-lg font-medium text-violet-400 flex items-center gap-2">
                  <span className="opacity-50 text-sm font-semibold">02</span> Economic Factors
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold text-gray-300">
                      Valuation Date
                    </label>
                    <input
                      type="date"
                      value={valuationDate}
                      onChange={(event) => setValuationDate(event.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-violet-500 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide opacity-50 mb-2 font-semibold text-gray-300">
                      Prediction Interval
                    </label>
                    <select
                      value={confidenceLevel}
                      onChange={(event) => setConfidenceLevel(Number(event.target.value))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value={0.5}>50% interval</option>
                      <option value={0.8}>80% interval</option>
                      <option value={0.9}>90% interval</option>
                      <option value={0.95}>95% interval</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Current indicators</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {economicContextLoading
                        ? 'Loading economic data for the selected date...'
                        : economicContext
                          ? `Loaded from ${formatYearMonth(economicContext.current_month)}.`
                          : 'Economic data is unavailable for the selected date.'}
                    </p>
                  </div>
                  <EconomicInputs
                    values={economicFactors}
                    onChange={handleEconomicFactorChange}
                    readOnly
                  />
                </div>

                {economicContextError ? (
                  <div className="flex items-center justify-between gap-3 text-xs text-red-300/90 bg-red-500/5 border border-red-500/15 rounded-xl p-3 leading-relaxed">
                    <p>{economicContextError}</p>
                    <button
                      type="button"
                      onClick={() => setEconomicContextReloadKey((value) => value + 1)}
                      className="shrink-0 rounded-lg border border-red-400/30 px-3 py-1.5 font-semibold hover:bg-red-500/10 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 leading-relaxed">
                    {economicContext
                      ? economicContext.current_month !== valuationDate.slice(0, 7)
                        ? `${formatYearMonth(economicContext.current_month)} is the latest available month for the ${formatYearMonth(valuationDate.slice(0, 7))} valuation. Lag months: ${economicContext.lag_months.map(formatYearMonth).join(', ')}.`
                        : `Economic factors and lags were loaded automatically. Lag months: ${economicContext.lag_months.map(formatYearMonth).join(', ')}.`
                      : 'Economic factors and their three monthly lags are loaded automatically by the backend.'}
                  </p>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handlePredict}
                disabled={predicting || economicContextLoading || !economicContext}
                className="btn-primary w-full py-3.5 sm:py-4 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {predicting ? (
                  <>
                    <span className="spinner" /> Predicting...
                  </>
                ) : economicContextLoading ? (
                  <>
                    <span className="spinner" /> Loading Economic Data...
                  </>
                ) : !economicContext ? (
                  'Economic Data Unavailable'
                ) : (
                  'Estimate Value'
                )}
              </button>
            </fieldset>
          ) : (
            /* Results Section */
            <div className="glass-panel p-5 sm:p-6 space-y-6 animate-slide-up">
              <h2 className="text-xl sm:text-2xl font-bold text-cyan-400 border-b border-white/10 pb-4">
                Valuation Results
              </h2>

              {isFlowActive && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3.5 text-xs animate-fade-in shadow-sm animate-fade-in">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-gray-400 font-medium">Gem Authenticity:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${authResult?.ensemble_result?.prediction === 'Synthetic'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                      {authResult?.ensemble_result?.prediction || 'Natural'} Origin
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-gray-400 font-medium">Gem Type:</span>
                    <span className="text-white font-bold">{gemFactors.gem_type}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-gray-400 font-medium">Extracted Shape:</span>
                    <span className="text-white font-bold">{gemFactors.shape}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-gray-400 font-medium">Extracted Cut:</span>
                    <span className="text-white font-bold">{gemFactors.cut}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Color Intensity:</span>
                    <span className="text-white font-bold">{gemFactors.colour_intensity}</span>
                  </div>
                </div>
              )}

              {/* Main Price */}
              <div className="text-center py-4">
                <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wider mb-2 font-semibold">
                  Estimated Price Range
                </p>

                <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-blue-400 tracking-tight mb-3">
                  {result
                    ? `LKR ${formatLkr(result.prediction_interval.lower_total_price_lkr)} – LKR ${formatLkr(result.prediction_interval.upper_total_price_lkr)}`
                    : '—'}
                </p>
                <div className="inline-block px-4 py-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded-full text-xs sm:text-sm font-semibold">
                  {result ? `${(result.prediction_interval.confidence_level * 100).toFixed(0)}% prediction interval` : 'Prediction interval'}
                </div>

                <div className="mt-4 text-2xl sm:text-2xl lg:text-2xl font-bold gradient-text tracking-tight mb-3">
                  LKR {result ? formatLkr(result.predicted_total_price_lkr) : '—'}
                </div>

              </div>

              {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">
                    Predicted Price per Carat
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-violet-400">
                    LKR {result ? formatLkr(result.predicted_price_per_carat_lkr) : '—'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10 shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">
                    Price-per-Carat Interval
                  </p>
                  <p className="text-base sm:text-lg font-bold text-cyan-400 leading-relaxed">
                    {result
                      ? `LKR ${formatLkr(result.prediction_interval.lower_price_per_carat_lkr)} – LKR ${formatLkr(result.prediction_interval.upper_price_per_carat_lkr)}`
                      : '—'}
                  </p>
                </div>
              </div> */}

              {/* <p className="text-xs text-gray-500 text-center leading-relaxed">
                The total price and its interval are calculated by multiplying the predicted price per carat and interval bounds by {gemFactors.weight_ct} ct.
              </p> */}

              {result && (
                <div className="space-y-6 border-t border-white/10 pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <h3 className="text-lg sm:text-xl font-bold text-white">
                        Why the model predicted this price
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                      Local SHAP explains this specific voting-ensemble prediction in price-per-carat space. The percentages show each factor&apos;s share of the total explanation strength.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {result.explanation.categories.map((category) => {
                      const isIncrease = category.direction === 'increase';
                      const isGemological = category.category === 'Gemological';
                      const isEconomic = category.category === 'Economic';
                      const CategoryIcon = isGemological ? Gem : isEconomic ? Landmark : CalendarDays;
                      const accent = isGemological
                        ? 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5'
                        : isEconomic
                          ? 'text-violet-400 border-violet-500/20 bg-violet-500/5'
                          : 'text-amber-400 border-amber-500/20 bg-amber-500/5';

                      return (
                        <div key={category.category} className={`rounded-xl border p-4 ${accent}`}>
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <CategoryIcon className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-bold uppercase tracking-wider truncate">
                                {category.category}
                              </span>
                            </div>
                            {category.direction === 'neutral' ? (
                              <Sparkles className="w-4 h-4 text-gray-400" />
                            ) : isIncrease ? (
                              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-rose-400" />
                            )}
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {category.influence_percentage.toFixed(1)}%
                          </p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            of overall influence
                          </p>
                          <div className="h-1.5 rounded-full bg-black/30 overflow-hidden mt-3">
                            <div
                              className="h-full rounded-full bg-current"
                              style={{ width: `${Math.min(category.influence_percentage, 100)}%` }}
                            />
                          </div>
                          <p className={`text-xs font-semibold mt-3 ${isIncrease ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isIncrease ? 'Increased' : category.direction === 'neutral' ? 'Neutral' : 'Decreased'} estimate
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ensemble baseline price per carat (commented out for now)
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                        Ensemble baseline price per carat
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        The expected model output before this gemstone&apos;s feature effects are applied.
                      </p>
                    </div>
                    <p className="text-lg font-bold text-white whitespace-nowrap">
                      LKR {formatLkr(result.explanation.baseline_price_per_carat_lkr)}
                    </p>
                  </div>
                  */}

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Feature contributions</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Ranked by influence on this individual prediction.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {result.explanation.factors.map((factor) => {
                        const isIncrease = factor.direction === 'increase';
                        const isNeutral = factor.direction === 'neutral';
                        return (
                          <div
                            key={factor.factor}
                            className="rounded-xl border border-white/10 bg-white/[0.035] p-4 hover:bg-white/[0.055] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">
                                  {factor.display_name}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">
                                  {factor.category}
                                </p>
                              </div>
                              <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg border ${isNeutral
                                ? 'text-gray-400 bg-white/5 border-white/10'
                                : isIncrease
                                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                }`}>
                                {factor.influence_percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden mt-4">
                              <div
                                className={`h-full rounded-full ${isNeutral ? 'bg-gray-500' : isIncrease ? 'bg-emerald-400' : 'bg-rose-400'
                                  }`}
                                style={{ width: `${Math.min(factor.influence_percentage, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-3 text-xs">
                              <span className={isNeutral ? 'text-gray-400' : isIncrease ? 'text-emerald-400' : 'text-rose-400'}>
                                {isNeutral ? 'Neutral effect' : isIncrease ? 'Pushed estimate up' : 'Pushed estimate down'}
                              </span>
                              <span className="text-gray-500 font-semibold">
                                {factor.approximate_effect_percentage > 0 ? '+' : ''}{factor.approximate_effect_percentage.toFixed(1)}% effect
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500 leading-relaxed border-l-2 border-violet-500/30 pl-3">
                    {result.explanation.interpretation_note} Approximate effects are derived from the model&apos;s logarithmic price-per-carat output.
                  </p>
                </div>
              )}

              {/* Reset / Finish Buttons */}
              <div className="flex flex-col gap-3">
                {isFlowActive ? (
                  <button
                    onClick={() => {
                      sessionStorage.removeItem('faceted_flow_active');
                      sessionStorage.removeItem('faceted_flow_step');
                      sessionStorage.removeItem('faceted_flow_image');
                      sessionStorage.removeItem('faceted_flow_image_name');
                      sessionStorage.removeItem('faceted_flow_auth_result');
                      sessionStorage.removeItem('faceted_flow_identify_result');
                      router.push('/');
                    }}
                    className="btn-primary w-full py-3.5 sm:py-4 text-sm sm:text-base font-bold cursor-pointer"
                  >
                    Finish & Return Home
                  </button>
                ) : null}
                <button
                  onClick={handleReset}
                  className="btn-secondary w-full py-3.5 sm:py-4 text-sm sm:text-base cursor-pointer"
                >
                  {isFlowActive ? 'Recalculate Value' : 'New Valuation'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Sidebar */}
        {/* <div className="lg:col-span-1">
          <div className="glass-panel p-5 sm:p-6 sticky top-8 space-y-5 text-sm text-gray-400">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-3">
              About This Tool
            </h3>
            <p className="leading-relaxed">
              This engine predicts a gemstone&apos;s price per carat, then multiplies it by the entered carat weight to calculate the estimated total price.
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-300">Voting Ensemble:</h4>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>LightGBM Regressor</li>
                <li>Random Forest Regressor</li>
                <li>Gradient Boosting Regressor</li>
              </ul>
            </div>
            <p className="leading-relaxed">
              The displayed range is a calibrated prediction interval, not a probability that the point estimate is correct.
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-300">Features Analyzed:</h4>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Gem characteristics (weight, type, clarity, etc.)</li>
                <li>Economic indicators (CCPI, gold price, GDP, etc.)</li>
              </ul>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
