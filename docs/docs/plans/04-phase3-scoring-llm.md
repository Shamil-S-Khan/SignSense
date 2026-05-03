# Phase 3: Phonological Scoring Engine + LLM Feedback

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Implement browser-side scoring of hand shape, orientation, and movement quality against canonical sign definitions. Integrate Ollama for natural-language coaching feedback. Populate the sign vocabulary JSON.

**Tech Stack:** TypeScript (scoring), DTW algorithm, Ollama/Phi-3 Mini, httpx, FastAPI

---

### Task 1: Sign Vocabulary JSON

**Files:** Create: `frontend/public/data/sign-vocabulary.json`

- [ ] **Step 1:** Define JSON schema for each sign entry: `id`, `label`, `language`, `difficulty` (1-5), `skillNode`, `canonicalHandshape` (jointAngles array of 15 floats + handshapeCategory), `canonicalOrientation` (palmNormal 3-float unit vector + orientationCategory), `canonicalMovement` (movementType + trajectoryTemplate + isDynamic), `referenceVideoUrl`, `isTwoHanded`
- [ ] **Step 2:** Populate entries for ASL alphabet A-Z (26 static signs) with measured canonical joint angles and palm normals
- [ ] **Step 3:** Populate entries for 10 common ASL signs (hello, thank you, please, sorry, yes, no, help, more, want, like) with movement trajectories
- [ ] **Step 4:** Validate JSON structure with a TypeScript type guard

---

### Task 2: Handshape Scoring

**Files:** Create: `frontend/src/lib/scoring/handshape.ts`

- [ ] **Step 1:** Implement `computeJointAngles(landmarks: HandLandmark[]): number[]` — for each of 15 finger joints (3 per finger), compute angle using arccos(dot(A,B)/(|A|×|B|))
- [ ] **Step 2:** Implement `scoreHandshape(observed: HandLandmark[], canonical: CanonicalHandshape): HandshapeResult` — operate on peak motion frame, compute weighted MAE (thumb joints 1.5×, others 1.0×), score = max(0, 100 - weightedMAE × 1.8)
- [ ] **Step 3:** Return score + category: >85 CORRECT, 60-85 MINOR_ERROR with worst finger, <60 MAJOR_ERROR with two worst fingers
- [ ] **Step 4:** Write unit tests with known joint angle vectors

**Key code — joint angle computation:**
```typescript
function jointAngle(a: Vec3, b: Vec3, c: Vec3): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  return Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * (180 / Math.PI);
}
```

---

### Task 3: Orientation Scoring

**Files:** Create: `frontend/src/lib/scoring/orientation.ts`

- [ ] **Step 1:** Implement `computePalmNormal(landmarks: HandLandmark[]): Vec3` — cross product of (lm0→lm9) and (lm5→lm17), normalized to unit length
- [ ] **Step 2:** Implement `scoreOrientation(observed: HandLandmark[], canonical: CanonicalOrientation, frames: Float32Array, isDynamic: boolean): OrientationResult`
- [ ] **Step 3:** For static signs: operate on frame 30. For dynamic: average frames 15 and 45
- [ ] **Step 4:** Score = dot(observed, canonical) × 100, clamped 0-100. >85 CORRECT, 60-85 MINOR_ROTATION, <60 MAJOR_ROTATION with direction
- [ ] **Step 5:** Write unit tests with known palm normal vectors

---

### Task 4: Movement Scoring with DTW

**Files:**
- Create: `frontend/src/lib/scoring/dtw.ts`
- Create: `frontend/src/lib/scoring/movement.ts`

- [ ] **Step 1:** Implement constrained DTW in TypeScript (~50 lines): Sakoe-Chiba band width 10, Euclidean distance

**Key code — DTW:**
```typescript
export function dtw(s: number[][], t: number[][], bandWidth = 10): number {
  const n = s.length, m = t.length;
  const cost = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
  cost[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    const jMin = Math.max(1, i - bandWidth);
    const jMax = Math.min(m, i + bandWidth);
    for (let j = jMin; j <= jMax; j++) {
      const d = Math.sqrt(s[i-1].reduce((sum, v, k) => sum + (v - t[j-1][k]) ** 2, 0));
      cost[i][j] = d + Math.min(cost[i-1][j], cost[i][j-1], cost[i-1][j-1]);
    }
  }
  return cost[n][m];
}
```

- [ ] **Step 2:** Implement `scoreMovement(frames: Float32Array, canonical: CanonicalMovement): MovementResult`
- [ ] **Step 3:** Extract wrist x,y for all 60 frames, normalize to start at origin, scale arc length to 1.0
- [ ] **Step 4:** For dynamic signs: DTW against trajectory template, score = max(0, 100 - dtwDist × 200)
- [ ] **Step 5:** For static signs: check max wrist displacement, <0.05 → 95, ≥0.05 → 50 with UNEXPECTED_MOVEMENT
- [ ] **Step 6:** Write unit tests with synthetic trajectories

---

### Task 5: Score Display in Lesson UI

**Files:** Modify: `frontend/src/components/lesson/ScoreBars.tsx`

- [ ] **Step 1:** Wire up scoring engine to exercise flow: after sign captured, run all 3 scorers, compute overall = handshape×0.35 + movement×0.35 + orientation×0.30
- [ ] **Step 2:** Animate 3 bars with Framer Motion spring (0 → final, 600ms)
- [ ] **Step 3:** Color coding: >85 green #22C55E, 60-85 amber #F59E0B, <60 red #EF4444
- [ ] **Step 4:** Text labels alongside colors: "Good", "Needs Work", "Incorrect" for accessibility

---

### Task 6: Coaching Bubble UI

**Files:** Create: `frontend/src/components/lesson/CoachBubble.tsx`

- [ ] **Step 1:** Speech bubble component with fade-in animation (Framer Motion)
- [ ] **Step 2:** Fetch coaching message from `POST /api/feedback/generate` after scoring
- [ ] **Step 3:** Display message with coach avatar, handle loading state
- [ ] **Step 4:** Track last 3 messages in session for repetition avoidance (passed to API)

---

### Task 7: Ollama LLM Feedback Endpoint

**Files:**
- Create: `backend/services/llm_service.py`
- Create: `backend/schemas/feedback.py`
- Create: `backend/routers/feedback.py`

- [ ] **Step 1:** Create Pydantic request schema with all fields: targetSign, language, 3× score/error fields, attemptCount, previousBestScore, userId, sessionCoachMessages array
- [ ] **Step 2:** Implement system prompt per spec: sign language coach, physical feedback, second-person present tense, no scores/numbers, vary structure, address lowest score first
- [ ] **Step 3:** Build user message from request data (<300 tokens), include prior messages for repetition avoidance
- [ ] **Step 4:** Call Ollama via httpx POST to `http://ollama:11434/api/chat` with model from `LLM_MODEL_NAME` env var, stream=false, temperature=0.7, num_predict=150
- [ ] **Step 5:** Implement 8-second timeout with fallback template lookup table mapping error categories → pre-written coaching strings
- [ ] **Step 6:** Return `{ coachMessage, focusComponent, isPositive }`

**Key code — Ollama call:**
```python
async def generate_feedback(request: FeedbackRequest) -> FeedbackResponse:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_message(request)},
    ]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": settings.LLM_MODEL_NAME,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 150},
                },
            )
            content = resp.json()["message"]["content"]
    except (httpx.TimeoutException, Exception):
        content = get_fallback_message(request)
    return FeedbackResponse(coachMessage=content, ...)
```

---

## Self-Review

1. **Spec coverage:** ✅ All 3 scoring functions with exact algorithms, ✅ joint angle computation, ✅ palm normal via cross product, ✅ DTW with Sakoe-Chiba band=10, ✅ static vs dynamic sign handling, ✅ score thresholds and categories match spec, ✅ sign vocabulary JSON schema complete, ✅ Ollama integration with timeout+fallback, ✅ system prompt rules, ✅ LLM_MODEL_NAME env var, ✅ coaching bubble UI.
2. **Placeholder scan:** No TBD/TODO. All steps have concrete actions.
3. **Type consistency:** `HandLandmark` type from Phase 1B used consistently. Score thresholds (85/60) consistent between scoring functions and UI color coding.
