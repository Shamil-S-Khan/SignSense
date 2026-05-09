"use client";

import { useCallback, useRef, useState } from "react";

interface UseRecordingBufferReturn {
  isRecording: boolean;
  frameCount: number;
  startRecording: () => void;
  addFrame: (landmarks: number[]) => void;
  stopRecording: () => number[][];
  clearBuffer: () => void;
}

export function useRecordingBuffer(): UseRecordingBufferReturn {
  const bufferRef = useRef<number[][]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const clearBuffer = useCallback(() => {
    bufferRef.current = [];
    setFrameCount(0);
  }, []);

  const startRecording = useCallback(() => {
    bufferRef.current = [];
    setFrameCount(0);
    setIsRecording(true);
  }, []);

  const addFrame = useCallback(
    (landmarks: number[]) => {
      if (!isRecording) {
        return;
      }

      bufferRef.current.push(landmarks);
      setFrameCount(bufferRef.current.length);
    },
    [isRecording],
  );

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    return bufferRef.current.slice();
  }, []);

  return {
    isRecording,
    frameCount,
    startRecording,
    addFrame,
    stopRecording,
    clearBuffer,
  };
}