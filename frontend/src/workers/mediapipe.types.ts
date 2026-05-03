// Main thread → Worker
export type WorkerInMessage =
  | { type: "INIT"; config: { modelComplexity?: number } }
  | { type: "FRAME"; frame: ImageBitmap; timestamp: number }
  | { type: "SET_CONFIG"; poseEnabled: boolean };

// Worker → Main thread
export type WorkerOutMessage =
  | { type: "LANDMARKS"; landmarks: NormalizedLandmarks; rawHands?: HandLandmark[][]; timestamp: number }
  | { type: "SIGN_READY"; frames: Float32Array; frameCount: number }
  | { type: "SIGN_DETECTED"; signIdx: number; confidence: number }
  | { type: "STATUS"; state: VADState; fps: number };

export type VADState = "IDLE" | "SIGNING" | "COOLDOWN";

export interface HandLandmark {
  x: number; y: number; z: number;
}

export interface NormalizedLandmarks {
  leftHand: HandLandmark[];   // 21 landmarks, empty if absent
  rightHand: HandLandmark[];  // 21 landmarks, empty if absent
  pose: HandLandmark[];       // 33 landmarks
}
