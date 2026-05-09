"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { RecognitionCamera } from "@/components/recognition/RecognitionCamera";
import { useVideoFrameCapture } from "@/hooks/useVideoFrameCapture";
import { useWebcam } from "@/hooks/useWebcam";
import { WLASL_LESSONS } from "@/lib/wlasl/lesson-data";

// All unique words across all 20 lessons, preserving lesson order
const ALL_WORDS = Array.from(
  new Set(WLASL_LESSONS.flatMap((l) => l.words)),
);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface ClipInfo {
  index: number;
  frames: number;
  recorded_at: string;
  path: string;
}

interface WordStats {
  word: string;
  total_clips: number;
  clips: ClipInfo[];
}

type Phase = "idle" | "recording" | "saving" | "saved" | "error";

export default function CollectPage() {
  const [selectedWord, setSelectedWord] = useState<string>(ALL_WORDS[0]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [frameCount, setFrameCount] = useState(0);
  const [lastSave, setLastSave] = useState<{ clipIndex: number; frames: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, number>>({});

  const framesRef = useRef<string[]>([]);
  const isRecordingRef = useRef(false);

  const { videoRef, isStreaming, error: cameraError, startCapture, stopCapture } = useWebcam();

  // Start webcam on mount
  useEffect(() => {
    startCapture(() => {});
    return () => stopCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Accumulate frames while recording
  useVideoFrameCapture({
    videoRef,
    enabled: phase === "recording",
    onFrame: useCallback((jpeg: string) => {
      if (!isRecordingRef.current) return;
      framesRef.current.push(jpeg);
      setFrameCount(framesRef.current.length);
    }, []),
  });

  // Fetch stats for all words on mount + after each save
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/data-collection/stats`);
      if (!res.ok) return;
      const data: WordStats[] = await res.json();
      const map: Record<string, number> = {};
      for (const s of data) map[s.word] = s.total_clips;
      setStatsMap(map);
    } catch {
      // backend may not be running — silently ignore
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const handleStartRecording = () => {
    framesRef.current = [];
    setFrameCount(0);
    setLastSave(null);
    setErrorMsg(null);
    isRecordingRef.current = true;
    setPhase("recording");
  };

  const handleStopRecording = async () => {
    isRecordingRef.current = false;
    const frames = [...framesRef.current];
    if (frames.length === 0) {
      setPhase("idle");
      return;
    }
    setPhase("saving");
    try {
      const res = await fetch(`${API_BASE}/api/data-collection/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: selectedWord, frames }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const data = await res.json() as { clip_index: number; frames_saved: number; total_clips: number };
      setLastSave({ clipIndex: data.clip_index, frames: data.frames_saved });
      setStatsMap((prev) => ({ ...prev, [selectedWord]: data.total_clips }));
      setPhase("saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const isConnectedToBackend = phase !== "error" && errorMsg === null;

  return (
    <main className="min-h-screen bg-[#0b0f13] px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400">
              Data Collection · Fine-tuning
            </p>
            <h1 className="mt-1 text-3xl font-black text-white">Record training clips</h1>
            <p className="mt-2 max-w-lg text-sm text-zinc-400">
              Record yourself signing each word. Clips are saved to{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 text-xs text-zinc-300">
                backend/training_data/
              </code>
              . Aim for <strong className="text-white">30+ clips per word</strong> for fine-tuning.
            </p>
          </div>
          <Link
            href="/skill-tree"
            className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300 hover:border-white/20 hover:text-white"
          >
            ← Back
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Camera */}
          <RecognitionCamera
            videoRef={videoRef}
            isStreaming={isStreaming}
            isRecording={phase === "recording"}
            cameraError={cameraError}
            connectionStatus="connected"
          />

          {/* Controls */}
          <div className="flex flex-col gap-5">
            {/* Word selector */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                Select word to record
              </p>
              <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                {ALL_WORDS.map((w) => {
                  const count = statsMap[w] ?? 0;
                  const isSelected = w === selectedWord;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        if (phase === "recording") return;
                        setSelectedWord(w);
                        setLastSave(null);
                        setPhase("idle");
                      }}
                      className={`relative rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                        isSelected
                          ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
                          : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                      }`}
                    >
                      {w}
                      {count > 0 && (
                        <span className="ml-1.5 rounded-full bg-green-500/30 px-1.5 py-0.5 text-[9px] font-black text-green-400">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected word + stats */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Now recording</p>
              <p className="mt-2 text-5xl font-black text-white">{selectedWord}</p>
              <p className="mt-2 text-sm text-zinc-500">
                {statsMap[selectedWord] ?? 0} clip{(statsMap[selectedWord] ?? 0) !== 1 ? "s" : ""} saved
                {(statsMap[selectedWord] ?? 0) >= 30 && (
                  <span className="ml-2 text-green-400">✓ Ready for fine-tuning</span>
                )}
              </p>
            </div>

            {/* Status / result */}
            {phase === "recording" && (
              <div className="flex items-center gap-3 rounded-xl bg-red-500/10 px-4 py-3">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-bold text-red-400">
                  Recording — {frameCount} frames captured
                </span>
              </div>
            )}
            {phase === "saving" && (
              <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-400">
                Saving {frameCount} frames…
              </div>
            )}
            {phase === "saved" && lastSave && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                ✓ Clip #{lastSave.clipIndex} saved ({lastSave.frames} frames)
              </div>
            )}
            {phase === "error" && errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                Error: {errorMsg}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {phase !== "recording" ? (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  disabled={!isStreaming}
                  className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-amber-400 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {phase === "saved" ? "Record Another" : "Start Recording"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStopRecording()}
                  className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-white text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-zinc-100"
                >
                  Done — Save Clip
                </button>
              )}
            </div>

            {/* Tip */}
            <p className="rounded-xl bg-white/[0.02] px-4 py-3 text-xs leading-5 text-zinc-500">
              <span className="font-bold text-zinc-400">Tips:</span> Sign clearly, keep your upper body in frame.
              Vary your angle and lighting slightly across clips. Each clip is ~2–4 s of signing (50–100 frames at 25 fps).
            </p>
          </div>
        </div>

        {/* Per-word progress table */}
        {Object.keys(statsMap).length > 0 && (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="mb-4 text-lg font-black text-white">Collected so far</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Object.entries(statsMap)
                .sort((a, b) => b[1] - a[1])
                .map(([word, count]) => (
                  <div
                    key={word}
                    className="flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{word}</span>
                    <span
                      className={`mt-1 text-2xl font-black ${
                        count >= 30 ? "text-green-400" : count >= 10 ? "text-amber-400" : "text-white"
                      }`}
                    >
                      {count}
                    </span>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          count >= 30 ? "bg-green-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.min((count / 30) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="mt-1 text-[9px] text-zinc-600">{Math.min(count, 30)}/30</span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}