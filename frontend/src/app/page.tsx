"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { SignReference } from "@/components/lesson/SignReference";
import { ScoreBars } from "@/components/lesson/ScoreBars";
import { WebcamFeed } from "@/components/webcam/WebcamFeed";
import { smoothDetections, shouldAllowSuccess, type DetectionSample, type ScoreBreakdown } from "@/lib/practice/feedback";
import { ALL_REFERENCE_LETTERS, LESSONS, isGuidedOnlyLetter } from "@/lib/practice/lesson-data";
import { useLocalPracticeStore } from "@/lib/practice/progress";
import type { VADState, WorkerMetrics } from "@/workers/mediapipe.types";

const INITIAL_SCORES: ScoreBreakdown = { handshape: 0, movement: 0, orientation: 0 };
const INITIAL_METRICS: WorkerMetrics = { fps: 0, latencyMs: 0, droppedFrames: 0 };

const MARQUEE_LETTERS = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z".split(" ");

export default function Home() {
  const [targetIndex, setTargetIndex] = useState(0);
  const [scores, setScores] = useState<ScoreBreakdown>(INITIAL_SCORES);
  const [lastDetection, setLastDetection] = useState<{ sign: string; confidence: number } | null>(null);
  const [feedback, setFeedback] = useState("Start the camera and match the target handshape. Guided letters use the reference card only.");
  const [overlayMessage, setOverlayMessage] = useState<string | null>(null);
  const [overlayTone, setOverlayTone] = useState<"success" | "guided" | "neutral">("neutral");
  const [vadState, setVadState] = useState<VADState>("IDLE");
  const [metrics, setMetrics] = useState<WorkerMetrics>(INITIAL_METRICS);
  const [segmentCount, setSegmentCount] = useState(0);
  const [xpBurst, setXpBurst] = useState<number | null>(null);
  const [isCorrectFlash, setIsCorrectFlash] = useState(false);

  const detectionHistoryRef = useRef<DetectionSample[]>([]);
  const lastSuccessAtRef = useRef<number | null>(null);

  const xp = useLocalPracticeStore((state) => state.xp);
  const streak = useLocalPracticeStore((state) => state.streak);
  const completedLetters = useLocalPracticeStore((state) => state.completedLetters);
  const recentSessionStats = useLocalPracticeStore((state) => state.recentSessionStats);
  const awardLetterSuccess = useLocalPracticeStore((state) => state.awardLetterSuccess);

  const target = ALL_REFERENCE_LETTERS[targetIndex] ?? "A";
  const isGuided = isGuidedOnlyLetter(target);
  const completedCount = completedLetters.length;
  const nextLesson = LESSONS.find((lesson) => !lesson.letters.every((letter) => completedLetters.includes(letter))) ?? LESSONS[0];

  const cycleToNextTarget = () => {
    setTargetIndex((current) => (current + 1) % ALL_REFERENCE_LETTERS.length);
    setScores(INITIAL_SCORES);
    setLastDetection(null);
    detectionHistoryRef.current = [];
    setTimeout(() => {
      const nextTarget = ALL_REFERENCE_LETTERS[(targetIndex + 1) % ALL_REFERENCE_LETTERS.length] ?? "A";
      setFeedback(`Next target: ${nextTarget}. Hold steady for a stable read.`);
    }, 0);
  };

  const triggerSuccess = (matchedLetter: string, accuracy: number) => {
    lastSuccessAtRef.current = performance.now();
    awardLetterSuccess({ letter: matchedLetter, accuracy });
    setXpBurst(10);
    setIsCorrectFlash(true);
    setOverlayTone("success");
    setOverlayMessage("Correct");
    setFeedback(`Clean match for ${matchedLetter}. +10 XP`);

    window.setTimeout(() => setXpBurst(null), 900);
    window.setTimeout(() => setOverlayMessage(null), 800);
    window.setTimeout(() => setIsCorrectFlash(false), 950);
    window.setTimeout(() => cycleToNextTarget(), 1050);
  };

  const handleDetection = (sign: string, confidence: number, detailScores: ScoreBreakdown) => {
    setLastDetection({ sign, confidence });
    setScores(detailScores);

    detectionHistoryRef.current = [...detectionHistoryRef.current.slice(-2), { sign, confidence, scores: detailScores }];
    const smoothed = smoothDetections(detectionHistoryRef.current);
    if (!smoothed) {
      if (confidence >= 0.35) {
        setFeedback(`Detected ${sign}. Hold the pose a little steadier if you're aiming for ${target}.`);
      }
      return;
    }

    if (smoothed.sign !== target) {
      setFeedback(`Stable read is ${smoothed.sign}. Adjust toward ${target}.`);
      return;
    }

    const averageAccuracy = Math.round((smoothed.scores.handshape + smoothed.scores.movement + smoothed.scores.orientation) / 3);
    if (smoothed.confidence >= 0.45 && shouldAllowSuccess(lastSuccessAtRef.current, performance.now())) {
      triggerSuccess(target, averageAccuracy);
    }
  };

  const handleGuidedPractice = () => {
    setOverlayTone("guided");
    setOverlayMessage("Guided");
    setFeedback(`Marked ${target} as guided practice. Follow the reference motion, then move on.`);
    triggerSuccess(target, 88);
  };

  return (
    <div className="min-h-screen bg-[#b985e8] text-[#3c3c3c]">

      {/* Sticky Navbar */}
      <nav className="navbar-glass sticky top-0 z-30 py-2">
        <div className="page-container flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #1cb0f6, #0a9de0)" }}
            >
              <span className="text-sm font-black text-white">S</span>
            </div>
            <span className="font-display text-base font-bold tracking-tight text-white">
              SignSense
            </span>
          </div>

          {/* HUD stats – visible md+ */}
          <div className="hidden items-center gap-2 md:flex">
            <HudStat icon="&#x26a1;" label="XP" value={xp} color="cyan" />
            <HudStat icon="&#x1f525;" label="Streak" value={streak} color="amber" />
            <HudStat icon="&#x1f3af;" label="Letters" value={`${completedCount}/26`} color="emerald" />
            <HudStat icon="&#x1f4e1;" label="Segments" value={segmentCount} color="violet" />
          </div>

          <Link
            href="/skill-tree"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border-0 bg-white px-4 text-xs font-bold uppercase tracking-[0.16em] text-[#1cb0f6] transition hover:opacity-90"
          >
            Skill Tree &#x2192;
          </Link>
        </div>
      </nav>

      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="relative overflow-hidden border-b border-white/[0.15] px-4 pb-10 pt-10 md:px-8">

        {/* Marquee letter strip */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden opacity-[0.10] select-none">
          <div className="animate-marquee flex whitespace-nowrap" style={{ width: "200%" }}>
            {[...MARQUEE_LETTERS, ...MARQUEE_LETTERS].map((l, i) => (
              <span
                key={i}
                className="font-display mr-10 text-[10rem] font-black leading-none text-white"
              >
                {l}
              </span>
            ))}
          </div>
        </div>


        <div className="page-container relative">
          <div className="max-w-xl">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">
              American Sign Language
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] text-white md:text-6xl">
              Learn ASL,{" "}
              <span style={{ color: "#ffc800" }}>the fun way</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/75">
              Practice every letter of the alphabet with your webcam. Earn XP, keep streaks, and unlock structured lessons &#x2014; all locally, no account needed.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/skill-tree"
                className="inline-flex h-12 items-center gap-2 px-6 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:opacity-90"
                style={{ background: "#1cb0f6", boxShadow: "0 4px 0 #0a9de0", borderRadius: "9999px" }}
              >
                Open Skill Tree
              </Link>
              <a
                href="#practice"
                className="inline-flex h-12 items-center rounded-full border border-white/30 bg-white/25 px-6 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-white/30"
              >
                Free Practice &#x2193;
              </a>
            </div>
          </div>

          {/* Mobile HUD stats */}
          <div className="mt-6 flex flex-wrap gap-2 md:hidden">
            <HudStat icon="&#x26a1;" label="XP" value={xp} color="cyan" />
            <HudStat icon="&#x1f525;" label="Streak" value={streak} color="amber" />
            <HudStat icon="&#x1f3af;" label="Letters" value={`${completedCount}/26`} color="emerald" />
            <HudStat icon="&#x1f4e1;" label="Segments" value={segmentCount} color="violet" />
          </div>
        </div>
      </section>

      {/* â”€â”€ Practice Area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* Practice Area */}
      <section id="practice" className="page-container py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
          <WebcamFeed
            disablePose
            overlayMessage={overlayMessage}
            overlayTone={overlayTone}
            onSignDetected={handleDetection}
            onSignSegment={() => setSegmentCount((count) => count + 1)}
            onStatusChange={({ vadState: nextVadState, metrics: nextMetrics }) => {
              setVadState(nextVadState);
              setMetrics(nextMetrics);
            }}
          />

          {/* Sidebar – right 40%, scrollable */}
          <aside className="flex flex-col gap-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
            {/* Target card */}
            <section
              className={`relative overflow-hidden rounded-3xl border p-5 transition-all duration-300 ${
                isCorrectFlash
                  ? "ring-2 ring-[#58cc02] bg-[#edffd6]/20 border-[#58cc02]/50"
                  : "border-[#e5e5e5] bg-white shadow-md"
              }`}
            >
              {/* XP burst */}
              {xpBurst !== null && (
                <div
                  className="pointer-events-none absolute right-5 top-4 z-10 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white"
                  style={{
                    background: "#58cc02",
                    animation: "xp-burst 0.9s ease forwards",
                  }}
                >
                  +{xpBurst} XP
                </div>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b0b0b0]">Target letter</p>
                  <div
                    className="font-display mt-2 font-black leading-none"
                    style={{
                      fontSize: "7rem",
                      color: "#3c3c3c",
                      WebkitTextFillColor: "#3c3c3c",
                      textShadow: isCorrectFlash ? "0 0 30px rgba(52,211,153,0.5)" : "none",
                    }}
                  >
                    {target}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                        isGuided
                          ? "bg-[#fff9e0] text-[#ff9600]"
                          : "bg-[#e8f9ff] text-[#1cb0f6]"
                      }`}
                    >
                      {isGuided ? "✋ Guided only" : "\ud83d\udc4d Live detection"}
                    </span>
                    <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b0b0b0]">
                      {vadState}
                    </span>
                  </div>
                </div>

                <SignReference sign={target} isHighlighted={isCorrectFlash} caption={isGuided ? "Follow motion" : "Match this"} />
              </div>

              {/* Letter grid */}
              <div className="mt-5 grid grid-cols-5 gap-1.5">
                {ALL_REFERENCE_LETTERS.map((sign, index) => (
                  <button
                    key={sign}
                    type="button"
                    onClick={() => {
                      setTargetIndex(index);
                      setScores(INITIAL_SCORES);
                      setLastDetection(null);
                      detectionHistoryRef.current = [];
                      setFeedback(`${sign} is loaded. Match the reference card.`);
                    }}
                    className={`h-10 rounded-xl border text-sm font-black transition-all duration-150 ${
                      sign === target
                        ? "border-[#1cb0f6] bg-[#e8f9ff] text-[#1cb0f6] shadow-[0_0_8px_rgba(28,176,246,0.2)]"
                        : completedLetters.includes(sign)
                          ? "border-[#58cc02]/40 bg-[#edffd6] text-[#45a301]"
                          : "border-[#e5e5e5] bg-[#f5f5f5] text-[#777777] hover:border-[#cccccc] hover:bg-[#eeeeee]"
                    }`}
                  >
                    {sign}
                  </button>
                ))}
              </div>

              {isGuided ? (
                <button
                  type="button"
                  onClick={handleGuidedPractice}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center text-sm font-black uppercase tracking-[0.16em] text-white transition hover:opacity-90"
                  style={{ background: "#ff9600", boxShadow: "0 4px 0 #cc7800", borderRadius: "9999px" }}
                >
                  &#x2705; Mark Guided Practice
                </button>
              ) : null}
            </section>

            {/* Feedback */}
            <section className="rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b0b0b0]">Live feedback</p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-[#777777]">{feedback}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat label="Detected" value={lastDetection?.sign ?? "\u2013"} />
                <MiniStat label="Confidence" value={lastDetection ? `${Math.round(lastDetection.confidence * 100)}%` : "\u2013"} />
              </div>
            </section>

            <ScoreBars handshapeScore={scores.handshape} movementScore={scores.movement} orientationScore={scores.orientation} />

            {/* Next lesson */}
            <section className="rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b0b0b0]">Next lesson</p>
                  <h2 className="font-display mt-2 text-xl font-bold text-[#3c3c3c]">{nextLesson.title}</h2>
                </div>
                <Link
                  href="/skill-tree"
                  className="inline-flex h-10 shrink-0 items-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 text-xs font-bold uppercase tracking-[0.14em] text-[#777777] transition hover:bg-[#eeeeee]"
                >
                  Open tree
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {nextLesson.letters.map((letter) => (
                  <div key={letter} className="rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] p-3">
                    <SignReference sign={letter} caption={isGuidedOnlyLetter(letter) ? "Guided" : "Detectable"} />
                  </div>
                ))}
              </div>
            </section>

            {/* Performance */}
            <section className="grid grid-cols-3 gap-2 rounded-3xl border border-[#e5e5e5] bg-white p-4 shadow-md">
              <MiniStat label="FPS" value={metrics.fps || "\u2013"} muted={!metrics.fps} />
              <MiniStat label="Latency" value={metrics.latencyMs ? `${metrics.latencyMs}ms` : "\u2013"} muted={!metrics.latencyMs} />
              <MiniStat label="Dropped" value={metrics.droppedFrames} />
            </section>

            {/* Recent */}
            <section className="rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b0b0b0]">Recent wins</p>
              <div className="mt-3 space-y-1.5">
                {recentSessionStats.slice(0, 4).map((entry) => (
                  <div
                    key={`${entry.completedAt}-${entry.letter}`}
                    className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2 text-sm"
                  >
                    <span className="font-black text-[#3c3c3c]">{entry.letter}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        entry.accuracy >= 90
                          ? "bg-[#edffd6] text-[#45a301]"
                          : entry.accuracy >= 80
                            ? "bg-[#fff9e0] text-[#ff9600]"
                            : "text-[#b0b0b0]"
                      }`}
                    >
                      {entry.accuracy}%
                    </span>
                  </div>
                ))}
                {recentSessionStats.length === 0 ? (
                  <p className="text-sm text-[#b0b0b0]">Your recent wins will show up here.</p>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}

function HudStat({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: "cyan" | "amber" | "emerald" | "violet";
}) {
  const colorMap = {
    cyan:    "border-[#1cb0f6]/30 bg-[#e8f9ff] text-[#0a9de0]",
    amber:   "border-[#ffc800]/30 bg-[#fff9e0] text-[#ff9600]",
    emerald: "border-[#58cc02]/30 bg-[#edffd6] text-[#45a301]",
    violet:  "border-[#ce82ff]/30 bg-[#f5e8ff] text-[#a855f7]",
  };
  return (
    <div className={`min-w-[86px] rounded-2xl border bg-white px-3 py-2.5 shadow-sm ${colorMap[color]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{icon} {label}</p>
      <p className="font-display mt-1 text-xl font-black text-[#3c3c3c]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#b0b0b0]">{label}</p>
      <p className={`mt-0.5 text-base font-black ${muted ? "text-[#b0b0b0]" : "text-[#3c3c3c]"}`}>{value}</p>
    </div>
  );
}

