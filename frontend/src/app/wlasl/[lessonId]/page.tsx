"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { RecognitionCamera } from "@/components/recognition/RecognitionCamera";
import { ResultsScreen } from "@/components/lesson/ResultsScreen";
import { WordPrompt } from "@/components/wlasl/WordPrompt";
import { WordResult } from "@/components/wlasl/WordResult";
import { useWLASLLesson, type WLASLLessonResult } from "@/hooks/useWLASLLesson";
import { getWLASLLessonById, WORD_TIPS } from "@/lib/wlasl/lesson-data";
import { useWLASLProgressStore } from "@/lib/wlasl/progress";

const MAX_HEARTS = 3;
const XP_PER_WORD = 15;

export default function WLASLLessonPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";

  // ?mode=practice disables hearts and skips progress saving
  const isPracticeMode = searchParams.get("mode") === "practice";

  const lesson = getWLASLLessonById(lessonId);

  const { markWordDone, markLessonComplete } = useWLASLProgressStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [successCount, setSuccessCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [pendingResult, setPendingResult] = useState<WLASLLessonResult | null>(null);

  const targetWord = lesson?.words[currentIndex] ?? "";

  const onSuccess = useCallback((result: WLASLLessonResult) => { setPendingResult(result); }, []);
  const onFailure = useCallback((result: WLASLLessonResult) => { setPendingResult(result); }, []);

  const { videoRef, isStreaming, cameraError, connectionStatus, phase, frameCount, startRecording, stopRecording, reset } =
    useWLASLLesson({ targetWord, onSuccess, onFailure });

  const handleContinue = useCallback(() => {
    if (!lesson) return;

    if (!isPracticeMode) {
      markWordDone(targetWord, XP_PER_WORD);
    }
    const nextSuccessCount = successCount + 1;
    setSuccessCount(nextSuccessCount);
    setPendingResult(null);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= lesson.words.length) {
      if (!isPracticeMode) markLessonComplete(lesson.id);
      setShowResults(true);
    } else {
      setCurrentIndex(nextIndex);
      reset();
    }
  }, [lesson, targetWord, successCount, currentIndex, isPracticeMode, markWordDone, markLessonComplete, reset]);

  // In practice mode: wrong answer just moves on (no heart lost), user can also retry
  const handleRetry = useCallback(() => {
    if (!isPracticeMode) {
      const newHearts = Math.max(0, hearts - 1);
      setHearts(newHearts);
      if (newHearts === 0) {
        setCurrentIndex(0);
        setHearts(MAX_HEARTS);
        setSuccessCount(0);
      }
    }
    setPendingResult(null);
    reset();
  }, [hearts, isPracticeMode, reset]);

  // Practice mode "skip" — move to next word without counting as success
  const handleSkip = useCallback(() => {
    if (!lesson) return;
    setPendingResult(null);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= lesson.words.length) {
      setShowResults(true);
    } else {
      setCurrentIndex(nextIndex);
      reset();
    }
  }, [lesson, currentIndex, reset]);

  if (!lesson) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#b985e8]">
        <div className="text-center">
          <p className="text-white/80">Lesson not found.</p>
          <button
            type="button"
            onClick={() => router.push("/skill-tree")}
            className="mt-4 rounded-full px-6 py-3 text-sm font-bold text-white hover:opacity-90"
            style={{ background: "#1cb0f6", boxShadow: "0 4px 0 #0a9de0" }}
          >
            Back to Skill Tree
          </button>
        </div>
      </main>
    );
  }

  if (showResults) {
    const accuracy = Math.round((successCount / lesson.words.length) * 100);
    return (
      <ResultsScreen
        xpEarned={isPracticeMode ? 0 : successCount * XP_PER_WORD}
        accuracy={accuracy}
      />
    );
  }

  const tip = WORD_TIPS[targetWord] ?? "";

  return (
    <main className="min-h-screen bg-[#b985e8] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/skill-tree")}
            className="rounded-full border border-white/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white hover:bg-white/20"
          >
            ← Back
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
              {lesson.category} · {lessonId.replace("wlasl-", "Lesson ")}
              {isPracticeMode && (
                <span className="ml-2 rounded-full bg-white/30 px-2 py-0.5 text-white">
                  Practice Mode
                </span>
              )}
            </p>
            <h1 className="text-2xl font-black text-white">{lesson.title}</h1>
          </div>
        </header>

        {/* Two-column layout: camera left, controls right */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Camera */}
          <RecognitionCamera
            videoRef={videoRef}
            isStreaming={isStreaming}
            isRecording={phase === "recording"}
            cameraError={cameraError}
            connectionStatus={connectionStatus}
          />

          {/* Controls */}
          <div className="flex flex-col gap-6">
            {pendingResult ? (
              <WordResult
                targetWord={targetWord}
                result={pendingResult.raw}
                matched={pendingResult.matched}
                practiceMode={isPracticeMode}
                onContinue={handleContinue}
                onRetry={handleRetry}
                onSkip={handleSkip}
              />
            ) : (
              <WordPrompt
                word={targetWord}
                tip={tip}
                wordIndex={currentIndex}
                totalWords={lesson.words.length}
                hearts={hearts}
                maxHearts={MAX_HEARTS}
                practiceMode={isPracticeMode}
                phase={phase}
                frameCount={frameCount}
                connectionStatus={connectionStatus}
                onRecord={startRecording}
                onDone={stopRecording}
              />
            )}

            {/* Word list preview */}
            <div className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-md">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#b0b0b0]">
                Lesson words
              </p>
              <div className="flex flex-wrap gap-2">
                {lesson.words.map((w, i) => (
                  <span
                    key={w}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                      i < currentIndex
                        ? "bg-[#edffd6] text-[#45a301]"
                        : i === currentIndex
                          ? "bg-[#e8f9ff] text-[#1cb0f6] ring-1 ring-[#1cb0f6]/40"
                          : "bg-[#f5f5f5] text-[#b0b0b0]"
                    }`}
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
