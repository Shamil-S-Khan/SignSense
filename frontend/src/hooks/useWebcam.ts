"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  error: string | null;
  startCapture: (onFrame: (frame: ImageBitmap, timestamp: number) => void) => void;
  stopCapture: () => void;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const onFrameRef = useRef<((frame: ImageBitmap, timestamp: number) => void) | null>(null);
  const frameInFlightRef = useRef(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    frameInFlightRef.current = false;
    setIsStreaming(false);
  }, []);

  const startCapture = useCallback(
    (onFrame: (frame: ImageBitmap, timestamp: number) => void) => {
      onFrameRef.current = onFrame;
      if (streamRef.current) return;

      navigator.mediaDevices
        .getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: "user",
          },
          audio: false,
        })
        .then((stream) => {
          streamRef.current = stream;
          setError(null);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }

          setIsStreaming(true);

          let lastFrameAt = 0;
          const tick = async (now: number) => {
            const video = videoRef.current;
            if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
              rafRef.current = requestAnimationFrame(tick);
              return;
            }

            if (!frameInFlightRef.current && now - lastFrameAt >= 33) {
              frameInFlightRef.current = true;
              try {
                const bitmap = await createImageBitmap(video);
                onFrameRef.current?.(bitmap, performance.now());
                lastFrameAt = now;
              } catch {
                // Dropped capture frames are expected while permissions/video warm up.
              } finally {
                frameInFlightRef.current = false;
              }
            }

            rafRef.current = requestAnimationFrame(tick);
          };

          rafRef.current = requestAnimationFrame(tick);
        })
        .catch((captureError: unknown) => {
          const message = captureError instanceof Error ? captureError.message : "Camera permission was denied";
          setError(message);
          setIsStreaming(false);
        });
    },
    [],
  );

  useEffect(() => stopCapture, [stopCapture]);

  return { videoRef, isStreaming, error, startCapture, stopCapture };
}
