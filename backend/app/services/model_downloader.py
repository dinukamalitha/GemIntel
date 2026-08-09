import os
from pathlib import Path
from huggingface_hub import snapshot_download
from app.config import MODELS_DIR, HF_MODEL_REPO

REQUIRED_MODEL_FILES = [
    os.path.join("4C", "clarity-module.pt"),
    os.path.join("4C", "color-module.pt"),
    os.path.join("4C", "cut-module.pt"),
    os.path.join("Filters", "ai-filter.pt"),
    os.path.join("Filters", "global_domain_filter.pkl"),
    os.path.join("authentication", "efficientnet_b4.pth"),
    os.path.join("authentication", "xgboost_model.pkl"),
    os.path.join("cut-prediction", "model_columns.joblib"),
    os.path.join("cut-prediction", "optimal_cut_classifier.joblib"),
    os.path.join("cut-prediction", "yield_regressor.joblib"),
    os.path.join("valuation", "ppc_voting_ensemble_bundle.joblib"),
]


def ensure_models_exist():
    """
    Checks if all required ML model files exist locally in MODELS_DIR.
    If any file is missing and HF_MODEL_REPO is configured, downloads
    the model directory structure from Hugging Face Model Hub.
    """
    missing_files = []
    for rel_path in REQUIRED_MODEL_FILES:
        full_path = os.path.join(MODELS_DIR, rel_path)
        if not os.path.exists(full_path) or os.path.getsize(full_path) == 0:
            missing_files.append(rel_path)

    if missing_files:
        print(f"[ModelDownloader] Missing {len(missing_files)} model file(s): {missing_files}")
        repo_id = os.getenv("HF_MODEL_REPO", HF_MODEL_REPO)
        token = os.getenv("HF_TOKEN", None)
        print(f"[ModelDownloader] Fetching models from Hugging Face Hub: '{repo_id}'...")
        try:
            os.makedirs(MODELS_DIR, exist_ok=True)
            snapshot_download(
                repo_id=repo_id,
                local_dir=MODELS_DIR,
                token=token,
            )
            print("[ModelDownloader] All models successfully downloaded from Hugging Face Hub.")
        except Exception as e:
            print(f"[ModelDownloader] Error downloading models from Hugging Face Hub: {e}")
    else:
        print("[ModelDownloader] All required model files verified locally.")
