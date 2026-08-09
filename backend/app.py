import gradio as gr
from app.main import app as fastapi_app

# Simple Gradio Blocks interface
with gr.Blocks(title="GemIntel API") as demo:
    gr.Markdown("# 💎 GemIntel Backend API")
    gr.Markdown("The backend server is running successfully.")
    gr.Markdown("👉 Interactive API Documentation: [Swagger UI (/docs)](/docs)")

# Mount FastAPI app onto Gradio
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    # Pass the app object directly to avoid module resolution errors in different working directories
    uvicorn.run(app, host="0.0.0.0", port=7860, log_level="info")
