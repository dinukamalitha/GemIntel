"""
Script to upload local GemIntel model binaries from backend/models/ to Hugging Face Model Hub.

Usage:
    python scripts/upload_models_to_hf.py --repo dinukamalitha/gemintel-models --token YOUR_HF_TOKEN
"""
import os
import argparse
from pathlib import Path
from huggingface_hub import HfApi, create_repo


def upload_models(repo_id: str, token: str | None = None, private: bool = False):
    base_dir = Path(__file__).resolve().parent.parent
    models_dir = base_dir / "models"

    if not models_dir.exists():
        print(f"Error: Models directory not found at {models_dir}")
        return

    api = HfApi(token=token)

    print(f"Ensuring repository '{repo_id}' exists on Hugging Face...")
    try:
        create_repo(repo_id=repo_id, token=token, private=private, repo_type="model", exist_ok=True)
        print(f"Repository '{repo_id}' is ready.")
    except Exception as e:
        print(f"Notice during repo creation: {e}")

    print(f"Uploading folder '{models_dir}' to Hugging Face Hub ('{repo_id}')...")
    api.upload_folder(
        folder_path=str(models_dir),
        repo_id=repo_id,
        repo_type="model",
        token=token,
    )
    print(f"Successfully uploaded all model files to https://huggingface.co/{repo_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload GemIntel models to Hugging Face Model Hub")
    parser.add_argument(
        "--repo",
        type=str,
        default="dmCoder/gemintel-models",
        help="HF Model Repo ID (e.g. username/gemintel-models)",
    )
    parser.add_argument(
        "--token",
        type=str,
        default=None,
        help="Hugging Face User Access Token (Write permission)",
    )
    parser.add_argument(
        "--private",
        action="store_true",
        help="Make the Hugging Face model repository private",
    )

    args = parser.parse_args()
    upload_models(repo_id=args.repo, token=args.token, private=args.private)
