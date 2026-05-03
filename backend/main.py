from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis

from config import settings
from database import engine, Base

from utils.init_minio import init_minio_buckets
from routers import auth, users, exercises, lessons, skill_tree, leagues, achievements, notifications, daily_challenge
from ws_handler import router as ws_router
from recognition import engine as recognition_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify connections
    app.state.redis = aioredis.from_url(settings.REDIS_URL)
    # Initialize MinIO buckets on startup
    try:
        init_minio_buckets()
    except Exception as e:
        print(f"MinIO init warning: {e}")
    # Load ML models onto GPU
    try:
        recognition_engine.load()
        print("Recognition engine loaded.")
    except Exception as e:
        print(f"Recognition engine warning: {e}")
    yield
    # Shutdown
    await app.state.redis.close()
    await engine.dispose()

app = FastAPI(title="SignSense API", version="0.2.0", lifespan=lifespan)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": str(exc), "traceback": traceback.format_exc()}
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(lessons.router)
app.include_router(skill_tree.router)
app.include_router(leagues.router)
app.include_router(achievements.router)
app.include_router(notifications.router)
app.include_router(daily_challenge.router)
app.include_router(ws_router)

