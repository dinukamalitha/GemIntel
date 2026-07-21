"""Local TreeSHAP explanations for the deployed valuation voting ensemble."""

from __future__ import annotations

import math
import re
from collections import defaultdict
from threading import Lock
from typing import Any

import numpy as np
import pandas as pd
import shap


CATEGORICAL_FEATURES = (
    "Gem_Type", "Hue", "Clarity", "Shape", "Cut",
    "Natural Or Synthetic", "Colour_Intensity", "Heat_Treatment",
)

ECONOMIC_FACTORS = {
    "CCPI", "CCPI_YoY", "SLFR", "Gold_LKR", "GDP_Growth",
    "Monthly_Avg_Exchange_Rate",
}

FRIENDLY_NAMES = {
    "Gem_Type": "Gem Type", "Weight": "Weight", "Hue": "Hue",
    "Clarity": "Clarity", "Shape": "Shape", "Cut": "Cut",
    "Natural_Origin": "Natural or Synthetic",
    "Colour_Intensity": "Colour Intensity",
    "Heat_Treatment": "Heat Treatment",
    "CCPI": "Consumer Price Index", "CCPI_YoY": "Inflation Rate",
    "SLFR": "Interest Rate", "Gold_LKR": "Gold Price",
    "GDP_Growth": "GDP Growth",
    "Monthly_Avg_Exchange_Rate": "Exchange Rate",
    "Date_Seasonality": "Date / Seasonality", "Year": "Year",
}

_explainer_cache: dict[int, Any] = {}
_explainer_lock = Lock()


class ValuationExplanationError(RuntimeError):
    """Raised when a valid local explanation cannot be generated."""


def _get_explainer(tree_model: Any):
    cache_key = id(tree_model)
    explainer = _explainer_cache.get(cache_key)
    if explainer is not None:
        return explainer
    with _explainer_lock:
        explainer = _explainer_cache.get(cache_key)
        if explainer is None:
            explainer = shap.TreeExplainer(tree_model)
            _explainer_cache[cache_key] = explainer
    return explainer


def _normalize_values(explanation: Any) -> np.ndarray:
    values = np.asarray(explanation.values)
    if values.ndim == 3 and values.shape[-1] == 1:
        values = values[:, :, 0]
    if values.ndim == 1:
        values = values.reshape(1, -1)
    if values.ndim != 2:
        raise ValuationExplanationError(
            f"Unexpected SHAP value shape: {values.shape}"
        )
    return values.astype(float)


def _normalize_base_values(explanation: Any, row_count: int) -> np.ndarray:
    base_values = np.asarray(explanation.base_values, dtype=float).squeeze()
    if base_values.ndim == 0:
        return np.repeat(float(base_values), row_count)
    if len(base_values) == 1 and row_count > 1:
        return np.repeat(float(base_values[0]), row_count)
    return base_values.reshape(-1)


def _explain_pipeline(pipeline: Any, frame: pd.DataFrame) -> dict[str, Any]:
    named_steps = getattr(pipeline, "named_steps", {})
    preprocessor = named_steps.get("preprocess")
    tree_model = named_steps.get("model")
    if preprocessor is None or tree_model is None:
        raise ValuationExplanationError(
            "Each voting estimator must contain preprocess and model steps."
        )

    transformed = preprocessor.transform(frame)
    if hasattr(transformed, "toarray"):
        transformed = transformed.toarray()
    feature_names = list(preprocessor.get_feature_names_out())
    encoded = pd.DataFrame(transformed, columns=feature_names, index=frame.index)

    explainer = _get_explainer(tree_model)
    try:
        explanation = explainer(encoded, check_additivity=False)
    except TypeError:
        explanation = explainer(encoded)

    return {
        "feature_names": feature_names,
        "values": _normalize_values(explanation),
        "base_values": _normalize_base_values(explanation, len(encoded)),
    }


def _original_feature(encoded_name: str) -> str:
    clean_name = re.sub(r"^(cat|num)__", "", str(encoded_name))
    for feature in sorted(CATEGORICAL_FEATURES, key=len, reverse=True):
        if clean_name == feature or clean_name.startswith(f"{feature}_"):
            return feature
    return clean_name


def _business_factor(original_feature: str) -> str:
    if original_feature in {"Weight_ct", "Log_Weight_ct"}:
        return "Weight"
    if original_feature in {"Natural Or Synthetic", "Is_Natural"}:
        return "Natural_Origin"
    if original_feature in {"Month", "Quarter", "Month_Sin", "Month_Cos"}:
        return "Date_Seasonality"
    lag_match = re.match(r"^(.*)_lag[123]$", original_feature)
    return lag_match.group(1) if lag_match else original_feature


def _category(factor: str) -> str:
    if factor in ECONOMIC_FACTORS:
        return "Economic"
    if factor in {"Date_Seasonality", "Year"}:
        return "Calendar"
    return "Gemological"


def _effect_percentage(shap_value: float) -> float:
    """Convert a log-target SHAP value to its isolated multiplicative effect."""
    return float((np.exp(np.clip(shap_value, -20, 20)) - 1) * 100)


def explain_voting_prediction(
    voting_model: Any,
    frame: pd.DataFrame,
    model_names: list[str],
    weights_by_name: dict[str, float],
    weight_ct: float,
) -> dict[str, Any]:
    """Apply the notebook's exact weighted TreeSHAP aggregation to one row."""
    fitted_estimators = list(getattr(voting_model, "estimators_", []))
    if len(fitted_estimators) != len(model_names):
        raise ValuationExplanationError(
            "Fitted estimators do not match the explanation metadata."
        )

    weights = np.asarray([weights_by_name[name] for name in model_names], dtype=float)
    weights = weights / weights.sum()
    combined_values: np.ndarray | None = None
    combined_base = np.zeros(len(frame), dtype=float)
    reference_names: list[str] | None = None

    for model_weight, pipeline in zip(weights, fitted_estimators):
        explanation = _explain_pipeline(pipeline, frame)
        feature_names = explanation["feature_names"]
        if reference_names is None:
            reference_names = feature_names
        elif feature_names != reference_names:
            raise ValuationExplanationError(
                "Voting estimators do not share the same encoded feature structure."
            )
        weighted_values = model_weight * explanation["values"]
        combined_values = (
            weighted_values.copy()
            if combined_values is None
            else combined_values + weighted_values
        )
        combined_base += model_weight * explanation["base_values"]

    if combined_values is None or reference_names is None:
        raise ValuationExplanationError("The voting ensemble contains no estimators.")

    prediction = float(voting_model.predict(frame)[0])
    reconstructed = float(combined_base[0] + combined_values[0].sum())
    reconstruction_error = abs(prediction - reconstructed)
    if not math.isfinite(reconstruction_error):
        raise ValuationExplanationError("SHAP produced a non-finite reconstruction.")

    grouped: dict[str, float] = defaultdict(float)
    for encoded_name, shap_value in zip(reference_names, combined_values[0]):
        grouped[_business_factor(_original_feature(encoded_name))] += float(shap_value)

    total_absolute = sum(abs(value) for value in grouped.values())
    factors = []
    for factor, shap_value in grouped.items():
        factors.append({
            "factor": factor,
            "display_name": FRIENDLY_NAMES.get(factor, factor.replace("_", " ")),
            "category": _category(factor),
            "shap_value_log_price_per_carat": shap_value,
            "influence_percentage": (
                100.0 * abs(shap_value) / total_absolute if total_absolute else 0.0
            ),
            "approximate_effect_percentage": _effect_percentage(shap_value),
            "direction": "increase" if shap_value > 0 else (
                "decrease" if shap_value < 0 else "neutral"
            ),
        })
    factors.sort(key=lambda item: item["influence_percentage"], reverse=True)

    category_values: dict[str, float] = defaultdict(float)
    category_absolute: dict[str, float] = defaultdict(float)
    for item in factors:
        category_values[item["category"]] += item["shap_value_log_price_per_carat"]
        category_absolute[item["category"]] += abs(
            item["shap_value_log_price_per_carat"]
        )

    categories = []
    for category in ("Gemological", "Economic", "Calendar"):
        signed_value = category_values[category]
        categories.append({
            "category": category,
            "shap_value_log_price_per_carat": signed_value,
            "influence_percentage": (
                100.0 * category_absolute[category] / total_absolute
                if total_absolute else 0.0
            ),
            "approximate_effect_percentage": _effect_percentage(signed_value),
            "direction": "increase" if signed_value > 0 else (
                "decrease" if signed_value < 0 else "neutral"
            ),
        })

    baseline_log_ppc = float(combined_base[0])
    baseline_ppc = max(float(np.expm1(baseline_log_ppc)), 0.0)
    return {
        "method": "weighted_tree_shap",
        "output_space": "log_price_per_carat",
        "percentage_definition": (
            "Absolute grouped SHAP value divided by the sum of all absolute "
            "grouped SHAP values."
        ),
        "baseline_log_price_per_carat": baseline_log_ppc,
        "baseline_price_per_carat_lkr": baseline_ppc,
        "baseline_total_price_lkr": baseline_ppc * weight_ct,
        "reconstructed_log_price_per_carat": reconstructed,
        "reconstruction_error": reconstruction_error,
        "factors": factors,
        "categories": categories,
        "interpretation_note": (
            "Contribution percentages represent relative SHAP importance for "
            "this prediction and are not causal percentages of market price."
        ),
    }
