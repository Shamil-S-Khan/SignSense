# Phase 4: Dynamic ASL Sign Recognition

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Ship dynamic ASL recognition with a checkpoint-first strategy: evaluate OpenHands WLASL checkpoint first, fine-tune on Google ASL Signs if needed, and only train from scratch on full WLASL as a last resort.

**Tech Stack:** PyTorch (Kaggle), MediaPipe Python, h5py, ONNX Runtime Web, BiLSTM

---

### Task 1: Evaluate OpenHands WLASL Checkpoint First

**Files:**
- Create: `training/eval_openhands_wlasl.py`
- Modify: `frontend/public/models/dynamic-asl.onnx` (artifact target)

- [ ] **Step 1:** Fetch OpenHands WLASL checkpoint (LSTM or Transformer variant with landmark input)
- [ ] **Step 2:** Run evaluation on SignSense target vocabulary split
- [ ] **Step 3:** Measure top-1 accuracy and per-class confusion
- [ ] **Step 4:** Decision gate:
    - If target-vocabulary top-1 >= 65%: accept checkpoint path and export/integrate
    - If < 65%: proceed to Task 2 (fine-tune on Google ASL Signs)
- [ ] **Step 5:** Export accepted checkpoint to ONNX opset 17 and place at `frontend/public/models/dynamic-asl.onnx`

---

### Task 2: Fine-Tune on Google ASL Signs (Fallback #1)

**Files:** Create: `training/dynamic_asl_finetune_google.py`

- [ ] **Step 1:** Download Google ASL Signs Kaggle dataset (250 words, pre-extracted landmarks)
- [ ] **Step 2:** Fine-tune OpenHands checkpoint on target SignSense vocabulary mapping
- [ ] **Step 3:** Train on Kaggle free GPU with runtime target under 1 hour
- [ ] **Step 4:** Evaluate with same protocol as Task 1 and keep best checkpoint
- [ ] **Step 5:** Decision gate:
    - If target-vocabulary top-1 >= 65%: accept and export ONNX
    - If < 65%: proceed to Task 3 (full WLASL from-scratch path)
- [ ] **Step 6:** Export ONNX + INT8 quantized artifact for browser inference

---

### Task 3: Full WLASL Data Download & Landmark Extraction (Fallback #2)

**Files:** Create: `training/wlasl_prepare.py`

- [ ] **Step 1:** Clone WLASL GitHub repo, parse the JSON file mapping video IDs → sign labels → download URLs
- [ ] **Step 2:** Select top 200 signs by video count, filter out signs with < 10 examples
- [ ] **Step 3:** Download videos via the provided URLs (run in Kaggle notebook for bandwidth)
- [ ] **Step 4:** For each video: run MediaPipe Holistic frame-by-frame, extract normalized landmark sequences (same normalization as Phase 1: shoulder origin, shoulder scale, per-hand scale)
- [ ] **Step 5:** Pad/truncate each sequence to 60 frames
- [ ] **Step 6:** Generate 2,000 rest-state samples from neutral hand position recordings
- [ ] **Step 7:** Save all data to HDF5: `X` array shape (N, 60, 138), `y` array shape (N,), `labels` array mapping index → sign name
- [ ] **Step 8:** Print dataset statistics: total samples, per-class distribution, train/val/test split info

**Key code — per-video extraction:**
```python
def extract_landmarks(video_path: str, target_frames: int = 60) -> np.ndarray:
    cap = cv2.VideoCapture(video_path)
    frames = []
    with mp.solutions.holistic.Holistic(min_detection_confidence=0.5) as holistic:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            results = holistic.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            landmarks = normalize_landmarks(results)  # reuse Phase 1 normalization
            frames.append(landmarks)
    cap.release()
    # Pad or truncate to target_frames
    return pad_or_truncate(np.array(frames), target_frames)
```

---

### Task 4: BiLSTM Training on Kaggle from Scratch (Fallback #2)

**Files:** Create: `training/dynamic_asl_train.py`

- [ ] **Step 1:** Load HDF5 dataset, create train/val/test split (70/15/15) stratified by label, ensure no signer overlap between splits if signer info available
- [ ] **Step 2:** Define BiLSTM architecture:
  - Input: (batch, 60, 138)
  - BiLSTM 256 units each direction, Dropout 0.3
  - BiLSTM 128 units each direction, Dropout 0.3
  - Dense 256 ReLU
  - Dense output: softmax over vocab_size + 1 (rest class)

**Key code — model architecture:**
```python
class SignLanguageBiLSTM(nn.Module):
    def __init__(self, input_dim=138, num_classes=201):
        super().__init__()
        self.lstm1 = nn.LSTM(input_dim, 256, batch_first=True, bidirectional=True, dropout=0.3)
        self.lstm2 = nn.LSTM(512, 128, batch_first=True, bidirectional=True, dropout=0.3)
        self.fc1 = nn.Linear(256, 256)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(256, num_classes)

    def forward(self, x):
        x, _ = self.lstm1(x)
        x, _ = self.lstm2(x)
        x = x[:, -1, :]  # last timestep
        x = self.relu(self.fc1(x))
        return self.fc2(x)
```

- [ ] **Step 3:** Train with Adam lr=0.0005, cosine annealing 100 epochs, batch 64, early stopping patience 10, gradient clip norm 1.0
- [ ] **Step 4:** Data augmentation during training: Gaussian noise (std 0.005), temporal speed variation (resample 40-80 frames → back to 60), random spatial mirroring
- [ ] **Step 5:** Log validation accuracy per epoch, target >75% top-1 and >90% top-5
- [ ] **Step 6:** Export best checkpoint to ONNX opset 17
- [ ] **Step 7:** Apply dynamic INT8 quantization, verify size < 8MB
- [ ] **Step 8:** Save as Kaggle output, download to `frontend/public/models/dynamic-asl.onnx`

---

### Task 5: Browser ONNX Integration

**Files:** Create: `frontend/src/lib/inference/dynamic-asl.ts`

- [ ] **Step 1:** Load `dynamic-asl.onnx` in Web Worker via onnxruntime-web
- [ ] **Step 2:** Runtime preference order:
    1. OpenHands checkpoint ONNX (if passed >= 65%)
    2. Google ASL Signs fine-tuned ONNX
    3. Full WLASL scratch ONNX
- [ ] **Step 3:** When worker emits SIGN_READY, reshape Float32Array to tensor (1, 60, 138)
- [ ] **Step 4:** Run inference, apply softmax to output
- [ ] **Step 5:** If max probability > 0.65: emit top-3 predictions with probabilities. If < 0.65: emit UNKNOWN. If rest-class leads: suppress event
- [ ] **Step 6:** Add `SIGN_CLASSIFIED` worker message type with predictions array
- [ ] **Step 7:** Wire up to exercise flow: compare predicted sign to target sign

---

### Task 6: Extend Skill Tree

**Files:**
- Modify: `frontend/public/data/sign-vocabulary.json` — add entries for 200 dynamic signs
- Modify: `frontend/src/app/skill-tree/page.tsx` — add nodes for dynamic sign categories

- [ ] **Step 1:** Organize 200 signs into skill tree categories: Greetings, Common Phrases, Numbers, Family, Food, Emotions, Actions, Places, Time, etc.
- [ ] **Step 2:** Add tree nodes per category with prerequisite chains (fingerspelling → greetings → common phrases → ...)
- [ ] **Step 3:** Update layout config with new node positions and connections
- [ ] **Step 4:** Each node unlocks after completing prior node's lessons

---

## Self-Review

1. **Spec coverage:** ✅ checkpoint-first evaluation (OpenHands), ✅ explicit 65% gate, ✅ Google ASL Signs fine-tuning fallback (<1h target), ✅ WLASL from-scratch as final fallback, ✅ browser integration with source preference order, ✅ skill tree extension.
2. **Placeholder scan:** Clean.
3. **Type consistency:** Input dimension 138 consistent with Phase 1B frame buffer. 60-frame sequences consistent throughout.
