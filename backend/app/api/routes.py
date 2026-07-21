import io
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
import cv2
import numpy as np
from app.services.auth_service import run_inference
from collections import defaultdict
from app.config import GEM_TYPES
from app.services.cut_service import predict_cut_one, cut_classes
from app.services.color_service import predict_color_one, summarize_color, color_classes
from app.services.clarity_service import predict_clarity_one, clarity_classes

router = APIRouter()

@router.post("/authenticate")
async def authenticate_gem(
    file: UploadFile = File(...),
    gem_type: str | None = Form(None)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    
    try:
        # Read image
        image_bytes = await file.read()
        base_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # --- Global Domain Filter check ---
        from app.services.domain_filter_service import validate_gem_image
        is_valid, score = validate_gem_image(base_image)
        print(f"[Telemetry] Score: {score}")
        if not is_valid:
            return {
                "status": "invalid input",
                "message": "The image entered is not a gem. Please input a valid gem image.",
                "score": score
            }
        
        # --- AI Filter check ---
        from app.services.ai_filter_service import analyze_image_origin
        filter_result = analyze_image_origin(base_image)
        print(f"AI Filter Result: {filter_result}")
        if filter_result["is_ai_generated"]:
            return {
                "status": "ai_generated",
                "message": "The image is AI-generated. Please submit a real one.",
                "filter_result": filter_result
            }
        
        # Pass to our service
        result = run_inference(base_image, gem_type=gem_type)
        result["filter_result"] = filter_result
        result["score"] = score
        return result

        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reconstruct")
async def reconstruct_gem(
    files: List[UploadFile] = File(...),
    gem_type: str = Form(...),
    weight: float = Form(...)
):
    try:
        # Decode files to CV2 images
        images = []
        for file in files:
            file_bytes = await file.read()
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                images.append(img)
                
        if len(images) < 10:
            raise HTTPException(status_code=400, detail="A minimum of 10 side-view images is required for reconstruction.")
            
        from app.services.reconstruction_service import (
            reconstruct_visual_hull, 
            extract_metrics, 
            predict_cut_and_yield, 
            generate_mesh
        )
        
        # Reconstruct voxel grid (size 128)
        voxels = reconstruct_visual_hull(images, size=128)
        
        # Calculate volume metrics and ratios
        metrics = extract_metrics(voxels, gem_type, weight)
        
        # Run RF models to estimate cut name and yield
        predictions = predict_cut_and_yield(metrics)
        
        # Generate 3D marching cubes mesh
        mesh = generate_mesh(voxels)
        
        return {
            "status": "success",
            "metrics": metrics,
            "predictions": predictions,
            "mesh": mesh
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Visual hull reconstruction failed: {str(e)}")

@router.get("/health")
def health_check():
    return {"status": "healthy"}


# =========================================================
# Identification (M02 — DINOv2 cut + color classifiers)
# =========================================================
@router.get("/gem-types")
def list_gem_types():
    return {"gem_types": GEM_TYPES}


@router.get("/identify/classes")
def identify_class_labels():
    return {"cut": cut_classes(), "color": color_classes(), "clarity": clarity_classes()}


def _top(d: dict) -> tuple[str, float]:
    label, prob = max(d.items(), key=lambda kv: kv[1])
    return label, float(prob)


@router.post("/identify")
async def identify_gem(
    gem_type: str = Form(...),
    files: List[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(status_code=400, detail="At least one image is required.")
    if gem_type not in GEM_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown gem_type '{gem_type}'.")

    per_image = []
    sum_shape: dict[str, float] = defaultdict(float)
    sum_cut: dict[str, float] = defaultdict(float)
    sum_hue: dict[str, float] = defaultdict(float)
    sum_intensity: dict[str, float] = defaultdict(float)
    sum_clarity: dict[str, float] = defaultdict(float)

    def _round(d: dict) -> dict:
        return {k: round(v, 4) for k, v in d.items()}

    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"{f.filename}: not an image.")

        raw = await f.read()
        try:
            image = Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"{f.filename}: {e}")

        # --- Global Domain Filter check ---
        from app.services.domain_filter_service import validate_gem_image
        is_valid, score = validate_gem_image(image)
        print(f"[Telemetry] Score: {score}")
        if not is_valid:
            return {
                "status": "invalid input",
                "message": f"The image entered is not a gem: {f.filename}. Please input a valid gem image.",
                "score": score
            }

        try:
            cut_res = predict_cut_one(image)
            color = summarize_color(predict_color_one(image), gem_type)
            clarity_res = predict_clarity_one(image)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        hue_probs = color["hue_probs"]
        intensity_probs = color["intensity_probs"]
        clarity_probs = clarity_res["clarity_probs"]

        shape_top, shape_p = _top(cut_res["shape_probs"])
        cut_top, cut_p = _top(cut_res["cut_style_probs"])
        hue_top, hue_p = _top(hue_probs)
        intensity_top, intensity_p = _top(intensity_probs)
        clarity_top, clarity_p = _top(clarity_probs)

        per_image.append({
            "filename": f.filename,
            "cut": {
                "shape": {"label": shape_top, "confidence": round(shape_p, 4)},
                "cut_style": {"label": cut_top, "confidence": round(cut_p, 4)},
                "shape_probs": _round(cut_res["shape_probs"]),
                "cut_style_probs": _round(cut_res["cut_style_probs"]),
            },
            "color": {
                "hue": {"label": hue_top, "confidence": round(hue_p, 4)},
                "intensity": {"label": intensity_top, "confidence": round(intensity_p, 4)},
                "hue_probs": _round(hue_probs),
                "intensity_probs": _round(intensity_probs),
            },
            "clarity": {
                "grade": {"label": clarity_top, "confidence": round(clarity_p, 4)},
                "clarity_probs": _round(clarity_probs),
            },
        })

        for k, v in cut_res["shape_probs"].items():
            sum_shape[k] += v
        for k, v in cut_res["cut_style_probs"].items():
            sum_cut[k] += v
        for k, v in hue_probs.items():
            sum_hue[k] += v
        for k, v in intensity_probs.items():
            sum_intensity[k] += v
        for k, v in clarity_probs.items():
            sum_clarity[k] += v

    n = len(per_image)
    avg_shape = {k: v / n for k, v in sum_shape.items()}
    avg_cut = {k: v / n for k, v in sum_cut.items()}
    avg_hue = {k: v / n for k, v in sum_hue.items()}
    avg_intensity = {k: v / n for k, v in sum_intensity.items()}
    avg_clarity = {k: v / n for k, v in sum_clarity.items()}

    shape_top, shape_p = _top(avg_shape)
    cut_top, cut_p = _top(avg_cut)
    hue_top, hue_p = _top(avg_hue)
    intensity_top, intensity_p = _top(avg_intensity)
    clarity_top, clarity_p = _top(avg_clarity)

    return {
        "status": "success",
        "gem_type": gem_type,
        "image_count": n,
        "aggregate": {
            "cut": {
                "shape": {"label": shape_top, "confidence": round(shape_p, 4)},
                "cut_style": {"label": cut_top, "confidence": round(cut_p, 4)},
                "shape_probs": _round(avg_shape),
                "cut_style_probs": _round(avg_cut),
            },
            "color": {
                "hue": {"label": hue_top, "confidence": round(hue_p, 4)},
                "intensity": {"label": intensity_top, "confidence": round(intensity_p, 4)},
                "hue_probs": _round(avg_hue),
                "intensity_probs": _round(avg_intensity),
            },
            "clarity": {
                "grade": {"label": clarity_top, "confidence": round(clarity_p, 4)},
                "clarity_probs": _round(avg_clarity),
            },
        },
        "per_image": per_image,
    }


# =========================================================
# Feedback (M04 — Submitting feedback to admin email)
# =========================================================
from pydantic import BaseModel
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

class FeedbackRequest(BaseModel):
    name: str
    email: str
    feedback_type: str
    rating: int
    message: str

@router.post("/feedback")
async def receive_feedback(req: FeedbackRequest):
    print(f"Feedback received: {req}")
    
    admin_emails_raw = os.getenv("ADMIN_EMAILS", "")
    admin_emails = [email.strip() for email in admin_emails_raw.split(",") if email.strip()]  
    subject = f"GemIntel Feedback: {req.feedback_type.capitalize()} (Rating: {req.rating}/5)"
    
    body = f"""
You have received new feedback from GemIntel:

Name: {req.name}
Email: {req.email}
Feedback Type: {req.feedback_type}
Rating: {req.rating}/5

Message:
{req.message}
"""
    
    msg = MIMEMultipart()
    msg['From'] = req.email
    msg['To'] = ", ".join(admin_emails)
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASSWORD", "")
        
        if smtp_user and smtp_pass:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            print("Feedback email sent successfully.")
        else:
            print("[Warning] Feedback email not sent. SMTP credentials (SMTP_USER/SMTP_PASSWORD) are not configured in .env.")
    except Exception as e:
        print(f"[Error] Failed to send feedback email: {e}")
        
    return {
        "status": "success",
        "message": "Feedback received successfully. Admin has been notified."
    }
