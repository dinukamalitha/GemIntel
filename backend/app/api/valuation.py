from datetime import date

from fastapi import APIRouter, HTTPException

from app.schemas.valuation import ValuationRequest, ValuationResponse
from app.services.economic_history_service import (
    EconomicHistoryCoverageError,
    EconomicHistoryError,
    economic_context_for_date,
    economic_history_metadata,
)
from app.services.valuation_service import (
    CATEGORICAL_OPTIONS,
    EXPECTED_FEATURES,
    ValuationInputError,
    ValuationModelError,
    predict_price,
    valuation_model_metadata,
)


router = APIRouter()


@router.get("/factor-options")
def factor_options():
    """Return only values seen by the fitted categorical encoders."""
    try:
        model_metadata = valuation_model_metadata()
        history_metadata = economic_history_metadata()
    except (ValuationModelError, EconomicHistoryError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "factor_options": {
            "gem_factors": {
                **CATEGORICAL_OPTIONS,
                "weight_ct": {"min": 0, "max": 1000, "unit": "carat"},
            },
            "economic_factors": {
                "fields": [
                    "ccpi",
                    "ccpi_yoy",
                    "slfr",
                    "gold_lkr",
                    "gdp_growth",
                    "exchange_rate",
                ],
                "required_monthly_lags": 3,
                "historical_database": history_metadata,
            },
        },
        "model": model_metadata,
    }


@router.get("/economic-context")
def economic_context(valuation_date: date):
    """Return the current and three prior monthly snapshots for a date."""
    try:
        context = economic_context_for_date(valuation_date)
    except EconomicHistoryCoverageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except EconomicHistoryError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        **context,
        "current": context["current"].model_dump(),
        "lags": [snapshot.model_dump() for snapshot in context["lags"]],
    }


@router.post("/predict-price", response_model=ValuationResponse)
def valuation_prediction(request: ValuationRequest):
    try:
        return predict_price(request)
    except ValuationInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValuationModelError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
