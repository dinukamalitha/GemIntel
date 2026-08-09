import gradio as gr
from app.main import app as fastapi_app

# Gradio Blocks landing page (for Hugging Face Spaces compatibility and health checks)
with gr.Blocks(title="GemIntel API") as demo:
    gr.Markdown("# 💎 GemIntel Backend API")
    gr.Markdown("The backend server is running successfully with ZeroGPU acceleration.")
    gr.Markdown("👉 Interactive API Documentation: [Swagger UI (/docs)](/docs)")

# Mount Gradio at root '/' so Hugging Face Space supervisor receives 200 OK
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
