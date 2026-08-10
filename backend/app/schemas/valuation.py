from datetime import date
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GemFactors(StrictSchema):
    gem_type: str
    hue: str
    clarity: str
    shape: str
    cut: str
    natural_or_synthetic: str
    colour_intensity: str
    heat_treatment: str
    weight_ct: float = Field(gt=0, le=1000)


class EconomicSnapshot(StrictSchema):
    ccpi: float
    ccpi_yoy: float
    slfr: float
    gold_lkr: float = Field(gt=0)
    gdp_growth: float
    exchange_rate: float = Field(gt=0)


class ValuationRequest(StrictSchema):
    gem_factors: GemFactors
    valuation_date: date
    economic_source: Literal["manual", "historical", "latest_available"] = "manual"
    economic_factors: Optional[EconomicSnapshot] = None
    economic_lags: Optional[List[EconomicSnapshot]] = None
    confidence_level: float = Field(default=0.90, gt=0, lt=1)

    @field_validator("economic_lags")
    @classmethod
    def require_three_monthly_lags(cls, value):
        if value is not None and len(value) != 3:
            raise ValueError(
                "economic_lags must contain exactly three snapshots ordered "
                "from lag 1 (previous month) to lag 3"
            )
        return value

    @model_validator(mode="after")
    def validate_economic_source(self):
        if self.economic_source == "manual":
            if self.economic_factors is None or self.economic_lags is None:
                raise ValueError(
                    "Manual economic input requires economic_factors and "
                    "exactly three economic_lags."
                )
        elif self.economic_source == "historical" and (
            self.economic_factors is not None or self.economic_lags is not None
        ):
            raise ValueError(
                "Historical economic mode loads current and lag values "
                "automatically; do not send manual economic fields."
            )
        elif self.economic_source == "latest_available":
            if self.economic_factors is None:
                raise ValueError(
                    "Latest-available mode requires current economic_factors."
                )
            if self.economic_lags is not None:
                raise ValueError(
                    "Latest-available mode selects historical lags automatically; "
                    "do not send economic_lags."
                )
        return self


class ModelPrediction(BaseModel):
    weight: float
    predicted_log_price_per_carat: float
    predicted_price_per_carat_lkr: float
    predicted_total_price_lkr: float


class PredictionInterval(BaseModel):
    confidence_level: float
    method: str
    calibration_rows: int
    log_residual_quantile: float
    lower_price_per_carat_lkr: float
    upper_price_per_carat_lkr: float
    lower_total_price_lkr: float
    upper_total_price_lkr: float


class ShapFactorContribution(BaseModel):
    factor: str
    display_name: str
    category: str
    shap_value_log_price_per_carat: float
    influence_percentage: float
    approximate_effect_percentage: float
    direction: str


class ShapCategoryContribution(BaseModel):
    category: str
    shap_value_log_price_per_carat: float
    influence_percentage: float
    approximate_effect_percentage: float
    direction: str


class LocalShapExplanation(BaseModel):
    method: str
    output_space: str
    percentage_definition: str
    baseline_log_price_per_carat: float
    baseline_price_per_carat_lkr: float
    baseline_total_price_lkr: float
    reconstructed_log_price_per_carat: float
    reconstruction_error: float
    factors: List[ShapFactorContribution]
    categories: List[ShapCategoryContribution]
    interpretation_note: str


class EconomicContextUsed(BaseModel):
    source: Literal["manual", "historical_database", "current_with_latest_history"]
    valuation_month: str
    current_month: str
    current: EconomicSnapshot
    lags: List[EconomicSnapshot]
    lag_months: List[str]


class ValuationResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: str
    currency: str
    target: str
    predicted_log_price_per_carat: float
    predicted_price_per_carat_lkr: float
    predicted_total_price_lkr: float
    prediction_interval: PredictionInterval
    model_predictions: Dict[str, ModelPrediction]
    explanation: LocalShapExplanation
    economic_context: EconomicContextUsed
