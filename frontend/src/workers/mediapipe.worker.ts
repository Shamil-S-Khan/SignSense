import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { WorkerInMessage, HandLandmark, NormalizedLandmarks } from "./mediapipe.types";

// Sign recognition now runs on the GPU backend via WebSocket.
// This worker focuses on: Hand + Pose landmark extraction → Normalization → VAD.

let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;

// --- Normalization ---
function normalize(
  rawHands: { x: number; y: number; z: number }[][],
  rawHandedness: string[],
  rawPose: { x: number; y: number; z: number }[]
): NormalizedLandmarks {
  // Hand landmarks: MediaPipe [0,1] normalized coordinates.
  // We keep them as-is for the backend models.
  
  const normalizeHand = (lm: { x: number; y: number; z: number }[]): HandLandmark[] => {
    return lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  };

  let leftHand: HandLandmark[] = [];
  let rightHand: HandLandmark[] = [];
  for (let i = 0; i < rawHands.length; i++) {
    const label = rawHandedness[i] === "Right" ? "Left" : "Right";
    if (label === "Left") leftHand = normalizeHand(rawHands[i]);
    else rightHand = normalizeHand(rawHands[i]);
  }

  const pose: HandLandmark[] = rawPose.map(p => ({ x: p.x, y: p.y, z: p.z }));

  return { leftHand, rightHand, pose };
}

// --- Frame Buffer (circular) ---
const BUFFER_LEN = 90;
// 33 pose + 21 left + 21 right = 75 points. 75 * 3 = 225 floats.
const VALUES_PER_FRAME = 225; 
const frameBuffer = new Float32Array(BUFFER_LEN * VALUES_PER_FRAME);
let bufferHead = 0;
let bufferCount = 0;

function landmarksToArray(lm: NormalizedLandmarks): Float32Array {
  const arr = new Float32Array(VALUES_PER_FRAME);
  
  // Order: Left Hand (21), Right Hand (21), Pose (33)
  // This matches what the backend expects for fingerspelling (first 63 floats = one hand)
  // Wait, if the user signs with Right Hand, it should be in the first 63.
  // MediaPipe "Right" hand (user's left) or "Left" hand (user's right).
  
  // We'll prioritize the "Active" hand for fingerspelling.
  // But for Pose-TGCN, we need everything.
  
  const writePoints = (points: HandLandmark[], offset: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const p = points[i] ?? { x: 0, y: 0, z: 0 };
      arr[offset + i * 3] = p.x;
      arr[offset + i * 3 + 1] = p.y;
      arr[offset + i * 3 + 2] = p.z;
    }
  };

  // The backend predict_fingerspelling takes first 63.
  // We'll put the Right hand (user's dominant usually) or whichever is present.
  const mainHand = lm.rightHand.length > 0 ? lm.rightHand : lm.leftHand;
  writePoints(mainHand, 0, 21);          // 0..62 (Main hand for fingerspelling)
  writePoints(lm.leftHand, 63, 21);       // 63..125
  writePoints(lm.rightHand, 126, 21);     // 126..188
  writePoints(lm.pose, 189, 33);          // 189..287 -- wait, size is 225.
  // 75 points * 3 = 225. 
  // 21 + 21 + 33 = 75. 
  // 0..62 (21), 63..125 (21), 126..224 (33).
  // Let's use:
  // 0..62: Dominant Hand (for fingerspelling)
  // 63..125: Left Hand
  // 126..188: Right Hand
  // 189..287: Pose (33 points) -> 33 * 3 = 99. 189 + 99 = 288.
  // So VALUES_PER_FRAME should be 288.
  
  return arr;
}
// Adjusted below...

const VALUES_PER_FRAME_UPDATED = 288;
const frameBufferUpdated = new Float32Array(BUFFER_LEN * VALUES_PER_FRAME_UPDATED);

function landmarksToArrayUpdated(lm: NormalizedLandmarks): Float32Array {
  const arr = new Float32Array(VALUES_PER_FRAME_UPDATED);
  const writePoints = (points: HandLandmark[], offset: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const p = points[i] ?? { x: 0, y: 0, z: 0 };
      arr[offset + i * 3] = p.x;
      arr[offset + i * 3 + 1] = p.y;
      arr[offset + i * 3 + 2] = p.z;
    }
  };
  const mainHand = lm.rightHand.length > 0 ? lm.rightHand : lm.leftHand;
  writePoints(mainHand, 0, 21);      // 0..62
  writePoints(lm.leftHand, 63, 21);   // 63..125
  writePoints(lm.rightHand, 126, 21); // 126..188
  writePoints(lm.pose, 189, 33);      // 189..287
  return arr;
}

function pushFrame(arr: Float32Array) {
  frameBufferUpdated.set(arr, bufferHead * VALUES_PER_FRAME_UPDATED);
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
  const output = new Float32Array(TARGET * VALUES_PER_FRAME_UPDATED);
  for (let i = 0; i < TARGET; i++) {
    const srcIdx = Math.min(Math.floor((i / TARGET) * len) + startIdx, endIdx - 1);
    const bufIdx = ((srcIdx % BUFFER_LEN) + BUFFER_LEN) % BUFFER_LEN;
    output.set(
      frameBufferUpdated.slice(bufIdx * VALUES_PER_FRAME_UPDATED, (bufIdx + 1) * VALUES_PER_FRAME_UPDATED),
      i * VALUES_PER_FRAME_UPDATED
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
        (self as unknown as Worker).postMessage({ type: "STATUS", state: "SIGNING", fps: 0 });
      }
      break;
    case "SIGNING":
      if (sv < lowerThreshold) { consecutiveBelow++; } else { consecutiveBelow = 0; }
      if (consecutiveBelow >= 10) {
        vadState = "COOLDOWN";
        cooldownCounter = 0;
        const frames = extractSignFrames(signStartIdx, frameIdx);
        (self as unknown as Worker).postMessage({ type: "SIGN_READY", frames, frameCount: 60 });
        (self as unknown as Worker).postMessage({ type: "STATUS", state: "COOLDOWN", fps: 0 });
        consecutiveBelow = 0;
      }
      break;
    case "COOLDOWN":
      cooldownCounter++;
      if (cooldownCounter >= 15) {
        vadState = "IDLE";
        (self as unknown as Worker).postMessage({ type: "STATUS", state: "IDLE", fps: 0 });
      }
      break;
  }
}

// --- Config ---
let poseEnabled = true;

// --- Init & Frame Loop ---
let frameIdx = 0;

async function initLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.3,
    minHandPresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  });
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoseLandmarks: 33,
    minPoseDetectionConfidence: 0.4,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === "INIT") {
    await initLandmarker();
    (self as unknown as Worker).postMessage({ type: "STATUS", state: "IDLE", fps: 0 });
    return;
  }

  if (msg.type === "SET_CONFIG") {
    poseEnabled = msg.poseEnabled;
    return;
  }

  if (msg.type === "FRAME" && handLandmarker && poseLandmarker) {
    // Discard frames older than 80ms to prevent queue buildup causing lag
    const age = performance.now() - msg.timestamp;
    if (age > 80) {
      msg.frame.close();
      return;
    }

    try {
      const handResult = handLandmarker.detectForVideo(msg.frame, msg.timestamp);
      // Only run expensive pose model when needed (dynamic signs / word drills)
      const poseResult = poseEnabled
        ? poseLandmarker.detectForVideo(msg.frame, msg.timestamp)
        : { landmarks: [] };
      msg.frame.close();

      const rawHands = handResult.landmarks ?? [];
      const rawHandedness = (handResult.handedness ?? []).map(h => h[0]?.categoryName ?? "Right");
      const rawPose = poseResult.landmarks?.[0] ?? [];

      const normalized = normalize(rawHands, rawHandedness, rawPose);
      const arr = landmarksToArrayUpdated(normalized);
      pushFrame(arr);
      updateVAD(normalized, frameIdx);
      frameIdx++;

      (self as unknown as Worker).postMessage({
        type: "LANDMARKS",
        landmarks: normalized,
        rawHands: rawHands.map(h => h.map(p => ({ x: p.x, y: p.y, z: p.z }))),
        timestamp: msg.timestamp,
      });
    } catch {
      /* skip malformed frame */
    }
  }
};
