import torch
import timm
import joblib
import numpy as np
from PIL import Image
from app.config import EFF_MODEL_PATH, GEM_PIPELINE_PATH, W_EFF, W_XGB 

# Global variables to hold models in memory
eff_model = None
gem_model = None
scaler = None
label_encoder = None

def load_all_models():
    """Triggered on app startup to load models into memory."""
    global eff_model, gem_model, scaler, label_encoder
    
    print("[BranchPredictor] Initializing dual-branch authentication pipeline...")
    
    print("Building timm EfficientNet-B4 Skeleton...")
    eff_model = timm.create_model("efficientnet_b4", pretrained=False, num_classes=2)
    
    print(f"Loading .pth weights from: {EFF_MODEL_PATH}")
    state_dict = torch.load(EFF_MODEL_PATH, map_location=torch.device('cpu'))
    eff_model.load_state_dict(state_dict)
    eff_model.eval() 
    print("[BranchPredictor] EfficientNet-B4 loaded successfully on CPU.")
    
    print(f"Loading XGBoost ML Pipeline Bundle from: {GEM_PIPELINE_PATH}")
    pipeline_bundle = joblib.load(GEM_PIPELINE_PATH)
    gem_model = pipeline_bundle["model"]
    scaler = pipeline_bundle["scaler"]
    label_encoder = pipeline_bundle["label_encoder"]
    print("[BranchPredictor] XGBoost classifier and scaler loaded successfully.")
    
    # Load AI filter model
    from app.services.ai_filter_service import load_ai_filter_model
    load_ai_filter_model()

    # Load Domain Filter model
    from app.services.domain_filter_service import load_domain_filter_models
    try:
        load_domain_filter_models()
    except Exception as e:
        print(f"[Error] Failed to load Domain Filter model: {e}")

    # Load Cut Predictor model
    from app.services.cut_prediction_service import get_predictor
    try:
        get_predictor().load()
    except Exception as e:
        print(f"[Error] Failed to load Cut Predictor: {e}")
    
    # Load Valuation models (XGBoost and LightGBM for price prediction)
    from app.services.valuation_service import load_valuation_models
    try:
        load_valuation_models()
    except Exception as e:
        print(f"[Error] Failed to load Valuation models: {e}")
    
    print("[Assets] All application ML models loaded successfully.")

def run_inference(
    images: Image.Image | list[Image.Image],
    gem_type: str | None = None,
    aggregation: str = "mean"
) -> dict:
    """
    Predict natural vs. synthetic from one or more images of the SAME stone.

    images : Image.Image or list of Image.Image
        A single PIL Image (backward compatible) or a list of PIL Images — e.g. several
        angles/lighting conditions/zoom levels of the same physical stone.
    gem_type : str, optional
        Target gemstone variety (e.g. 'Blue Sapphire', 'Blue Topaz', 'Blue Spinel').
    aggregation : "mean" | "vote"
        "mean" (default): average the softmax probabilities across all images,
            then take the argmax. Uses full confidence information from every image.
        "vote": have each image cast a hard vote for its own predicted class,
            take majority class. Ties fall back to mean-probability.

    Returns
    -------
    dict with keys: "prediction", "confidence", "ensemble_result", "breakdown", "per_image"
    """
    global eff_model, gem_model, scaler, label_encoder

    if not eff_model or not gem_model:
        raise RuntimeError("Models are not loaded into memory.")

    # Normalize input to a list of PIL Images
    if isinstance(images, Image.Image):
        image_list = [images]
    elif isinstance(images, list):
        image_list = [img for img in images if isinstance(img, Image.Image)]
    else:
        raise ValueError("Invalid images argument: must be PIL.Image or list of PIL.Image")

    if not image_list:
        raise ValueError("No valid images provided for inference.")

    from app.utils.image_utils import prepare_for_efficientnet, prepare_for_xgboost

    per_image_results = []
    all_ensemble_probs = []
    all_eff_probs = []
    all_xgb_probs = []

    for idx, base_img in enumerate(image_list):
        # --- BRANCH 1: EfficientNet ---
        eff_input_tensor = prepare_for_efficientnet(base_img)
        with torch.no_grad():
            outputs = eff_model(eff_input_tensor)
            eff_probs = torch.softmax(outputs, dim=1)[0].numpy()

        eff_pred_idx = int(np.argmax(eff_probs))
        eff_label = str(label_encoder.inverse_transform([eff_pred_idx])[0])

        # --- BRANCH 2: XGBoost ---
        xgb_raw_features = prepare_for_xgboost(base_img)
        scaled_features = scaler.transform(xgb_raw_features)
        xgb_probs = gem_model.predict_proba(scaled_features)[0]

        xgb_pred_idx = int(np.argmax(xgb_probs))
        xgb_label = str(label_encoder.inverse_transform([xgb_pred_idx])[0])

        # --- ENSEMBLE PER IMAGE ---
        final_natural = (W_EFF * eff_probs[0]) + (W_XGB * xgb_probs[0])
        final_synthetic = (W_EFF * eff_probs[1]) + (W_XGB * xgb_probs[1])
        ensemble_probs = np.array([final_natural, final_synthetic])

        img_pred_idx = int(np.argmax(ensemble_probs))
        img_pred_label = str(label_encoder.inverse_transform([img_pred_idx])[0])
        img_confidence = float(ensemble_probs[img_pred_idx])

        all_ensemble_probs.append(ensemble_probs)
        all_eff_probs.append(eff_probs)
        all_xgb_probs.append(xgb_probs)

        per_image_results.append({
            "image_index": idx + 1,
            "prediction": img_pred_label,
            "confidence": round(img_confidence, 4),
            "efficientnet": {
                "prediction": eff_label,
                "confidence": round(float(np.max(eff_probs)), 4)
            },
            "xgboost": {
                "prediction": xgb_label,
                "confidence": round(float(np.max(xgb_probs)), 4)
            }
        })

    class_names = [str(c) for c in label_encoder.classes_]  # ["Natural", "Synthetic"]
    ensemble_matrix = np.array(all_ensemble_probs)  # [N, 2]

    # Aggregation
    if aggregation == "vote":
        votes = [int(np.argmax(p)) for p in ensemble_matrix]
        vote_counts = np.bincount(votes, minlength=len(class_names))
        top_count = vote_counts.max()
        tied_classes = np.flatnonzero(vote_counts == top_count)

        if len(tied_classes) == 1:
            final_idx = int(tied_classes[0])
            final_conf = float(vote_counts[final_idx] / len(votes))
        else:
            mean_probs = ensemble_matrix.mean(axis=0)
            final_idx = int(np.argmax(mean_probs))
            final_conf = float(mean_probs[final_idx])
    else:  # "mean" (default, recommended)
        mean_probs = ensemble_matrix.mean(axis=0)
        final_idx = int(np.argmax(mean_probs))
        final_conf = float(mean_probs[final_idx])

    final_label = str(label_encoder.inverse_transform([final_idx])[0])

    # Model breakdowns (averaged across images)
    mean_eff_probs = np.array(all_eff_probs).mean(axis=0)
    eff_pred_idx = int(np.argmax(mean_eff_probs))
    eff_label = str(label_encoder.inverse_transform([eff_pred_idx])[0])
    eff_conf = float(mean_eff_probs[eff_pred_idx])

    mean_xgb_probs = np.array(all_xgb_probs).mean(axis=0)
    xgb_pred_idx = int(np.argmax(mean_xgb_probs))
    xgb_label = str(label_encoder.inverse_transform([xgb_pred_idx])[0])
    xgb_conf = float(mean_xgb_probs[xgb_pred_idx])

    # Topaz rule override
    is_topaz = bool(gem_type and "topaz" in gem_type.lower())
    if is_topaz:
        print(f"[AuthService] Topaz variety detected ('{gem_type}'). Overriding classification output to Natural.")
        final_label = "Natural"
        eff_label = "Natural"
        xgb_label = "Natural"
        eff_conf = float(max(mean_eff_probs[0], mean_eff_probs[1]))
        xgb_conf = float(max(mean_xgb_probs[0], mean_xgb_probs[1]))
        final_conf = float(max(mean_probs[0], mean_probs[1]))

    print(f"[AuthService] Images used: {len(image_list)} | Aggregation: {aggregation}")
    for pi in per_image_results:
        print(f"  Image #{pi['image_index']}: {pi['prediction']} ({pi['confidence']:.3f})")
    print(f"[AuthService] Final Prediction: {final_label} (confidence: {final_conf:.3f})")

    return {
        "status": "success",
        "prediction": final_label,
        "confidence": round(final_conf, 4),
        "aggregation": aggregation,
        "images_used": len(image_list),
        "ensemble_result": {
            "prediction": final_label,
            "confidence": round(final_conf, 4)
        },
        "breakdown": {
            "efficientnet": {
                "prediction": eff_label,
                "confidence": round(eff_conf, 4),
                "weight_used": W_EFF
            },
            "xgboost": {
                "prediction": xgb_label,
                "confidence": round(xgb_conf, 4),
                "weight_used": W_XGB
            }
        },
        "per_image": per_image_results
    }

