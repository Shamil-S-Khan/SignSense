"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { animate } from "animejs";

interface SkillNodeProps {
  id: string;
  title: string;
  description?: string;
  state: "completed" | "active" | "locked";
  icon: string;
  xp: number;
  color: string;
  onClick: () => void;
}

const SIZE = 80;
const H = SIZE / 2;
const P = 6; // padding

// Diamond perimeter as path (for orbit animation)
const DIAMOND_PATH = `M ${H} ${P} L ${SIZE - P} ${H} L ${H} ${SIZE - P} L ${P} ${H} Z`;
// Diamond as polygon points string
const DIAMOND_PTS = `${H},${P} ${SIZE - P},${H} ${H},${SIZE - P} ${P},${H}`;
// Slightly smaller inner bevel
const INNER_PTS = `${H},${P + 5} ${SIZE - P - 5},${H} ${H},${SIZE - P - 5} ${P + 5},${H}`;
// Shadow offset
const SHADOW_PTS = `${H},${P + 6} ${SIZE - P + 2},${H + 2} ${H},${SIZE - P + 6} ${P - 2},${H + 2}`;

export function SkillNode({ id, title, description, state, icon, xp, color, onClick }: SkillNodeProps) {
  const isCompleted = state === "completed";
  const isActive = state === "active";
  const isLocked = state === "locked";

  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<SVGPathElement>(null);

  // Locked: padlock rattle on first scroll-into-view
  useEffect(() => {
    if (!isLocked || !wrapperRef.current) return;
    let fired = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired && lockRef.current) {
          fired = true;
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            animate(lockRef.current, {
              rotate: [-5, 5, -3, 3, -1, 0],
              duration: 550,
              ease: "easeInOut",
            });
          }
        }
      },
      { threshold: 0.6 }
    );
    obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, [isLocked]);

  // Active: Anime.js orbiting dashed border
  useEffect(() => {
    if (!isActive || !orbitRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pathEl = orbitRef.current;
    // Get total path length safely
    let len = 240;
    try { len = pathEl.getTotalLength(); } catch (_) {}
    pathEl.style.strokeDasharray = `14 7`;
    const anim = animate(pathEl, {
      strokeDashoffset: [len * 2, 0],
      duration: 2800,
      loop: true,
      ease: "linear",
    });
    return () => { try { anim.pause(); } catch (_) {} };
  }, [isActive]);

  return (
    <div ref={wrapperRef} className="relative" style={{ width: SIZE, height: SIZE + 20 }}>
      {/* Framer Motion spring entrance from below */}
      <motion.div
        style={{ width: SIZE, height: SIZE, cursor: isLocked ? "default" : "pointer" }}
        initial={{ opacity: 0, y: 50, scale: 0.65 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        viewport={{ once: false, margin: "-30px" }}
        whileHover={!isLocked ? { scale: 1.08 } : {}}
        whileTap={!isLocked ? { scale: 0.93 } : {}}
        onHoverStart={() => !isLocked && setShowTooltip(true)}
        onHoverEnd={() => setShowTooltip(false)}
        onClick={() => !isLocked && onClick()}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          overflow="visible"
          className="overflow-visible"
        >
          <defs>
            <filter id={`node-glow-${id}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`fill-grad-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={isCompleted ? color : isActive ? color : "#141E2E"} stopOpacity={isCompleted ? "0.85" : isActive ? "0.2" : "1"} />
              <stop offset="100%" stopColor={isCompleted ? `${color}88` : isActive ? `${color}08` : "#0D1220"} stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Outer ambient glow (active/completed only) */}
          {(isActive || isCompleted) && (
            <polygon
              points={DIAMOND_PTS}
              fill="none"
              stroke={color}
              strokeWidth="14"
              opacity="0.06"
              style={{ filter: `blur(8px)` }}
            />
          )}

          {/* Drop shadow */}
          <polygon points={SHADOW_PTS} fill="rgba(0,0,0,0.45)" />

          {/* Main diamond fill */}
          <polygon
            points={DIAMOND_PTS}
            fill={`url(#fill-grad-${id})`}
            stroke={isLocked ? "#1E2C40" : color}
            strokeWidth={isActive ? "2.5" : "1.8"}
            filter={isActive ? `url(#node-glow-${id})` : undefined}
          />

          {/* Inner bevel highlight */}
          <polygon
            points={INNER_PTS}
            fill="none"
            stroke={isLocked ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)"}
            strokeWidth="1"
          />

          {/* Animating orbit path (Anime.js target) */}
          {isActive && (
            <path
              ref={orbitRef}
              d={DIAMOND_PATH}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}

          {/* Shimmer on completed */}
          {isCompleted && (
            <polygon
              points={INNER_PTS}
              fill="rgba(255,255,255,0.06)"
            />
          )}
        </svg>

        {/* Icon / lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: 4 }}>
          {isLocked ? (
            <div ref={lockRef} className="flex items-center justify-center">
              <svg width="20" height="22" viewBox="0 0 24 26" fill="none">
                <rect x="3" y="12" width="18" height="12" rx="2" fill="#131E2E" stroke="#2A3E58" strokeWidth="1.5" />
                <path d="M7 12V8a5 5 0 0 1 10 0v4" stroke="#2A3E58" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <span
              className="text-xl leading-none select-none"
              style={{
                filter: isCompleted
                  ? `drop-shadow(0 0 6px ${color}80)`
                  : "brightness(0.9)",
              }}
            >
              {icon}
            </span>
          )}
        </div>

        {/* Completed star badge */}
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              key="star"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.1 }}
              className="absolute -top-2 -right-2 z-10"
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center border"
                style={{
                  backgroundColor: "#080C14",
                  borderColor: "#FFD700",
                  boxShadow: "0 0 8px rgba(255,215,0,0.5)",
                }}
              >
                <Star className="w-2.5 h-2.5" style={{ color: "#FFD700", fill: "#FFD700" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active breathing glow ring */}
        {isActive && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-none"
            style={{
              background: `radial-gradient(ellipse at center, ${color}28 0%, transparent 68%)`,
              transform: "scale(1.5)",
            }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [1.3, 1.7, 1.3] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>

      {/* XP label beneath node */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <span
          className="text-[8px] font-mono font-bold tracking-wider"
          style={{ color: isLocked ? "#2A354F" : "#F59E0B" }}
        >
          {xp}XP
        </span>
      </div>

      {/* Hover tooltip card */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            key="tooltip"
            initial={{ y: 10, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="absolute z-50 pointer-events-none"
            style={{
              bottom: SIZE + 28,
              left: "50%",
              transform: "translateX(-50%)",
              width: 168,
            }}
          >
            <div
              className="rounded-2xl border p-3.5 shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${color}1A 0%, #0F1623F0 100%)`,
                borderColor: `${color}50`,
                boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 16px ${color}25`,
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                className="text-[9px] font-display font-black uppercase tracking-widest mb-1.5"
                style={{ color }}
              >
                {isCompleted ? "✓ Completed" : "▶ Practice"}
              </div>
              <div className="text-[11px] font-bold text-[#F0F4FF] leading-tight">{title}</div>
              <div className="text-[9px] text-[#64748B] mt-1 leading-snug">
                {description || "Sign recognition practice"}
              </div>
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                <span className="text-[9px] font-mono font-bold text-[#F59E0B]">+{xp} XP</span>
              </div>
            </div>
            {/* Arrow tip */}
            <div
              className="w-3 h-3 mx-auto -mt-1.5 rotate-45 border-r border-b"
              style={{
                background: "#0F1623",
                borderColor: `${color}50`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
