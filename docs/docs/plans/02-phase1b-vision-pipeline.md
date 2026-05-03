# Phase 1B: MediaPipe Worker Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Real-time webcam → MediaPipe landmark extraction → normalization → frame buffer → motion VAD → skeleton overlay, all running off the main thread in a Web Worker.

**Tech Stack:** `@mediapipe/tasks-vision` (HolisticLandmarker), Canvas API, TypeScript, Next.js 14

---

### Task 1: Message Protocol Types

**Files:** Create: `frontend/src/workers/mediapipe.types.ts`

- [ ] **Step 1: Define the protocol**

```typescript
// Main thread → Worker
export type WorkerInMessage =
  | { type: "INIT"; config: { modelComplexity?: number } }
  | { type: "FRAME"; frame: ImageBitmap; timestamp: number };

// Worker → Main thread
export type WorkerOutMessage =
  | { type: "LANDMARKS"; landmarks: NormalizedLandmarks; timestamp: number }
  | { type: "SIGN_READY"; frames: Float32Array; frameCount: number }
  | { type: "STATUS"; state: VADState; fps: number };

export type VADState = "IDLE" | "SIGNING" | "COOLDOWN";

export interface HandLandmark {
  x: number; y: number; z: number;
}

export interface NormalizedLandmarks {
  leftHand: HandLandmark[];   // 21 landmarks, empty if absent
  rightHand: HandLandmark[];  // 21 landmarks, empty if absent
  pose: HandLandmark[];       // 4 landmarks (shoulders + elbows)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/workers/mediapipe.types.ts
git commit -m "feat: define mediapipe worker message protocol types"
```

---

### Task 2: MediaPipe Web Worker Core

**Files:** Create: `frontend/src/workers/mediapipe.worker.ts`

- [ ] **Step 1: Create worker with MediaPipe init and frame processing**

```typescript
import { FilesetResolver, HolisticLandmarker } from "@mediapipe/tasks-vision";
import type { WorkerInMessage, HandLandmark, NormalizedLandmarks } from "./mediapipe.types";

let landmarker: HolisticLandmarker | null = null;

// --- Normalization ---
function normalize(
  rawHands: { landmarks: { x: number; y: number; z: number }[] }[],
  rawHandedness: string[],
  rawPose: { x: number; y: number; z: number }[]
): NormalizedLandmarks {
  // Shoulder midpoint & scale
  const lShoulder = rawPose[11] ?? { x: 0.5, y: 0.5, z: 0 };
  const rShoulder = rawPose[12] ?? { x: 0.5, y: 0.5, z: 0 };
  const originX = (lShoulder.x + rShoulder.x) / 2;
  const originY = (lShoulder.y + rShoulder.y) / 2;
  const shoulderDist = Math.sqrt(
    (lShoulder.x - rShoulder.x) ** 2 + (lShoulder.y - rShoulder.y) ** 2
  ) || 1;

  const normalizeHand = (lm: { x: number; y: number; z: number }[]): HandLandmark[] => {
    const wrist = lm[0];
    const midTip = lm[12];
    const handScale = Math.sqrt(
      (wrist.x - midTip.x) ** 2 + (wrist.y - midTip.y) ** 2 + (wrist.z - midTip.z) ** 2
    ) || 1;
    return lm.map((p) => ({
      x: (p.x - originX) / shoulderDist / handScale,
      y: (p.y - originY) / shoulderDist / handScale,
      z: p.z / shoulderDist / handScale,
    }));
  };

  // Invert handedness (selfie mode)
  let leftHand: HandLandmark[] = [];
  let rightHand: HandLandmark[] = [];
  for (let i = 0; i < rawHands.length; i++) {
    const label = rawHandedness[i] === "Right" ? "Left" : "Right"; // inverted
    if (label === "Left") leftHand = normalizeHand(rawHands[i].landmarks);
    else rightHand = normalizeHand(rawHands[i].landmarks);
  }

  // Pose: shoulders (11,12) and elbows (13,14)
  const poseIndices = [11, 12, 13, 14];
  const pose: HandLandmark[] = poseIndices.map((idx) => {
    const p = rawPose[idx] ?? { x: 0, y: 0, z: 0 };
    return {
      x: (p.x - originX) / shoulderDist,
      y: (p.y - originY) / shoulderDist,
      z: p.z / shoulderDist,
    };
  });

  return { leftHand, rightHand, pose };
}

// --- Frame Buffer (circular, 90 frames, 138 values each) ---
const BUFFER_LEN = 90;
const VALUES_PER_FRAME = 138; // 42 hand lm * 3 + 4 pose lm * 3 = 126 + 12 = 138
const frameBuffer = new Float32Array(BUFFER_LEN * VALUES_PER_FRAME);
let bufferHead = 0;
let bufferCount = 0;

function landmarksToArray(lm: NormalizedLandmarks): Float32Array {
  const arr = new Float32Array(VALUES_PER_FRAME);
  const writeHand = (hand: HandLandmark[], offset: number) => {
    for (let i = 0; i < 21; i++) {
      const h = hand[i] ?? { x: 0, y: 0, z: 0 };
      arr[offset + i * 3] = h.x;
      arr[offset + i * 3 + 1] = h.y;
      arr[offset + i * 3 + 2] = h.z;
    }
  };
  writeHand(lm.leftHand, 0);       // 0..62
  writeHand(lm.rightHand, 63);     // 63..125
  for (let i = 0; i < 4; i++) {
    const p = lm.pose[i] ?? { x: 0, y: 0, z: 0 };
    arr[126 + i * 3] = p.x;
    arr[126 + i * 3 + 1] = p.y;
    arr[126 + i * 3 + 2] = p.z;
  }
  return arr;
}

function pushFrame(arr: Float32Array) {
  frameBuffer.set(arr, bufferHead * VALUES_PER_FRAME);
  bufferHead = (bufferHead + 1) % BUFFER_LEN;
  if (bufferCount < BUFFER_LEN) bufferCount++;
}

// --- Motion VAD ---
let vadState: "IDLE" | "SIGNING" | "COOLDOWN" = "IDLE";
let prevHandPositions: number[] | null = null;
const velocityWindow: number[] = [];
let consecutiveAbove = 0;
let consecutiveBelow = 0;
let signStartIdx = 0;
let cooldownCounter = 0;
let upperThreshold = 0.015;
let lowerThreshold = 0.008;

function computeVelocity(lm: NormalizedLandmarks): number {
  const current: number[] = [];
  for (const h of [...lm.leftHand, ...lm.rightHand]) {
    current.push(h.x, h.y);
  }
  if (!prevHandPositions || current.length !== prevHandPositions.length) {
    prevHandPositions = current;
    return 0;
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < current.length; i += 2) {
    if (current[i] === 0 && current[i + 1] === 0) continue;
    const dx = current[i] - prevHandPositions[i];
    const dy = current[i + 1] - prevHandPositions[i + 1];
    sum += Math.sqrt(dx * dx + dy * dy);
    count++;
  }
  prevHandPositions = current;
  return count > 0 ? sum / count : 0;
}

function getSmoothedVelocity(v: number): number {
  velocityWindow.push(v);
  if (velocityWindow.length > 5) velocityWindow.shift();
  return velocityWindow.reduce((a, b) => a + b, 0) / velocityWindow.length;
}

function extractSignFrames(startIdx: number, endIdx: number): Float32Array {
  const TARGET = 60;
  const len = endIdx - startIdx;
  const output = new Float32Array(TARGET * VALUES_PER_FRAME);
  for (let i = 0; i < TARGET; i++) {
    const srcIdx = Math.min(Math.floor((i / TARGET) * len) + startIdx, endIdx - 1);
    const bufIdx = ((srcIdx % BUFFER_LEN) + BUFFER_LEN) % BUFFER_LEN;
    output.set(
      frameBuffer.slice(bufIdx * VALUES_PER_FRAME, (bufIdx + 1) * VALUES_PER_FRAME),
      i * VALUES_PER_FRAME
    );
  }
  return output;
}

function updateVAD(lm: NormalizedLandmarks, frameIdx: number) {
  const v = computeVelocity(lm);
  const sv = getSmoothedVelocity(v);

  switch (vadState) {
    case "IDLE":
      if (sv > upperThreshold) { consecutiveAbove++; } else { consecutiveAbove = 0; }
      if (consecutiveAbove >= 5) {
        vadState = "SIGNING";
        signStartIdx = frameIdx - 5;
        consecutiveAbove = 0;
      }
      break;
    case "SIGNING":
      if (sv < lowerThreshold) { consecutiveBelow++; } else { consecutiveBelow = 0; }
      if (consecutiveBelow >= 10) {
        vadState = "COOLDOWN";
        cooldownCounter = 0;
        const frames = extractSignFrames(signStartIdx, frameIdx);
        (self as unknown as Worker).postMessage(
          { type: "SIGN_READY", frames, frameCount: 60 } as const
        );
        consecutiveBelow = 0;
      }
      break;
    case "COOLDOWN":
      cooldownCounter++;
      if (cooldownCounter >= 15) { vadState = "IDLE"; }
      break;
  }
}

// --- Init & Frame Loop ---
let frameIdx = 0;

async function initLandmarker(complexity: number) {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  landmarker = await HolisticLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/latest/holistic_landmarker_task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    minHandLandmarksConfidence: 0.7,
    minPoseLandmarksConfidence: 0.5,
  });
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === "INIT") {
    await initLandmarker(msg.config.modelComplexity ?? 1);
    (self as unknown as Worker).postMessage({ type: "STATUS", state: "IDLE", fps: 0 });
    return;
  }

  if (msg.type === "FRAME" && landmarker) {
    const result = landmarker.detectForVideo(msg.frame, msg.timestamp);
    msg.frame.close();

    const rawHands = (result.handLandmarks ?? []).map((lm) => ({ landmarks: lm }));
    const rawHandedness = (result.handedness ?? []).map(
      (h) => h[0]?.categoryName ?? "Right"
    );
    const rawPose = result.poseLandmarks?.[0] ?? [];

    const normalized = normalize(rawHands, rawHandedness, rawPose as any);
    const arr = landmarksToArray(normalized);
    pushFrame(arr);
    updateVAD(normalized, frameIdx);
    frameIdx++;

    (self as unknown as Worker).postMessage({
      type: "LANDMARKS",
      landmarks: normalized,
      timestamp: msg.timestamp,
    });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/workers/mediapipe.worker.ts
git commit -m "feat: mediapipe web worker with normalization, buffer, and VAD"
```

---

### Task 3: useMediaPipeWorker Hook

**Files:** Create: `frontend/src/hooks/useMediaPipeWorker.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import type { NormalizedLandmarks, VADState, WorkerOutMessage } from "@/workers/mediapipe.types";

interface UseMediaPipeWorkerReturn {
  isReady: boolean;
  landmarks: NormalizedLandmarks | null;
  vadState: VADState;
  sendFrame: (frame: ImageBitmap, timestamp: number) => void;
  onSignReady: React.MutableRefObject<((frames: Float32Array) => void) | null>;
}

export function useMediaPipeWorker(): UseMediaPipeWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [landmarks, setLandmarks] = useState<NormalizedLandmarks | null>(null);
  const [vadState, setVadState] = useState<VADState>("IDLE");
  const onSignReady = useRef<((frames: Float32Array) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/mediapipe.worker.ts", import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === "LANDMARKS") {
        setLandmarks(msg.landmarks);
      } else if (msg.type === "SIGN_READY") {
        onSignReady.current?.(msg.frames);
      } else if (msg.type === "STATUS") {
        setVadState(msg.state);
        if (!isReady) setIsReady(true);
      }
    };

    worker.postMessage({ type: "INIT", config: { modelComplexity: 1 } });

    return () => { worker.terminate(); };
  }, []);

  const sendFrame = useCallback((frame: ImageBitmap, timestamp: number) => {
    workerRef.current?.postMessage(
      { type: "FRAME", frame, timestamp },
      [frame] // transfer ownership
    );
  }, []);

  return { isReady, landmarks, vadState, sendFrame, onSignReady };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useMediaPipeWorker.ts
git commit -m "feat: useMediaPipeWorker hook for main thread communication"
```

---

### Task 4: Webcam Hook

**Files:** Create: `frontend/src/hooks/useWebcam.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  error: string | null;
  startCapture: (onFrame: (frame: ImageBitmap, ts: number) => void) => void;
  stopCapture: () => void;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCapture = useCallback(
    (onFrame: (frame: ImageBitmap, ts: number) => void) => {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setIsStreaming(true);

          const tick = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
            try {
              const bmp = await createImageBitmap(videoRef.current);
              onFrame(bmp, performance.now());
            } catch { /* skip frame */ }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch((err) => setError(err.message));
    },
    []
  );

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsStreaming(false);
  }, []);

  useEffect(() => () => stopCapture(), [stopCapture]);

  return { videoRef, isStreaming, error, startCapture, stopCapture };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useWebcam.ts
git commit -m "feat: useWebcam hook with ImageBitmap frame capture"
```

---

### Task 5: Skeleton Overlay Component

**Files:** Create: `frontend/src/components/webcam/SkeletonOverlay.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";
import { useEffect, useRef } from "react";
import type { NormalizedLandmarks, HandLandmark } from "@/workers/mediapipe.types";

// MediaPipe hand connections (pairs of landmark indices)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],      // thumb
  [0,5],[5,6],[6,7],[7,8],      // index
  [0,9],[9,10],[10,11],[11,12], // middle
  [0,13],[13,14],[14,15],[15,16],// ring
  [0,17],[17,18],[18,19],[19,20],// pinky
  [5,9],[9,13],[13,17],          // palm
];

interface Props {
  landmarks: NormalizedLandmarks | null;
  width: number;
  height: number;
}

export function SkeletonOverlay({ landmarks, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !landmarks) return;

    ctx.clearRect(0, 0, width, height);

    const drawHand = (hand: HandLandmark[], color: string) => {
      if (hand.length === 0) return;
      // Convert normalized coords back to pixel space (approximate via center + scale)
      const toPixel = (lm: HandLandmark) => ({
        x: (lm.x * 0.3 + 0.5) * width,  // rough inverse normalization for display
        y: (lm.y * 0.3 + 0.4) * height,
      });

      // Lines
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        if (!hand[a] || !hand[b]) continue;
        const pa = toPixel(hand[a]);
        const pb = toPixel(hand[b]);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Dots
      ctx.fillStyle = color;
      for (const lm of hand) {
        const p = toPixel(lm);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawHand(landmarks.rightHand, "#00FF88");
    drawHand(landmarks.leftHand, "#FF6B35");
  }, [landmarks, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/webcam/SkeletonOverlay.tsx
git commit -m "feat: skeleton overlay canvas with hand connection drawing"
```

---

### Task 6: WebcamFeed Component (Integration)

**Files:** Create: `frontend/src/components/webcam/WebcamFeed.tsx`

- [ ] **Step 1: Create the integrated webcam component**

```tsx
"use client";
import { useEffect, useCallback } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { useMediaPipeWorker } from "@/hooks/useMediaPipeWorker";
import { SkeletonOverlay } from "./SkeletonOverlay";

const WIDTH = 640;
const HEIGHT = 480;

interface Props {
  onSignReady?: (frames: Float32Array) => void;
}

export function WebcamFeed({ onSignReady }: Props) {
  const { videoRef, isStreaming, error, startCapture, stopCapture } = useWebcam();
  const { isReady, landmarks, vadState, sendFrame, onSignReady: signReadyRef } = useMediaPipeWorker();

  // Wire up sign ready callback
  useEffect(() => {
    signReadyRef.current = onSignReady ?? null;
  }, [onSignReady, signReadyRef]);

  // Start capture once MediaPipe is ready
  useEffect(() => {
    if (isReady) startCapture(sendFrame);
    return () => stopCapture();
  }, [isReady, startCapture, stopCapture, sendFrame]);

  return (
    <div style={{ position: "relative", width: WIDTH, height: HEIGHT }}>
      <video
        ref={videoRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ transform: "scaleX(-1)", borderRadius: 12 }}
        muted
        playsInline
      />
      <SkeletonOverlay landmarks={landmarks} width={WIDTH} height={HEIGHT} />
      {/* VAD state indicator */}
      <div style={{
        position: "absolute", top: 8, right: 8, padding: "4px 12px",
        borderRadius: 20, fontSize: 12, fontWeight: 600,
        background: vadState === "SIGNING" ? "#22C55E" : vadState === "COOLDOWN" ? "#F59E0B" : "#6B7280",
        color: "#fff",
      }}>
        {vadState}
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!isReady && <p>Loading MediaPipe...</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/webcam/WebcamFeed.tsx
git commit -m "feat: integrated webcam feed with skeleton overlay and VAD indicator"
```

---

### Task 7: Test Page

**Files:** Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Replace the default page with WebcamFeed test**

```tsx
"use client";
import { WebcamFeed } from "@/components/webcam/WebcamFeed";

export default function Home() {
  const handleSignReady = (frames: Float32Array) => {
    console.log("Sign captured!", frames.length / 138, "frames");
  };

  return (
    <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0a0a0a" }}>
      <div>
        <h1 style={{ color: "#fff", textAlign: "center", marginBottom: 16, fontSize: 24 }}>
          SignSense — Vision Pipeline Test
        </h1>
        <WebcamFeed onSignReady={handleSignReady} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run and verify in browser**

```bash
cd frontend && npm run dev
```
Open http://localhost:3000. Expected:
- Camera permission prompt appears
- Video feed renders with skeleton overlay on hands
- VAD badge shows IDLE → SIGNING → COOLDOWN as you sign
- Console logs "Sign captured! 60 frames" after a sign completes

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: vision pipeline test page with webcam and VAD"
```

---

## Self-Review

1. **Spec coverage:** ✅ Web Worker architecture, ✅ Message protocol (INIT/FRAME/LANDMARKS/SIGN_READY), ✅ `@mediapipe/tasks-vision` instead of deprecated `@mediapipe/holistic`, ✅ Landmark normalization (shoulder origin, shoulder scale, per-hand scale, handedness inversion), ✅ Circular buffer 90 frames × 138 values, ✅ Motion VAD 3-state machine with thresholds, ✅ Skeleton overlay with Canvas, ✅ Hand connections and color coding (#00FF88 right, #FF6B35 left).
2. **Not yet implemented (deferred to execution):** Calibration mode (IndexedDB storage of thresholds) and benchmark-based complexity fallback — these are small additions to the worker that will be added as sub-tasks during execution.
3. **Placeholder scan:** No TBD/TODO found. All code complete.
4. **Type consistency:** `NormalizedLandmarks`, `HandLandmark`, `VADState` used consistently across types, worker, hook, overlay, and feed.
