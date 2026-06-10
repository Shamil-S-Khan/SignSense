"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { animate } from "animejs";

interface MilestoneChestProps {
  unlocked: boolean;
  color: string;
  chapterNum: number;
}

export function MilestoneChest({ unlocked, color, chapterNum }: MilestoneChestProps) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const lidRef = useRef<SVGGElement | null>(null);
  const chestRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!unlocked || hasAnimated || !lidRef.current || !chestRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setHasAnimated(true);

    // Lid swings open
    animate(lidRef.current, {
      rotateX: [0, -70],
      duration: 600,
      delay: 200,
      ease: "easeOut",
    });

    // Chest bounces
    animate(chestRef.current, {
      y: [0, -12, 0],
      duration: 500,
      delay: 150,
      ease: "easeOut",
    });
  }, [unlocked, hasAnimated]);

  return (
    <div className="relative flex flex-col items-center" style={{ perspective: "200px" }}>
      <div ref={chestRef} className="relative">
        <svg width="64" height="56" viewBox="0 0 64 56" fill="none">
          {/* Chest body */}
          <rect x="6" y="28" width="52" height="24" rx="3" fill={unlocked ? `${color}30` : "#131824"} stroke={unlocked ? color : "#2A354F"} strokeWidth="1.5" />
          {/* Body banding */}
          <rect x="6" y="37" width="52" height="5" fill={unlocked ? `${color}18` : "#0D1220"} />
          {/* Lock clasp */}
          {!unlocked && (
            <rect x="27" y="34" width="10" height="8" rx="2" fill="#2A354F" stroke="#3D4F6A" strokeWidth="1" />
          )}
          {/* Chest lid (SVG group for rotation) */}
          <g ref={lidRef} style={{ transformOrigin: "32px 28px" }}>
            <rect x="6" y="16" width="52" height="14" rx="3" fill={unlocked ? `${color}40` : "#1A2235"} stroke={unlocked ? color : "#2A354F"} strokeWidth="1.5" />
            {/* Lid banding */}
            <rect x="6" y="24" width="52" height="3" fill={unlocked ? `${color}25` : "#141E2E"} />
            {/* Lid corner gems */}
            <circle cx="14" cy="20" r="2.5" fill={unlocked ? color : "#2A354F"} opacity={unlocked ? "0.8" : "0.4"} />
            <circle cx="50" cy="20" r="2.5" fill={unlocked ? color : "#2A354F"} opacity={unlocked ? "0.8" : "0.4"} />
          </g>

          {/* Glow under chest when unlocked */}
          {unlocked && (
            <ellipse cx="32" cy="53" rx="20" ry="3" fill={color} opacity="0.2" />
          )}
        </svg>

        {/* Badge floating above unlocked chest */}
        <AnimatePresence>
          {unlocked && (
            <motion.div
              initial={{ y: 0, opacity: 0, scale: 0.5 }}
              animate={{ y: -28, opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 180,
                damping: 12,
                delay: 0.5,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="absolute -top-6 left-1/2 -translate-x-1/2 z-20"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 shadow-lg"
                style={{
                  backgroundColor: `${color}22`,
                  borderColor: color,
                  boxShadow: `0 0 16px ${color}60`,
                }}
              >
                {chapterNum === 1 ? "🔤" : chapterNum === 2 ? "🤝" : "💬"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Particle burst */}
        <AnimatePresence>
          {unlocked && hasAnimated && (
            <>
              {[...Array(8)].map((_, i) => {
                const angle = (i / 8) * Math.PI * 2;
                return (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full pointer-events-none"
                    style={{
                      backgroundColor: color,
                      top: "50%",
                      left: "50%",
                      marginTop: -4,
                      marginLeft: -4,
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos(angle) * 50,
                      y: Math.sin(angle) * 50,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                  />
                );
              })}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Chapter complete label */}
      <div
        className="mt-2 text-[9px] font-display font-black uppercase tracking-widest text-center"
        style={{ color: unlocked ? color : "#2A354F" }}
      >
        Chapter {chapterNum} Complete
      </div>
    </div>
  );
}
