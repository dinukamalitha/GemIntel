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

def run_inference(base_image: Image.Image, gem_type: str | None = None):
    """Executes both models, calculates weighted ensemble, and returns payload."""
    global eff_model, gem_model, scaler, label_encoder
    
    if not eff_model or not gem_model:
        raise RuntimeError("Models are not loaded into memory.")

    # --- BRANCH 1: EfficientNet ---
    from app.utils.image_utils import prepare_for_efficientnet, prepare_for_xgboost
    eff_input_tensor = prepare_for_efficientnet(base_image)
    
    with torch.no_grad(): 
        outputs = eff_model(eff_input_tensor)
        eff_probs = torch.softmax(outputs, dim=1)[0].numpy() # Extract probabilities as numpy array
        
    eff_pred_idx = int(np.argmax(eff_probs))
    eff_label = label_encoder.inverse_transform([eff_pred_idx])[0]
    
    # --- BRANCH 2: XGBoost ---
    xgb_raw_features = prepare_for_xgboost(base_image)
    scaled_features = scaler.transform(xgb_raw_features)
    
    xgb_probs = gem_model.predict_proba(scaled_features)[0] 
    
    xgb_pred_idx = int(np.argmax(xgb_probs))
    xgb_label = label_encoder.inverse_transform([xgb_pred_idx])[0]

    # --- THE ENSEMBLE ---
    final_natural = (W_EFF * eff_probs[0]) + (W_XGB * xgb_probs[0])
    final_synthetic = (W_EFF * eff_probs[1]) + (W_XGB * xgb_probs[1])

    # Combined probability array
    ensemble_probs = np.array([final_natural, final_synthetic])

    # Final prediction
    final_pred_idx = int(np.argmax(ensemble_probs))
    final_label = label_encoder.inverse_transform([final_pred_idx])[0]
    final_confidence = float(ensemble_probs[final_pred_idx])

    # --- TOPAZ RULE OVERRIDE ---
    # Whenever gem_type is Topaz, override output to Natural and set confidence to model strength.
    is_topaz = bool(gem_type and "topaz" in gem_type.lower())
    if is_topaz:
        print(f"[AuthService] Topaz variety detected ('{gem_type}'). Overriding classification output to Natural.")
        final_label = "Natural"
        eff_label = "Natural"
        xgb_label = "Natural"
        
        eff_conf = float(max(eff_probs[0], eff_probs[1]))
        xgb_conf = float(max(xgb_probs[0], xgb_probs[1]))
        final_confidence = float(max(final_natural, final_synthetic))
    else:
        eff_conf = float(eff_probs[eff_pred_idx])
        xgb_conf = float(xgb_probs[xgb_pred_idx])

    return {
        "status": "success",
        "ensemble_result": {
            "prediction": final_label,
            "confidence": round(final_confidence, 4)
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
        }
    }
