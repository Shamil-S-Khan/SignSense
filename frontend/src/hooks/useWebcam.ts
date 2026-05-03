"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  error: string | null;
  startCapture: (onFrame: (frame: ImageBitmap, ts: number) => void) => void;
  stopCapture: () => void;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCapture = useCallback(
    (onFrame: (frame: ImageBitmap, ts: number) => void) => {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setIsStreaming(true);

          let lastTime = 0;
          const tick = async (now: number) => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
            
            if (now - lastTime >= 33) { // ~30fps
              try {
                const bmp = await createImageBitmap(videoRef.current);
                onFrame(bmp, now);
                lastTime = now;
              } catch { /* skip frame */ }
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch((err) => setError(err.message));
    },
    []
  );

  const stopCapture = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsStreaming(false);
  }, []);

  useEffect(() => () => stopCapture(), [stopCapture]);

  return { videoRef, isStreaming, error, startCapture, stopCapture };
}
