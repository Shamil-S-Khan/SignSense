# Phase 1A: Infrastructure & Project Setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stand up all 8 Docker services and scaffold both the Next.js and FastAPI projects so they boot, connect to databases, and serve health endpoints.

**Architecture:** Docker Compose orchestrates postgres, redis, minio, ollama, fastapi, celery, celery-beat, and nextjs. Each service has a healthcheck. FastAPI connects to PostgreSQL via SQLAlchemy and Redis via redis-py. Next.js runs in dev mode with Tailwind CSS.

**Tech Stack:** Docker Compose, Next.js 14, FastAPI, PostgreSQL 15, Redis 7, MinIO, Ollama, Tailwind CSS v3, SQLAlchemy, Alembic, Pydantic v2

---

### Task 1: Project Root Files

**Files:**
- Create: `c:\Github\SignSense\.gitignore`
- Create: `c:\Github\SignSense\.env.example`
- Create: `c:\Github\SignSense\.env`

- [ ] **Step 1: Create .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/

# Node
node_modules/
.next/
out/

# Environment
.env

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Docker
docker-compose.override.yml

# Models (large binary files)
frontend/public/models/*.onnx
```

- [ ] **Step 2: Create .env.example**

```env
# PostgreSQL
POSTGRES_USER=signsense
POSTGRES_PASSWORD=signsense_dev
POSTGRES_DB=signsense

# Redis
REDIS_URL=redis://redis:6379/0

# Database
DATABASE_URL=postgresql+asyncpg://signsense:signsense_dev@postgres:5432/signsense

# JWT
JWT_SECRET_KEY=change_me_generate_with_openssl_rand_hex_32
JWT_ALGORITHM=HS256

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_LORA=lora-adapters
MINIO_BUCKET_MODELS=psl-models

# Ollama / LLM
LLM_MODEL_NAME=phi3:mini
OLLAMA_BASE_URL=http://ollama:11434

# Frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Web Push (generate with: python -m vapid --gen)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CLAIMS_EMAIL=mailto:admin@signsense.local
```

- [ ] **Step 3: Create .env by copying .env.example**

Run: `Copy-Item c:\Github\SignSense\.env.example c:\Github\SignSense\.env`

- [ ] **Step 4: Commit**

```bash
git init
git add .gitignore .env.example
git commit -m "chore: initial project root with gitignore and env template"
```

---

### Task 2: Backend Dockerfile & Requirements

**Files:**
- Create: `c:\Github\SignSense\backend\Dockerfile`
- Create: `c:\Github\SignSense\backend\requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```txt
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pydantic==2.7.4
pydantic-settings==2.3.4
redis==5.0.6
celery[redis]==5.4.0
httpx==0.27.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
boto3==1.34.131
minio==7.2.7
pywebpush==2.0.0
py-vapid==1.9.2
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile backend/requirements.txt
git commit -m "chore: backend dockerfile and python dependencies"
```

---

### Task 3: Frontend Dockerfile

**Files:**
- Create: `c:\Github\SignSense\frontend\Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

- [ ] **Step 2: Commit**

```bash
git add frontend/Dockerfile
git commit -m "chore: frontend dockerfile"
```

---

### Task 4: Docker Compose

**Files:**
- Create: `c:\Github\SignSense\docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - miniodata:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama
    volumes:
      - ollamadata:/root/.ollama
    ports:
      - "11434:11434"

  fastapi:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - ./backend:/app
      - shared_models:/app/shared_models
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery:
    build:
      context: ./backend
    command: celery -A tasks worker --loglevel=info
    env_file: .env
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  celery-beat:
    build:
      context: ./backend
    command: celery -A tasks beat --loglevel=info
    env_file: .env
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  nextjs:
    build:
      context: ./frontend
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - shared_models:/app/public/models
    depends_on:
      - fastapi

volumes:
  pgdata:
  redisdata:
  miniodata:
  ollamadata:
  shared_models:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: docker compose with all 8 services"
```

---

### Task 5: Next.js Project Initialization

**Files:**
- Create: `c:\Github\SignSense\frontend\package.json` (generated)
- Create: `c:\Github\SignSense\frontend\tsconfig.json` (generated)
- Create: `c:\Github\SignSense\frontend\tailwind.config.ts` (generated)
- Create: `c:\Github\SignSense\frontend\next.config.mjs`

- [ ] **Step 1: Scaffold Next.js project**

Run from `c:\Github\SignSense`:
```bash
npx -y create-next-app@14 ./frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbo
```

Expected: Creates the full Next.js 14 project in `frontend/`.

- [ ] **Step 2: Install frontend dependencies**

Run from `c:\Github\SignSense\frontend`:
```bash
npm install zustand @tanstack/react-query framer-motion react-hot-toast canvas-confetti onnxruntime-web @mediapipe/tasks-vision
npm install -D @types/canvas-confetti
```

- [ ] **Step 3: Configure next.config.mjs for Web Workers and COOP/COEP headers**

Replace `frontend/next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create placeholder directories**

```bash
mkdir -p frontend/src/workers
mkdir -p frontend/src/components/webcam
mkdir -p frontend/src/components/ui
mkdir -p frontend/src/hooks
mkdir -p frontend/src/stores
mkdir -p frontend/src/lib/scoring
mkdir -p frontend/src/lib/inference
mkdir -p frontend/src/lib/api
mkdir -p frontend/public/models
mkdir -p frontend/public/data
```

- [ ] **Step 5: Verify Next.js boots**

Run from `c:\Github\SignSense\frontend`:
```bash
npm run dev
```
Expected: Server starts on http://localhost:3000, default Next.js page renders.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold next.js 14 with tailwind, deps, and worker config"
```

---

### Task 6: FastAPI App Entrypoint

**Files:**
- Create: `c:\Github\SignSense\backend\config.py`
- Create: `c:\Github\SignSense\backend\main.py`
- Create: `c:\Github\SignSense\backend\models\__init__.py`
- Create: `c:\Github\SignSense\backend\tasks\__init__.py`

- [ ] **Step 1: Create config.py**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://signsense:signsense_dev@postgres:5432/signsense"
    REDIS_URL: str = "redis://redis:6379/0"

    JWT_SECRET_KEY: str = "change_me"
    JWT_ALGORITHM: str = "HS256"

    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET_LORA: str = "lora-adapters"
    MINIO_BUCKET_MODELS: str = "psl-models"

    LLM_MODEL_NAME: str = "phi3:mini"
    OLLAMA_BASE_URL: str = "http://ollama:11434"

    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:admin@signsense.local"

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 2: Create database engine module**

Create `c:\Github\SignSense\backend\database.py`:

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
```

- [ ] **Step 3: Create minimal Celery app**

Create `c:\Github\SignSense\backend\tasks\__init__.py`:

```python
from celery import Celery
from config import settings

celery_app = Celery(
    "signsense",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
```

- [ ] **Step 4: Create main.py**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis

from config import settings
from database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify connections
    app.state.redis = aioredis.from_url(settings.REDIS_URL)
    yield
    # Shutdown
    await app.state.redis.close()
    await engine.dispose()


app = FastAPI(title="SignSense API", version="0.1.0", lifespan=lifespan)

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
```

- [ ] **Step 5: Create empty models init**

Create `c:\Github\SignSense\backend\models\__init__.py`:

```python
# Models will be imported here as they are created
```

- [ ] **Step 6: Verify FastAPI boots locally**

Run from `c:\Github\SignSense\backend`:
```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```
Expected: Server starts. `GET http://localhost:8000/health` returns `{"status": "ok"}`.

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: fastapi entrypoint with config, database, celery, and health endpoint"
```

---

### Task 7: Alembic Migration Setup

**Files:**
- Create: `c:\Github\SignSense\backend\alembic.ini`
- Create: `c:\Github\SignSense\backend\alembic\env.py`

- [ ] **Step 1: Initialize Alembic**

Run from `c:\Github\SignSense\backend`:
```bash
alembic init alembic
```
Expected: Creates `alembic/` directory and `alembic.ini`.

- [ ] **Step 2: Edit alembic.ini — set sqlalchemy.url to empty** 

In `alembic.ini`, find:
```
sqlalchemy.url = driver://user:pass@localhost/dbname
```
Replace with:
```
sqlalchemy.url =
```
(We'll set it programmatically in env.py)

- [ ] **Step 3: Edit alembic/env.py for async support**

Replace `c:\Github\SignSense\backend\alembic\env.py`:

```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from config import settings
from database import Base
# Import all models so Base.metadata is populated
from models import *  # noqa: F401, F403

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Commit**

```bash
git add backend/alembic.ini backend/alembic/
git commit -m "feat: alembic async migration setup"
```

---

### Task 8: Docker Compose Full Boot Test

- [ ] **Step 1: Build and start all services**

Run from `c:\Github\SignSense`:
```bash
docker compose up --build -d
```
Expected: All 8 services start. Check with `docker compose ps` — postgres, redis, minio should be healthy.

- [ ] **Step 2: Verify FastAPI health**

```bash
curl http://localhost:8000/health
```
Expected: `{"status": "ok"}`

- [ ] **Step 3: Verify Next.js**

Open `http://localhost:3000` in browser.
Expected: Default Next.js page renders.

- [ ] **Step 4: Verify MinIO console**

Open `http://localhost:9001` in browser. Login with `minioadmin` / `minioadmin123`.
Expected: MinIO console loads.

- [ ] **Step 5: Pull Ollama model**

```bash
docker compose exec ollama ollama pull phi3:mini
```
Expected: Model downloads (~2.2GB). If too slow or machine lacks resources:
```bash
docker compose exec ollama ollama pull tinyllama
```
Then set `LLM_MODEL_NAME=tinyllama` in `.env`.

- [ ] **Step 6: Verify Ollama**

```bash
curl http://localhost:11434/api/chat -d '{"model":"phi3:mini","messages":[{"role":"user","content":"Hello"}],"stream":false}'
```
Expected: JSON response with model output.

- [ ] **Step 7: Commit (no code change, just verification milestone)**

```bash
git add -A
git commit -m "chore: verify all docker services boot successfully"
```

---

### Task 9: MinIO Bucket Initialization Script

**Files:**
- Create: `c:\Github\SignSense\backend\utils\init_minio.py`

- [ ] **Step 1: Create init script**

```python
from minio import Minio
from minio.error import S3Error

from config import settings


def init_minio_buckets():
    client = Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=False,
    )

    for bucket_name in [settings.MINIO_BUCKET_LORA, settings.MINIO_BUCKET_MODELS]:
        try:
            if not client.bucket_exists(bucket_name):
                client.make_bucket(bucket_name)
                print(f"Created bucket: {bucket_name}")
            else:
                print(f"Bucket already exists: {bucket_name}")
        except S3Error as e:
            print(f"Error creating bucket {bucket_name}: {e}")


if __name__ == "__main__":
    init_minio_buckets()
```

- [ ] **Step 2: Add MinIO init to FastAPI lifespan**

In `c:\Github\SignSense\backend\main.py`, update the lifespan:

```python
from utils.init_minio import init_minio_buckets

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(settings.REDIS_URL)
    # Initialize MinIO buckets on startup
    try:
        init_minio_buckets()
    except Exception as e:
        print(f"MinIO init warning: {e}")
    yield
    await app.state.redis.close()
    await engine.dispose()
```

- [ ] **Step 3: Verify buckets created**

Restart FastAPI, then check MinIO console at `http://localhost:9001`.
Expected: `lora-adapters` and `psl-models` buckets exist.

- [ ] **Step 4: Commit**

```bash
git add backend/utils/init_minio.py backend/main.py
git commit -m "feat: auto-create minio buckets on startup"
```

---

## Self-Review Checklist

1. **Spec coverage:** ✅ Docker Compose with 8 services, ✅ PostgreSQL healthcheck, ✅ Redis persistence, ✅ MinIO with buckets, ✅ Ollama with model pull, ✅ FastAPI with CORS, ✅ Celery app, ✅ Next.js with Tailwind and COOP/COEP headers, ✅ Alembic async migrations, ✅ Environment variables matching spec.
2. **Placeholder scan:** No TBD, TODO, or "implement later" found. All code is complete.
3. **Type consistency:** `settings` object used consistently across config.py, main.py, database.py, tasks/__init__.py, and init_minio.py. Bucket names reference `settings.MINIO_BUCKET_LORA` and `settings.MINIO_BUCKET_MODELS` everywhere.

---

**Next:** Phase 1B plan covers MediaPipe Web Worker, landmark normalization, frame buffer, motion VAD, skeleton overlay, and calibration mode.
