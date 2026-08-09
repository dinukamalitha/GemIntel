import os
# Disable Gradio 5 Server-Side Rendering (SSR) Node.js server to prevent crash on HF Spaces
os.environ["GRADIO_SSR"] = "False"

import gradio as gr
from app.main import app as fastapi_app

# Define a simple Gradio interface for HF Spaces compatibility
with gr.Blocks(title="GemIntel API") as demo:
    gr.Markdown("# 💎 GemIntel Backend API")
    gr.Markdown("The backend server is running successfully.")
    gr.Markdown("👉 Interactive API Documentation: [Swagger UI (/docs)](/docs)")

# Mount Gradio onto FastAPI root / so HF health check gets the correct UI assets
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    # Start the FastAPI application on port 7860
    # HF Gradio Space supervisor expects web server here.
    uvicorn.run(app, host="0.0.0.0", port=7860, log_level="info")
