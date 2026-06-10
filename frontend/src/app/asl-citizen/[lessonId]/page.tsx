"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { ASLCitizenCamera } from "@/components/recognition/ASLCitizenCamera";
import { ResultsScreen } from "@/components/lesson/ResultsScreen";
import { WordPrompt } from "@/components/wlasl/WordPrompt";
import { WordResult } from "@/components/wlasl/WordResult";
import { useASLCitizenLesson, type ASLCitizenLessonResult } from "@/hooks/useASLCitizenLesson";
import { getASLCitizenLessonById, ASL_CITIZEN_WORD_TIPS } from "@/lib/asl-citizen/lesson-data";
import { useASLCitizenProgressStore } from "@/lib/asl-citizen/progress";

const MAX_HEARTS = 3;
const XP_PER_WORD = 15;

export default function ASLCitizenLessonPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";

  // ?mode=practice disables hearts and skips progress saving
  const isPracticeMode = searchParams.get("mode") === "practice";

  const lesson = getASLCitizenLessonById(lessonId);

  const { markWordDone, markLessonComplete } = useASLCitizenProgressStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [successCount, setSuccessCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [pendingResult, setPendingResult] = useState<ASLCitizenLessonResult | null>(null);

  const targetWord = lesson?.words[currentIndex] ?? "";

  const onSuccess = useCallback((result: ASLCitizenLessonResult) => { setPendingResult(result); }, []);
  const onFailure = useCallback((result: ASLCitizenLessonResult) => { setPendingResult(result); }, []);

  const {
    videoRef,
    isStreaming,
    cameraError,
    workerError,
    isWorkerReady,
    connectionStatus,
    phase,
    frameCount,
    rawHandsRef,
    landmarksRef,
    startRecording,
    stopRecording,
    reset,
    isHandsFree,
    setIsHandsFree,
    liveGuess,
  } = useASLCitizenLesson({ targetWord, onSuccess, onFailure });

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

  // Auto-advance in hands-free mode when there is a successful match
  useEffect(() => {
    if (!isHandsFree || !pendingResult || !pendingResult.matched) return;

    const timer = setTimeout(() => {
      handleContinue();
    }, 1500); // 1.5s delay so the user has time to see "Correct!" feedback

    return () => clearTimeout(timer);
  }, [isHandsFree, pendingResult, handleContinue]);

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

  const tip = ASL_CITIZEN_WORD_TIPS[targetWord] ?? "";

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
              {lesson.category} · {lessonId.replace("asl-citizen-", "ASL Citizen Lesson ")}
              {isPracticeMode && (
                <span className="ml-2 rounded-full bg-white/30 px-2 py-0.5 text-white text-[10px]">
                  Practice Mode
                </span>
              )}
            </p>
            <h1 className="text-2xl font-black text-white">{lesson.title}</h1>
          </div>
        </header>

        {/* Two-column layout: camera left, controls right */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Camera with real-time skeleton overlay */}
          <ASLCitizenCamera
            videoRef={videoRef}
            isStreaming={isStreaming}
            isRecording={phase === "recording"}
            cameraError={cameraError}
            workerError={workerError}
            isWorkerReady={isWorkerReady}
            connectionStatus={connectionStatus}
            rawHandsRef={rawHandsRef}
            landmarksRef={landmarksRef}
            isHandsFree={isHandsFree}
          />

          {/* Controls */}
          <div className="flex flex-col gap-6">
            
            {/* Hands-free Mode Toggle Switch */}
            <div className="flex items-center justify-between rounded-2xl border border-[#e5e5e5] bg-white p-4 shadow-md">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#3c3c3c]">Hands-free Auto-Detect</h3>
                <p className="text-[10px] text-[#777777] font-medium">Scanner triggers predictions automatically</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setIsHandsFree(!isHandsFree);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  isHandsFree ? "bg-[#58cc02]" : "bg-[#ccc]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    isHandsFree ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

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
            ) : isHandsFree ? (
              /* Live scanning prompt panel for Hands-free mode */
              <div className="flex flex-col gap-4 rounded-3xl border border-[#e5e5e5] bg-white p-6 shadow-md text-center">
                {/* Lesson progress & Hearts */}
                <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#b0b0b0]">
                    Word {currentIndex + 1} of {lesson.words.length}
                  </span>
                  {!isPracticeMode && (
                    <div className="flex gap-1">
                      {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                        <span key={i} className="text-sm">
                          {i < hearts ? "❤️" : "🖤"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Target Word */}
                <div className="my-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b0b0b0] mb-1">
                    Sign this word
                  </p>
                  <h2 className="text-4xl font-black uppercase tracking-wider text-[#1cb0f6] animate-pulse">
                    {targetWord}
                  </h2>
                </div>

                {/* Scanner Status & Live Feedback */}
                <div className="rounded-2xl bg-[#f8fafc] border border-[#e2e8f0] p-4 min-h-[110px] flex flex-col justify-center items-center">
                  {!isStreaming ? (
                    <p className="text-xs font-bold text-[#b0b0b0] uppercase tracking-wider">Camera is starting...</p>
                  ) : !isWorkerReady || frameCount < 40 ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                      <p className="text-[10px] font-bold text-[#b0b0b0] uppercase tracking-wider">
                        Calibrating skeleton ({frameCount}/40 frames)
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">
                          Active Auto-Scanner
                        </p>
                      </div>
                      
                      {liveGuess ? (
                        <div className="mt-2 flex flex-col items-center">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Live Prediction</p>
                          <p className="text-lg font-black text-[#a855f7] uppercase leading-tight">
                            {liveGuess.label}
                          </p>
                          <p className="text-[10px] font-bold text-[#a855f7]/85">
                            {Math.round(liveGuess.confidence * 100)}% match
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] font-semibold text-[#b0b0b0] italic mt-1">
                          Perform gesture to trigger match...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Tips */}
                {tip && (
                  <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 text-left">
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a855f7] block mb-1">
                      Signing Tip
                    </span>
                    <p className="text-xs leading-relaxed text-purple-900 font-medium">{tip}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Manual Prompt */
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
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b0b0b0]">
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
