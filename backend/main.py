import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.sign_recognition import router as sign_recognition_router
from routers.data_collection import router as data_collection_router
from sign_recognition.pipeline import pipeline as sign_recognition_pipeline

logger = logging.getLogger("main")

app = FastAPI(title="SignSense API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sign_recognition_router)
app.include_router(data_collection_router)


@app.on_event("startup")
async def startup_load_sign_recognition() -> None:
    if not settings.SIGN_RECOGNITION_ENABLED:
        return

    try:
        await asyncio.get_running_loop().run_in_executor(None, sign_recognition_pipeline.load)
        logger.info("Sign recognition pipeline ready")
    except Exception:
        logger.exception("Sign recognition pipeline failed to load during startup")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "phase": "phase1",
        "deferred": ["postgres", "redis", "celery", "minio", "ollama", "onnx", "server_ml"],
        "sign_recognition": settings.SIGN_RECOGNITION_ENABLED,
    }
