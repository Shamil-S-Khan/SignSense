"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  HandLandmark,
  NormalizedLandmarks,
  VADState,
  WorkerMetrics,
  WorkerOutMessage,
} from "@/workers/mediapipe.types";

interface UseMediaPipeWorkerReturn {
  isReady: boolean;
  error: string | null;
  landmarksRef: React.MutableRefObject<NormalizedLandmarks | null>;
  rawHandsRef: React.MutableRefObject<HandLandmark[][]>;
  vadState: VADState;
  metrics: WorkerMetrics;
  sendFrame: (frame: ImageBitmap, timestamp: number) => void;
  setPoseEnabled: (enabled: boolean) => void;
  onLandmarks: React.MutableRefObject<((landmarks: NormalizedLandmarks) => void) | null>;
  onSignSegment: React.MutableRefObject<((frames: Float32Array) => void) | null>;
}

export function useMediaPipeWorker(): UseMediaPipeWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const landmarksRef = useRef<NormalizedLandmarks | null>(null);
  const rawHandsRef = useRef<HandLandmark[][]>([]);
  const onLandmarks = useRef<((landmarks: NormalizedLandmarks) => void) | null>(null);
  const onSignSegment = useRef<((frames: Float32Array) => void) | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vadState, setVadState] = useState<VADState>("IDLE");
  const [metrics, setMetrics] = useState<WorkerMetrics>({ fps: 0, latencyMs: 0, droppedFrames: 0 });

  useEffect(() => {
    const worker = new Worker(new URL("../workers/mediapipe.worker.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const message = event.data;

      if (message.type === "READY") {
        setIsReady(true);
        return;
      }

      if (message.type === "LANDMARKS") {
        landmarksRef.current = message.landmarks;
        rawHandsRef.current = message.rawHands;
        onLandmarks.current?.(message.landmarks);
        return;
      }

      if (message.type === "VAD_STATE") {
        console.log(`[VAD] ${message.state} velocity=${message.velocity.toFixed(4)}`);
        setVadState(message.state);
        return;
      }

      if (message.type === "SIGN_SEGMENT") {
        console.log(`[VAD] segment ready ${message.frameCount} frames`);
        onSignSegment.current?.(message.frames);
        return;
      }

      if (message.type === "METRICS") {
        setMetrics({
          fps: message.fps,
          latencyMs: message.latencyMs,
          droppedFrames: message.droppedFrames,
        });
        return;
      }

      if (message.type === "ERROR") {
        setError(message.message);
      }
    };

    worker.postMessage({ type: "INIT" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const sendFrame = useCallback((frame: ImageBitmap, timestamp: number) => {
    const worker = workerRef.current;
    if (!worker) {
      frame.close();
      return;
    }

    worker.postMessage({ type: "FRAME", frame, timestamp }, [frame]);
  }, []);

  const setPoseEnabled = useCallback((enabled: boolean) => {
    workerRef.current?.postMessage({ type: "SET_CONFIG", poseEnabled: enabled });
  }, []);

  return {
    isReady,
    error,
    landmarksRef,
    rawHandsRef,
    vadState,
    metrics,
    sendFrame,
    setPoseEnabled,
    onLandmarks,
    onSignSegment,
  };
}
