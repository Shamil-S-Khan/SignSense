import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { HandLandmark, NormalizedLandmarks, VADState, WorkerInMessage } from "./mediapipe.types";

const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const BUFFER_LEN = 90;
const TARGET_SEGMENT_FRAMES = 60;
const VALUES_PER_FRAME = 288;
const MAX_FRAME_AGE_MS = 90;

let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let poseEnabled = false;

const frameBuffer = new Float32Array(BUFFER_LEN * VALUES_PER_FRAME);
let bufferHead = 0;
let bufferCount = 0;
let frameIdx = 0;

let vadState: VADState = "IDLE";
let prevHandPositions: number[] | null = null;
const velocityWindow: number[] = [];
let consecutiveAbove = 0;
let consecutiveBelow = 0;
let signStartIdx = 0;
let signStartedAt = 0;
let cooldownFrames = 0;

const upperThreshold = 0.015;
const lowerThreshold = 0.008;

let metricsWindowStartedAt = performance.now();
let processedFrames = 0;
let droppedFrames = 0;
let latencyTotal = 0;

function postMessageToMain(message: unknown, transfer?: Transferable[]) {
  (self as unknown as Worker).postMessage(message, transfer ?? []);
}

function normalize(
  rawHands: { x: number; y: number; z: number }[][],
  rawHandedness: string[],
  rawPose: { x: number; y: number; z: number }[],
): NormalizedLandmarks {
  const toLandmarks = (points: { x: number; y: number; z: number }[]): HandLandmark[] =>
    points.map((point) => ({ x: point.x, y: point.y, z: point.z }));

  let leftHand: HandLandmark[] = [];
  let rightHand: HandLandmark[] = [];

  for (let i = 0; i < rawHands.length; i += 1) {
    const mirroredLabel = rawHandedness[i] === "Right" ? "Left" : "Right";
    if (mirroredLabel === "Left") {
      leftHand = toLandmarks(rawHands[i]);
    } else {
      rightHand = toLandmarks(rawHands[i]);
    }
  }

  return {
    leftHand,
    rightHand,
    pose: toLandmarks(rawPose),
  };
}

function writePoints(target: Float32Array, points: HandLandmark[], offset: number, count: number) {
  for (let i = 0; i < count; i += 1) {
    const point = points[i] ?? { x: 0, y: 0, z: 0 };
    target[offset + i * 3] = point.x;
    target[offset + i * 3 + 1] = point.y;
    target[offset + i * 3 + 2] = point.z;
  }
}

function landmarksToArray(landmarks: NormalizedLandmarks): Float32Array {
  const output = new Float32Array(VALUES_PER_FRAME);
  const dominantHand = landmarks.rightHand.length > 0 ? landmarks.rightHand : landmarks.leftHand;

  writePoints(output, dominantHand, 0, 21);
  writePoints(output, landmarks.leftHand, 63, 21);
  writePoints(output, landmarks.rightHand, 126, 21);
  writePoints(output, landmarks.pose, 189, 33);

  return output;
}

function pushFrame(frame: Float32Array) {
  frameBuffer.set(frame, bufferHead * VALUES_PER_FRAME);
  bufferHead = (bufferHead + 1) % BUFFER_LEN;
  bufferCount = Math.min(bufferCount + 1, BUFFER_LEN);
}

function computeVelocity(landmarks: NormalizedLandmarks): number {
  const current: number[] = [];
  const activeHands = [...landmarks.leftHand, ...landmarks.rightHand];

  for (const point of activeHands) {
    current.push(point.x, point.y);
  }

  if (current.length === 0) {
    prevHandPositions = null;
    return 0;
  }

  if (!prevHandPositions || current.length !== prevHandPositions.length) {
    prevHandPositions = current;
    return 0;
  }

  let total = 0;
  for (let i = 0; i < current.length; i += 2) {
    const dx = current[i] - prevHandPositions[i];
    const dy = current[i + 1] - prevHandPositions[i + 1];
    total += Math.hypot(dx, dy);
  }

  prevHandPositions = current;
  return total / Math.max(1, current.length / 2);
}

function smoothVelocity(velocity: number): number {
  velocityWindow.push(velocity);
  if (velocityWindow.length > 5) velocityWindow.shift();
  return velocityWindow.reduce((sum, value) => sum + value, 0) / velocityWindow.length;
}

function extractSegment(startIdx: number, endIdx: number): Float32Array {
  const availableLength = Math.max(1, Math.min(endIdx - startIdx, bufferCount));
  const output = new Float32Array(TARGET_SEGMENT_FRAMES * VALUES_PER_FRAME);

  for (let i = 0; i < TARGET_SEGMENT_FRAMES; i += 1) {
    const sourceOffset = Math.min(Math.floor((i / TARGET_SEGMENT_FRAMES) * availableLength), availableLength - 1);
    const absoluteFrame = startIdx + sourceOffset;
    const bufferIndex = ((absoluteFrame % BUFFER_LEN) + BUFFER_LEN) % BUFFER_LEN;
    output.set(
      frameBuffer.subarray(bufferIndex * VALUES_PER_FRAME, (bufferIndex + 1) * VALUES_PER_FRAME),
      i * VALUES_PER_FRAME,
    );
  }

  return output;
}

function emitVADState(nextState: VADState, velocity: number) {
  if (vadState === nextState) return;
  vadState = nextState;
  postMessageToMain({ type: "VAD_STATE", state: vadState, velocity, timestamp: performance.now() });
}

function updateVAD(landmarks: NormalizedLandmarks, currentFrameIdx: number) {
  const velocity = smoothVelocity(computeVelocity(landmarks));

  if (vadState === "IDLE") {
    consecutiveAbove = velocity > upperThreshold ? consecutiveAbove + 1 : 0;
    if (consecutiveAbove >= 5) {
      signStartIdx = Math.max(0, currentFrameIdx - 5);
      signStartedAt = performance.now();
      consecutiveAbove = 0;
      console.log(`[VAD] start velocity=${velocity.toFixed(4)}`);
      emitVADState("SIGNING", velocity);
    }
    return;
  }

  if (vadState === "SIGNING") {
    consecutiveBelow = velocity < lowerThreshold ? consecutiveBelow + 1 : 0;
    if (consecutiveBelow >= 10) {
      const frames = extractSegment(signStartIdx, currentFrameIdx);
      const endedAt = performance.now();
      console.log(`[VAD] end frames=${TARGET_SEGMENT_FRAMES} velocity=${velocity.toFixed(4)}`);
      postMessageToMain(
        {
          type: "SIGN_SEGMENT",
          frames,
          frameCount: TARGET_SEGMENT_FRAMES,
          startedAt: signStartedAt,
          endedAt,
        },
        [frames.buffer],
      );
      consecutiveBelow = 0;
      cooldownFrames = 0;
      emitVADState("COOLDOWN", velocity);
    }
    return;
  }

  cooldownFrames += 1;
  if (cooldownFrames >= 15) {
    emitVADState("IDLE", velocity);
  }
}

function updateMetrics(latencyMs: number) {
  processedFrames += 1;
  latencyTotal += latencyMs;

  const now = performance.now();
  const elapsed = now - metricsWindowStartedAt;
  if (elapsed < 1000) return;

  postMessageToMain({
    type: "METRICS",
    fps: Math.round((processedFrames * 1000) / elapsed),
    latencyMs: Math.round(latencyTotal / Math.max(1, processedFrames)),
    droppedFrames,
  });

  metricsWindowStartedAt = now;
  processedFrames = 0;
  droppedFrames = 0;
  latencyTotal = 0;
}

async function initLandmarkers() {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_MODEL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.35,
    minHandPresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
  });

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_MODEL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    minPoseDetectionConfidence: 0.4,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const message = event.data;

  if (message.type === "INIT") {
    try {
      await initLandmarkers();
      postMessageToMain({ type: "READY" });
      postMessageToMain({ type: "VAD_STATE", state: "IDLE", velocity: 0, timestamp: performance.now() });
    } catch (error) {
      postMessageToMain({
        type: "ERROR",
        message: error instanceof Error ? error.message : "MediaPipe initialization failed",
      });
    }
    return;
  }

  if (message.type === "SET_CONFIG") {
    poseEnabled = message.poseEnabled;
    return;
  }

  if (message.type !== "FRAME" || !handLandmarker || !poseLandmarker) return;

  const age = performance.now() - message.timestamp;
  if (age > MAX_FRAME_AGE_MS) {
    droppedFrames += 1;
    message.frame.close();
    return;
  }

  let frameClosed = false;
  try {
    const handResult = handLandmarker.detectForVideo(message.frame, message.timestamp);
    const poseResult = poseEnabled ? poseLandmarker.detectForVideo(message.frame, message.timestamp) : { landmarks: [] };
    message.frame.close();
    frameClosed = true;

    const rawHands = handResult.landmarks ?? [];
    const rawHandedness = (handResult.handedness ?? []).map((hand) => hand[0]?.categoryName ?? "Right");
    const rawPose = poseResult.landmarks?.[0] ?? [];
    const normalized = normalize(rawHands, rawHandedness, rawPose);

    pushFrame(landmarksToArray(normalized));
    updateVAD(normalized, frameIdx);
    frameIdx += 1;

    postMessageToMain({
      type: "LANDMARKS",
      landmarks: normalized,
      rawHands: rawHands.map((hand) => hand.map((point) => ({ x: point.x, y: point.y, z: point.z }))),
      timestamp: message.timestamp,
    });

    updateMetrics(performance.now() - message.timestamp);
  } catch (error) {
    if (!frameClosed) message.frame.close();
    postMessageToMain({
      type: "ERROR",
      message: error instanceof Error ? error.message : "Frame processing failed",
    });
  }
};
