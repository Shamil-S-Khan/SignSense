"use client";

import { useEffect, useState, useRef } from "react";
import { useLocalPracticeStore } from "@/lib/practice/progress";
import { Flame, Award, Zap } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import confetti from "canvas-confetti";

// P0 — XP counter number animation via useMotionValue + useTransform (Framer Motion)
function AnimatedCounter({ value }: { value: number }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [value, count]);

  return <motion.span className="font-mono">{rounded}</motion.span>;
}

export function ProgressHeader() {
  const xp = useLocalPracticeStore((state) => state.xp);
  const streak = useLocalPracticeStore((state) => state.streak);

  // Compute level: every 100 XP is a level
  const currentLevel = Math.floor(xp / 100) + 1;
  const progressInLevel = xp % 100; // 0 to 99

  const [prevXp, setPrevXp] = useState(xp);
  const [prevLevel, setPrevLevel] = useState(currentLevel);
  const [xpIncrements, setXpIncrements] = useState<{ id: number; amount: number }[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [isLeftHanded, setIsLeftHanded] = useState(false);
  
  const incrementIdRef = useRef(0);

  // Handle Handedness Mirror Settings Toggle
  useEffect(() => {
    if (isLeftHanded) {
      document.body.classList.add("mirror-signs");
    } else {
      document.body.classList.remove("mirror-signs");
    }
  }, [isLeftHanded]);

  // Monitor XP changes for floating increments
  useEffect(() => {
    if (xp > prevXp) {
      const diff = xp - prevXp;
      const id = incrementIdRef.current++;
      setXpIncrements((prev) => [...prev, { id, amount: diff }]);
      
      // Auto-remove after animation
      setTimeout(() => {
        setXpIncrements((prev) => prev.filter((inc) => inc.id !== id));
      }, 1200);
    }
    setPrevXp(xp);
  }, [xp, prevXp]);

  // Monitor Level changes for full screen celebration
  useEffect(() => {
    if (currentLevel > prevLevel) {
      // Trigger level up!
      setShowLevelUp(true);
      
      // Fire confetti
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        // since particles fall down, animate a bit higher than random
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }
    setPrevLevel(currentLevel);
  }, [currentLevel, prevLevel]);

  // SVG parameters for progress ring
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressInLevel / 100) * circumference;

  return (
    <>
      <nav className="navbar-glass sticky top-0 z-30 py-3 select-none">
        <div className="page-container flex items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#4f8ef7] to-[#2b61b3] shadow-md shadow-[#4f8ef7]/15"
            >
              <span className="font-display text-lg font-black text-[#f0f2f8]">S</span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-[#f0f2f8]">
              SignSense
            </span>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-5">

            {/* Left/Right Hand Toggle Settings */}
            <button
              type="button"
              onClick={() => setIsLeftHanded(!isLeftHanded)}
              className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                isLeftHanded
                  ? "border-[#f7a84f]/40 bg-[#f7a84f]/10 text-[#f7a84f]"
                  : "border-[#22263a] bg-[#1a1d27] text-[#9ca3af]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {isLeftHanded ? "Left Handed" : "Right Handed"}
            </button>
            
            {/* XP Counter with floating increments */}
            <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1d27] border border-[#22263a]">
              <Zap className="h-4.5 w-4.5 text-[#4f8ef7] fill-[#4f8ef7]/20" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-[#6b7280]">XP Total</span>
                <span className="font-mono text-sm font-medium text-[#f0f2f8]">
                  <AnimatedCounter value={xp} />
                </span>
              </div>

              {/* Floating XP increments */}
              <AnimatePresence>
                {xpIncrements.map((inc) => (
                  <motion.div
                    key={inc.id}
                    initial={{ opacity: 1, y: 0, scale: 0.8 }}
                    animate={{ opacity: 0, y: -24, scale: 1.1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="absolute -top-6 right-2 text-xs font-bold text-[#3dd68c] font-mono"
                  >
                    +{inc.amount} XP
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Streak Counter */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1d27] border border-[#22263a]">
              <Flame className="h-4.5 w-4.5 text-[#f7a84f] fill-[#f7a84f]/20 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Streak</span>
                <span className="font-mono text-sm font-medium text-[#f7a84f]">{streak} days</span>
              </div>
            </div>

            {/* Level Badge and Progress Ring */}
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 flex items-center justify-center">
                {/* Progress Ring Background */}
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r={radius}
                    className="stroke-[#22263a]"
                    strokeWidth="3.5"
                    fill="transparent"
                  />
                  {/* Active Progress */}
                  <motion.circle
                    cx="20"
                    cy="20"
                    r={radius}
                    className="stroke-[#4f8ef7]"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <Award className="h-4.5 w-4.5 text-[#4f8ef7] relative z-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-[#6b7280]">Rank</span>
                <span className="text-sm font-semibold text-[#f0f2f8]">Lvl {currentLevel}</span>
              </div>
            </div>

          </div>

        </div>
      </nav>

      {/* Level Up Overlay Celebration */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f1117]/95 px-6"
          >
            <motion.div
              initial={{ scale: 0.7, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.7, y: 50 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="max-w-md text-center p-8 rounded-2xl bg-[#1a1d27] border border-[#22263a] shadow-2xl relative overflow-hidden"
            >
              {/* Radial gradient backing */}
              <div className="absolute -inset-10 bg-gradient-to-b from-[#4f8ef7]/10 to-transparent pointer-events-none rounded-full blur-3xl" />

              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-[#4f8ef7]/10 border border-[#4f8ef7]/20">
                  <Award className="h-10 w-10 text-[#f7a84f] fill-[#f7a84f]/10" />
                </div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#f7a84f]">Milestone unlocked</p>
              <h2 className="font-display mt-2 text-3xl font-bold text-[#f0f2f8]">Level Up!</h2>
              
              <p className="mt-4 text-sm leading-6 text-[#9ca3af]">
                Congratulations! You reached <span className="text-[#f0f2f8] font-bold">Level {currentLevel}</span>. Your grasp of visual grammar is strengthening!
              </p>

              <div className="mt-6 flex items-center justify-center gap-3">
                <span className="rounded-full bg-[#22263a] px-3 py-1 text-xs text-[#9ca3af] font-mono">
                  {xp} Total XP
                </span>
                <span className="rounded-full bg-[#4f8ef7]/10 border border-[#4f8ef7]/20 px-3 py-1 text-xs text-[#4f8ef7] font-semibold">
                  +100 XP Target
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowLevelUp(false)}
                className="mt-8 h-11 w-full bg-[#4f8ef7] text-[#f0f2f8] font-bold rounded-lg hover:bg-[#5fa0ff] active:bg-[#2b61b3] shadow-md transition-colors"
              >
                Continue Learning
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
