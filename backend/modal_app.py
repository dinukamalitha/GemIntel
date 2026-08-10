import modal
import os
from pathlib import Path

backend_dir = Path(__file__).resolve().parent

# Define Modal container image with Python 3.11, system packages, and local app/data sources
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libimage-exiftool-perl")
    .pip_install_from_requirements("requirements.txt")
    .add_local_python_source("app")
    .add_local_dir(backend_dir / "data", remote_path="/root/data")
)

app = modal.App("gemintel-backend")


@app.function(
    image=image,
    timeout=600,
    secrets=[
        modal.Secret.from_name("gemintel-secrets"),
        modal.Secret.from_dict(
            {
                "HF_MODEL_REPO": os.getenv("HF_MODEL_REPO", "dmCoder/gemintel-models"),
                "VALUATION_N_JOBS": "1",
            }
        ),
    ],
)
@modal.asgi_app()
def fastapi_app():
    from app.main import app as web_app

    return web_app
