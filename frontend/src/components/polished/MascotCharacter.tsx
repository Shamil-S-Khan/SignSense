"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { motion } from "framer-motion";
import { animate } from "animejs";

export interface MascotHandle {
  celebrate: () => void;
}

export const MascotCharacter = forwardRef<MascotHandle>((_, ref) => {
  const mascotRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    celebrate() {
      if (!mascotRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      animate(mascotRef.current, {
        rotate: [0, -15, 15, -10, 10, 0],
        scale: [1, 1.3, 1.3, 1.15, 1.15, 1],
        duration: 700,
        ease: "easeInOut",
      });
    },
  }));

  return (
    <motion.div
      ref={mascotRef}
      className="select-none pointer-events-none"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* ASL hand making "ILY" sign — index, pinky, and thumb extended */}
      <svg
        width="44"
        height="52"
        viewBox="0 0 44 52"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ASL hand mascot"
      >
        {/* Glow halo */}
        <ellipse cx="22" cy="48" rx="14" ry="3" fill="var(--accent)" opacity="0.18" />

        {/* Palm */}
        <path
          d="M8 28 Q7 40 10 46 Q16 52 22 52 Q28 52 34 46 Q37 40 36 28 L34 22 Q30 20 26 22 L22 22 L18 22 Q14 20 10 22 Z"
          fill="url(#palm-grad)"
        />

        {/* Index finger (extended) */}
        <path
          d="M17 22 L16 8 Q16.5 4 18.5 4 Q20.5 4 21 8 L21 22"
          fill="url(#finger-grad)"
          stroke="var(--accent)"
          strokeWidth="0.5"
          strokeOpacity="0.4"
        />

        {/* Middle finger (curled) */}
        <path
          d="M22 22 L22.5 16 Q23 13 24.5 14 Q25.5 15 25 18 L25 22"
          fill="url(#finger-grad)"
        />

        {/* Ring finger (curled) */}
        <path
          d="M25.5 22 L26 17 Q26.5 14 28 15 Q29 16 28.5 19 L28 22"
          fill="url(#finger-grad)"
        />

        {/* Pinky (extended) */}
        <path
          d="M28.5 22 L30 10 Q30.5 6 32.5 6.5 Q34 7 33.5 11 L32 22"
          fill="url(#finger-grad)"
          stroke="var(--accent)"
          strokeWidth="0.5"
          strokeOpacity="0.4"
        />

        {/* Thumb (extended outward) */}
        <path
          d="M10 26 L4 20 Q2 17 3.5 15 Q5 13 7.5 15.5 L11 22"
          fill="url(#finger-grad)"
          stroke="var(--accent)"
          strokeWidth="0.5"
          strokeOpacity="0.4"
        />

        {/* Knuckle lines */}
        <line x1="14" y1="26" x2="32" y2="26" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* Fingernails accent dots */}
        <circle cx="18.5" cy="5.5" r="1.2" fill="var(--accent)" opacity="0.5" />
        <circle cx="31" cy="8" r="1.2" fill="var(--accent)" opacity="0.5" />

        <defs>
          <linearGradient id="palm-grad" x1="22" y1="20" x2="22" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1A2A4A" />
            <stop offset="100%" stopColor="#0F1C32" />
          </linearGradient>
          <linearGradient id="finger-grad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#1E3050" />
            <stop offset="100%" stopColor="#152038" />
          </linearGradient>
        </defs>
      </svg>

      {/* Neon cyan glow pulse around mascot */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(ellipse, rgba(79, 142, 247, 0.18) 0%, transparent 70%)",
          top: -8,
          left: -8,
          right: -8,
          bottom: -8,
        }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
});

MascotCharacter.displayName = "MascotCharacter";
