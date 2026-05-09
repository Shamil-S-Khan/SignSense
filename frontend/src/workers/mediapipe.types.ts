export type WorkerInMessage =
  | { type: "INIT"; config?: { modelComplexity?: number } }
  | { type: "FRAME"; frame: ImageBitmap; timestamp: number }
  | { type: "SET_CONFIG"; poseEnabled: boolean };

export type WorkerOutMessage =
  | { type: "READY" }
  | { type: "LANDMARKS"; landmarks: NormalizedLandmarks; rawHands: HandLandmark[][]; timestamp: number }
  | { type: "VAD_STATE"; state: VADState; velocity: number; timestamp: number }
  | { type: "SIGN_SEGMENT"; frames: Float32Array; frameCount: number; startedAt: number; endedAt: number }
  | { type: "METRICS"; fps: number; latencyMs: number; droppedFrames: number }
  | { type: "ERROR"; message: string };

export type VADState = "IDLE" | "SIGNING" | "COOLDOWN";

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface NormalizedLandmarks {
  leftHand: HandLandmark[];
  rightHand: HandLandmark[];
  pose: HandLandmark[];
}

export interface WorkerMetrics {
  fps: number;
  latencyMs: number;
  droppedFrames: number;
}
