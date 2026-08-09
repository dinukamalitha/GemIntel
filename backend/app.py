import gradio as gr
from app.main import app as fastapi_app

# Define a simple Gradio interface for HF Spaces compatibility
with gr.Blocks(title="GemIntel API") as demo:
    gr.Markdown("# 💎 GemIntel Backend API")
    gr.Markdown("The backend server is running successfully.")
    gr.Markdown("👉 Interactive API Documentation: [Swagger UI (/docs)](/docs)")

# Use Gradio's launch mechanism which is required for sdk: gradio on HF Spaces.
# We mount FastAPI under Gradio's internal FastAPI server (which runs on demo.app).
demo.app = fastapi_app

if __name__ == "__main__":
    # Launch Gradio. It will automatically handle uvicorn startup, port binding (7860),
    # and provide the correct heartbeat metadata for Hugging Face supervisor.
    demo.launch(server_name="0.0.0.0", server_port=7860, prevent_thread_lock=False)
