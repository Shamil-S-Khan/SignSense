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
    <section className="relative h-full min-h-[420px] overflow-hidden rounded-[var(--radius-card)] border border-[#e5e5e5] bg-[#2a1040]">
      {/* Idle placeholder – shown when camera hasn't started */}
      {!isStreaming && !cameraStarted && (
        <div className="absolute inset-0 z-5 flex flex-col items-center justify-center gap-4 bg-purple-950/70">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7L16 12l7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <p className="text-sm font-semibold text-white/40">Start camera to begin</p>
        </div>
      )}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: "scaleX(-1)" }}
        muted
        playsInline
      />

      <SkeletonOverlay rawHandsRef={rawHandsRef} width={640} height={480} />

      {overlayMessage ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 px-6">
          <div
            className={`rounded-2xl border px-6 py-4 text-center backdrop-blur ${
              overlayTone === "success"
                ? "border-emerald-300/70 bg-emerald-400/20 text-white"
                : overlayTone === "guided"
                  ? "border-amber-300/70 bg-amber-400/20 text-white"
                  : "border-white/20 bg-black/40 text-white"
            }`}
          >
            <p className="text-3xl font-black uppercase tracking-[0.18em]">{overlayMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
        <StatusPill tone={isStreaming ? "green" : workerError || cameraError ? "red" : "neutral"}>{statusLabel}</StatusPill>
        <StatusPill tone={vadState === "SIGNING" ? "green" : vadState === "COOLDOWN" ? "amber" : "neutral"}>
          {vadState}
        </StatusPill>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid w-full grid-cols-3 gap-2 rounded-xl border border-white/15 bg-black/60 p-3 text-center backdrop-blur md:max-w-xs">
          <Metric label="FPS" value={metrics.fps || "-"} />
          <Metric label="Latency" value={metrics.latencyMs ? `${metrics.latencyMs}ms` : "-"} />
          <Metric label="Dropped" value={metrics.droppedFrames} />
        </div>

        <button
          type="button"
          onClick={isStreaming ? stop : start}
          disabled={!isReady}
          className="h-11 rounded-xl bg-white px-5 text-sm font-bold text-[#3c3c3c] transition hover:bg-[#e8f9ff] disabled:cursor-not-allowed disabled:opacity-50"
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
      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
      : tone === "amber"
        ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
        : tone === "red"
          ? "border-red-400/40 bg-red-500/20 text-red-100"
          : "border-white/10 bg-zinc-900/80 text-zinc-200";

  return <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${className}`}>{children}</span>;
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
