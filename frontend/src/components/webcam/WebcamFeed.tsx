"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { classifyFingerspellingFallback } from "@/lib/inference/fingerspelling-fallback";
import { useMediaPipeWorker } from "@/hooks/useMediaPipeWorker";
import { useWebcam } from "@/hooks/useWebcam";
import type { NormalizedLandmarks, VADState, WorkerMetrics } from "@/workers/mediapipe.types";
import { SkeletonOverlay } from "./SkeletonOverlay";

interface ScoreBreakdown {
  handshape: number;
  movement: number;
  orientation: number;
}

interface Props {
  disablePose?: boolean;
  overlayMessage?: string | null;
  overlayTone?: "success" | "guided" | "neutral";
  onLandmarks?: (landmarks: NormalizedLandmarks) => void;
  onSignSegment?: (frames: Float32Array) => void;
  onSignDetected?: (sign: string, confidence: number, scores: ScoreBreakdown) => void;
  onStatusChange?: (status: { vadState: VADState; metrics: WorkerMetrics; cameraActive: boolean }) => void;
}

export function WebcamFeed({
  disablePose = true,
  overlayMessage = null,
  overlayTone = "neutral",
  onLandmarks,
  onSignSegment,
  onSignDetected,
  onStatusChange,
}: Props) {
  const { videoRef, isStreaming, error: cameraError, startCapture, stopCapture } = useWebcam();
  const {
    isReady,
    error: workerError,
    landmarksRef,
    rawHandsRef,
    vadState,
    metrics,
    sendFrame,
    setPoseEnabled,
    onLandmarks: onWorkerLandmarks,
    onSignSegment: onWorkerSignSegment,
  } = useMediaPipeWorker();

  const latestDetectionRef = useRef<{ sign: string; at: number } | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    setPoseEnabled(!disablePose);
  }, [disablePose, isReady, setPoseEnabled]);

  useEffect(() => {
    onWorkerSignSegment.current = onSignSegment ?? null;
  }, [onSignSegment, onWorkerSignSegment]);

  useEffect(() => {
    onWorkerLandmarks.current = (landmarks) => {
      onLandmarks?.(landmarks);

      const hand = landmarks.rightHand.length > 0 ? landmarks.rightHand : landmarks.leftHand;
      if (hand.length !== 21 || !onSignDetected) return;

      const result = classifyFingerspellingFallback(hand);
      if (!result) return;

      const last = latestDetectionRef.current;
      const now = performance.now();
      if (last?.sign === result.letter && now - last.at < 400) return;

      latestDetectionRef.current = { sign: result.letter, at: now };
      onSignDetected(result.letter, result.confidence, result.scores);
    };

    return () => {
      onWorkerLandmarks.current = null;
    };
  }, [onLandmarks, onSignDetected, onWorkerLandmarks]);

  useEffect(() => {
    onStatusChange?.({ vadState, metrics, cameraActive: isStreaming });
  }, [isStreaming, metrics, onStatusChange, vadState]);

  useEffect(() => {
    if (cameraError || workerError) {
      setCameraStarted(false);
    }
  }, [cameraError, workerError]);

  const start = () => {
    if (!isReady) return;
    setCameraStarted(true);
    startCapture(sendFrame);
  };

  const stop = () => {
    setCameraStarted(false);
    stopCapture();
  };

  const statusLabel = workerError || cameraError || (!isReady ? "Loading MediaPipe" : isStreaming ? "Camera Live" : "Camera Ready");

  return (
    <section className="relative w-full aspect-video overflow-hidden rounded-[var(--radius-card)] border-2 border-[#22263a] bg-zinc-950 shadow-2xl">
      {/* Idle placeholder – shown when camera hasn't started */}
      {!isStreaming && !cameraStarted && (
        <div className="absolute inset-0 z-5 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 backdrop-blur-sm">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7L16 12l7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <p className="text-xs font-semibold text-[#9ca3af]">Start camera to begin</p>
        </div>
      )}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full"
        style={{ transform: "scaleX(-1)", objectFit: "cover" }}
        muted
        playsInline
      />

      <SkeletonOverlay rawHandsRef={rawHandsRef} landmarksRef={landmarksRef} videoRef={videoRef} />

      {overlayMessage ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 px-6">
          <div
            className={`rounded-2xl border-2 px-5 py-3.5 text-center backdrop-blur-md ${
              overlayTone === "success"
                ? "border-[#3dd68c]/70 bg-[#3dd68c]/20 text-[#f0f2f8]"
                : overlayTone === "guided"
                  ? "border-[#f7a84f]/70 bg-[#f7a84f]/20 text-[#f0f2f8]"
                  : "border-[#22263a] bg-[#1a1d27]/80 text-[#f0f2f8]"
            }`}
          >
            <p className="text-2xl font-black uppercase tracking-[0.18em]">{overlayMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-1.5">
        <StatusPill tone={isStreaming ? "green" : workerError || cameraError ? "red" : "neutral"}>{statusLabel}</StatusPill>
        <StatusPill tone={vadState === "SIGNING" ? "green" : vadState === "COOLDOWN" ? "amber" : "neutral"}>
          {vadState}
        </StatusPill>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border-2 border-[#22263a] bg-[#1a1d27]/90 px-4 py-2 text-center backdrop-blur-sm md:max-w-[220px]">
          <Metric label="FPS" value={metrics.fps || "-"} />
          <Metric label="Latency" value={metrics.latencyMs ? `${metrics.latencyMs}ms` : "-"} />
          <Metric label="Dropped" value={metrics.droppedFrames} />
        </div>

        <button
          type="button"
          onClick={isStreaming ? stop : start}
          disabled={!isReady}
          className={`${isStreaming ? "btn-pink" : cameraError ? "btn-amber" : "btn-blue"} h-10 px-5 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isStreaming ? "Stop Camera" : cameraStarted ? "Starting..." : cameraError ? "Retry Camera" : "Start Camera"}
        </button>
      </div>
    </section>
  );
}

function StatusPill({ children, tone }: { children: ReactNode; tone: "green" | "amber" | "red" | "neutral" }) {
  const className =
    tone === "green"
      ? "border-[#3dd68c] bg-[#3dd68c]/15 text-[#3dd68c]"
      : tone === "amber"
        ? "border-[#f7a84f] bg-[#f7a84f]/15 text-[#f7a84f]"
        : tone === "red"
          ? "border-[#f75f5f] bg-[#f75f5f]/15 text-[#f75f5f]"
          : "border-[#22263a] bg-[#1a1d27]/90 text-zinc-200";

  return <span className={`rounded-full border-2 px-4 py-1 text-[10px] font-extrabold uppercase tracking-wider ${className}`}>{children}</span>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  const isDash = value === "-" || value === 0;
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={`text-lg font-black ${isDash ? "text-zinc-500" : "text-white"}`}>{value}</div>
    </div>
  );
}
