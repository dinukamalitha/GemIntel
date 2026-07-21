"""Inference service for the calibrated price-per-carat voting ensemble."""

from __future__ import annotations

import math
import os
from threading import Lock
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.config import VALUATION_BUNDLE_PATH, VALUATION_N_JOBS
from app.schemas.valuation import ValuationRequest
from app.services.economic_history_service import (
    EconomicHistoryCoverageError,
    EconomicHistoryError,
    economic_context_for_date,
    latest_history_context_for_date,
)
from app.services.valuation_explanation_service import (
    ValuationExplanationError,
    explain_voting_prediction,
)


EXPECTED_FEATURES = (
    "Gem_Type", "Hue", "Clarity", "Shape", "Cut",
    "Natural Or Synthetic", "Colour_Intensity", "Heat_Treatment",
    "Weight_ct", "Log_Weight_ct", "Is_Natural", "Year", "Month",
    "Quarter", "Month_Sin", "Month_Cos", "CCPI", "CCPI_YoY", "SLFR",
    "Gold_LKR", "GDP_Growth", "Monthly_Avg_Exchange_Rate",
    "CCPI_lag1", "CCPI_YoY_lag1", "SLFR_lag1", "Gold_LKR_lag1",
    "GDP_Growth_lag1", "Monthly_Avg_Exchange_Rate_lag1", "CCPI_lag2",
    "CCPI_YoY_lag2", "SLFR_lag2", "Gold_LKR_lag2", "GDP_Growth_lag2",
    "Monthly_Avg_Exchange_Rate_lag2", "CCPI_lag3", "CCPI_YoY_lag3",
    "SLFR_lag3", "Gold_LKR_lag3", "GDP_Growth_lag3",
    "Monthly_Avg_Exchange_Rate_lag3",
)

CATEGORICAL_OPTIONS = {
    "gem_type": ["Ceylon Blue Sapphire", "Ceylon Blue Spinel", "Ceylon Blue Topaz"],
    "hue": ["Blue", "Cobalt Blue", "Cornflower Blue", "London Blue", "Royal Blue", "Sky Blue", "Swiss Blue"],
    "clarity": ["Eye-clean", "IF", "VS", "VVS"],
    "shape": ["Asscher", "Cushion", "Emerald", "Heart", "Marquise", "Oval", "Pear", "Radiant", "Round"],
    "cut": ["Asscher Cut", "Brilliant", "Emerald", "Mixed", "Radiant Cut", "Step"],
    "natural_or_synthetic": ["Natural", "Synthetic"],
    "colour_intensity": ["Dark", "Deep", "Intense", "Light", "Medium", "Vivid"],
    "heat_treatment": ["Heat Treated", "Not Heat Treated"],
}

_bundle: dict[str, Any] | None = None
_load_lock = Lock()


class ValuationModelError(RuntimeError):
    """Raised when the valuation bundle cannot be loaded or used."""


class ValuationInputError(ValueError):
    """Raised when an input is outside the model's trained categories."""


def _conformal_quantile(residuals: np.ndarray, confidence_level: float) -> float:
    """Use the same finite-sample conformal rule as the training notebook."""
    n = len(residuals)
    quantile_level = min(1.0, math.ceil((n + 1) * confidence_level) / n)
    return float(np.quantile(residuals, quantile_level, method="higher"))


def _limit_model_parallelism(model: Any) -> None:
    if hasattr(model, "n_jobs"):
        model.set_params(n_jobs=VALUATION_N_JOBS)

    for pipeline in getattr(model, "estimators_", []):
        final_estimator = getattr(pipeline, "named_steps", {}).get("model")
        if final_estimator is not None and hasattr(final_estimator, "n_jobs"):
            final_estimator.set_params(n_jobs=VALUATION_N_JOBS)


def _validate_bundle(bundle: Any) -> dict[str, Any]:
    if not isinstance(bundle, dict):
        raise ValuationModelError("Valuation bundle must be a dictionary.")
    if bundle.get("artifact_version") != 1:
        raise ValuationModelError("Unsupported valuation artifact version.")
    if bundle.get("target") != "Log_Price_Per_Carat":
        raise ValuationModelError("Valuation bundle has an unexpected prediction target.")
    if tuple(bundle.get("features", ())) != EXPECTED_FEATURES:
        raise ValuationModelError("Valuation bundle feature schema does not match the API schema.")

    model = bundle.get("model")
    if model is None or not hasattr(model, "predict"):
        raise ValuationModelError("Valuation bundle does not contain a fitted model.")

    model_names = bundle.get("model_names")
    weights = bundle.get("weights")
    if not isinstance(model_names, list) or not isinstance(weights, dict):
        raise ValuationModelError("Valuation bundle model metadata is invalid.")
    if set(model_names) != set(weights):
        raise ValuationModelError("Valuation model names and weights do not match.")
    weight_values = np.asarray([weights[name] for name in model_names], dtype=float)
    if not np.isfinite(weight_values).all() or (weight_values <= 0).any():
        raise ValuationModelError("Valuation ensemble weights must be finite and positive.")
    if not math.isclose(float(weight_values.sum()), 1.0, rel_tol=1e-9, abs_tol=1e-9):
        raise ValuationModelError("Valuation ensemble weights must sum to one.")

    calibration = bundle.get("calibration")
    if not isinstance(calibration, dict):
        raise ValuationModelError("Valuation bundle has no calibration metadata.")
    residuals = np.asarray(calibration.get("residuals", ()), dtype=float)
    if residuals.ndim != 1 or len(residuals) == 0 or not np.isfinite(residuals).all():
        raise ValuationModelError("Calibration residuals must be a finite one-dimensional array.")
    if (residuals < 0).any():
        raise ValuationModelError("Calibration residuals cannot be negative.")
    if calibration.get("rows") != len(residuals):
        raise ValuationModelError("Calibration row count does not match the saved residuals.")

    _limit_model_parallelism(model)
    return bundle


def load_valuation_models(force: bool = False) -> None:
    """Load and validate the deployment bundle once per backend process."""
    global _bundle
    if _bundle is not None and not force:
        return

    with _load_lock:
        if _bundle is not None and not force:
            return
        if not os.path.isfile(VALUATION_BUNDLE_PATH):
            raise ValuationModelError(
                f"Missing valuation bundle at {VALUATION_BUNDLE_PATH}"
            )
        try:
            loaded = joblib.load(VALUATION_BUNDLE_PATH)
        except Exception as exc:
            raise ValuationModelError(f"Could not load valuation bundle: {exc}") from exc
        _bundle = _validate_bundle(loaded)


def valuation_model_metadata() -> dict[str, Any]:
    if _bundle is None:
        load_valuation_models()
    assert _bundle is not None
    calibration = _bundle["calibration"]
    return {
        "artifact_version": _bundle["artifact_version"],
        "target": "log_price_per_carat",
        "feature_count": len(EXPECTED_FEATURES),
        "model_names": _bundle["model_names"],
        "weights": _bundle["weights"],
        "calibration_method": calibration["method"],
        "calibration_rows": calibration["rows"],
        "precomputed_quantiles": calibration.get("precomputed_quantiles", {}),
        "test_metrics": _bundle.get("test_metrics", {}),
    }


SHAPE_SYNONYMS = {
    "square": "Asscher",
    "square emerald": "Asscher",
    "square_emerald": "Asscher",
    "princess": "Radiant",
    "baguette": "Emerald",
    "trillion": "Radiant",
    "trilliant": "Radiant",
    "octagonal": "Emerald",
}

CUT_SYNONYMS = {
    "mixed brilliant": "Mixed",
    "mixed_brilliant": "Mixed",
    "modified brilliant": "Brilliant",
    "step cut": "Step",
    "radiant cut": "Radiant Cut",
    "asscher cut": "Asscher Cut",
}

def _normalize_category_value(field: str, value: str) -> str:
    if not isinstance(value, str):
        return value
    clean = value.strip()
    allowed = CATEGORICAL_OPTIONS.get(field, [])
    
    # 1. Exact match
    if clean in allowed:
        return clean

    # 2. Case-insensitive lookup map
    lower_map = {opt.lower(): opt for opt in allowed}
    if clean.lower() in lower_map:
        return lower_map[clean.lower()]

    # 3. Synonym fallbacks
    if field == "shape":
        syn = SHAPE_SYNONYMS.get(clean.lower())
        if syn and syn in allowed:
            return syn
        # Suffix strip e.g. "Square Cut" -> "Square" -> "Asscher"
        if clean.lower().endswith(" cut"):
            base = clean[:-4].strip()
            if base.lower() in lower_map:
                return lower_map[base.lower()]
            if base.lower() in SHAPE_SYNONYMS:
                return SHAPE_SYNONYMS[base.lower()]
    elif field == "cut":
        syn = CUT_SYNONYMS.get(clean.lower())
        if syn and syn in allowed:
            return syn

    # 4. Partial / word match fallback
    for opt in allowed:
        if clean.lower() in opt.lower() or opt.lower() in clean.lower():
            return opt

    return clean


def _validate_categories(request: ValuationRequest) -> None:
    gem = request.gem_factors
    fields = [
        "gem_type", "hue", "clarity", "shape", "cut",
        "natural_or_synthetic", "colour_intensity", "heat_treatment",
    ]
    for field in fields:
        raw_val = getattr(gem, field)
        normalized = _normalize_category_value(field, raw_val)
        setattr(gem, field, normalized)
        
        if normalized not in CATEGORICAL_OPTIONS[field]:
            raise ValuationInputError(
                f"Unsupported {field} '{raw_val}'. Allowed values: {CATEGORICAL_OPTIONS[field]}"
            )



def _economic_columns(snapshot, suffix: str = "") -> dict[str, float]:
    return {
        f"CCPI{suffix}": snapshot.ccpi,
        f"CCPI_YoY{suffix}": snapshot.ccpi_yoy,
        f"SLFR{suffix}": snapshot.slfr,
        f"Gold_LKR{suffix}": snapshot.gold_lkr,
        f"GDP_Growth{suffix}": snapshot.gdp_growth,
        f"Monthly_Avg_Exchange_Rate{suffix}": snapshot.exchange_rate,
    }


def resolve_economic_context(request: ValuationRequest) -> dict[str, Any]:
    if request.economic_source == "historical":
        try:
            return economic_context_for_date(request.valuation_date)
        except EconomicHistoryCoverageError as exc:
            raise ValuationInputError(str(exc)) from exc
        except EconomicHistoryError as exc:
            raise ValuationModelError(str(exc)) from exc

    if request.economic_source == "latest_available":
        assert request.economic_factors is not None
        try:
            return latest_history_context_for_date(
                request.valuation_date,
                request.economic_factors,
            )
        except EconomicHistoryCoverageError as exc:
            raise ValuationInputError(str(exc)) from exc
        except EconomicHistoryError as exc:
            raise ValuationModelError(str(exc)) from exc

    assert request.economic_factors is not None
    assert request.economic_lags is not None
    valuation_month = pd.Period(request.valuation_date, freq="M")
    return {
        "source": "manual",
        "valuation_month": str(valuation_month),
        "current": request.economic_factors,
        "lags": request.economic_lags,
        "lag_months": [str(valuation_month - offset) for offset in range(1, 4)],
    }


def build_feature_frame(
    request: ValuationRequest,
    economic_context: dict[str, Any] | None = None,
) -> pd.DataFrame:
    """Derive the exact 40-column feature row used during model training."""
    _validate_categories(request)
    context = economic_context or resolve_economic_context(request)
    gem = request.gem_factors
    month = request.valuation_date.month
    row: dict[str, Any] = {
        "Gem_Type": gem.gem_type, "Hue": gem.hue, "Clarity": gem.clarity,
        "Shape": gem.shape, "Cut": gem.cut,
        "Natural Or Synthetic": gem.natural_or_synthetic,
        "Colour_Intensity": gem.colour_intensity,
        "Heat_Treatment": gem.heat_treatment, "Weight_ct": gem.weight_ct,
        "Log_Weight_ct": math.log1p(gem.weight_ct),
        "Is_Natural": 1 if gem.natural_or_synthetic == "Natural" else 0,
        "Year": request.valuation_date.year, "Month": month,
        "Quarter": ((month - 1) // 3) + 1,
        "Month_Sin": math.sin(2 * math.pi * month / 12),
        "Month_Cos": math.cos(2 * math.pi * month / 12),
    }
    row.update(_economic_columns(context["current"]))
    for lag_number, snapshot in enumerate(context["lags"], start=1):
        row.update(_economic_columns(snapshot, suffix=f"_lag{lag_number}"))

    frame = pd.DataFrame([row], columns=EXPECTED_FEATURES)
    numeric = frame.select_dtypes(include=[np.number]).to_numpy(dtype=float)
    if not np.isfinite(numeric).all():
        raise ValuationInputError("All numeric valuation inputs must be finite values.")
    return frame


def predict_price(request: ValuationRequest) -> dict[str, Any]:
    """Predict log-PPC and return calibrated per-carat and total-price bounds."""
    if _bundle is None:
        load_valuation_models()
    assert _bundle is not None

    economic_context = resolve_economic_context(request)
    frame = build_feature_frame(request, economic_context=economic_context)
    model = _bundle["model"]
    try:
        ensemble_log_ppc = float(model.predict(frame)[0])
    except Exception as exc:
        raise ValuationModelError(f"Ensemble prediction failed: {exc}") from exc
    if not math.isfinite(ensemble_log_ppc):
        raise ValuationModelError("The valuation ensemble returned a non-finite prediction.")

    weight_ct = request.gem_factors.weight_ct
    price_per_carat = max(float(np.expm1(ensemble_log_ppc)), 0.0)
    total_price = price_per_carat * weight_ct

    residuals = np.asarray(_bundle["calibration"]["residuals"], dtype=float)
    residual_quantile = _conformal_quantile(residuals, request.confidence_level)
    lower_ppc = max(float(np.expm1(ensemble_log_ppc - residual_quantile)), 0.0)
    upper_ppc = max(float(np.expm1(ensemble_log_ppc + residual_quantile)), 0.0)

    breakdown = {}
    names = _bundle["model_names"]
    weights = _bundle["weights"]
    fitted_estimators = list(getattr(model, "estimators_", []))
    if len(fitted_estimators) != len(names):
        raise ValuationModelError("Fitted base estimators do not match bundle metadata.")
    for name, estimator in zip(names, fitted_estimators):
        log_prediction = float(estimator.predict(frame)[0])
        model_ppc = max(float(np.expm1(log_prediction)), 0.0)
        breakdown[name] = {
            "weight": float(weights[name]),
            "predicted_log_price_per_carat": log_prediction,
            "predicted_price_per_carat_lkr": model_ppc,
            "predicted_total_price_lkr": model_ppc * weight_ct,
        }

    try:
        explanation = explain_voting_prediction(
            voting_model=model,
            frame=frame,
            model_names=names,
            weights_by_name=weights,
            weight_ct=weight_ct,
        )
    except ValuationExplanationError as exc:
        raise ValuationModelError(
            f"Voting ensemble SHAP explanation failed: {exc}"
        ) from exc

    return {
        "status": "success", "currency": "LKR",
        "target": "log_price_per_carat",
        "predicted_log_price_per_carat": ensemble_log_ppc,
        "predicted_price_per_carat_lkr": price_per_carat,
        "predicted_total_price_lkr": total_price,
        "prediction_interval": {
            "confidence_level": request.confidence_level,
            "method": "out_of_fold_conformal_absolute_log_residuals",
            "calibration_rows": len(residuals),
            "log_residual_quantile": residual_quantile,
            "lower_price_per_carat_lkr": lower_ppc,
            "upper_price_per_carat_lkr": upper_ppc,
            "lower_total_price_lkr": lower_ppc * weight_ct,
            "upper_total_price_lkr": upper_ppc * weight_ct,
        },
        "model_predictions": breakdown,
        "explanation": explanation,
        "economic_context": economic_context,
    }
