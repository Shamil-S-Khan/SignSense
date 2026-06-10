"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMediaPipeWorker } from "./useMediaPipeWorker";
import { useSignRecognitionSocket } from "./useSignRecognitionSocket";
import { useVideoFrameCapture } from "./useVideoFrameCapture";
import { useWebcam } from "./useWebcam";
import type { ConnectionStatus, RecognitionResult } from "@/lib/sign-recognition/types";
import type { HandLandmark, NormalizedLandmarks } from "@/workers/mediapipe.types";

export type ASLCitizenLessonPhase = "idle" | "recording" | "predicting" | "result";

export interface ASLCitizenLessonResult {
  matched: boolean;
  topLabel: string;
  confidence: number;
  raw: RecognitionResult;
}

interface UseASLCitizenLessonOptions {
  targetWord: string;
  onSuccess: (result: ASLCitizenLessonResult) => void;
  onFailure: (result: ASLCitizenLessonResult) => void;
}

interface UseASLCitizenLessonReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  cameraError: string | null;
  workerError: string | null;
  isWorkerReady: boolean;
  connectionStatus: ConnectionStatus;
  phase: ASLCitizenLessonPhase;
  frameCount: number;
  lastResult: ASLCitizenLessonResult | null;
  rawHandsRef: React.MutableRefObject<HandLandmark[][]>;
  landmarksRef: React.MutableRefObject<NormalizedLandmarks | null>;
  startRecording: () => void;
  stopRecording: () => void;
  reset: () => void;

  // Hands-free properties
  isHandsFree: boolean;
  setIsHandsFree: (enabled: boolean) => void;
  isDetecting: boolean;
  liveGuess: { label: string; confidence: number } | null;
}

/** Helper to convert worker landmarks format into a 288-float array for the model backend */
function landmarksToArray(landmarks: NormalizedLandmarks): number[] {
  const output = new Array<number>(288).fill(0);

  const writePoints = (points: HandLandmark[], offset: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const p = points[i] ?? { x: 0, y: 0, z: 0 };
      output[offset + i * 3] = p.x;
      output[offset + i * 3 + 1] = p.y;
      output[offset + i * 3 + 2] = p.z;
    }
  };

  const dominantHand = landmarks.rightHand.length > 0 ? landmarks.rightHand : landmarks.leftHand;
  writePoints(dominantHand, 0, 21);
  writePoints(landmarks.leftHand, 63, 21);
  writePoints(landmarks.rightHand, 126, 21);
  writePoints(landmarks.pose, 189, 33);

  return output;
}

export function useASLCitizenLesson({
  targetWord,
  onSuccess,
  onFailure,
}: UseASLCitizenLessonOptions): UseASLCitizenLessonReturn {
  const { videoRef, isStreaming, error: cameraError, startCapture, stopCapture } = useWebcam();
  
  const {
    isReady: isWorkerReady,
    error: workerError,
    landmarksRef,
    rawHandsRef,
    sendFrame: sendMPFrame,
    setPoseEnabled,
  } = useMediaPipeWorker();

  const {
    connectionStatus,
    latestResult,
    sendFrame: sendWSFrame,
    requestPrediction,
    clearRemoteBuffer,
    clearPrediction,
  } = useSignRecognitionSocket();

  const [phase, setPhase] = useState<ASLCitizenLessonPhase>("idle");
  const [frameCount, setFrameCount] = useState(0);
  const [lastResult, setLastResult] = useState<ASLCitizenLessonResult | null>(null);

  // Hands-free state
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [liveGuess, setLiveGuess] = useState<{ label: string; confidence: number } | null>(null);

  const frameIndexRef = useRef(0);
  const isRecordingRef = useRef(false);
  const rollingBufferRef = useRef<{ jpeg: string; landmarks: number[] | null }[]>([]);
  const isEvaluatingRef = useRef(false);

  // Configure worker: enable pose tracking on load
  useEffect(() => {
    if (isWorkerReady) {
      setPoseEnabled(true);
    }
  }, [isWorkerReady, setPoseEnabled]);

  // Start webcam and send frames to MediaPipe worker client-side
  useEffect(() => {
    if (!isWorkerReady) return;

    startCapture((frame, timestamp) => {
      sendMPFrame(frame, timestamp);
    });

    return () => {
      stopCapture();
    };
  }, [isWorkerReady, startCapture, sendMPFrame, stopCapture]);

  // Runs sliding window evaluation in the background using the websocket
  const runRollingEvaluation = useCallback(async (snapshot: { jpeg: string; landmarks: number[] | null }[]) => {
    try {
      // 1. Clear remote buffer
      clearRemoteBuffer();

      // 2. Uniformly sample 16 frames from the 40-frame snapshot
      const numFrames = 16;
      const n = snapshot.length;
      const indices: number[] = [];
      for (let i = 0; i < numFrames; i++) {
        indices.push(Math.round((i * (n - 1)) / (numFrames - 1)));
      }

      // 3. Send the 16 sampled frames in order
      for (let idx = 0; idx < numFrames; idx++) {
        const frameIdx = indices[idx]!;
        const item = snapshot[frameIdx];
        if (item) {
          sendWSFrame(idx, item.jpeg, item.landmarks ?? undefined);
        }
      }

      // 4. Request prediction
      requestPrediction();
    } catch (err) {
      console.error("Failed running rolling window evaluation:", err);
      isEvaluatingRef.current = false;
    }
  }, [clearRemoteBuffer, sendWSFrame, requestPrediction]);

  // Capture frames at 25fps and send them to the backend socket, with client-side landmarks included
  useVideoFrameCapture({
    videoRef,
    enabled: isStreaming && (phase === "recording" || (isHandsFree && phase === "idle")),
    onFrame: useCallback(
      (jpeg: string) => {
        const idx = frameIndexRef.current++;

        // Attach current landmarks array (288 floats) if available
        let landmarksArray: number[] | undefined = undefined;
        if (landmarksRef.current) {
          landmarksArray = landmarksToArray(landmarksRef.current);
        }

        if (isHandsFree) {
          // Push to local rolling buffer
          rollingBufferRef.current.push({ jpeg, landmarks: landmarksArray ?? null });
          if (rollingBufferRef.current.length > 40) {
            rollingBufferRef.current.shift();
          }

          // Trigger evaluation periodically (every 8 frames once buffer is full)
          const count = rollingBufferRef.current.length;
          if (count >= 40 && idx % 8 === 0 && !isEvaluatingRef.current) {
            isEvaluatingRef.current = true;
            const snapshot = [...rollingBufferRef.current];
            void runRollingEvaluation(snapshot);
          }
          setFrameCount(count);
        } else {
          if (!isRecordingRef.current) return;
          sendWSFrame(idx, jpeg, landmarksArray);
          setFrameCount(idx + 1);
        }
      },
      [sendWSFrame, landmarksRef, isHandsFree, phase, runRollingEvaluation, isStreaming],
    ),
  });

  // Handle predictions from the backend WebSocket
  useEffect(() => {
    if (!latestResult) return;

    const top = latestResult.predictions[0];
    const matched = top?.label?.toUpperCase() === targetWord.toUpperCase();

    const lessonResult: ASLCitizenLessonResult = {
      matched,
      topLabel: top?.label ?? "",
      confidence: top?.confidence ?? 0,
      raw: latestResult,
    };

    if (isHandsFree) {
      isEvaluatingRef.current = false;
      if (matched && phase === "idle") {
        setLastResult(lessonResult);
        setPhase("result");
        onSuccess(lessonResult);
      } else {
        // If not matched, update live guess state for user feedback
        setLiveGuess(top ? { label: top.label, confidence: top.confidence } : null);
      }
    } else {
      if (phase !== "predicting") return;
      setLastResult(lessonResult);
      setPhase("result");

      if (matched) {
        onSuccess(lessonResult);
      } else {
        onFailure(lessonResult);
      }
    }
  }, [latestResult, phase, targetWord, onSuccess, onFailure, isHandsFree]);

  const startRecording = useCallback(() => {
    clearRemoteBuffer();
    clearPrediction();
    setLastResult(null);
    frameIndexRef.current = 0;
    setFrameCount(0);
    isRecordingRef.current = true;
    setPhase("recording");
  }, [clearRemoteBuffer, clearPrediction]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setPhase("predicting");
    requestPrediction();
  }, [requestPrediction]);

  const reset = useCallback(() => {
    isRecordingRef.current = false;
    isEvaluatingRef.current = false;
    rollingBufferRef.current = [];
    setLiveGuess(null);
    clearRemoteBuffer();
    clearPrediction();
    frameIndexRef.current = 0;
    setFrameCount(0);
    setLastResult(null);
    setPhase("idle");
  }, [clearRemoteBuffer, clearPrediction]);

  const isDetecting = isHandsFree && phase === "idle" && frameCount >= 40;

  return {
    videoRef,
    isStreaming,
    cameraError,
    workerError,
    isWorkerReady,
    connectionStatus,
    phase,
    frameCount,
    lastResult,
    rawHandsRef,
    landmarksRef,
    startRecording,
    stopRecording,
    reset,

    // Hands-free properties
    isHandsFree,
    setIsHandsFree,
    isDetecting,
    liveGuess,
  };
}
