const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface FactorOptions {
  gem_factors: {
    gem_type: string[];
    hue: string[];
    clarity: string[];
    shape: string[];
    cut: string[];
    natural_or_synthetic: string[];
    colour_intensity: string[];
    heat_treatment: string[];
    weight_ct: { min: number; max: number; unit: string };
  };
  economic_factors: {
    fields: string[];
    required_monthly_lags: number;
    historical_database: {
      rows: number;
      earliest_month: string;
      earliest_complete_valuation_month: string;
      latest_month: string;
      required_monthly_lags: number;
    };
  };
}

export interface EconomicSnapshot {
  ccpi: number;
  ccpi_yoy: number;
  slfr: number;
  gold_lkr: number;
  gdp_growth: number;
  exchange_rate: number;
}

export interface GemFactors {
  weight_ct: number;
  gem_type: string;
  hue: string;
  clarity: string;
  shape: string;
  cut: string;
  natural_or_synthetic: string;
  colour_intensity: string;
  heat_treatment: string;
}

export interface ValuationRequest {
  gem_factors: GemFactors;
  valuation_date: string;
  economic_source: "manual" | "historical" | "latest_available";
  economic_factors?: EconomicSnapshot;
  economic_lags?: EconomicSnapshot[];
  confidence_level: number;
}

export interface ModelPrediction {
  weight: number;
  predicted_log_price_per_carat: number;
  predicted_price_per_carat_lkr: number;
  predicted_total_price_lkr: number;
}

export interface ShapFactorContribution {
  factor: string;
  display_name: string;
  category: "Gemological" | "Economic" | "Calendar";
  shap_value_log_price_per_carat: number;
  influence_percentage: number;
  approximate_effect_percentage: number;
  direction: "increase" | "decrease" | "neutral";
}

export interface ShapCategoryContribution {
  category: "Gemological" | "Economic" | "Calendar";
  shap_value_log_price_per_carat: number;
  influence_percentage: number;
  approximate_effect_percentage: number;
  direction: "increase" | "decrease" | "neutral";
}

export interface LocalShapExplanation {
  method: "weighted_tree_shap";
  output_space: "log_price_per_carat";
  percentage_definition: string;
  baseline_log_price_per_carat: number;
  baseline_price_per_carat_lkr: number;
  baseline_total_price_lkr: number;
  reconstructed_log_price_per_carat: number;
  reconstruction_error: number;
  factors: ShapFactorContribution[];
  categories: ShapCategoryContribution[];
  interpretation_note: string;
}

export interface PredictionResult {
  status: string;
  currency: "LKR";
  target: "log_price_per_carat";
  predicted_log_price_per_carat: number;
  predicted_price_per_carat_lkr: number;
  predicted_total_price_lkr: number;
  prediction_interval: {
    confidence_level: number;
    method: string;
    calibration_rows: number;
    log_residual_quantile: number;
    lower_price_per_carat_lkr: number;
    upper_price_per_carat_lkr: number;
    lower_total_price_lkr: number;
    upper_total_price_lkr: number;
  };
  model_predictions: Record<string, ModelPrediction>;
  explanation: LocalShapExplanation;
  economic_context: {
    source: "manual" | "historical_database" | "current_with_latest_history";
    valuation_month: string;
    current: EconomicSnapshot;
    lags: EconomicSnapshot[];
    lag_months: string[];
  };
}

export async function fetchFactorOptions(): Promise<FactorOptions> {
  const res = await fetch(`${API_BASE}/api/valuation/factor-options`);

  if (!res.ok) {
    throw new Error(`Failed to fetch factor options: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.factor_options;
}

export async function predictPrice(
  request: ValuationRequest
): Promise<PredictionResult> {
  const res = await fetch(`${API_BASE}/api/valuation/predict-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    const detail = error?.detail;
    throw new Error(
      typeof detail === "string" ? detail : "Valuation prediction failed"
    );
  }

  return res.json();
}
