# SignSense — Master Progress Checklist

> Last updated: 2026-04-30

---

## Phase 1A: Infrastructure & Project Setup
[Plan →](./01-phase1a-infrastructure.md)

- [ ] **Task 1:** Project root files (.gitignore, .env.example, .env)
- [ ] **Task 2:** Backend Dockerfile & requirements.txt
- [ ] **Task 3:** Frontend Dockerfile
- [ ] **Task 4:** Docker Compose (8 services)
- [ ] **Task 5:** Next.js 14 project initialization (Tailwind, deps, COOP/COEP)
- [ ] **Task 6:** FastAPI app entrypoint (config, database, Celery, health)
- [ ] **Task 7:** Alembic async migration setup
- [ ] **Task 8:** Docker Compose full boot test (all services verified)
- [ ] **Task 9:** MinIO bucket initialization script

---

## Phase 1B: Vision Pipeline
[Plan →](./02-phase1b-vision-pipeline.md)

- [ ] **Task 1:** Message protocol types (WorkerInMessage, WorkerOutMessage)
- [ ] **Task 2:** MediaPipe Web Worker core (init, normalization, buffer, VAD)
- [ ] **Task 3:** useMediaPipeWorker hook
- [ ] **Task 4:** useWebcam hook (ImageBitmap capture)
- [ ] **Task 5:** Skeleton overlay component (Canvas)
- [ ] **Task 6:** WebcamFeed integrated component
- [ ] **Task 7:** Test page (vision pipeline smoke test)

---

## Phase 2: ASL Fingerspelling + Gamification
[Plan →](./03-phase2-fingerspelling-gamification.md)

- [ ] **Task 1:** Fingerspelling model strategy (HF checkpoint first, Kaggle fallback)
- [ ] **Task 2:** Fingerpose immediate placeholder
- [ ] **Task 3:** ONNX fingerspelling browser integration
- [ ] **Task 4:** Database schema — all tables (users, attempts, lessons, achievements, leagues, notifications, SR)
- [ ] **Task 5:** JWT authentication (register, login, refresh, logout)
- [ ] **Task 6:** XP service (calculate, award, level thresholds)
- [ ] **Task 7:** Streak service (record, shields, milestones)
- [ ] **Task 8:** Achievement service (check and award)
- [ ] **Task 9:** Spaced repetition service (record attempt, get due signs)
- [ ] **Task 10:** Core API endpoints (users, exercises, lessons, skill tree, leagues, daily challenge, achievements, notifications)
- [ ] **Task 11:** Skill tree UI (SVG paths, node panel, Framer Motion)
- [ ] **Task 12:** Lesson exercise view (hearts, score bars, results, confetti)
- [ ] **Task 13:** Home screen (daily challenge, drill, continue, XP bar)

---

## Phase 3: Phonological Scoring + LLM Feedback
[Plan →](./04-phase3-scoring-llm.md)

- [ ] **Task 1:** Sign vocabulary JSON (schema + ASL alphabet + 10 common signs)
- [ ] **Task 2:** Handshape scoring (joint angles, weighted MAE)
- [ ] **Task 3:** Orientation scoring (palm normal cross product)
- [ ] **Task 4:** Movement scoring with DTW (Sakoe-Chiba band)
- [ ] **Task 5:** Score display in lesson UI (animated bars, color coding)
- [ ] **Task 6:** Coaching bubble UI (speech bubble, fade-in)
- [ ] **Task 7:** Ollama LLM feedback endpoint (system prompt, timeout, fallback)

---

## Phase 4: Dynamic ASL Recognition
[Plan →](./05-phase4-dynamic-asl.md)

- [ ] **Task 1:** Evaluate OpenHands WLASL checkpoint first
- [ ] **Task 2:** Fine-tune on Google ASL Signs (fallback #1)
- [ ] **Task 3:** WLASL data download & landmark extraction (fallback #2)
- [ ] **Task 4:** BiLSTM scratch training on Kaggle (fallback #2)
- [ ] **Task 5:** Browser ONNX integration (confidence threshold, rest suppression)
- [ ] **Task 6:** Extend skill tree (dynamic sign categories)

---

## Phase 5: PSL Data Collection & Training
[Plan →](./06-phase5-psl-collection.md)

- [ ] **Task 1:** PSL submission database model & migration
- [ ] **Task 2:** PSL collection interface (/admin/collect-psl)
- [ ] **Task 3:** PSL review interface (/admin/review-psl)
- [ ] **Task 4:** Admin API endpoints (submit, list, approve, reject)
- [ ] **Task 5:** Data augmentation pipeline (rotation, scale, speed, noise, combined)
- [ ] **Task 6:** PSL model training on Kaggle (BiLSTM, held-out signer validation)
- [ ] **Task 7:** PSL skill tree track (language toggle, PSL nodes)

---

## Phase 6: LLM Personalization + Background Jobs
[Plan →](./07-phase6-personalization-jobs.md)

- [ ] **Task 1:** LoRA fine-tuning Celery task (4-bit, peft, Trainer)
- [ ] **Task 2:** MinIO adapter service with LRU cache
- [ ] **Task 3:** League weekly reset job (promote/demote)
- [ ] **Task 4:** Daily challenge job (Redis key, 25hr TTL)
- [ ] **Task 5:** Streak expiry notification job (hourly)
- [ ] **Task 6:** PSL model retraining check (Monday 3am, threshold 500)
- [ ] **Task 7:** Celery beat schedule registration
- [ ] **Task 8:** Web Push notifications (VAPID, pywebpush, service worker)
- [ ] **Task 9:** In-app notification polling (60s, react-hot-toast)

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1A — Infrastructure | 9 | ⬜ Not started |
| 1B — Vision Pipeline | 7 | ⬜ Not started |
| 2 — Fingerspelling + Gamification | 13 | ⬜ Not started |
| 3 — Scoring + LLM | 7 | ⬜ Not started |
| 4 — Dynamic ASL | 6 | ⬜ Not started |
| 5 — PSL Collection | 7 | ⬜ Not started |
| 6 — Personalization + Jobs | 9 | ⬜ Not started |
| **Total** | **56** | |
