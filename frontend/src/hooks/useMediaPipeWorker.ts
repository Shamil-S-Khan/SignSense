"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import type { NormalizedLandmarks, VADState, WorkerOutMessage, HandLandmark } from "@/workers/mediapipe.types";

interface UseMediaPipeWorkerReturn {
  isReady: boolean;
  landmarks: NormalizedLandmarks | null;
  vadState: VADState;
  sendFrame: (frame: ImageBitmap, timestamp: number) => void;
  setPoseEnabled: (enabled: boolean) => void;
  onSignReady: React.MutableRefObject<((frames: Float32Array) => void) | null>;
  onSignDetected: React.MutableRefObject<((signIdx: number, confidence: number) => void) | null>;
  rawHandsRef: React.MutableRefObject<HandLandmark[][]>;
}

export function useMediaPipeWorker(): UseMediaPipeWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [landmarks, setLandmarks] = useState<NormalizedLandmarks | null>(null);
  const rawHandsRef = useRef<HandLandmark[][]>([]);
  const [vadState, setVadState] = useState<VADState>("IDLE");
  const onSignReady = useRef<((frames: Float32Array) => void) | null>(null);
  const onSignDetected = useRef<((signIdx: number, confidence: number) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/mediapipe.worker.ts", import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === "LANDMARKS") {
        setLandmarks(msg.landmarks);
        // Update ref directly — no re-render needed for canvas drawing
        if (msg.rawHands) rawHandsRef.current = msg.rawHands;
      } else if (msg.type === "SIGN_READY") {
        onSignReady.current?.(msg.frames);
      } else if (msg.type === "SIGN_DETECTED") {
        onSignDetected.current?.(msg.signIdx, msg.confidence);
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

  const setPoseEnabled = useCallback((enabled: boolean) => {
    workerRef.current?.postMessage({ type: "SET_CONFIG", poseEnabled: enabled });
  }, []);

  return { isReady, landmarks, rawHandsRef, vadState, sendFrame, setPoseEnabled, onSignReady, onSignDetected };
}
