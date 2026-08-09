from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.api.routes import router
from app.api.valuation import router as valuation_router
from app.services.auth_service import load_all_models
from app.api.cut_prediction import router as cut_router
from app.api.carat import router as carat_router

import os
import signal
import sys
import traceback
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Debug: log when the process receives a termination signal ---
def _signal_handler(signum, frame):
    sig_name = signal.Signals(signum).name
    print(f"\n[SIGNAL] Received {sig_name} (signal {signum})", flush=True)
    print("[SIGNAL] Traceback at time of signal:", flush=True)
    traceback.print_stack(frame)
    sys.stdout.flush()
    # Re-raise so uvicorn can still do graceful shutdown
    signal.signal(signum, signal.SIG_DFL)
    os.kill(os.getpid(), signum)

signal.signal(signal.SIGTERM, _signal_handler)

app = FastAPI(title="Dual-Branch Gem Authentication API")

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

@app.on_event("shutdown")
async def shutdown_event():
    print("[SHUTDOWN] FastAPI shutdown event triggered", flush=True)
    traceback.print_stack()
    sys.stdout.flush()

# Include all routes
app.include_router(router)
app.include_router(cut_router, prefix="/api/cut", tags=["cut-prediction"])
app.include_router(valuation_router, prefix="/api/valuation", tags=["valuation"])
app.include_router(carat_router, prefix="/api/carat", tags=["carat"])