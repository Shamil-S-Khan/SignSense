"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/sign-recognition/types";
import { SkeletonOverlay } from "@/components/webcam/SkeletonOverlay";
import type { HandLandmark, NormalizedLandmarks } from "@/workers/mediapipe.types";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  isRecording: boolean;
  cameraError: string | null;
  workerError?: string | null;
  isWorkerReady?: boolean;
  connectionStatus: ConnectionStatus;
  rawHandsRef: React.MutableRefObject<HandLandmark[][]>;
  landmarksRef: React.MutableRefObject<NormalizedLandmarks | null>;
  isHandsFree?: boolean;
}

export function ASLCitizenCamera({
  videoRef,
  isStreaming,
  isRecording,
  cameraError,
  workerError,
  isWorkerReady,
  connectionStatus,
  rawHandsRef,
  landmarksRef,
  isHandsFree = false,
}: Props) {
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDimensions = () => {
      if (video.videoWidth && video.videoHeight) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }
    };

    video.addEventListener("loadedmetadata", updateDimensions);
    video.addEventListener("resize", updateDimensions);

    if (video.videoWidth && video.videoHeight) {
      updateDimensions();
    }

    return () => {
      video.removeEventListener("loadedmetadata", updateDimensions);
      video.removeEventListener("resize", updateDimensions);
    };
  }, [videoRef, isStreaming]);

  const statusLabel = workerError
    ? "Tracker Error"
    : cameraError
      ? "Camera Error"
      : !isWorkerReady
        ? "Loading Tracker..."
        : isStreaming
          ? "Camera live"
          : "Camera idle";

  return (
    <section 
      className="self-start relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.45)] w-full"
      style={{ aspectRatio: aspectRatio, alignSelf: "start" }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full"
        style={{ transform: "scaleX(-1)", objectFit: "cover" }}
        muted
        playsInline
      />

      <SkeletonOverlay rawHandsRef={rawHandsRef} landmarksRef={landmarksRef} videoRef={videoRef} />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
        <StatusPill tone={isStreaming ? "green" : "neutral"}>{statusLabel}</StatusPill>
        <StatusPill tone={connectionStatus === "connected" ? "green" : connectionStatus === "connecting" ? "amber" : "red"}>
          {connectionStatus}
        </StatusPill>
        <StatusPill tone={isRecording ? "red" : "neutral"}>{isRecording ? "Recording" : isHandsFree ? "Auto-Scanning" : "Preview"}</StatusPill>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/75 to-transparent px-5 pb-5 pt-16">
        <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur">
          {cameraError || workerError ? (
            <p className="text-sm font-medium text-red-200">{cameraError || workerError}</p>
          ) : (
            <p className="text-sm font-medium text-zinc-200">
              {isRecording
                ? "Recording — sign the word clearly, keeping hands/body tracked."
                : isHandsFree
                  ? "Auto-Scanning — sign the word and hold the final pose."
                  : "Position yourself so your body is centered and landmarks are active."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "red" | "neutral" }) {
  const className =
    tone === "green"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
      : tone === "amber"
        ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
        : tone === "red"
          ? "border-red-400/30 bg-red-500/15 text-red-100"
          : "border-white/10 bg-zinc-900/80 text-zinc-200";

  return <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${className}`}>{children}</span>;
}
