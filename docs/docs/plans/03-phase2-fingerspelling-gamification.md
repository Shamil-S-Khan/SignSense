# Phase 2: ASL Fingerspelling + Gamification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Ship a working fingerspelling classifier quickly using a checkpoint-first path (HuggingFace -> Kaggle fallback -> fingerpose placeholder), integrate it in the browser via ONNX, and build the full gamification backend (XP, streaks, achievements, leagues, spaced repetition), JWT auth, and core UI (skill tree, lesson flow, home screen).

**Tech Stack:** HuggingFace Hub, TensorFlow Lite -> ONNX conversion, PyTorch (Kaggle fallback), ONNX Runtime Web, fingerpose (immediate placeholder), SQLAlchemy + Alembic, python-jose, Zustand, React Query, Framer Motion, Tailwind CSS

---

### Task 1: Fingerspelling Model Strategy (Checkpoint First)

**Files:**
- Modify: `training/fingerspelling_train.py`
- Create: `training/fingerspelling_hf_convert.py`
- Create: `training/fingerspelling_kaggle_mlp.py`

Use this exact fallback chain:
1) Try `ColdSlim/ASL-TFLite-Edge` from HuggingFace and convert to ONNX
2) If conversion/inference quality is problematic, train a simple Kaggle MLP baseline in ~10 minutes
3) Keep fingerpose active as the immediate working placeholder until ONNX model is validated

---

#### 1-A: Attempt HuggingFace checkpoint first (`ColdSlim/ASL-TFLite-Edge`)

- [ ] **Step 1:** Download `ColdSlim/ASL-TFLite-Edge` model from HuggingFace and inspect model I/O tensor shape and label map
- [ ] **Step 2:** Convert TFLite -> ONNX (`opset=17`) and save as `frontend/public/models/fingerspelling.onnx`
- [ ] **Step 3:** Run a smoke test on representative landmarks to verify:
  - input shape matches worker output
  - output logits/probabilities map correctly to A-Z + control labels
  - model loads in `onnxruntime-web`
- [ ] **Step 4:** Acceptance gate for HF model:
  - conversion succeeds without unsupported ops in browser runtime
  - target-letter validation is acceptable for lesson flow
  - confidence is stable under temporal smoothing

---

#### 1-B: Kaggle fallback (only if HF conversion/quality fails)

- [ ] **Step 5:** Use Kaggle fingerspelling competition dataset and train a compact MLP baseline (landmark input) with runtime target ~10 minutes on free GPU
- [ ] **Step 6:** Export ONNX and quantize to INT8
- [ ] **Step 7:** Save as `frontend/public/models/fingerspelling.onnx`
- [ ] **Step 8:** Verify browser load + inference parity for train notebook vs browser runtime

---

#### 1-C: Artefacts and runtime readiness (applies to either HF or Kaggle path)

- [ ] **Step 9:** Ensure output artefacts exist:
  - `frontend/public/models/fingerspelling.onnx`
  - `frontend/public/models/class_map.json`
- [ ] **Step 10:** Validate ONNX file size target (< 500 KB preferred after quantization)
- [ ] **Step 11:** Confirm model loads in worker and emits predictions with temporal smoothing enabled
- [ ] **Step 12:** Document which source won (`ColdSlim/ASL-TFLite-Edge` or Kaggle MLP fallback)

**Key code — MLP architecture:**
```python
class FingerspellingMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(63, 256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, 29),
        )
    def forward(self, x):
        return self.net(x)
```

**Key code — ONNX export:**
```python
dummy = torch.randn(1, 63)
torch.onnx.export(model, dummy, "fingerspelling.onnx", opset_version=17,
                   input_names=["landmarks"], output_names=["logits"],
                   dynamic_axes={"landmarks": {0: "batch"}, "logits": {0: "batch"}})
```

---

### Task 2: Fingerpose Immediate Placeholder

**Files:** Create: `frontend/src/lib/inference/fingerspelling-fallback.ts`

- [ ] **Step 1:** Install fingerpose package: `npm install fingerpose`
- [ ] **Step 2:** Create wrapper that accepts 21 MediaPipe hand landmarks, runs fingerpose gesture estimation
- [ ] **Step 3:** Define ASL letter gestures for A-Z using fingerpose's GestureDescription API (curl/direction rules per finger)
- [ ] **Step 4:** Export `classifyFingerspellingFallback(landmarks)` returning `{ letter: string, confidence: number }`
- [ ] **Step 5:** Wire this as the default temporary classifier until ONNX path passes validation gates

---

### Task 3: ONNX Fingerspelling Browser Integration

**Files:** Create: `frontend/src/lib/inference/fingerspelling.ts`

- [ ] **Step 1:** Load `fingerspelling.onnx` via `onnxruntime-web` InferenceSession in the Web Worker
- [ ] **Step 2:** Runtime fallback order:
  1. HuggingFace-converted ONNX (preferred)
  2. Kaggle-trained MLP ONNX (fallback)
  3. fingerpose placeholder (last fallback)
- [ ] **Step 3:** On each frame when VAD is IDLE, run inference on dominant hand landmarks
- [ ] **Step 4:** Implement temporal smoothing: 8-frame sliding window, majority vote, emit only if confidence > 0.80 and same letter in ≥ 6 of last 8 frames
- [ ] **Step 5:** Add new worker message type `LETTER_DETECTED` with letter and confidence fields

**Key code — temporal smoothing:**
```typescript
const WINDOW = 8;
const history: string[] = [];

function smoothPrediction(letter: string, conf: number): string | null {
  history.push(letter);
  if (history.length > WINDOW) history.shift();
  if (history.length < WINDOW) return null;

  const counts = new Map<string, number>();
  for (const l of history) counts.set(l, (counts.get(l) ?? 0) + 1);
  const [best, bestCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return bestCount >= 6 && conf > 0.80 ? best : null;
}
```

---

### Task 4: Database Schema — All Tables

**Files:**
- Create: `backend/models/user.py`
- Create: `backend/models/sign_attempt.py`
- Create: `backend/models/lesson.py`
- Create: `backend/models/achievement.py`
- Create: `backend/models/league.py`
- Create: `backend/models/notification.py`
- Create: `backend/models/spaced_repetition.py`
- Modify: `backend/models/__init__.py`

- [ ] **Step 1:** Define `users` table with all columns from spec (UUID pk, email, password_hash, display_name, xp, level, streak fields, lora key, account_type enum, league FK)
- [ ] **Step 2:** Define `sign_attempts` table (UUID pk, user FK, sign_id, exercise FK, all score columns, computed overall_score, coaching_message, attempt_number, session_id)
- [ ] **Step 3:** Define `lesson_attempts` table (UUID pk, user FK, lesson_id, timestamps, hearts, xp, accuracy columns)
- [ ] **Step 4:** Define `spaced_repetition` table (UUID pk, user FK, sign_id, interval, ease_factor, next_review, consecutive_correct, unique constraint)
- [ ] **Step 5:** Define `achievements` + `user_achievements` tables (key, name, desc, hint, category enum, xp_reward, unique constraint)
- [ ] **Step 6:** Define `leagues` + `league_memberships` tables (tier enum, week dates, weekly_xp, etc.)
- [ ] **Step 7:** Define `notifications` table (UUID pk, user FK, message, type, is_read, timestamp)
- [ ] **Step 8:** Import all models in `__init__.py`
- [ ] **Step 9:** Generate Alembic migration: `alembic revision --autogenerate -m "initial schema"`
- [ ] **Step 10:** Run migration: `alembic upgrade head`
- [ ] **Step 11:** Seed achievements table in migration with all achievement definitions

---

### Task 5: JWT Authentication

**Files:**
- Create: `backend/utils/auth.py`
- Create: `backend/schemas/auth.py`
- Create: `backend/routers/auth.py`

- [ ] **Step 1:** Create JWT helper functions: `create_access_token`, `create_refresh_token`, `verify_token`, `get_current_user` dependency
- [ ] **Step 2:** Create Pydantic schemas: `RegisterRequest`, `LoginRequest`, `TokenResponse`, `RefreshRequest`
- [ ] **Step 3:** Implement `POST /api/auth/register` — hash password with passlib bcrypt, create user, return tokens
- [ ] **Step 4:** Implement `POST /api/auth/login` — verify password, return tokens
- [ ] **Step 5:** Implement `POST /api/auth/refresh` — verify refresh token, issue new access token
- [ ] **Step 6:** Implement `DELETE /api/auth/logout` — blacklist token in Redis with TTL matching token expiry
- [ ] **Step 7:** Register auth router in `main.py`

---

### Task 6: XP Service

**Files:** Create: `backend/services/xp_service.py`

- [ ] **Step 1:** Define level thresholds list: level 1 = 0 XP, each next = prev × 1.5 rounded to nearest 50, up to level 50
- [ ] **Step 2:** Implement `calculate_exercise_xp(overall_score, attempt_number, exercise_type)` — base XP by type + bonus for high score + first-attempt bonus
- [ ] **Step 3:** Implement `calculate_lesson_completion_bonus(hearts_remaining)` — 25 if 5 hearts, else 15
- [ ] **Step 4:** Implement `apply_streak_multiplier(base_xp, streak_count)` — 2.0× at 30+, 1.5× at 7+, else 1.0×
- [ ] **Step 5:** Implement `award_xp(user_id, xp_amount, db_session)` — atomic add, level-up check, return result
- [ ] **Step 6:** Write pytest tests for all XP calculations with edge cases

---

### Task 7: Streak Service

**Files:** Create: `backend/services/streak_service.py`

- [ ] **Step 1:** Implement `record_session(user_id, session_date, db_session)` with full logic: same-day no-op, consecutive day increment, 1-day gap with shield, 1-day gap without shield reset, 2+ day gap reset
- [ ] **Step 2:** After streak update, check milestone thresholds {7, 14, 30, 90, 365} for shield award and achievement trigger
- [ ] **Step 3:** Write pytest tests covering all streak edge cases (gap with shield, gap without shield, same-day duplicate, milestone triggers)

---

### Task 8: Achievement Service

**Files:** Create: `backend/services/achievement_service.py`

- [ ] **Step 1:** Implement `check_and_award(user_id, trigger_event, event_data, db_session)`
- [ ] **Step 2:** Write individual checker functions for each achievement category: MILESTONE (first sign, 100 signs, etc.), ACCURACY (perfect score), STREAK (7/14/30/90/365 days), DISCOVERY (try all exercise types), SOCIAL (join league)
- [ ] **Step 3:** Each checker: query DB to verify condition → if met and not already earned → insert UserAchievement → call XPService.award_xp → insert notification
- [ ] **Step 4:** Write pytest tests for 3 representative achievements

---

### Task 9: Spaced Repetition Service

**Files:** Create: `backend/services/sr_service.py`

- [ ] **Step 1:** Implement `record_attempt(user_id, sign_id, overall_score, db_session)` — load/create record, update interval and ease_factor per spec rules
- [ ] **Step 2:** Implement `get_due_signs(user_id, limit, db_session)` — query where next_review_date ≤ today, order by date, limit
- [ ] **Step 3:** Write pytest tests for SR interval progression (correct vs incorrect sequences)

---

### Task 10: Core API Endpoints

**Files:**
- Create: `backend/routers/users.py`
- Create: `backend/routers/exercises.py`
- Create: `backend/routers/lessons.py`
- Create: `backend/routers/skill_tree.py`
- Create: `backend/routers/leagues.py`
- Create: `backend/routers/daily_challenge.py`
- Create: `backend/routers/achievements.py`
- Create: `backend/routers/notifications.py`

- [ ] **Step 1:** `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/users/me/progress`, `GET /api/users/me/weaknesses`
- [ ] **Step 2:** `POST /api/exercises/attempt` — record attempt, call scoring services, call XP/streak/achievement services, return results
- [ ] **Step 3:** `GET /api/lessons/{id}`, `POST /api/lessons/{id}/complete`, `GET /api/lessons/next`
- [ ] **Step 4:** `GET /api/skill-tree/asl`, `GET /api/skill-tree/psl`
- [ ] **Step 5:** `GET /api/leagues/current`
- [ ] **Step 6:** `GET /api/daily-challenge/today`, `POST /api/daily-challenge/attempt`
- [ ] **Step 7:** `GET /api/achievements`
- [ ] **Step 8:** `GET /api/notifications/unread`, `POST /api/notifications/{id}/read`
- [ ] **Step 9:** Register all routers in `main.py`

---

### Task 11: Skill Tree UI

**Files:**
- Create: `frontend/src/app/skill-tree/page.tsx`
- Create: `frontend/src/components/skill-tree/SkillTreeCanvas.tsx`
- Create: `frontend/src/components/skill-tree/SkillNodePanel.tsx`

- [ ] **Step 1:** Define skill tree layout config: node positions as % of container, child connections, unlock requirements
- [ ] **Step 2:** Render scrollable container with SVG curved paths (cubic Bezier) between nodes
- [ ] **Step 3:** Render each node as circular element with SVG completion ring, glow animation for completed, 40% opacity + lock icon for locked
- [ ] **Step 4:** Click unlocked node → Framer Motion slide-in panel from right with vocabulary preview + Start button
- [ ] **Step 5:** Click locked node → tooltip showing requirements

---

### Task 12: Lesson Exercise View

**Files:**
- Create: `frontend/src/app/lesson/[lessonId]/page.tsx`
- Create: `frontend/src/components/lesson/ExerciseView.tsx`
- Create: `frontend/src/components/lesson/ScoreBars.tsx`
- Create: `frontend/src/components/lesson/ResultsScreen.tsx`
- Create: `frontend/src/components/ui/HeartBar.tsx`

- [ ] **Step 1:** Full viewport layout: top bar (hearts + progress + streak), webcam left 40%, exercise right 60%
- [ ] **Step 2:** Watch and Reproduce exercise: reference video at top, status indicator, attempt tracking
- [ ] **Step 3:** Score bars: 3 animated bars (Framer Motion spring, 600ms) color-coded (green/amber/red) with text labels for accessibility
- [ ] **Step 4:** Results screen with canvas-confetti animation on mount
- [ ] **Step 5:** Heart system: start with 5, lose 1 on score < 60, lesson fails at 0

---

### Task 13: Home Screen

**Files:**
- Create: `frontend/src/app/page.tsx` (replace test page)
- Create: `frontend/src/components/home/DailyChallengeCard.tsx`
- Create: `frontend/src/components/home/DrillCard.tsx`
- Create: `frontend/src/components/home/WeeklyXPBar.tsx`
- Create: `frontend/src/stores/userStore.ts`
- Create: `frontend/src/stores/sessionStore.ts`
- Create: `frontend/src/lib/api/client.ts`

- [ ] **Step 1:** Set up API client with axios/fetch wrapper, JWT token management, React Query provider
- [ ] **Step 2:** Zustand user store: current user, level, streak, XP
- [ ] **Step 3:** Home layout: user badge + level (top-left), streak counter with flame + pulse animation (top-right)
- [ ] **Step 4:** Daily Challenge card: today's sign, best score, Start button
- [ ] **Step 5:** Custom Drill card: signs due for review count, Start Drill button
- [ ] **Step 6:** Continue button: next incomplete lesson
- [ ] **Step 7:** Weekly XP bar: progress toward promotion threshold

---

## Self-Review

1. **Spec coverage:** ✅ checkpoint-first fingerspelling path (`ColdSlim/ASL-TFLite-Edge` -> Kaggle MLP fallback -> fingerpose placeholder), ✅ temporal smoothing (8-frame, majority 6+, confidence 0.80), ✅ all 10 database tables, ✅ all 4 services with exact algorithms from spec, ✅ all API endpoints listed in spec, ✅ skill tree with SVG paths + Framer Motion panel, ✅ lesson flow with hearts + score bars + confetti, ✅ home screen with all 4 cards.
2. **Placeholder scan:** No TBD/TODO. All task steps describe concrete actions.
3. **Type consistency:** `overall_score` computed formula (0.35+0.35+0.30) used in both DB model and exercise endpoint. Level thresholds computed identically in XP service. Achievement keys referenced by string from DB seed.
