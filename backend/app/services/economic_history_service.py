"""Validated monthly economic history used by valuation inference."""

from __future__ import annotations

import os
from functools import lru_cache

import numpy as np
import pandas as pd

from app.config import VALUATION_ECONOMIC_HISTORY_PATH
from app.schemas.valuation import EconomicSnapshot


ECONOMIC_COLUMNS = (
    "CCPI",
    "CCPI_YoY",
    "SLFR",
    "Gold_LKR",
    "GDP_Growth",
    "Monthly_Avg_Exchange_Rate",
)


class EconomicHistoryError(RuntimeError):
    """Raised when the economic history is missing or invalid."""


class EconomicHistoryCoverageError(ValueError):
    """Raised when a requested month is outside complete history coverage."""


@lru_cache(maxsize=1)
def load_economic_history() -> pd.DataFrame:
    if not os.path.isfile(VALUATION_ECONOMIC_HISTORY_PATH):
        raise EconomicHistoryError(
            f"Missing economic history at {VALUATION_ECONOMIC_HISTORY_PATH}"
        )

    try:
        history = pd.read_csv(VALUATION_ECONOMIC_HISTORY_PATH)
    except Exception as exc:
        raise EconomicHistoryError(f"Could not read economic history: {exc}") from exc

    required = ["YearMonth", *ECONOMIC_COLUMNS]
    if list(history.columns) != required:
        raise EconomicHistoryError(
            f"Economic history columns must be exactly: {required}"
        )
    if history["YearMonth"].duplicated().any():
        raise EconomicHistoryError("Economic history contains duplicate months.")

    try:
        history["Month"] = pd.PeriodIndex(history["YearMonth"], freq="M")
    except Exception as exc:
        raise EconomicHistoryError("Economic history has invalid YearMonth values.") from exc

    history = history.sort_values("Month").reset_index(drop=True)
    expected_months = pd.period_range(
        history["Month"].min(), history["Month"].max(), freq="M"
    )
    if list(history["Month"]) != list(expected_months):
        raise EconomicHistoryError("Economic history must contain consecutive months.")

    numeric = history[list(ECONOMIC_COLUMNS)].apply(pd.to_numeric, errors="coerce")
    if numeric.isna().any().any() or not np.isfinite(numeric.to_numpy()).all():
        raise EconomicHistoryError("Economic history contains missing or non-finite values.")
    if (numeric[["Gold_LKR", "Monthly_Avg_Exchange_Rate"]] <= 0).any().any():
        raise EconomicHistoryError("Gold and exchange-rate history must be positive.")
    history[list(ECONOMIC_COLUMNS)] = numeric
    return history.set_index("Month", drop=False)


def economic_history_metadata() -> dict:
    history = load_economic_history()
    earliest = history.index.min()
    latest = history.index.max()
    return {
        "rows": len(history),
        "earliest_month": str(earliest),
        "earliest_complete_valuation_month": str(earliest + 3),
        "latest_month": str(latest),
        "required_monthly_lags": 3,
    }


def _snapshot(row: pd.Series) -> EconomicSnapshot:
    return EconomicSnapshot(
        ccpi=float(row["CCPI"]),
        ccpi_yoy=float(row["CCPI_YoY"]),
        slfr=float(row["SLFR"]),
        gold_lkr=float(row["Gold_LKR"]),
        gdp_growth=float(row["GDP_Growth"]),
        exchange_rate=float(row["Monthly_Avg_Exchange_Rate"]),
    )


def economic_context_for_date(valuation_date) -> dict:
    history = load_economic_history()
    valuation_month = pd.Period(valuation_date, freq="M")
    required_months = [valuation_month - offset for offset in range(4)]
    missing = [str(month) for month in required_months if month not in history.index]
    if missing:
        metadata = economic_history_metadata()
        raise EconomicHistoryCoverageError(
            "Automatic economic history is unavailable for "
            f"{valuation_month}. Missing months: {', '.join(missing)}. "
            "Complete automatic coverage is "
            f"{metadata['earliest_complete_valuation_month']} through "
            f"{metadata['latest_month']}; use manual economic input outside this range."
        )

    return {
        "source": "historical_database",
        "valuation_month": str(valuation_month),
        "current": _snapshot(history.loc[valuation_month]),
        "lags": [_snapshot(history.loc[month]) for month in required_months[1:]],
        "lag_months": [str(month) for month in required_months[1:]],
    }


def latest_history_context_for_date(
    valuation_date,
    current: EconomicSnapshot,
) -> dict:
    """Combine user-supplied current values with the latest three prior months."""
    history = load_economic_history()
    valuation_month = pd.Period(valuation_date, freq="M")
    available_prior_months = history.index[history.index < valuation_month]
    if len(available_prior_months) < 3:
        raise EconomicHistoryCoverageError(
            "At least three historical months before the valuation month are "
            "required for automatic lag selection."
        )

    selected_months = list(available_prior_months[-3:][::-1])
    return {
        "source": "current_with_latest_history",
        "valuation_month": str(valuation_month),
        "current": current,
        "lags": [_snapshot(history.loc[month]) for month in selected_months],
        "lag_months": [str(month) for month in selected_months],
    }
