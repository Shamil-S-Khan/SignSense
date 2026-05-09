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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#b985e8] px-4">

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

        <div className="rounded-3xl bg-white p-8 text-center shadow-2xl">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.28em] text-[#58cc02]">
            Lesson complete
          </p>
          <h1 className="font-display text-4xl font-extrabold text-[#3c3c3c]">
            Well done!
          </h1>

          {/* Grade badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.35 }}
            className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#ffc800] bg-[#fff9e0]"
          >
            <span className={`font-display text-5xl font-black ${gradeColor}`}>{grade}</span>
          </motion.div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-[#1cb0f6]/20 bg-[#e8f9ff] p-4"
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1cb0f6]">XP Earned</p>
              <p className="font-display text-3xl font-black text-[#3c3c3c]">+{xpEarned}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl border border-[#58cc02]/20 bg-[#edffd6] p-4"
            >
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#45a301]">Accuracy</p>
              <p className="font-display text-3xl font-black text-[#3c3c3c]">{accuracy}%</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-5"
          >
            <Link
              href="/skill-tree"
              className="block w-full py-4 text-base font-black uppercase tracking-[0.14em] text-white transition hover:opacity-90"
              style={{ background: "#1cb0f6", boxShadow: "0 4px 0 #0a9de0", borderRadius: "9999px" }}
            >
              Back to Skill Tree
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
