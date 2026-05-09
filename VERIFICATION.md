# WLASL Pipeline Verification

This file documents the outcome of the 7-check verification suite that follows the
preprocessing bug-fix pass. Fill in each check as you test.

---

## Pre-conditions

Before running any check:
- Frontend dev server running: `npm --prefix "c:\22i-2451\SignSense\frontend" run dev`
- Backend Uvicorn running: see restart instructions below
- Browser DevTools console open
- Good lighting; shoulders and both hands visible

---

## Backend Restart (after config change)

```powershell
$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
& "C:/Users/HP/AppData/Local/Programs/Python/Python311/python.exe" -m uvicorn `
  --app-dir "c:/22i-2451/SignSense/backend" main:app --host 0.0.0.0 --port 8000
```

---

## Check 1 — Mirror Sanity Log

**Purpose:** Confirm which hand-label convention is active and whether a left/right slot swap is needed.

**Method:**
1. Open browser DevTools console, navigate to `localhost:3000/recognize`.
2. Confirm the following `console.warn` appears on first frame:
   > `[SignSense] Mirror path: the raw video stream fed to MediaPipe is NOT mirrored ...`
3. Raise only your **physical RIGHT hand**. Observe which value becomes non-zero in MediaPipe output (add a temporary `console.log(result.rightHandLandmarks)` in `useHolisticSignCapture` if needed).
4. Record which slot activates.

**Result:**
- [ ] `console.warn` appeared
- [ ] Physical RIGHT hand → `rightHandLandmarks` non-zero → **no swap needed (correct)**
- [ ] Physical RIGHT hand → `leftHandLandmarks` non-zero → **swap needed** (add left/right swap in `extract.ts`)

**Notes:**
```
(fill in)
```

---

## Check 2 — Feature Shape Check

**Purpose:** Confirm the flat landmark array is exactly 225 values and that pose/hand slots are correctly populated.

**Method:**
1. Navigate to `localhost:3000/recognize`, let MediaPipe initialize.
2. Look for the one-shot log in DevTools console:
   > `[SignSense][Check2] landmarks.length = 225 | pose[0..2]: [...] | leftHand[0..2]: [...] | rightHand[0..2]: [...]`
3. Confirm length = 225.
4. Raise/lower hands to verify leftHand/rightHand values change.

**Result:**
- [ ] `landmarks.length = 225` confirmed
- [ ] Pose values non-zero when person visible
- [ ] Left/right hand values change when hands shown/hidden

**Notes:**
```
(fill in)
```

---

## Check 3 — Z-Coordinate Handling

**Purpose:** Confirm z is dropped before the Siformer forward pass (model was trained on 2D only).

**Method:**
1. Start recognition and press Done after signing any word.
2. Check backend terminal/log for:
   > `[Check3] Tensor shapes before Siformer forward pass: left_hand=(1, 204, 21, 2) right_hand=(1, 204, 21, 2) body=(1, 204, 12, 2) (coord dim = 2, z is DROPPED (correct))`

**Result:**
- [ ] Coord dim = 2 confirmed (z dropped correctly)
- [ ] If coord dim = 3, normalization is applying z incorrectly — investigate `_preprocess()`

**Notes:**
```
(fill in)
```

---

## Check 4 — Frame Rate

**Purpose:** Confirm send rate is ~25fps (training data was 25fps).

**Method:**
1. Sign a word for approximately 2 seconds, then press Done.
2. Check backend log for:
   > `[Check4] predict received: N frames buffered`
3. For a 2-second clip: ~50 frames expected (25fps × 2s). A value of ~30 means 15fps rate fix did not apply.

**Result:**
- [ ] 2-second clip → ~48–60 frames (25–30fps confirmed)
- [ ] OR: ~28–32 frames → frontend change not picked up; hard-refresh or rebuild

**Observed frame count:**
```
(fill in)
```

---

## Check 5 — Controlled Sign Accuracy Test

**Purpose:** Primary accuracy check with threshold at 0.10.

> **Note:** HELLO and WATER are not in the WLASL100 vocabulary.
> Use: **BOOK, DRINK, HELP, DOCTOR, EAT**

**Method:** For each word, sign slowly and deliberately in good lighting. Record top-3 and confidence scores.

| Sign | Top-1 (label, conf) | Top-2 (label, conf) | Top-3 (label, conf) | Correct in top-3? |
|------|---------------------|---------------------|---------------------|-------------------|
| BOOK | | | | |
| DRINK | | | | |
| HELP | | | | |
| DOCTOR | | | | |
| EAT | | | | |

**Interpretation:**
- Correct at rank 1 consistently → fix confirmed successful for that sign
- Correct at rank 2–3, low confidence → working but may need threshold review
- Not in top-3 at all → still a preprocessing mismatch somewhere

---

## Check 6 — Trim Padding Visual Check

**Purpose:** Confirm padding adds frames on both sides of the detected active window.

**Method:**
1. Sign a word with a clear preparation phase (raise hand, pause 0.5s, then sign).
2. Check backend log for:
   > `original_frames=N trimmed_frames=M ...`
3. Confirm M > 0. If M = 5 or fewer, the trim threshold is too aggressive; increase `SIGN_RECOGNITION_TRIM_PADDING_FRAMES` to 15.

**Result:**
- [ ] Trimmed frames > 10 for a normal 1-word clip
- [ ] Padding visibly adds frames on both sides (original >> trimmed by a reasonable margin)

**Observed counts:**
```
original_frames = (fill in)
trimmed_frames  = (fill in)
```

---

## Check 7 — Regression: Motion Gate Still Works

**Purpose:** Ensure the motion rejection gate still fires after the threshold was lowered.

**Method:**
1. Sit still in front of camera without signing for 3 seconds.
2. Press Done.
3. Confirm response is: `"Recognition rejected: not enough signing motion."`
4. Confirm it is NOT a spurious prediction.

**Result:**
- [ ] Motion rejection still fires correctly
- [ ] No spurious prediction returned

---

## Cleanup Checklist

After all checks pass:

- [ ] Remove `console.log` in `extract.ts` (the `[Check2]` block, guarded by `_shapLogFired`)
- [ ] Remove `logger.info("[Check3] ...")` block in `pipeline.py`
- [ ] Remove `logger.info("[Check4] ...")` line in `routers/sign_recognition.py`
- [ ] Set final `SIGN_RECOGNITION_CONFIDENCE_THRESHOLD`:
  - 0.20 if correct gloss consistently appears at ≥ 0.25
  - 0.12 if correct gloss consistently appears at ≥ 0.15
- [ ] Set `SIGN_RECOGNITION_IMPUTATION_STRATEGY` to whichever performed better
- [ ] If Check 1 reveals swap needed: add left/right swap in `extract.ts` → `flattenHolisticFrame`

---

## Fixes Applied

| Fix | Change | File(s) |
|-----|--------|---------|
| Within-hand point ordering (NEW — highest priority) | `HAND_POINT_REORDER` applied via `writeLandmarks` | `extract.ts` |
| Fix 1 — Mirror sanity | `console.warn` added; no code swap yet (pending Check 1) | `extract.ts` |
| Fix 2 — Group ordering | **No-op confirmed.** Backend splits 225-vector into 3 tensors; order irrelevant. | — |
| Fix 3 — Z coordinates | **No-op confirmed.** Training is 2D; pipeline already drops z via `[:,:,:2]`. | — |
| Fix 4 — Frame rate | `SEND_INTERVAL_MS = 1000 / 25` (was 15fps) | `page.tsx` |
| Fix 5 — Trim padding | Config-driven 10-frame pad (was dynamic 3–8) | `config.py`, `trimming.py` |
| Fix 6 — Imputation strategy | Zero-fill default; spline available via config | `config.py`, `imputation.py` |
| Fix 7 — Pose mapping | Inline comments added; indices were correct | `constants.py` |
| Fix 8 — Confidence threshold | Diagnostic 0.10 (was 0.35) | `config.py` |
