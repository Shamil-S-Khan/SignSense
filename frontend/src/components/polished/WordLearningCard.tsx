"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, Eye, Sparkles } from "lucide-react";

export interface WordData {
  word: string;
  phonetic: string;
  example: string;
  status: "unseen" | "learning" | "mastered";
  videoUrl: string;
}

interface WordLearningCardProps {
  data: WordData;
  cardState?: "idle" | "hovered" | "selected" | "correct" | "incorrect";
  onSelect?: () => void;
}

export function WordLearningCard({
  data,
  cardState = "idle",
  onSelect,
}: WordLearningCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  // Status badge with ring-2 styles (grey -> blue -> green)
  const statusBadgeStyles = {
    unseen: "border border-zinc-700 bg-zinc-800/40 text-zinc-400 ring-2 ring-zinc-700/20",
    learning: "border border-[#4f8ef7]/40 bg-[#4f8ef7]/10 text-[#4f8ef7] ring-2 ring-[#4f8ef7]/20",
    mastered: "border border-[#3dd68c]/40 bg-[#3dd68c]/10 text-[#3dd68c] ring-2 ring-[#3dd68c]/20",
  };

  const statusLabels = {
    unseen: "unseen",
    learning: "in progress",
    mastered: "mastered",
  };

  // State colors - each visually distinct
  const stateStyles = {
    idle: "border border-[#22263a] bg-[#1a1d27] hover:bg-[#22263a] hover:border-[#4f8ef7]/40 transition-all duration-200",
    hovered: "border border-[#4f8ef7]/60 bg-[#22263a] shadow-[0_0_12px_rgba(79,142,247,0.1)] transition-all duration-200",
    selected: "border-2 border-[#4f8ef7] bg-[#1a2035] shadow-[0_0_15px_rgba(79,142,247,0.15)]",
    correct: "border-2 border-[#3dd68c] bg-[#132a22] shadow-[0_0_15px_rgba(61,214,140,0.15)]",
    incorrect: "border-2 border-[#f75f5f] bg-[#2d1b20] shadow-[0_0_15px_rgba(247,95,95,0.15)]",
  };

  const flipCard = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when flipping
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="relative h-[290px] w-full [perspective:1000px] select-none">
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full h-full relative [transform-style:preserve-3d] cursor-pointer"
        onClick={() => onSelect?.()}
      >
        
        {/* ──────── FRONT OF CARD ──────── */}
        <div
          className={`absolute inset-0 w-full h-full rounded-xl p-4 flex flex-col justify-between [backface-visibility:hidden] transition-colors duration-200 ${stateStyles[cardState]}`}
        >
          {/* Status Indicator & Utility buttons */}
          <div className="flex items-center justify-between">
            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadgeStyles[data.status]}`}>
              {statusLabels[data.status]}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={flipCard}
                className="h-7 w-7 rounded-md bg-[#22263a] hover:bg-[#2b304c] flex items-center justify-center text-[#9ca3af] transition-colors"
                title="View description & tips"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Video Container (16:9, rounded-xl/12px) */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#0f1117] border border-[#22263a] mt-2">
            
            {/* Shimmer loading state */}
            {isVideoLoading && (
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-[#22263a] to-transparent" />
            )}

            <video
              src={data.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              onCanPlay={() => setIsVideoLoading(false)}
              className={`w-full h-full object-cover sign-demo-media transition-opacity duration-300 ${
                isVideoLoading ? "opacity-0" : "opacity-100"
              }`}
            />
          </div>

          {/* Sign Word Title */}
          <div className="mt-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-[#f0f2f8]">
              {data.word}
            </h3>
            <span className="text-[10px] font-mono text-[#9ca3af] uppercase bg-[#0f1117] px-2 py-0.5 rounded-[6px] border border-[#22263a]">
              Sign Loop
            </span>
          </div>
        </div>

        {/* ──────── BACK OF CARD (Flipped) ──────── */}
        <div
          className={`absolute inset-0 w-full h-full rounded-xl p-4 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)] border border-[#22263a] bg-[#22263a]/90 backdrop-blur-sm`}
          onClick={(e) => e.stopPropagation()} // Stop selection toggle when interacting with back
        >
          {/* Card Back Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#f7a84f]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#f7a84f]">
                Phonetic & Usage
              </span>
            </div>
            <button
              type="button"
              onClick={flipCard}
              className="h-7 w-7 rounded-md bg-[#1a1d27] hover:bg-[#22263a] flex items-center justify-center text-[#9ca3af] transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>

          {/* Description & Phonetics */}
          <div className="flex-1 flex flex-col justify-center my-3">
            <p className="text-sm font-semibold text-[#f0f2f8] italic">
              /{data.phonetic}/
            </p>
            <p className="text-xs text-[#9ca3af] leading-5 mt-2 bg-[#1a1d27] p-2.5 rounded-lg border border-[#22263a]/50">
              {data.example}
            </p>
          </div>

          {/* XP Badge and Back Action */}
          <div className="flex items-center justify-between mt-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#3dd68c] bg-[#132a22] px-2.5 py-1 rounded-[6px] border border-[#3dd68c]/25">
              +15 XP Earned
            </span>
            <button
              type="button"
              onClick={flipCard}
              className="text-xs font-semibold text-[#4f8ef7] hover:underline"
            >
              Back to Sign
            </button>
          </div>

        </div>

      </motion.div>
    </div>
  );
}
