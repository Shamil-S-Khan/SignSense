"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ResultsScreen } from "@/components/lesson/ResultsScreen";
import { ScoreBars } from "@/components/lesson/ScoreBars";
import { SignReference } from "@/components/lesson/SignReference";
import { HeartBar } from "@/components/ui/HeartBar";
import { WebcamFeed } from "@/components/webcam/WebcamFeed";
import { smoothDetections, shouldAllowSuccess, type DetectionSample, type ScoreBreakdown } from "@/lib/practice/feedback";
import { getLessonById, isGuidedOnlyLetter } from "@/lib/practice/lesson-data";
import { useLocalPracticeStore } from "@/lib/practice/progress";

const INITIAL_SCORES: ScoreBreakdown = { handshape: 0, movement: 0, orientation: 0 };

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const lesson = getLessonById(params.lessonId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<ScoreBreakdown>(INITIAL_SCORES);
  const [feedback, setFeedback] = useState("Hold the target shape until the read stabilizes.");
  const [lastDetection, setLastDetection] = useState<{ sign: string; confidence: number } | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<string | null>(null);
  const [overlayTone, setOverlayTone] = useState<"success" | "guided" | "neutral">("neutral");
  const [successfulLetters, setSuccessfulLetters] = useState<string[]>([]);
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  const detectionHistoryRef = useRef<DetectionSample[]>([]);
  const lastSuccessAtRef = useRef<number | null>(null);
  const lastPenaltyAtRef = useRef<number | null>(null);

  const heartsRemaining = useLocalPracticeStore((state) => state.heartsRemaining);
  const startLesson = useLocalPracticeStore((state) => state.startLesson);
  const loseHeart = useLocalPracticeStore((state) => state.loseHeart);
  const setHeartsRemaining = useLocalPracticeStore((state) => state.setHeartsRemaining);
  const awardLetterSuccess = useLocalPracticeStore((state) => state.awardLetterSuccess);
  const markLessonComplete = useLocalPracticeStore((state) => state.markLessonComplete);

  useEffect(() => {
    if (!lesson) return;
    startLesson(lesson.id);
    setSuccessfulLetters([]);
    setAccuracyHistory([]);
    setCurrentIndex(0);
    setScores(INITIAL_SCORES);
    setFeedback(`Lesson ${lesson.title} loaded. Start with ${lesson.letters[0]}.`);
  }, [lesson, startLesson]);

  useEffect(() => {
    if (!lesson) return;
    if (heartsRemaining === 0) {
      setHeartsRemaining(5);
      setCurrentIndex(0);
      setSuccessfulLetters([]);
      setAccuracyHistory([]);
      setFeedback("Hearts reset. Take another run through the lesson.");
      detectionHistoryRef.current = [];
      setScores(INITIAL_SCORES);
    }
  }, [heartsRemaining, lesson, setHeartsRemaining]);

  if (!lesson) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#b985e8] px-4">
        <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1cb0f6]">Missing lesson</p>
          <h1 className="mt-3 text-3xl font-black text-[#3c3c3c]">{params.lessonId}</h1>
          <p className="mt-4 text-sm leading-6 text-[#777777]">That lesson is not part of the local curriculum.</p>
          <Link href="/skill-tree" className="mt-6 inline-flex h-11 items-center px-5 text-sm font-bold text-white hover:opacity-90"
            style={{ background: "#1cb0f6", boxShadow: "0 4px 0 #0a9de0", borderRadius: "9999px" }}>
            Back to tree
          </Link>
        </section>
      </main>
    );
  }

  const currentLetter = lesson.letters[currentIndex] ?? lesson.letters[0];
  const isGuided = isGuidedOnlyLetter(currentLetter);
  const completionPercent = Math.round((successfulLetters.length / lesson.letters.length) * 100);

  const finishLetter = (accuracy: number) => {
    const completedLetter = currentLetter;
    awardLetterSuccess({ letter: completedLetter, lessonId: lesson.id, xpDelta: 12, accuracy });
    setSuccessfulLetters((current) => (current.includes(completedLetter) ? current : [...current, completedLetter]));
    setAccuracyHistory((current) => [...current, accuracy]);
    setScores(INITIAL_SCORES);
    setLastDetection(null);
    detectionHistoryRef.current = [];

    if (currentIndex === lesson.letters.length - 1) {
      markLessonComplete(lesson.id);
      setTimeout(() => setShowResults(true), 900);
      return;
    }

    window.setTimeout(() => {
      setCurrentIndex((current) => current + 1);
      setFeedback(`Next up: ${lesson.letters[currentIndex + 1]}.`);
      setOverlayMessage(null);
    }, 1000);
  };

  const handleDetection = (sign: string, confidence: number, detailScores: ScoreBreakdown) => {
    setLastDetection({ sign, confidence });
    setScores(detailScores);

    detectionHistoryRef.current = [...detectionHistoryRef.current.slice(-2), { sign, confidence, scores: detailScores }];
    const smoothed = smoothDetections(detectionHistoryRef.current);
    if (!smoothed) return;

    if (smoothed.sign === currentLetter && smoothed.confidence >= 0.45 && shouldAllowSuccess(lastSuccessAtRef.current, performance.now())) {
      lastSuccessAtRef.current = performance.now();
      setOverlayTone("success");
      setOverlayMessage("Correct");
      setFeedback(`${currentLetter} is locked in. Great hold.`);
      finishLetter(Math.round((smoothed.scores.handshape + smoothed.scores.movement + smoothed.scores.orientation) / 3));
      return;
    }

    if (smoothed.sign !== currentLetter && smoothed.confidence >= 0.6 && shouldAllowSuccess(lastPenaltyAtRef.current, performance.now(), 1300)) {
      lastPenaltyAtRef.current = performance.now();
      loseHeart();
      setFeedback(`Stable read is ${smoothed.sign}. Reset and try ${currentLetter} again.`);
    }
  };

  const handleGuidedContinue = () => {
    setOverlayTone("guided");
    setOverlayMessage("Guided");
    setFeedback(`${currentLetter} is guided. Copy the motion and continue.`);
    finishLetter(88);
  };

  if (showResults) {
    const averageAccuracy =
      accuracyHistory.length > 0 ? Math.round(accuracyHistory.reduce((sum, value) => sum + value, 0) / accuracyHistory.length) : 0;
    return <ResultsScreen xpEarned={lesson.letters.length * 12} accuracy={averageAccuracy} />;
  }

  return (
    <main className="min-h-screen bg-[#b985e8] px-4 py-5 text-[#3c3c3c] md:px-8">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5">

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="relative overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Link href="/skill-tree" className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b0b0b0] transition hover:text-[#777777]">
                  Skill Tree
                </Link>
                <span className="text-[#d0d0d0]">/</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1cb0f6]">Lesson</span>
              </div>
              <h1 className="font-display text-3xl font-extrabold text-[#3c3c3c] md:text-4xl">{lesson.title}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <HeartBar hearts={heartsRemaining} />

              {/* Segmented progress rail */}
              <div className="flex items-center gap-1">
                {lesson.letters.map((letter) => {
                  const done = successfulLetters.includes(letter);
                  const active = letter === currentLetter && !done;
                  return (
                    <div
                      key={letter}
                      className={`h-2 w-6 rounded-full transition-all duration-300 ${
                        done
                          ? "bg-[#58cc02]"
                          : active
                            ? "animate-ring-pulse bg-[#ff4b8c]"
                            : "bg-[#e5e5e5]"
                      }`}
                      title={letter}
                    />
                  );
                })}
              </div>
              <span className="text-[11px] font-black text-[#b0b0b0]">{completionPercent}%</span>

              <Link
                href="/skill-tree"
                className="inline-flex h-10 items-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#777777] transition hover:bg-[#eeeeee]"
              >
                ← Tree
              </Link>
            </div>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          <WebcamFeed disablePose overlayMessage={overlayMessage} overlayTone={overlayTone} onSignDetected={isGuided ? undefined : handleDetection} />

          <aside className="flex flex-col gap-4">
            {/* Prompt card */}
            <section className="rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b0b0b0]">Prompt</p>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <div
                    className="font-display mt-2 font-black leading-none"
                    style={{
                      fontSize: "7rem",
                      color: "#3c3c3c",
                      WebkitTextFillColor: "#3c3c3c",
                      textShadow: overlayMessage === "Correct" ? "0 0 30px rgba(52,211,153,0.6)" : undefined,
                    }}
                  >
                    {currentLetter}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#777777]">
                    {isGuided
                      ? "Guided letter — follow the reference image and mark when ready."
                      : "Hold the shape until the read stabilizes. A correct match advances automatically."}
                  </p>
                </div>
                <SignReference sign={currentLetter} isHighlighted={overlayMessage === "Correct"} caption={isGuided ? "Guided" : "Match this"} />
              </div>

              {isGuided ? (
                <button
                  type="button"
                  onClick={handleGuidedContinue}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center text-sm font-black uppercase tracking-[0.16em] text-white transition hover:opacity-90"
                  style={{ background: "#ff9600", boxShadow: "0 4px 0 #cc7800", borderRadius: "9999px" }}
                >
                  ✅ Mark Guided Practice
                </button>
              ) : null}
            </section>

            {/* Lesson path */}
            <section className="rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b0b0b0]">Lesson path</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {lesson.letters.map((letter, index) => {
                  const completed = successfulLetters.includes(letter);
                  const active = index === currentIndex;

                  return (
                    <div
                      key={letter}
                      className={`relative overflow-hidden rounded-2xl border p-3 text-center transition-all duration-200 ${
                        completed
                          ? "border-[#58cc02]/30 bg-[#edffd6]"
                          : active
                            ? "border-[#ff4b8c]/40 bg-[#ffe8f2]"
                            : "border-[#e5e5e5] bg-[#f5f5f5]"
                      }`}
                    >
                      <p className="font-display relative text-2xl font-black text-[#3c3c3c]">{letter}</p>
                      <p
                        className={`relative mt-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                          completed ? "text-[#45a301]" : active ? "text-[#ff4b8c]" : "text-[#b0b0b0]"
                        }`}
                      >
                        {completed ? "✓ Done" : active ? "Now" : isGuidedOnlyLetter(letter) ? "Guided" : "Queued"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Feedback */}
            <section className="rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b0b0b0]">Feedback</p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-[#777777]">{feedback}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#b0b0b0]">Detected</p>
                  <p className="mt-0.5 text-base font-black text-[#3c3c3c]">{lastDetection?.sign ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#b0b0b0]">Confidence</p>
                  <p className="mt-0.5 text-base font-black text-[#3c3c3c]">{lastDetection ? `${Math.round(lastDetection.confidence * 100)}%` : "—"}</p>
                </div>
              </div>
            </section>

            <ScoreBars handshapeScore={scores.handshape} movementScore={scores.movement} orientationScore={scores.orientation} />
          </aside>
        </section>
      </div>
    </main>
  );
}
