import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Calculate project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://signsense:signsense_dev@postgres:5432/signsense"
    REDIS_URL: str = "redis://redis:6379/0"

    POSTGRES_USER: str = "signsense"
    POSTGRES_PASSWORD: str = "signsense_dev"
    POSTGRES_DB: str = "signsense"

    JWT_SECRET_KEY: str = "change_me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET_LORA: str = "lora-adapters"
    MINIO_BUCKET_MODELS: str = "psl-models"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    NEXT_PUBLIC_API_BASE_URL: str = "http://localhost:8000"

    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:admin@signsense.local"

    class Config:
        env_file = os.path.join(BASE_DIR, ".env")
        extra = "ignore"

settings = Settings()
