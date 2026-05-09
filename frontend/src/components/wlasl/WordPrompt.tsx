"use client";

import type { ConnectionStatus, RecognitionResult } from "@/lib/sign-recognition/types";

interface WordPromptProps {
  word: string;
  tip: string;
  wordIndex: number;
  totalWords: number;
  hearts: number;
  maxHearts: number;
  practiceMode?: boolean;
  phase: "idle" | "recording" | "predicting" | "result";
  frameCount: number;
  connectionStatus: ConnectionStatus;
  onRecord: () => void;
  onDone: () => void;
}

export function WordPrompt({
  word,
  tip,
  wordIndex,
  totalWords,
  hearts,
  maxHearts,
  practiceMode = false,
  phase,
  frameCount,
  connectionStatus,
  onRecord,
  onDone,
}: WordPromptProps) {
  const isConnected = connectionStatus === "connected";

  return (
    <div className="flex flex-col gap-6">
      {/* Progress & Hearts */}
      <div className="flex items-center justify-between">
        {practiceMode ? (
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
            Practice — no hearts
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {Array.from({ length: maxHearts }).map((_, i) => (
              <span
                key={i}
                className={`text-xl transition-all duration-300 ${i < hearts ? "opacity-100" : "opacity-20 grayscale"}`}
              >
                ❤️
              </span>
            ))}
          </div>
        )}
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
          {wordIndex + 1} / {totalWords}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan-400 transition-all duration-500"
          style={{ width: `${((wordIndex) / totalWords) * 100}%` }}
        />
      </div>

      {/* Target word */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Sign this word</p>
        <p className="mt-4 text-6xl font-black tracking-tight text-white">{word}</p>
        {tip && (
          <p className="mt-4 text-sm leading-6 text-zinc-400">{tip}</p>
        )}
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${
            isConnected
              ? "bg-green-500/10 text-green-400"
              : "bg-amber-500/10 text-amber-400"
          }`}
        >
          {connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting…" : "Disconnected"}
        </span>

        {phase === "recording" && (
          <span className="animate-pulse rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-red-400">
            ● Recording — {frameCount} frames
          </span>
        )}

        {phase === "predicting" && (
          <span className="animate-pulse rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-400">
            Analysing…
          </span>
        )}
      </div>

      {/* Action button */}
      <div className="flex gap-3">
        {(phase === "idle" || phase === "result") && (
          <button
            type="button"
            onClick={onRecord}
            disabled={!isConnected}
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-cyan-300 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "result" ? "Try Again" : "Record"}
          </button>
        )}

        {phase === "recording" && (
          <button
            type="button"
            onClick={onDone}
            className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-zinc-100"
          >
            Done
          </button>
        )}

        {phase === "predicting" && (
          <div className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold uppercase tracking-[0.18em] text-zinc-400">
            Analysing…
          </div>
        )}
      </div>
    </div>
  );
}
