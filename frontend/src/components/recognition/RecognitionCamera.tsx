"use client";

import type { ConnectionStatus } from "@/lib/sign-recognition/types";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  isRecording: boolean;
  cameraError: string | null;
  connectionStatus: ConnectionStatus;
}

export function RecognitionCamera({
  videoRef,
  isStreaming,
  isRecording,
  cameraError,
  connectionStatus,
}: Props) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
      <video
        ref={videoRef}
        className="aspect-[4/3] w-full object-cover"
        style={{ transform: "scaleX(-1)" }}
        muted
        playsInline
      />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
        <StatusPill tone={isStreaming ? "green" : "neutral"}>{isStreaming ? "Camera live" : "Camera idle"}</StatusPill>
        <StatusPill tone={connectionStatus === "connected" ? "green" : connectionStatus === "connecting" ? "amber" : "red"}>
          {connectionStatus}
        </StatusPill>
        <StatusPill tone={isRecording ? "red" : "neutral"}>{isRecording ? "Recording" : "Preview"}</StatusPill>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/75 to-transparent px-5 pb-5 pt-16">
        <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur">
          {cameraError ? (
            <p className="text-sm font-medium text-red-200">{cameraError}</p>
          ) : (
            <p className="text-sm font-medium text-zinc-200">
              {isRecording
                ? "Recording — sign one word clearly, then press Done."
                : "Position yourself so your signing hand and upper body are visible."}
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