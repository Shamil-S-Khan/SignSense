export interface RecognitionPrediction {
  label: string;
  confidence: number;
}

export interface RecognitionResult {
  predictions: RecognitionPrediction[];
  preprocessMs: number;
  inferenceMs: number;
  totalMs: number;
  framesReceived: number;
  isConfident: boolean;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";