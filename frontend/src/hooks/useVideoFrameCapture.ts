"use client";

import { useCallback, useEffect, useRef } from "react";

const FRAME_SIZE = 224;
const JPEG_QUALITY = 0.7;
// Match the 25fps rate previously used for Siformer training data.
const INTERVAL_MS = 1000 / 25;

interface UseVideoFrameCaptureOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  onFrame: (jpeg: string) => void;
}

/**
 * Captures JPEG frames from a <video> element at 25fps and calls onFrame
 * with the raw base64 data URL string (without the data:image/jpeg;base64, prefix).
 */
export function useVideoFrameCapture({
  videoRef,
  enabled,
  onFrame,
}: UseVideoFrameCaptureOptions): void {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const getCanvas = useCallback((): HTMLCanvasElement => {
    if (!canvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = FRAME_SIZE;
      canvas.height = FRAME_SIZE;
      canvasRef.current = canvas;
    }
    return canvasRef.current;
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      const canvas = getCanvas();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Mirror the frame to match display (video is displayed mirrored via CSS).
      ctx.save();
      ctx.translate(FRAME_SIZE, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, FRAME_SIZE, FRAME_SIZE);
      ctx.restore();

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      // Strip the "data:image/jpeg;base64," prefix — the backend decodes raw base64.
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      onFrameRef.current(base64);
    }, INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, videoRef, getCanvas]);
}
