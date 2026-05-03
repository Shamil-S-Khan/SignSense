# Phase 5: PSL Data Collection & Training

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Build admin interfaces for collecting and reviewing Pakistani Sign Language data from contributors, implement data augmentation, train a PSL BiLSTM model, and add the PSL skill tree track.

**Tech Stack:** Next.js (admin pages), FastAPI (submission endpoints), PyTorch (Kaggle), MediaPipe, NumPy

---

### Task 1: PSL Submission Database Model

**Files:**
- Create: `backend/models/psl_submission.py`
- Modify: `backend/models/__init__.py`

- [ ] **Step 1:** Define `psl_submissions` table: id (UUID), sign_label (string), landmark_data (LargeBinary — 60×138 float32 blob), contributor_id (FK to users), timestamp, region (enum: LAHORE, KARACHI, ISLAMABAD, PESHAWAR, OTHER), experience_level (enum: NATIVE, FLUENT, INTERMEDIATE, BEGINNER), status (enum: PENDING_REVIEW, APPROVED, REJECTED), reviewer_id (FK nullable), reviewed_at (nullable)
- [ ] **Step 2:** Generate and run Alembic migration
- [ ] **Step 3:** Create Pydantic schemas for submission create/response

---

### Task 2: PSL Collection Interface

**Files:**
- Create: `frontend/src/app/admin/collect-psl/page.tsx`

- [ ] **Step 1:** Role gate: check user account_type is DATA_CONTRIBUTOR or ADMIN, redirect unauthorized users
- [ ] **Step 2:** Display target sign: English name, Urdu name (in Nastaliq font), description of correct form, reference image if available
- [ ] **Step 3:** 3-second animated countdown (Framer Motion) before recording starts
- [ ] **Step 4:** Open webcam with skeleton overlay (reuse WebcamFeed component), record for 5 seconds
- [ ] **Step 5:** After recording: show skeleton-only playback (render saved landmark frames on canvas, no raw video)
- [ ] **Step 6:** Accept / Reject buttons: on accept, serialize 60-frame landmark array to binary, POST to `/api/admin/psl-submissions` with metadata (region, experience level from user profile)
- [ ] **Step 7:** Queue of target signs: cycle through PSL vocabulary list, skip already-submitted signs

---

### Task 3: PSL Review Interface

**Files:**
- Create: `frontend/src/app/admin/review-psl/page.tsx`

- [ ] **Step 1:** Role gate: ADMIN only
- [ ] **Step 2:** Paginated list of PENDING_REVIEW submissions with filters (sign label, region, contributor)
- [ ] **Step 3:** For each submission: show skeleton-only playback, sign label, contributor info, region, experience level
- [ ] **Step 4:** Approve / Reject buttons: POST to `/api/admin/psl-submissions/{id}/approve` or `reject`
- [ ] **Step 5:** Bulk actions: select multiple, approve/reject all

---

### Task 4: Admin API Endpoints

**Files:**
- Create: `backend/routers/admin.py`
- Create: `backend/schemas/admin.py`

- [ ] **Step 1:** `POST /api/admin/psl-submissions` — create submission (data_contributor role required)
- [ ] **Step 2:** `GET /api/admin/psl-submissions` — list submissions with filters and pagination (admin role)
- [ ] **Step 3:** `POST /api/admin/psl-submissions/{id}/approve` — set status APPROVED, record reviewer (admin role)
- [ ] **Step 4:** `POST /api/admin/psl-submissions/{id}/reject` — set status REJECTED (admin role)
- [ ] **Step 5:** Register router in main.py

---

### Task 5: Data Augmentation Pipeline

**Files:** Create: `training/psl_augmentation.py`

- [ ] **Step 1:** Implement rotation augmentation: ±15° rotation matrix applied to all x,y coords (4 variants per sample)
- [ ] **Step 2:** Implement scale augmentation: ±15% uniform scaling (2 variants)
- [ ] **Step 3:** Implement speed variation: resample to 40-80 frames via linear interpolation then back to 60 (3 variants)
- [ ] **Step 4:** Implement Gaussian noise: add noise with std 0.005 to all landmark values (2 variants)
- [ ] **Step 5:** Implement combined augmentation: rotation + noise + speed (2 variants)
- [ ] **Step 6:** Total effective multiplier: ~14× per approved sample

**Key code — rotation augment:**
```python
def augment_rotation(sequence: np.ndarray, angle_deg: float) -> np.ndarray:
    theta = np.radians(angle_deg)
    cos_t, sin_t = np.cos(theta), np.sin(theta)
    result = sequence.copy()
    for i in range(0, sequence.shape[1], 3):  # every x,y,z triplet
        x, y = result[:, i], result[:, i+1]
        result[:, i] = x * cos_t - y * sin_t
        result[:, i+1] = x * sin_t + y * cos_t
    return result
```

---

### Task 6: PSL Model Training on Kaggle

**Files:** Create: `training/psl_train.py`

- [ ] **Step 1:** Export approved PSL submissions from PostgreSQL to HDF5 (run export script locally, upload HDF5 to Kaggle)
- [ ] **Step 2:** Apply augmentation pipeline to expand dataset ~14×
- [ ] **Step 3:** Same BiLSTM architecture as Phase 4 (random init, NOT transfer learning from ASL model)
- [ ] **Step 4:** Same training pipeline: Adam, cosine annealing, early stopping
- [ ] **Step 5:** Validation: hold out entire signers (not random frames) to test generalization
- [ ] **Step 6:** Target: 65-75% top-1 accuracy on held-out test signers
- [ ] **Step 7:** Export to ONNX, INT8 quantize, download to `frontend/public/models/dynamic-psl.onnx`

---

### Task 7: PSL Skill Tree Track

**Files:**
- Modify: `frontend/public/data/sign-vocabulary.json` — add PSL sign entries with language: "PSL"
- Modify: `frontend/src/app/skill-tree/page.tsx` — add language toggle ASL/PSL

- [ ] **Step 1:** Add PSL signs to vocabulary JSON with canonical data (populated from approved high-quality submissions)
- [ ] **Step 2:** Add language toggle at top of skill tree page (ASL | PSL tabs)
- [ ] **Step 3:** Define PSL skill tree layout: separate node graph for PSL track
- [ ] **Step 4:** Load PSL ONNX model in worker when PSL track selected
- [ ] **Step 5:** Update `GET /api/skill-tree/psl` endpoint to return PSL tree data

---

## Self-Review

1. **Spec coverage:** ✅ Collection page at /admin/collect-psl with countdown, skeleton playback, accept/reject, ✅ Review page at /admin/review-psl with approve/reject, ✅ All submission metadata (region, experience, status), ✅ All 5 augmentation types with correct parameters, ✅ ~14× multiplier, ✅ Same BiLSTM arch as Phase 4, ✅ Held-out signer validation, ✅ PSL skill tree track.
2. **Placeholder scan:** Clean.
3. **Type consistency:** Landmark blob format (60×138 float32) consistent with Phase 1B buffer.
