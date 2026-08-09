import gradio as gr
from app.main import app as fastapi_app

# Create a clean UI dashboard for the Hugging Face Space
with gr.Blocks(title="GemIntel API") as demo:
    gr.Markdown("# 💎 GemIntel Backend API & ML Pipeline")
    gr.Markdown(
        "Welcome to the **GemIntel** Machine Learning Backend API service.\n\n"
        "### 🔗 API Endpoints & Docs:\n"
        "- 📑 **Interactive Swagger Docs**: [/docs](/docs)\n"
        "- 🔍 **OpenAPI Schema**: [/openapi.json](/openapi.json)\n"
        "- ❤️ **Healthcheck Status**: [/health](/health)\n"
    )

# Mount Gradio interface onto FastAPI app
app = gr.mount_gradio_app(fastapi_app, demo, path="/ui")
