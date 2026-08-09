from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.api.routes import router
from app.api.valuation import router as valuation_router
from app.services.auth_service import load_all_models
from app.api.cut_prediction import router as cut_router
from app.api.carat import router as carat_router

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Dual-Branch Gem Authentication API")

@app.get("/", response_class=HTMLResponse)
def root():
    return """
    <!DOCTYPE html>
    <html><head><title>GemIntel API</title></head>
    <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0">
        <div style="text-align:center">
            <h1>💎 GemIntel Backend API</h1>
            <p>The server is running.</p>
            <p><a href="/docs" style="color:#60a5fa">API Documentation (Swagger UI)</a></p>
        </div>
    </body></html>
    """

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "GemIntel API"}

env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    origins = [o.strip() for o in env_origins.split(",") if o.strip()]
else:
    # Default fallback for local development if env/dotenv is not configured
    origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models Asynchronously in Background so Server Starts Immediately
def _init_models():
    try:
        load_all_models()
    except Exception as e:
        print(f"[Error] Critical error loading models: {e}")

    # Log memory usage after all models are loaded (helps diagnose OOM on HF Spaces)
    try:
        import psutil
        proc = psutil.Process()
        mem = proc.memory_info()
        print(f"[Memory] RSS: {mem.rss / 1024**2:.0f} MB | VMS: {mem.vms / 1024**2:.0f} MB")
    except ImportError:
        pass

@app.on_event("startup")
async def startup_event():
    import threading
    threading.Thread(target=_init_models, daemon=True).start()


# Include all routes
app.include_router(router)
app.include_router(cut_router, prefix="/api/cut", tags=["cut-prediction"])
app.include_router(valuation_router, prefix="/api/valuation", tags=["valuation"])
app.include_router(carat_router, prefix="/api/carat", tags=["carat"])