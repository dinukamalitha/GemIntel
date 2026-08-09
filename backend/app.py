"""
Entry point for Hugging Face Spaces (sdk: gradio).

Gradio SDK runs `python app.py`. We serve the FastAPI app directly
with uvicorn — no Gradio Blocks mount needed. The root `/` endpoint
in app.main returns an HTML landing page so the Space health-check
gets HTTP 200 and marks the Space as "Running".
"""
from app.main import app  # noqa: F401 — used by uvicorn

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
