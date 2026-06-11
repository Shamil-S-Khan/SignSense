"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import Link from "next/link";

interface Props {
  xpEarned: number;
  accuracy: number;
}

export function ResultsScreen({ xpEarned, accuracy }: Props) {
  useEffect(() => {
    const duration = 3500;
    const animationEnd = Date.now() + duration;
    const colors = ["#1cb0f6", "#58cc02", "#ffc800", "#ff4b8c", "#ce82ff"];

    const frame = () => {
      confetti({ particleCount: 7, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, scalar: 1.2 });
      confetti({ particleCount: 7, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, scalar: 1.2 });
      if (Date.now() < animationEnd) requestAnimationFrame(frame);
    };
    frame();

    confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 }, colors, scalar: 1.4, startVelocity: 35 });
  }, []);

  const grade = accuracy >= 90 ? "S" : accuracy >= 75 ? "A" : accuracy >= 60 ? "B" : "C";
  const gradeColor =
    grade === "S" ? "text-gradient-gold" :
    grade === "A" ? "text-gradient-cyan" :
    grade === "B" ? "text-gradient-emerald" : "text-[#b0b0b0]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#080C14] px-4">
      {/* Radial background glow */}
      <div className="absolute -inset-10 bg-gradient-to-b from-[#4f8ef7]/10 to-transparent pointer-events-none rounded-full blur-3xl" />

      <motion.div
        initial={{ scale: 0.82, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-sm"
      >
        {/* Trophy */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
          className="mb-6 text-center"
        >
          <span className="animate-float inline-block text-7xl leading-none">&#127942;</span>
        </motion.div>

        <div className="rounded-3xl bg-[#0f1623] border-2 border-[#22263a] p-8 text-center shadow-2xl relative overflow-hidden">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.28em] text-[#3dd68c]">
            Lesson complete
          </p>
          <h1 className="font-display text-4xl font-extrabold text-[#f0f2f8]">
            Well done!
          </h1>

          {/* Grade badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.35 }}
            className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#f7a84f] bg-[#f7a84f]/15"
          >
            <span className={`font-display text-5xl font-black ${gradeColor}`}>{grade}</span>
          </motion.div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border-2 border-[#4f8ef7]/35 bg-[#4f8ef7]/10 p-4"
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4f8ef7]">XP Earned</p>
              <p className="font-display text-3xl font-black text-[#f0f2f8]">+{xpEarned}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl border-2 border-[#3dd68c]/35 bg-[#3dd68c]/10 p-4"
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#3dd68c]">Accuracy</p>
              <p className="font-display text-3xl font-black text-[#f0f2f8]">{accuracy}%</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6"
          >
            <Link
              href="/skill-tree"
              className="w-full btn-blue h-12 flex items-center justify-center text-sm font-extrabold uppercase tracking-widest rounded-2xl"
            >
              Back to Skill Tree
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
