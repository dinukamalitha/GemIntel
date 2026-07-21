from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services.carat_service import estimate_carat, SG, SHAPE_FACTOR

router = APIRouter()


@router.get("/options")
def get_options():
    """Valid gem types and cut shapes for the carat form."""
    return {
        "gem_types": sorted(SG.keys()),
        "cut_shapes": sorted(SHAPE_FACTOR.keys()),
    }


@router.post("/estimate")
async def estimate(
    top_image: UploadFile = File(..., description="Top-down photo (coin + stone)"),
    side_image: UploadFile = File(..., description="Side photo (coin + stone on edge)"),
    gem_type: str = Form(...),
    cut_shape: str = Form(...),
    coin_diameter_mm: float = Form(..., description="Real coin diameter, e.g. Sri Lanka Rs.2 = 22.0"),
):
    """Estimate carat weight from two coin-referenced photos (top + side)."""
    try:
        top_bytes = await top_image.read()
        side_bytes = await side_image.read()
        if not top_bytes or not side_bytes:
            raise ValueError("Both a top and a side image are required.")
        return estimate_carat(top_bytes, side_bytes, gem_type, cut_shape, coin_diameter_mm)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Carat estimation failed: {e}")
