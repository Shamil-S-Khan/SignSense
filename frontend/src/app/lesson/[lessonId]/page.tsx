"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Star, Heart, Volume2, VolumeX, Sparkles, ArrowLeft } from "lucide-react";
import { animate } from "animejs";

import { ScoreBars } from "@/components/lesson/ScoreBars";
import { SignReference } from "@/components/lesson/SignReference";
import { WebcamFeed } from "@/components/webcam/WebcamFeed";
import { smoothDetections, shouldAllowSuccess, type DetectionSample, type ScoreBreakdown } from "@/lib/practice/feedback";
import { getLessonById, isGuidedOnlyLetter } from "@/lib/practice/lesson-data";
import { useLocalPracticeStore } from "@/lib/practice/progress";
import { audioManager } from "@/lib/audioManager";
import type { VADState, WorkerMetrics } from "@/workers/mediapipe.types";

const INITIAL_SCORES: ScoreBreakdown = { handshape: 0, movement: 0, orientation: 0 };
const INITIAL_METRICS: WorkerMetrics = { fps: 0, latencyMs: 0, droppedFrames: 0 };

export default function LessonPage() {
  const params = useParams<{ lessonId: string }>();
  const router = useRouter();
  const lesson = getLessonById(params.lessonId);

  // Core execution states
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState<ScoreBreakdown>(INITIAL_SCORES);
  const [feedback, setFeedback] = useState("Position your hand in frame to detect sign.");
  const [_lastDetection, setLastDetection] = useState<{ sign: string; confidence: number } | null>(null);
  const [successfulLetters, setSuccessfulLetters] = useState<string[]>([]);
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([]);

  // Camera Metrics tracking
  const [metrics, setMetrics] = useState<WorkerMetrics>(INITIAL_METRICS);
  const [cameraActive, setCameraActive] = useState(false);
  const [_vadState, setVadState] = useState<VADState>("IDLE");

  // Visual Feedbacks
  const [borderFlash, setBorderFlash] = useState<"success" | "danger" | null>(null);
  const cameraShakeControls = useAnimation();
  const [burstParticles, setBurstParticles] = useState<{ id: number; x: number; y: number; color: string; angle: number; speed: number }[]>([]);

  // Sound/Music state
  const [isMuted, setIsMuted] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.2);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Victory screen overlay
  const [showVictory, setShowVictory] = useState(false);
  const victoryCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiParticlesRef = useRef<{ x: number; y: number; size: number; speedY: number; speedX: number; rot: number; rotSpeed: number; color: string; shape: "diamond" | "star" }[]>([]);
  const [victoryTimeTaken, setVictoryTimeTaken] = useState("0:00");
  const lessonStartTimeRef = useRef<number>(0);

  // Wipe transitions
  const [startWipe, setStartWipe] = useState(false);

  // Session stats tracking
  const [sessionXpEarned, setSessionXpEarned] = useState(0);

  const detectionHistoryRef = useRef<DetectionSample[]>([]);
  const lastSuccessAtRef = useRef<number | null>(null);
  const lastPenaltyAtRef = useRef<number | null>(null);

  // Zustand Store integrations
  const heartsRemaining = useLocalPracticeStore((state) => state.heartsRemaining);
  const startLesson = useLocalPracticeStore((state) => state.startLesson);
  const loseHeart = useLocalPracticeStore((state) => state.loseHeart);
  const setHeartsRemaining = useLocalPracticeStore((state) => state.setHeartsRemaining);
  const awardLetterSuccess = useLocalPracticeStore((state) => state.awardLetterSuccess);
  const markLessonComplete = useLocalPracticeStore((state) => state.markLessonComplete);

  // Initialize Audio settings
  useEffect(() => {
    setIsMuted(audioManager.getMute());
    setBgmVolume(audioManager.getBgmVolume());
    audioManager.startBgm();
  }, []);

  const handleMuteToggle = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioManager.setMute(nextMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setBgmVolume(vol);
    audioManager.setBgmVolume(vol);
  };

  // Initialize Lesson setup
  useEffect(() => {
    if (!lesson) return;
    startLesson(lesson.id);
    setSuccessfulLetters([]);
    setAccuracyHistory([]);
    setCurrentIndex(0);
    setScores(INITIAL_SCORES);
    setSessionXpEarned(0);
    lessonStartTimeRef.current = Date.now();
    setFeedback(`Lesson ${lesson.title} initialized. Start by signing: ${lesson.letters[0]}`);
  }, [lesson, startLesson]);

  // Handle Heart Outages
  useEffect(() => {
    if (!lesson) return;
    if (heartsRemaining === 0) {
      setHeartsRemaining(5);
      setCurrentIndex(0);
      setSuccessfulLetters([]);
      setAccuracyHistory([]);
      setSessionXpEarned(0);
      setFeedback("Hearts refilled! Try spelling this sequence again.");
      detectionHistoryRef.current = [];
      setScores(INITIAL_SCORES);
      lessonStartTimeRef.current = Date.now();
    }
  }, [heartsRemaining, lesson, setHeartsRemaining]);

  if (!lesson) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080C14] px-4 font-body">
        <section className="w-full max-w-lg rounded-2xl bg-[#0F1623] border border-[#141E2E] p-8 text-center shadow-xl">
          <p className="text-[10px] font-display font-black uppercase tracking-widest text-[#EF4444]">Error</p>
          <h1 className="mt-3 text-3xl font-display font-black text-[#F0F4FF]">Missing Lesson ID</h1>
          <p className="mt-4 text-xs text-[#64748B] leading-relaxed">
            The requested lesson is not part of the active sign recognition curriculum.
          </p>
          <Link
            href="/skill-tree"
            className="mt-6 inline-flex h-11 items-center px-6 rounded-xl bg-[#00D4FF] hover:bg-[#00B4DF] text-[#080C14] font-display font-black text-xs uppercase tracking-wider transition-colors"
          >
            Return to tree
          </Link>
        </section>
      </main>
    );
  }

  const currentLetter = lesson.letters[currentIndex] ?? lesson.letters[0];
  const isGuided = isGuidedOnlyLetter(currentLetter);
  const completionPercent = Math.round((successfulLetters.length / lesson.letters.length) * 100);

  // Victory Confetti Canvas particle update loop (Anime.js controlled)
  const runVictoryConfetti = () => {
    const canvas = victoryCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#00D4FF", "#7C3AED", "#22C55E", "#F59E0B", "#EF4444"];
    const particles = Array.from({ length: 110 }).map(() => ({
      x: Math.random() * canvas.width,
      y: -50 - Math.random() * 200,
      size: Math.random() * 8 + 4,
      speedY: Math.random() * 3 + 2,
      speedX: (Math.random() - 0.5) * 1.5,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 4,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      shape: Math.random() > 0.4 ? ("diamond" as const) : ("star" as const),
    }));

    confettiParticlesRef.current = particles;

    const dummy = { t: 0 };
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const anim = animate(dummy, {
      t: 100,
      duration: 100000,
      loop: true,
      ease: "linear",
      onUpdate: () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confettiParticlesRef.current.forEach((p) => {
          if (!isReduced) {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rot += p.rotSpeed;

            if (p.y > canvas.height) {
              p.y = -30;
              p.x = Math.random() * canvas.width;
            }
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 4;

          if (p.shape === "diamond") {
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.lineTo(p.size * 0.6, 0);
            ctx.lineTo(0, p.size);
            ctx.lineTo(-p.size * 0.6, 0);
            ctx.closePath();
            ctx.fill();
          } else {
            // Star shape
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              ctx.lineTo(
                Math.cos(((18 + i * 72) * Math.PI) / 180) * p.size,
                Math.sin(((18 + i * 72) * Math.PI) / 180) * p.size
              );
              ctx.lineTo(
                Math.cos(((54 + i * 72) * Math.PI) / 180) * (p.size * 0.4),
                Math.sin(((54 + i * 72) * Math.PI) / 180) * (p.size * 0.4)
              );
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        });
      },
    });

    return anim;
  };

  // Launch Victory Fanfare overlay
  const triggerVictory = (_averageAccuracy: number) => {
    const elapsedMs = Date.now() - lessonStartTimeRef.current;
    const mins = Math.floor(elapsedMs / 60000);
    const secs = Math.floor((elapsedMs % 60000) / 1000);
    setVictoryTimeTaken(`${mins}:${secs.toString().padStart(2, "0")}`);

    // BGM Fade out and fanfare play
    audioManager.fadeBgmOut(0.5);
    audioManager.playFanfare();

    setShowVictory(true);

    setTimeout(() => {
      runVictoryConfetti();
    }, 100);
  };

  // Move target indices on correct classification
  const finishLetter = (accuracy: number) => {
    const completedLetter = currentLetter;
    
    // Add success reward
    awardLetterSuccess({ letter: completedLetter, lessonId: lesson.id, xpDelta: 15, accuracy });
    setSuccessfulLetters((current) => (current.includes(completedLetter) ? current : [...current, completedLetter]));
    setAccuracyHistory((current) => [...current, accuracy]);
    setSessionXpEarned((prev) => prev + 15);

    // Reset scores & historical buffer
    setScores(INITIAL_SCORES);
    setLastDetection(null);
    detectionHistoryRef.current = [];

    // Trigger visual flash
    setBorderFlash("success");
    audioManager.playCorrect();

    // Spawn green particle stars burst
    const idSeed = Date.now();
    const dots = Array.from({ length: 18 }).map((_, idx) => ({
      id: idSeed + idx,
      x: 0,
      y: 0,
      color: "#22C55E",
      angle: (idx / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      speed: Math.random() * 8 + 6,
    }));
    setBurstParticles((prev) => [...prev, ...dots]);
    setTimeout(() => setBurstParticles([]), 800);
    setTimeout(() => setBorderFlash(null), 300);

    // Slide Next Lesson Node target
    if (currentIndex === lesson.letters.length - 1) {
      // Completed curriculum!
      markLessonComplete(lesson.id);
      setTimeout(() => {
        const averageAccuracy =
          accuracyHistory.length > 0 ? Math.round(accuracyHistory.reduce((s, v) => s + v, 0) / accuracyHistory.length) : accuracy;
        triggerVictory(averageAccuracy);
      }, 700);
      return;
    }

    setTimeout(() => {
      setCurrentIndex((current) => current + 1);
      setFeedback(`Next target sign loaded: ${lesson.letters[currentIndex + 1]}`);
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
      setFeedback(`Correct hold for ${currentLetter}!`);
      finishLetter(Math.round((smoothed.scores.handshape + smoothed.scores.movement + smoothed.scores.orientation) / 3));
      return;
    }

    // Trigger heart loss if wrong sign is held stable for too long
    if (
      smoothed.sign !== currentLetter &&
      smoothed.confidence >= 0.6 &&
      shouldAllowSuccess(lastPenaltyAtRef.current, performance.now(), 2000)
    ) {
      lastPenaltyAtRef.current = performance.now();
      triggerFailure();
    }
  };

  // Visual and audio indicators for wrong signs
  const triggerFailure = () => {
    loseHeart();
    audioManager.playWrong();
    setBorderFlash("danger");
    setFeedback(`Adjust hand orientation. Target remains: ${currentLetter}`);

    // Camera viewport shake animation
    cameraShakeControls.start({
      x: [0, -8, 8, -8, 8, 0],
      transition: { duration: 0.35, ease: "easeInOut" },
    });

    setTimeout(() => {
      setBorderFlash(null);
    }, 350);
  };

  const handleGuidedContinue = () => {
    setFeedback(`Guided sign matched.`);
    finishLetter(85); // default accuracy
  };

  // Continue Wipe Sweep navigation back to map
  const handleContinueAndReturn = () => {
    setStartWipe(true);
    setTimeout(() => {
      audioManager.fadeBgmIn(0.5);
      router.push("/skill-tree");
    }, 600);
  };

  return (
    <main className="min-h-screen bg-[#080C14] px-4 py-5 text-[#F0F4FF] md:px-8 select-none font-body relative overflow-hidden flex flex-col justify-between">
      
      {/* Wipe sweeping transition overlay */}
      {startWipe && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed inset-0 z-50 bg-[#00D4FF]"
        />
      )}

      {/* TOP HUD ROW */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between shrink-0 bg-[#0F1623] border border-[#141E2E] rounded-2xl p-4 shadow-lg mb-4">
        
        {/* Left Side: Back / Unit */}
        <div className="flex items-center gap-3">
          <Link
            href="/skill-tree"
            onClick={() => audioManager.fadeBgmIn(0.5)}
            className="h-9 w-9 rounded-lg bg-[#080C14] hover:bg-[#141E2E] flex items-center justify-center border border-[#141E2E] text-[#64748B] hover:text-[#00D4FF] transition-colors"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div>
            <span className="text-[8px] font-display font-black uppercase tracking-wider text-[#64748B]">
              ASL Curriculum
            </span>
            <h1 className="text-xs font-display font-black text-[#F0F4FF] tracking-tight mt-0.5">
              {lesson.title}
            </h1>
          </div>
        </div>

        {/* Center: hearts */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#080C14] rounded-full border border-[#141E2E]">
          {Array.from({ length: 5 }).map((_, idx) => (
            <motion.div
              key={idx}
              animate={idx === heartsRemaining ? { scale: [1, 1.3, 1] } : {}}
              className="relative"
            >
              <Heart
                className={`h-4 w-4 ${
                  idx < heartsRemaining ? "text-red-500 fill-red-500" : "text-[#141E2E] fill-[#141E2E]"
                }`}
              />
            </motion.div>
          ))}
        </div>

        {/* Right Side: XP Accumulator */}
        <div className="flex items-center gap-3">
          
          {/* Volume control */}
          <div className="flex items-center gap-2 relative">
            <AnimatePresence>
              {showVolumeSlider && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center bg-[#080C14] border border-[#141E2E] px-2.5 py-1 rounded-md shadow-md"
                >
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={bgmVolume}
                    onChange={handleVolumeChange}
                    className="w-16 accent-[#00D4FF] cursor-pointer h-1 rounded-full"
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={handleMuteToggle}
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setTimeout(() => setShowVolumeSlider(false), 3000)}
              className="h-8 w-8 rounded-lg bg-[#080C14] hover:bg-[#141E2E] flex items-center justify-center border border-[#141E2E] text-[#64748B]"
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4 text-[#00D4FF]" />}
            </button>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-[#080C14] rounded-full border border-[#141E2E]">
            <Sparkles className="h-3.5 w-3.5 text-[#00D4FF]" />
            <span className="font-mono text-xs font-bold text-[#F0F4FF]">
              {sessionXpEarned} <span className="text-[9px] text-[#64748B] uppercase">XP</span>
            </span>
          </div>
        </div>

      </header>

      {/* CORE SPLIT INTERFACE */}
      <section className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 min-h-0 overflow-hidden">
        
        {/* LEFT ZONE: Camera feed HUD & Accuracy Bars */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
          
          {/* Cyber webcam Frame with angled clip-path */}
          <motion.div
            animate={cameraShakeControls}
            className="shrink-0 relative overflow-hidden shadow-2xl border-4 bg-[#080C14] transition-all duration-300"
            style={{
              borderColor: borderFlash === "success" ? "#22C55E" : borderFlash === "danger" ? "#EF4444" : "#141E2E",
              clipPath: "polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)",
              boxShadow: borderFlash === "success" ? "0 0 20px rgba(34, 197, 94, 0.4)" : borderFlash === "danger" ? "0 0 20px rgba(239, 68, 68, 0.4)" : "none",
            }}
          >
            <WebcamFeed
              disablePose={false}
              onSignDetected={isGuided ? undefined : handleDetection}
              onStatusChange={({ vadState: state, metrics: met, cameraActive: active }) => {
                setVadState(state);
                setMetrics(met);
                setCameraActive(active);
              }}
            />

            {/* Custom Cyber HUD metrics strip overlay */}
            <div className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-[#0F1623e6] border border-[#141E2E] px-3 py-1 rounded-md backdrop-blur-md">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  cameraActive ? "bg-emerald-500 animate-pulse" : "bg-[#64748B]"
                }`}
              />
              <span className="font-display font-black text-[9px] uppercase tracking-widest text-[#F0F4FF]">
                {cameraActive ? "TRACKING ACTIVE" : "CAMERA READY"}
              </span>
              <span className="text-[#64748B] text-[9px] font-mono">|</span>
              <span className="font-mono text-[9px] text-[#64748B]">
                FPS: <span className="text-[#F0F4FF] font-bold">{metrics.fps || "—"}</span>
              </span>
              <span className="font-mono text-[9px] text-[#64748B] ml-1">
                LAT: <span className="text-[#F0F4FF] font-bold">{metrics.latencyMs ? `${metrics.latencyMs}ms` : "—"}</span>
              </span>
            </div>

            {/* Particles emitter canvas */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {burstParticles.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute h-3.5 w-3.5 rotate-45"
                  style={{
                    backgroundColor: p.color,
                    left: "50%",
                    top: "50%",
                    marginLeft: "-7px",
                    marginTop: "-7px",
                    boxShadow: `0 0 10px ${p.color}`,
                  }}
                  initial={{ x: 0, y: 0, scale: 1.2, opacity: 1 }}
                  animate={{
                    x: Math.cos(p.angle) * 160,
                    y: Math.sin(p.angle) * 160,
                    scale: 0.1,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.75, ease: "easeOut" }}
                />
              ))}
            </div>

          </motion.div>

          {/* Thick accuracy progress bars */}
          <div className="shrink-0">
            <ScoreBars
              handshapeScore={scores.handshape}
              movementScore={scores.movement}
              orientationScore={scores.orientation}
            />
          </div>

        </div>

        {/* RIGHT ZONE: Target description card & tactile button */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
          
          {/* Target Card */}
          <section className="bg-[#0F1623] border border-[#141E2E] rounded-2xl p-6 shadow-xl flex-1 flex flex-col justify-between min-h-[300px]">
            
            {/* Top Info */}
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-display font-black uppercase tracking-widest text-[#64748B]">
                    TARGET SIGN
                  </span>
                  <h2 className="font-display text-4xl font-black text-[#F0F4FF] mt-1.5 tracking-wide">
                    {currentLetter}
                  </h2>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`h-4.5 w-4.5 ${
                        idx < lesson.difficulty ? "text-[#F59E0B] fill-[#F59E0B]" : "text-[#141E2E]"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Dynamic Demonstration Illustration */}
              <div className="mt-6 flex justify-center bg-[#080C14] border border-[#141E2E] rounded-xl p-4 relative overflow-hidden h-40">
                <SignReference
                  sign={currentLetter}
                  isHighlighted={borderFlash === "success"}
                  caption="Sign Reference Model"
                />
              </div>

              <div className="mt-4 p-3.5 bg-[#080C14]/50 border border-[#141E2E] rounded-xl">
                <p className="text-xs text-[#64748B] leading-relaxed">
                  {isGuided
                    ? "Guided demonstration sign. Mimic the visual posture and tap validation when complete."
                    : "Stable webcam classifier requires aligned hand shapes. Hold posture to verify."}
                </p>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-4 pt-4 border-t border-[#141E2E]/50">
              
              <div className="flex justify-between text-xs text-[#64748B]">
                <span>Lesson Progress</span>
                <span className="font-mono text-[#F0F4FF] font-bold">
                  {successfulLetters.length} / {lesson.letters.length} Completed
                </span>
              </div>
              
              {/* Progress Rail */}
              <div className="h-2 w-full bg-[#080C14] border border-[#141E2E] rounded-full overflow-hidden p-0.5">
                <motion.div
                  animate={{ width: `${completionPercent}%` }}
                  className="h-full rounded-full bg-[#22C55E]"
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>

              {/* Confirm / Camera Status button */}
              {isGuided ? (
                <div className="relative pt-2">
                  <div className="absolute inset-x-0 bottom-0 top-2 bg-[#B45309] rounded-xl z-0" />
                  <motion.button
                    type="button"
                    whileTap={{ y: 4 }}
                    onClick={handleGuidedContinue}
                    className="w-full h-11 relative z-10 rounded-xl font-display font-black text-xs uppercase tracking-widest text-[#080C14] flex items-center justify-center border-none"
                    style={{
                      background: "linear-gradient(90deg, #F59E0B, #D97706)",
                      boxShadow: "0 4px 0 #92400E",
                    }}
                  >
                    ✓ Confirm Guided Sign
                  </motion.button>
                </div>
              ) : (
                <div
                  className="flex items-center justify-center gap-3 h-11 rounded-xl border px-4"
                  style={{
                    background: cameraActive ? "rgba(34,197,94,0.08)" : "rgba(100,116,139,0.06)",
                    borderColor: cameraActive ? "rgba(34,197,94,0.3)" : "#141E2E",
                  }}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${cameraActive ? "bg-emerald-500 animate-pulse" : "bg-[#64748B]"}`}
                  />
                  <span
                    className="text-xs font-display font-black uppercase tracking-widest"
                    style={{ color: cameraActive ? "#22C55E" : "#64748B" }}
                  >
                    {cameraActive ? "Hold the sign — detecting…" : "Point camera at your hand"}
                  </span>
                </div>
              )}

            </div>

          </section>

          {/* Feedback bar */}
          <section className="bg-[#0F1623] border border-[#141E2E] rounded-2xl p-4 shadow-xl">
            <span className="text-[8px] font-display font-black uppercase tracking-widest text-[#64748B] block mb-1">
              STATUS LOG
            </span>
            <p className="text-xs text-[#F0F4FF] font-medium leading-relaxed">
              {feedback}
            </p>
          </section>

        </div>

      </section>

      {/* FULL SCREEN VICTORY SCREEN OVERLAY */}
      <AnimatePresence>
        {showVictory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#080C14]/98 flex flex-col items-center justify-center p-6"
          >
            {/* Drifting Confetti Canvas */}
            <canvas ref={victoryCanvasRef} className="absolute inset-0 pointer-events-none z-0" />

            <motion.div
              initial={{ scale: 0.82, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-full max-w-md bg-[#0F1623] border border-[#141E2E] rounded-3xl p-8 shadow-2xl relative text-center z-10"
            >
              <span className="text-[9px] font-display font-black uppercase tracking-widest text-[#22C55E]">
                LESSON COMPLETED
              </span>
              <h2 className="text-3xl font-display font-black text-[#F0F4FF] mt-2">
                VICTORY!
              </h2>

              {/* Glowing star SVGs in center */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.1, 1] }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.25 }}
                className="my-6 flex justify-center filter drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]"
              >
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <polygon
                    points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36"
                    fill="#F59E0B"
                    stroke="#FFD700"
                    strokeWidth="4"
                    className="w-24 h-24"
                  />
                  <div className="absolute inset-0 flex items-center justify-center pb-2">
                    <span className="text-3xl">🏆</span>
                  </div>
                </div>
              </motion.div>

              <h4 className="text-sm font-display font-black text-[#F0F4FF] tracking-tight mb-4">
                {lesson.title} Mastered
              </h4>

              {/* Stats block */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-[#080C14] border border-[#141E2E] p-3 rounded-xl">
                  <span className="text-[8px] font-display font-black uppercase tracking-wider text-[#64748B]">
                    XP EARNED
                  </span>
                  <p className="font-mono text-xl font-bold text-[#FFD700] mt-1">
                    +{sessionXpEarned}
                  </p>
                </div>

                <div className="bg-[#080C14] border border-[#141E2E] p-3 rounded-xl">
                  <span className="text-[8px] font-display font-black uppercase tracking-wider text-[#64748B]">
                    ACCURACY
                  </span>
                  <p className="font-mono text-xl font-bold text-[#22C55E] mt-1">
                    {accuracyHistory.length > 0
                      ? Math.round(accuracyHistory.reduce((s, v) => s + v, 0) / accuracyHistory.length)
                      : 85}%
                  </p>
                </div>

                <div className="bg-[#080C14] border border-[#141E2E] p-3 rounded-xl">
                  <span className="text-[8px] font-display font-black uppercase tracking-wider text-[#64748B]">
                    TIME TAKEN
                  </span>
                  <p className="font-mono text-xl font-bold text-[#00D4FF] mt-1">
                    {victoryTimeTaken}
                  </p>
                </div>
              </div>

              {/* Tactile Arcade Continue button */}
              <div className="relative pt-2">
                <div className="absolute inset-x-0 bottom-0 top-2 bg-[#1B8A5A] rounded-xl z-0" />
                <motion.button
                  type="button"
                  whileTap={{ y: 4 }}
                  onClick={handleContinueAndReturn}
                  className="w-full h-11 relative z-10 rounded-xl font-display font-black text-xs uppercase tracking-widest text-[#080C14] flex items-center justify-center border-none shadow-[0_4px_0_#156E47]"
                  style={{
                    background: "linear-gradient(90deg, #22C55E, #10B981)",
                  }}
                >
                  Continue
                </motion.button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}
