# SignSense — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted, AI-powered sign language practice platform with real-time webcam feedback, gamified curriculum, and support for ASL + PSL.

**Architecture:** Next.js 14 frontend communicates with a FastAPI backend. MediaPipe runs in a Web Worker for real-time landmark extraction. ONNX models run browser-side for sign classification. Ollama provides LLM coaching. All services orchestrated via Docker Compose.

**Tech Stack:** Next.js 14, FastAPI, PostgreSQL 15, Redis 7, Celery, MinIO, Ollama (Phi-3 Mini), MediaPipe Tasks Vision, ONNX Runtime Web, PyTorch, Tailwind CSS, Framer Motion, Zustand, React Query.

---

## User Review Required

> [!IMPORTANT]
> **MediaPipe Package Migration:** The spec calls for `@mediapipe/holistic` — this package is **deprecated** (last updated Feb 2023). I will use `@mediapipe/tasks-vision` with `HolisticLandmarker` instead. Same landmark output format, actively maintained, better Web Worker support. The landmark indices and normalization logic remain identical.

> [!WARNING]
> **Celery Beat Scheduler:** The spec references `django_celery_beat.schedulers:DatabaseScheduler` — this is a Django-only package. Since we use FastAPI, I will use `celery.beat.PersistentScheduler` (file-based, built into Celery) or `redbeat` (Redis-backed, MIT license). Recommend **redbeat** for Docker compatibility.

> [!IMPORTANT]
> **Scope Decomposition:** This spec covers 6 independent subsystems. Per best practices, each phase gets its own detailed plan. This document is the **master overview**. After you approve the approach, I'll produce the Phase 1 detailed plan with bite-sized TDD tasks.

## Open Questions

1. **GPU availability:** Does your development machine have an NVIDIA GPU? This determines Ollama model choice (Phi-3 vs TinyLlama) and whether LoRA fine-tuning runs locally or only via Kaggle.
2. **Domain/ports:** For local dev, is `localhost:3000` (frontend) + `localhost:8000` (API) acceptable, or do you need a reverse proxy?
3. **Auth provider:** The spec mentions JWT auth. Should we add OAuth (Google/GitHub) login as well, or email/password only?
4. **Tailwind version:** Spec says Tailwind CSS. Confirm Tailwind v3 or v4?

---

## Phase Overview

| Phase | Name | Key Deliverable | Dependencies |
|-------|------|----------------|-------------|
| 1 | Vision Pipeline | Web Worker with MediaPipe, landmark normalization, motion VAD, skeleton overlay | None (foundation) |
| 2 | ASL Fingerspelling + Gamification | Checkpoint-first fingerspelling (HF -> Kaggle fallback -> fingerpose placeholder), full DB schema, XP/streak/achievement services, skill tree UI, lesson flow | Phase 1 |
| 3 | Phonological Scoring | Handshape/orientation/movement scoring engine, sign vocabulary JSON, Ollama LLM feedback | Phase 2 |
| 4 | Dynamic ASL Recognition | Checkpoint-first dynamic ASL (OpenHands -> Google fine-tune -> WLASL scratch), ONNX browser integration, expanded skill tree | Phase 3 |
| 5 | PSL Data Collection | Collection UI, review UI, augmentation pipeline, PSL model training | Phase 4 |
| 6 | LLM Personalization | LoRA fine-tuning pipeline, MinIO adapter storage, full background job schedule | Phase 5 |

---

## Infrastructure (Built in Phase 1)

### Docker Compose Services

```
postgres (15-alpine) ─── port 5432
redis (7-alpine) ─────── port 6379
minio (minio/minio) ──── ports 9000, 9001
ollama (ollama/ollama) ── port 11434
fastapi (custom) ──────── port 8000
celery (custom) ────────── no port
celery-beat (custom) ───── no port
nextjs (node:20-alpine) ── port 3000
```

### File Structure (Full Project)

```
c:\Github\SignSense\
├── docker-compose.yml
├── .env.example
├── .env                          # gitignored
├── .gitignore
│
├── frontend/                     # Next.js 14 App Router
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.mjs
│   ├── public/
│   │   ├── models/               # ONNX model files
│   │   │   ├── fingerspelling.onnx
│   │   │   └── dynamic-asl.onnx
│   │   └── data/
│   │       └── sign-vocabulary.json
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Home screen
│   │   │   ├── skill-tree/
│   │   │   │   └── page.tsx
│   │   │   ├── lesson/
│   │   │   │   └── [lessonId]/
│   │   │   │       └── page.tsx
│   │   │   ├── daily-challenge/
│   │   │   │   └── page.tsx
│   │   │   └── admin/
│   │   │       ├── collect-psl/
│   │   │       │   └── page.tsx
│   │   │       └── review-psl/
│   │   │           └── page.tsx
│   │   ├── components/
│   │   │   ├── webcam/
│   │   │   │   ├── WebcamFeed.tsx
│   │   │   │   └── SkeletonOverlay.tsx
│   │   │   ├── skill-tree/
│   │   │   │   ├── SkillTreeCanvas.tsx
│   │   │   │   └── SkillNodePanel.tsx
│   │   │   ├── lesson/
│   │   │   │   ├── ExerciseView.tsx
│   │   │   │   ├── ScoreBars.tsx
│   │   │   │   ├── CoachBubble.tsx
│   │   │   │   └── ResultsScreen.tsx
│   │   │   ├── home/
│   │   │   │   ├── DailyChallengeCard.tsx
│   │   │   │   ├── DrillCard.tsx
│   │   │   │   └── WeeklyXPBar.tsx
│   │   │   └── ui/
│   │   │       ├── Toast.tsx
│   │   │       └── HeartBar.tsx
│   │   ├── workers/
│   │   │   └── mediapipe.worker.ts
│   │   ├── lib/
│   │   │   ├── scoring/
│   │   │   │   ├── handshape.ts
│   │   │   │   ├── orientation.ts
│   │   │   │   ├── movement.ts
│   │   │   │   └── dtw.ts
│   │   │   ├── inference/
│   │   │   │   ├── fingerspelling.ts
│   │   │   │   └── dynamic-asl.ts
│   │   │   └── api/
│   │   │       └── client.ts
│   │   ├── hooks/
│   │   │   ├── useMediaPipeWorker.ts
│   │   │   ├── useWebcam.ts
│   │   │   └── useNotifications.ts
│   │   └── stores/
│   │       ├── sessionStore.ts
│   │       └── userStore.ts
│
├── backend/                      # FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # FastAPI app entrypoint
│   ├── config.py                 # Settings from env vars
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── sign_attempt.py
│   │   ├── lesson.py
│   │   ├── achievement.py
│   │   ├── league.py
│   │   ├── notification.py
│   │   └── spaced_repetition.py
│   ├── schemas/                  # Pydantic v2 schemas
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── exercise.py
│   │   ├── feedback.py
│   │   └── lesson.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── lessons.py
│   │   ├── exercises.py
│   │   ├── feedback.py
│   │   ├── skill_tree.py
│   │   ├── leagues.py
│   │   ├── daily_challenge.py
│   │   ├── achievements.py
│   │   ├── notifications.py
│   │   ├── push.py
│   │   └── admin.py
│   ├── services/
│   │   ├── xp_service.py
│   │   ├── streak_service.py
│   │   ├── achievement_service.py
│   │   ├── sr_service.py
│   │   ├── llm_service.py
│   │   └── minio_service.py
│   ├── tasks/
│   │   ├── __init__.py           # Celery app config
│   │   ├── league_reset.py
│   │   ├── daily_challenge.py
│   │   ├── streak_notification.py
│   │   ├── lora_finetuning.py
│   │   └── psl_retraining.py
│   └── utils/
│       ├── auth.py               # JWT helpers
│       └── push.py               # pywebpush helpers
│
└── training/                     # Kaggle notebook scripts
    ├── fingerspelling_train.py
    ├── fingerspelling_hf_convert.py
    ├── fingerspelling_kaggle_mlp.py
    ├── eval_openhands_wlasl.py
    ├── dynamic_asl_finetune_google.py
    ├── wlasl_prepare.py
    ├── dynamic_asl_train.py
    ├── psl_train.py
    └── psl_augmentation.py
```

---

## Phase 1 Summary: Vision Pipeline

Phase 1 establishes the foundation — Docker infrastructure, Next.js project, FastAPI project, and the complete MediaPipe Web Worker pipeline. At the end of Phase 1, a user can open the app, see their webcam with skeleton overlay, and the motion VAD correctly detects sign start/end boundaries.

**Detailed Phase 1 plan will be produced as a separate document after approval of this master plan.**

---

## Phase 2 Summary: ASL Fingerspelling + Gamification

- Try `ColdSlim/ASL-TFLite-Edge` from HuggingFace first and convert to ONNX
- If conversion/quality fails, train a simple Kaggle MLP baseline (~10 min on free GPU)
- Keep `fingerpose` as immediate working placeholder until ONNX path is validated
- Integrate chosen ONNX model in Web Worker
- Build full PostgreSQL schema (all tables from spec)
- Implement XP, Streak, Achievement, Spaced Repetition services
- Build skill tree UI, lesson exercise flow, home screen
- Implement JWT auth endpoints

---

## Phase 3 Summary: Phonological Scoring Engine

- Implement `scoreHandshape`, `scoreOrientation`, `scoreMovement` in TypeScript
- Build DTW implementation (~50 lines)
- Populate `sign-vocabulary.json` with canonical data for initial ASL signs
- Integrate component scores into lesson UI (animated score bars)
- Set up Ollama container, implement LLM feedback endpoint
- Build coaching bubble UI with repetition avoidance

---

## Phase 4 Summary: Dynamic ASL Sign Recognition

- Evaluate OpenHands WLASL checkpoint first (LSTM/Transformer landmark model)
- If target-vocabulary accuracy is <65%, fine-tune on Google ASL Signs Kaggle dataset (<1 hour target)
- Only if still <65%, train BiLSTM from scratch on full WLASL
- Export selected model to ONNX and integrate in Web Worker
- Extend skill tree beyond fingerspelling to dynamic signs

---

## Phase 5 Summary: PSL Data Collection

- Build `/admin/collect-psl` and `/admin/review-psl` pages
- Implement data augmentation pipeline in Python
- Train PSL BiLSTM on Kaggle
- Add PSL skill tree track

---

## Phase 6 Summary: LLM Personalization + Background Jobs

- Implement LoRA fine-tuning Celery task
- Set up MinIO adapter storage/retrieval with LRU cache
- Implement all Celery beat jobs (league reset, daily challenge, streak notifications)
- Implement Web Push notifications with pywebpush + VAPID
- Full notification polling system

---

## Verification Plan

### Per-Phase Automated Tests
- **Phase 1:** Browser test — webcam opens, skeleton renders, VAD state transitions logged to console
- **Phase 2:** pytest for all services (XP, streak, achievement, SR), Kaggle notebook produces valid ONNX
- **Phase 3:** Unit tests for scoring functions with known canonical/observed pairs, Ollama endpoint integration test
- **Phase 4:** pytest for data pipeline, Kaggle notebook accuracy targets, browser inference test
- **Phase 5:** Playwright tests for collection/review flows, augmentation output verification
- **Phase 6:** Celery task integration tests, MinIO upload/download roundtrip, push notification test

### Manual Verification
- Each phase includes a browser walkthrough recording demonstrating the feature end-to-end
- Docker Compose `up` from clean state must work on each phase completion
