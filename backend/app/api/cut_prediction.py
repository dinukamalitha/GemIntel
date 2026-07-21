

import os
import uuid
import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

# Your services (self-contained, no external dependencies)
from app.services.reconstruction_service import reconstruct_full
from app.services.cut_prediction_service import get_predictor


router = APIRouter()

# =========================================================
# CONFIGURATION
# =========================================================
# Where uploaded images and generated masks live (per session)
DEFAULT_DIR = Path(__file__).parent.parent.parent / "data" / "sessions"
try:
    DEFAULT_DIR.mkdir(parents=True, exist_ok=True)
    BASE_DATA_DIR = DEFAULT_DIR
except (PermissionError, OSError):
    # Fallback for read-only environments (like Hugging Face Spaces)
    BASE_DATA_DIR = Path("/tmp") / "gemintel" / "sessions"
    BASE_DATA_DIR.mkdir(parents=True, exist_ok=True)

VALID_GEM_TYPES = {"blue_sapphire", "spinel", "topaz"}
MIN_IMAGES = 8
MAX_IMAGES = 16

# In-memory session state (for production: use Redis or DB)
SESSIONS: dict = {}


# =========================================================
# HELPERS
# =========================================================
def _get_session_dirs(session_id: str):
    """Return (upload_dir, masks_dir) paths for a session."""
    session_path = BASE_DATA_DIR / session_id
    return (
        session_path / "uploads",
        session_path / "masks",
    )


def _validate_gem_type(gem_type: str):
    if gem_type not in VALID_GEM_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid gem_type. Must be one of {sorted(VALID_GEM_TYPES)}",
        )


# =========================================================
# ENDPOINTS
# =========================================================

@router.post("/upload")
async def upload_images(
    gem_type: str = Form(...),
    weight_ct: float = Form(...),
    images: List[UploadFile] = File(...),
):
    """
    Upload 8-16 gem images + metadata. Returns a session_id.
    """
    _validate_gem_type(gem_type)

    if weight_ct <= 0 or weight_ct > 1000:
        raise HTTPException(400, "weight_ct must be between 0 and 1000 carats")

    if not (MIN_IMAGES <= len(images) <= MAX_IMAGES):
        raise HTTPException(
            400,
            f"Provide between {MIN_IMAGES} and {MAX_IMAGES} images. Got {len(images)}.",
        )



    session_id = uuid.uuid4().hex[:12]
    valid_exts = {".png", ".jpg", ".jpeg", ".webp"}
    saved = []

    from app.services.cloudinary_service import is_cloudinary_enabled, upload_image

    if is_cloudinary_enabled():
        for idx, img in enumerate(images):
            ext = Path(img.filename).suffix.lower()
            if ext not in valid_exts:
                raise HTTPException(400, f"Invalid image type: {img.filename}")
            public_id = f"gemintel/sessions/{session_id}/uploads/img_{idx:02d}"
            try:
                img.file.seek(0)
                secure_url = upload_image(img.file, public_id)
                saved.append(secure_url)
            except Exception as e:
                raise HTTPException(500, f"Cloudinary upload failed: {str(e)}")
    else:
        upload_dir, _ = _get_session_dirs(session_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        for idx, img in enumerate(images):
            ext = Path(img.filename).suffix.lower()
            if ext not in valid_exts:
                raise HTTPException(400, f"Invalid image type: {img.filename}")
            out_path = upload_dir / f"img_{idx:02d}{ext}"
            with open(out_path, "wb") as f:
                shutil.copyfileobj(img.file, f)
            saved.append(str(out_path))

    SESSIONS[session_id] = {
        "status":    "uploaded",
        "gem_type":  gem_type,
        "weight_ct": weight_ct,
        "n_images":  len(saved),
        "images":    saved,
        "result":    None,
        "error":     None,
    }

    return {
        "session_id": session_id,
        "status":     "uploaded",
        "n_images":   len(saved),
    }


@router.post("/process/{session_id}")
async def process_session(
    session_id: str,
    background_tasks: BackgroundTasks,
):
    """
    Kick off the pipeline asynchronously.
    Returns immediately; poll /status/{session_id} for progress.
    """
    if session_id not in SESSIONS:
        raise HTTPException(404, "Session not found")

    session = SESSIONS[session_id]
    if session["status"] in {"processing", "done", "generating_masks",
                              "reconstructing", "predicting"}:
        return {"status": session["status"], "session_id": session_id}

    session["status"] = "processing"
    background_tasks.add_task(_run_pipeline, session_id)

    return {"status": "processing", "session_id": session_id}


def _run_pipeline(session_id: str):
    """
    Background pipeline:
      masks (background removal) → visual hull → dimensions → ML predict
    """
    if session_id not in SESSIONS:
        return
    session = SESSIONS[session_id]
    upload_dir, masks_dir = _get_session_dirs(session_id)

    def check_cancelled():
        if session_id not in SESSIONS:
            return True
        return SESSIONS[session_id].get("status") == "idle"

    def on_status_change(new_status: str):
        if session_id in SESSIONS and SESSIONS[session_id].get("status") != "idle":
            SESSIONS[session_id]["status"] = new_status

    from app.services.cloudinary_service import is_cloudinary_enabled, download_image, upload_image
    use_cloudinary = is_cloudinary_enabled()

    try:
        if use_cloudinary:
            upload_dir.mkdir(parents=True, exist_ok=True)
            masks_dir.mkdir(parents=True, exist_ok=True)
            images_list = session.get("images", [])
            for idx, url in enumerate(images_list):
                ext = ".png"
                if ".jpg" in url.lower() or ".jpeg" in url.lower():
                    ext = ".jpg"
                elif ".webp" in url.lower():
                    ext = ".webp"
                out_path = upload_dir / f"img_{idx:02d}{ext}"
                if not download_image(url, out_path):
                    raise Exception(f"Failed to download image from Cloudinary: {url}")

        # Steps 1-3: masks + hull + dimensions + mesh
        reconstruction = reconstruct_full(
            upload_dir     = str(upload_dir),
            masks_dir      = str(masks_dir),
            gem_type       = session["gem_type"],
            real_weight_ct = session["weight_ct"],
            check_cancelled = check_cancelled,
            on_status_change = on_status_change,
        )

        if check_cancelled():
            return

        if use_cloudinary:
            valid_exts = {".png", ".jpg", ".jpeg", ".webp"}
            mask_files = sorted([
                f for f in os.listdir(masks_dir)
                if Path(f).suffix.lower() in valid_exts
            ])
            for mask_file in mask_files:
                local_mask_path = masks_dir / mask_file
                public_id = f"gemintel/sessions/{session_id}/masks/{local_mask_path.stem}"
                upload_image(str(local_mask_path), public_id)

        metrics = reconstruction["metrics"]
        mesh    = reconstruction["mesh"]

        # Step 4: ML prediction
        on_status_change("predicting")
        predictor = get_predictor()
        prediction = predictor.predict(
            gem_type  = session["gem_type"],
            length_mm = metrics["length_mm"],
            width_mm  = metrics["width_mm"],
            depth_mm  = metrics["depth_mm"],
        )

        if check_cancelled():
            return

        # Step 5: assemble result for Three.js
        session["result"] = {
            "session_id": session_id,
            "stone_id":   f"session_{session_id}",
            "gem_type":   session["gem_type"],
            "dimensions": {
                "length_mm": metrics["length_mm"],
                "width_mm":  metrics["width_mm"],
                "depth_mm":  metrics["depth_mm"],
            },
            "prediction": {
                "cut":           prediction["cut"],
                "yield_pct":     prediction["yield_pct"],
                "confidence":    prediction["confidence"],
                "probabilities": prediction["probabilities"],
            },
            "rough_bbox": mesh["bbox"],
            "rough_mesh": {
                "vertices":     mesh["vertices"],
                "indices":      mesh["indices"],
                "vertex_count": mesh["vertex_count"],
                "face_count":   mesh["face_count"],
            },
        }
        on_status_change("done")

    except Exception as e:
        if session_id in SESSIONS and SESSIONS[session_id].get("status") not in {"idle", "done"}:
            SESSIONS[session_id]["status"] = "error"
            SESSIONS[session_id]["error"]  = str(e)
    finally:
        if use_cloudinary:
            session_path = BASE_DATA_DIR / session_id
            if session_path.exists():
                shutil.rmtree(session_path)


@router.post("/cancel/{session_id}")
async def cancel_session(session_id: str):
    """Reset processing pipeline state to idle."""
    if session_id not in SESSIONS:
        raise HTTPException(404, "Session not found")

    session = SESSIONS[session_id]
    if session["status"] in {"processing", "generating_masks", "reconstructing", "predicting"}:
        session["status"] = "idle"

    return {"status": "idle", "session_id": session_id}


@router.get("/status/{session_id}")
async def get_status(session_id: str):
    """Poll for pipeline progress."""
    if session_id not in SESSIONS:
        raise HTTPException(404, "Session not found")

    session = SESSIONS[session_id]
    return {
        "session_id": session_id,
        "status":     session["status"],
        "error":      session["error"],
    }


@router.get("/result/{session_id}")
async def get_result(session_id: str):
    """Fetch the full result JSON (for Three.js viewer)."""
    if session_id not in SESSIONS:
        raise HTTPException(404, "Session not found")

    session = SESSIONS[session_id]
    if session["status"] != "done":
        raise HTTPException(
            409,
            f"Result not ready. Current status: {session['status']}",
        )

    return JSONResponse(session["result"])


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up uploaded files + session state."""
    if session_id not in SESSIONS:
        raise HTTPException(404, "Session not found")

    from app.services.cloudinary_service import is_cloudinary_enabled, delete_session_folder

    if is_cloudinary_enabled():
        delete_session_folder(session_id)

    session_path = BASE_DATA_DIR / session_id
    if session_path.exists():
        shutil.rmtree(session_path)
    SESSIONS.pop(session_id, None)

    return {"status": "deleted", "session_id": session_id}
