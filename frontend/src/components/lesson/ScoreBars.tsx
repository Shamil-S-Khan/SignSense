"use client";

import { motion } from "framer-motion";

interface Props {
  handshapeScore: number;
  movementScore: number;
  orientationScore: number;
}

const BAR_ICONS: Record<string, string> = {
  Handshape: "✋",
  Movement: "👈",
  Orientation: "🦭",
};

function getBarColor(score: number) {
  if (score >= 90) return "from-emerald-500 to-teal-400";
  if (score >= 70) return "from-amber-500 to-yellow-400";
  return "from-rose-600 to-pink-500";
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const isEmpty = score === 0;
  const color = getBarColor(score);
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#777777]">
          <span>{BAR_ICONS[label]}</span>
          {label}
        </span>
        <span
          className={`text-xs font-black tabular-nums ${
            isEmpty ? "text-[#b0b0b0]" : pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-rose-400"
          }`}
        >
          {isEmpty ? "\u2013" : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${isEmpty ? "bg-[#e5e5e5]" : color}`}
          style={{}}
        />
      </div>
    </div>
  );
}

export function ScoreBars({ handshapeScore, movementScore, orientationScore }: Props) {
  return (
    <section className="rounded-3xl border border-[#e5e5e5] bg-white p-5 shadow-md">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[#b0b0b0]">
        Execution analysis
      </p>
      <div className="flex flex-col gap-4">
        <ScoreBar label="Handshape" score={handshapeScore} />
        <ScoreBar label="Movement" score={movementScore} />
        <ScoreBar label="Orientation" score={orientationScore} />
      </div>
    </section>
  );
}
