import gradio as gr
from app.main import app as fastapi_app

# Gradio interface definition (for Hugging Face Spaces compatibility)
demo = gr.Interface(
    fn=lambda: "GemIntel API is running successfully.",
    inputs=None,
    outputs="text",
    title="GemIntel API",
    description="FastAPI Backend for GemIntel. Access interactive Swagger API documentation at [/docs](/docs)."
)

# Mount the Gradio demo onto FastAPI so all FastAPI routes (/api/..., /docs, /openapi.json) remain fully functional
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
