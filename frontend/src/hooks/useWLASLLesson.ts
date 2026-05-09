"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSignRecognitionSocket } from "./useSignRecognitionSocket";
import { useVideoFrameCapture } from "./useVideoFrameCapture";
import { useWebcam } from "./useWebcam";
import type { ConnectionStatus, RecognitionResult } from "@/lib/sign-recognition/types";

export type WLASLLessonPhase = "idle" | "recording" | "predicting" | "result";

export interface WLASLLessonResult {
  matched: boolean;
  topLabel: string;
  confidence: number;
  raw: RecognitionResult;
}

interface UseWLASLLessonOptions {
  targetWord: string;
  onSuccess: (result: WLASLLessonResult) => void;
  onFailure: (result: WLASLLessonResult) => void;
}

interface UseWLASLLessonReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  cameraError: string | null;
  connectionStatus: ConnectionStatus;
  phase: WLASLLessonPhase;
  frameCount: number;
  lastResult: WLASLLessonResult | null;
  startRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
}

export function useWLASLLesson({
  targetWord,
  onSuccess,
  onFailure,
}: UseWLASLLessonOptions): UseWLASLLessonReturn {
  const { videoRef, isStreaming, error: cameraError, startCapture, stopCapture } = useWebcam();
  const { connectionStatus, latestResult, isPredicting, sendFrame, requestPrediction, clearRemoteBuffer, clearPrediction } = useSignRecognitionSocket();

  const [phase, setPhase] = useState<WLASLLessonPhase>("idle");
  const [frameCount, setFrameCount] = useState(0);
  const [lastResult, setLastResult] = useState<WLASLLessonResult | null>(null);

  const frameIndexRef = useRef(0);
  const isRecordingRef = useRef(false);

  // Start webcam on mount
  useEffect(() => {
    startCapture(() => {
      // We only need the stream; frame capture is handled by useVideoFrameCapture below
    });
    return () => {
      stopCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture frames and send while recording
  useVideoFrameCapture({
    videoRef,
    enabled: phase === "recording",
    onFrame: useCallback(
      (jpeg: string) => {
        if (!isRecordingRef.current) return;
        const idx = frameIndexRef.current++;
        sendFrame(idx, jpeg);
        setFrameCount(idx + 1);
      },
      [sendFrame],
    ),
  });

  // Handle prediction result
  useEffect(() => {
    if (phase !== "predicting" || !latestResult) return;

    const top = latestResult.predictions[0];
    const matched = top?.label?.toUpperCase() === targetWord.toUpperCase();

    const lessonResult: WLASLLessonResult = {
      matched,
      topLabel: top?.label ?? "",
      confidence: top?.confidence ?? 0,
      raw: latestResult,
    };

    setLastResult(lessonResult);
    setPhase("result");

    if (matched) {
      onSuccess(lessonResult);
    } else {
      onFailure(lessonResult);
    }
  }, [latestResult, phase, targetWord, onSuccess, onFailure]);

  const startRecording = useCallback(() => {
    // Clear any previous state
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
    clearRemoteBuffer();
    clearPrediction();
    frameIndexRef.current = 0;
    setFrameCount(0);
    setLastResult(null);
    setPhase("idle");
  }, [clearRemoteBuffer, clearPrediction]);

  return {
    videoRef,
    isStreaming,
    cameraError,
    connectionStatus,
    phase,
    frameCount,
    lastResult,
    startRecording,
    stopRecording,
    reset,
  };
}
