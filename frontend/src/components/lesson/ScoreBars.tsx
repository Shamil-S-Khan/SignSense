"use client";

import React, { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import { audioManager } from "@/lib/audioManager";

interface Props {
  handshapeScore: number;
  movementScore: number;
  orientationScore: number;
}

const BAR_ICONS: Record<string, string> = {
  Handshape: "✋",
  Movement: "👈",
  Orientation: "🧭",
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const prevScoreRef = useRef(score);
  const controls = useAnimation();

  const pct = Math.min(100, Math.max(0, score));

  // Trigger flash and tick sound on hitting 100%
  useEffect(() => {
    if (pct >= 100 && prevScoreRef.current < 100) {
      audioManager.playTick();
      // Row flash animation
      controls.start({
        backgroundColor: ["rgba(34, 197, 94, 0.4)", "rgba(255, 255, 255, 0.8)", "rgba(15, 22, 35, 0)"],
        transition: { duration: 0.5, ease: "easeOut" }
      });
    }
    prevScoreRef.current = pct;
  }, [pct, controls]);

  return (
    <motion.div
      animate={controls}
      className="p-2.5 rounded-xl border border-transparent transition-all duration-300 relative overflow-hidden"
    >
      <div className="mb-2 flex items-center justify-between z-10 relative">
        <span className="flex items-center gap-2 text-[10px] font-display font-black uppercase tracking-widest text-[#64748B]">
          <span className="text-xs">{BAR_ICONS[label]}</span>
          {label}
        </span>
        <span
          className={`text-xs font-mono font-bold ${
            pct === 0 ? "text-[#64748B]" : pct >= 95 ? "text-[#22C55E]" : pct >= 70 ? "text-[#F59E0B]" : "text-[#EF4444]"
          }`}
        >
          {pct === 0 ? "—" : `${Math.round(pct)}%`}
        </span>
      </div>

      {/* Bar rail */}
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-[#080C14] border border-[#141E2E] p-0.5 shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="h-full rounded-full bg-gradient-to-r from-[#EF4444] via-[#F59E0B] to-[#22C55E]"
          style={{
            boxShadow: pct > 0 ? "0 0 10px rgba(34, 197, 94, 0.2)" : "none",
          }}
        />
      </div>
    </motion.div>
  );
}

export function ScoreBars({ handshapeScore, movementScore, orientationScore }: Props) {
  return (
    <section className="rounded-2xl border border-[#141E2E] bg-[#0F1623] p-4 shadow-xl">
      <p className="mb-3 text-[9px] font-display font-black uppercase tracking-widest text-[#64748B]">
        Execution Analysis
      </p>
      <div className="flex flex-col gap-1.5">
        <ScoreBar label="Handshape" score={handshapeScore} />
        <ScoreBar label="Movement" score={movementScore} />
        <ScoreBar label="Orientation" score={orientationScore} />
      </div>
    </section>
  );
}
