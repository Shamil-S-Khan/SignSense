"use client";

import type { RecognitionResult } from "@/lib/sign-recognition/types";

interface WordResultProps {
  targetWord: string;
  result: RecognitionResult;
  matched: boolean;
  practiceMode?: boolean;
  onContinue: () => void;
  onRetry: () => void;
  onSkip?: () => void;
}

export function WordResult({ targetWord, result, matched, practiceMode = false, onContinue, onRetry, onSkip }: WordResultProps) {
  const top = result.predictions[0];
  const rest = result.predictions.slice(1);

  return (
    <div
      className={`animate-slide-up-fade flex flex-col gap-5 rounded-[var(--radius-card)] border p-7 ${
        matched
          ? "border-[#58cc02]/30 bg-[#edffd6]"
          : "border-[#ff4b8c]/30 bg-[#ffe8f2]"
      }`}
    >
      {/* Result header */}
      <div className="flex items-start gap-4">
        <span className="text-4xl">{matched ? "✅" : "❌"}</span>
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-[0.2em] ${
              matched ? "text-[#45a301]" : "text-[#e0306e]"
            }`}
          >
            {matched ? "Great job!" : "Not quite"}
          </p>
          <p className="mt-1 text-2xl font-black text-[#3c3c3c]">
            You signed: {top.label}
          </p>
          {!matched && (
            <p className="mt-1 text-sm text-[#777777]">
              Target was{" "}
              <span className="font-bold text-[#3c3c3c]">{targetWord}</span>
            </p>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-[#777777]">
          <span className="font-semibold uppercase tracking-widest">{top.label}</span>
          <span>{(top.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/60">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              matched ? "animate-bar-pulse bg-[#58cc02]" : "bg-[#ff4b8c]"
            }`}
            style={{ width: `${Math.min(top.confidence * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Runner-up predictions */}
      {rest.length > 0 && (
        <div className="border-t border-dotted border-[#cccccc] pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#b0b0b0]">
            Also detected
          </p>
          <div className="flex flex-col gap-1">
            {rest.map((p) => (
              <div key={p.label} className="flex items-center justify-between gap-3">
                <span className="truncate text-[11px] text-[#999999]">{p.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[#b0b0b0]">
                  {(p.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timing */}
      <p className="text-[11px] text-[#b0b0b0]">
        {result.framesReceived} frames &middot; inference {result.inferenceMs.toFixed(0)} ms
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        {matched ? (
          <button
            type="button"
            onClick={onContinue}
            className="group flex h-14 flex-1 items-center justify-center gap-2 rounded-[var(--radius-btn)] text-sm font-black uppercase tracking-[0.18em] text-white transition hover:opacity-90 active:translate-y-0.5"
            style={{ background: "#58cc02", boxShadow: "0 4px 0 #45a301" }}
          >
            Continue
            <span className="group-hover:animate-arrow-bounce inline-block">&#x2192;</span>
          </button>
        ) : practiceMode ? (
          <>
            <button
              type="button"
              onClick={onRetry}
              className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] border border-[#e5e5e5] bg-white text-sm font-black uppercase tracking-[0.18em] text-[#3c3c3c] transition hover:bg-[#f5f5f5]"
            >
              Try Again
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="flex h-12 items-center justify-center rounded-[var(--radius-btn)] border border-[#ce82ff]/40 bg-[#f5e8ff] px-5 text-sm font-bold uppercase tracking-[0.16em] text-[#a855f7] transition hover:bg-[#ede0ff]"
              >
                Skip &#x2192;
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] border border-[#e5e5e5] bg-white text-sm font-black uppercase tracking-[0.18em] text-[#3c3c3c] transition hover:bg-[#f5f5f5]"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
