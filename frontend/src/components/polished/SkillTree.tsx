"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  Flame,
  Heart,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Star,
  ChevronRight,
} from "lucide-react";
import { animate } from "animejs";

import { UNITS, LessonDefinition, UnitDefinition } from "@/lib/practice/lesson-data";
import { useLocalPracticeStore } from "@/lib/practice/progress";
import { audioManager } from "@/lib/audioManager";
import { SkillNode } from "./SkillNode";
import { MascotCharacter, MascotHandle } from "./MascotCharacter";
import { MilestoneChest } from "./MilestoneChest";

// ─── Chapter classification ────────────────────────────────────────────────
const CHAPTER_MAP: Record<string, { num: number; label: string; subtitle: string; color: string }> = {
  "unit-1": { num: 1, label: "Chapter I — The Alphabet", subtitle: "Master the 26 handshapes of ASL fingerspelling", color: "#00D4FF" },
  "unit-2": { num: 2, label: "Chapter II — Core Vocabulary", subtitle: "Build your everyday signing vocabulary", color: "#7C3AED" },
  "unit-8": { num: 3, label: "Chapter III — Full Sentences", subtitle: "Combine signs into flowing ASL sentences", color: "#D97706" },
};

// ─── Layout helpers ────────────────────────────────────────────────────────
const NODE_STEP = 148;
const BANNER_STEP = 120;
const CHEST_STEP = 160;
const CONTAINER_W = 420;
const PATH_CENTER = CONTAINER_W / 2;

function sineOffset(lessonIdx: number): number {
  return Math.sin(lessonIdx * (Math.PI / 2.5)) * 90;
}

// ─── SkillTree ─────────────────────────────────────────────────────────────
export function SkillTree() {
  const router = useRouter();

  // Zustand
  const completedLessons = useLocalPracticeStore((s) => s.completedLessons);
  const userXp = useLocalPracticeStore((s) => s.xp);
  const hearts = useLocalPracticeStore((s) => s.heartsRemaining);
  const streak = useLocalPracticeStore((s) => s.streak);
  const startLessonStore = useLocalPracticeStore((s) => s.startLesson);
  const _loseHeartStore = useLocalPracticeStore((s) => s.loseHeart);

  // UI state
  const [selectedLesson, setSelectedLesson] = useState<LessonDefinition | null>(null);
  const [selectedColor, setSelectedColor] = useState("#00D4FF");
  const [isMuted, setIsMuted] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.2);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [hintsVisible, setHintsVisible] = useState(false);
  const [sidebarChapter, setSidebarChapter] = useState<{ num: number; label: string; subtitle: string; color: string; progress: number } | null>(null);

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const mascotRef = useRef<MascotHandle>(null);

  // Framer Motion scroll tracking
  const { scrollY } = useScroll({ container: scrollContainerRef });
  const bg1Y = useTransform(scrollY, [0, 6000], [0, -900]);   // 0.15×
  const bg2Y = useTransform(scrollY, [0, 6000], [0, -1800]);  // 0.30×
  const bg3Y = useTransform(scrollY, [0, 6000], [0, -3000]);  // 0.50×

  // ── Audio init
  useEffect(() => {
    setIsMuted(audioManager.getMute());
    setBgmVolume(audioManager.getBgmVolume());
    audioManager.startBgm();
  }, []);

  // ── Starfield canvas (Anime.js)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 100 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      speed: -(Math.random() * 0.12 + 0.04),
      opacity: Math.random() * 0.45 + 0.08,
    }));

    const dummy = { t: 0 };
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const anim = animate(dummy, {
      t: 100,
      duration: 120000,
      loop: true,
      ease: "linear",
      onUpdate: () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach((s) => {
          if (!isReduced) {
            s.y += s.speed;
            if (s.y < 0) { s.y = canvas.height; s.x = Math.random() * canvas.width; }
          }
          ctx.fillStyle = `rgba(220, 235, 255, ${s.opacity})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        });
      },
    });

    return () => { anim.pause(); window.removeEventListener("resize", resize); };
  }, []);

  // ── Entrance sequence (Anime.js)
  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) { setHintsVisible(true); return; }

    // Stagger-animate completed path segments on mount
    const completedPaths = pathRefs.current.filter(Boolean);
    if (completedPaths.length > 0) {
      animate(completedPaths, {
        strokeDashoffset: [(_el: Element, i: number) => {
          const el = completedPaths[i] as SVGPathElement;
          try { return el.getTotalLength() * 1.5; } catch { return 400; }
        }, 0],
        duration: 800,
        delay: (_el: unknown, i: number) => 80 + i * 55,
        ease: "easeInOut",
      });
    }

    setTimeout(() => setHintsVisible(true), 1200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animated path drawing (IntersectionObserver per path)
  const registerPath = useCallback((el: SVGPathElement | null, idx: number) => {
    pathRefs.current[idx] = el;
    if (!el) return;
    const len = (() => { try { return el.getTotalLength(); } catch { return 350; } })();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;

    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          animate(el, { strokeDashoffset: [len, 0], duration: 700, ease: "easeInOut" });
        } else {
          el.style.strokeDashoffset = "0";
        }
        obs.disconnect();
      }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    obs.observe(el);
  }, []);

  // ── Shimmer on completed path segments (Anime.js)
  const registerShimmerPath = useCallback((el: SVGPathElement | null) => {
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const len = (() => { try { return el.getTotalLength(); } catch { return 350; } })();
    el.style.strokeDasharray = `18 6`;
    animate(el, {
      strokeDashoffset: [len * 2, 0],
      duration: 3500,
      loop: true,
      ease: "linear",
    });
  }, []);

  // ── Sidebar: update on scroll via IntersectionObserver on chapter banners
  const registerChapterBanner = useCallback((el: HTMLDivElement | null, unitId: string) => {
    if (!el) return;
    const chapter = CHAPTER_MAP[unitId];
    if (!chapter) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const unit = UNITS.find(u => u.id === unitId);
        if (!unit) return;
        const done = unit.lessons.filter(l => completedLessons.includes(l.id)).length;
        setSidebarChapter({
          ...chapter,
          progress: Math.round((done / unit.lessons.length) * 100),
        });
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [completedLessons]);

  // ── Build layout items
  type BannerItem = { type: "banner"; id: string; unit: UnitDefinition; unitIdx: number; y: number; isChapterStart: boolean };
  type LessonItem = { type: "lesson"; id: string; lesson: LessonDefinition; unit: UnitDefinition; x: number; y: number; color: string; lessonIdx: number };
  type ChestItem = { type: "chest"; id: string; unit: UnitDefinition; y: number; chapterNum: number };
  type LayoutItem = BannerItem | LessonItem | ChestItem;

  const layoutItems: LayoutItem[] = [];
  const nodePositions: Record<string, { x: number; y: number }> = {};
  let currentY = 140;
  let globalLessonIdx = 0;

  UNITS.forEach((unit, unitIdx) => {
    const isChapterStart = CHAPTER_MAP[unit.id] !== undefined;

    layoutItems.push({
      type: "banner",
      id: unit.id,
      unit,
      unitIdx,
      y: currentY,
      isChapterStart,
    });
    currentY += BANNER_STEP;

    unit.lessons.forEach((lesson) => {
      const xOff = sineOffset(globalLessonIdx);
      layoutItems.push({
        type: "lesson",
        id: lesson.id,
        lesson,
        unit,
        x: xOff,
        y: currentY,
        color: unit.color,
        lessonIdx: globalLessonIdx,
      });
      nodePositions[lesson.id] = { x: xOff, y: currentY };
      currentY += NODE_STEP;
      globalLessonIdx++;
    });

    // Chest after each chapter-ending unit
    const chapterInfo = CHAPTER_MAP[unit.id];
    const nextUnit = UNITS[unitIdx + 1];
    const nextIsChapter = nextUnit ? CHAPTER_MAP[nextUnit.id] !== undefined : true;
    if (nextIsChapter || unitIdx === UNITS.length - 1) {
      layoutItems.push({
        type: "chest",
        id: `chest-${unit.id}`,
        unit,
        y: currentY,
        chapterNum: chapterInfo?.num ?? (unitIdx + 1),
      });
      currentY += CHEST_STEP;
    } else {
      currentY += 20; // small gap between units in same chapter
    }
  });

  const nodeSequence = layoutItems.filter(
    (item): item is LessonItem => item.type === "lesson"
  );
  const svgHeight = currentY + 100;

  // ── Find active lesson and its position
  let activeLessonId: string | null = null;
  let _activeNodePos: { x: number; y: number } | null = null;
  for (const unit of UNITS) {
    const active = unit.lessons.find(
      (l) => !completedLessons.includes(l.id) &&
        (l.unlockAfter === null || completedLessons.includes(l.unlockAfter))
    );
    if (active) { activeLessonId = active.id; _activeNodePos = nodePositions[active.id] ?? null; break; }
  }

  const handleStartLesson = (lessonId: string) => {
    startLessonStore(lessonId);
    audioManager.playTick();
    router.push(`/lesson/${lessonId}`);
  };

  // ── SVG path between two nodes
  function buildPath(posA: { x: number; y: number }, posB: { x: number; y: number }): string {
    const sx = posA.x + PATH_CENTER;
    const sy = posA.y + 40;
    const ex = posB.x + PATH_CENTER;
    const ey = posB.y;
    const dy = ey - sy;
    return `M ${sx} ${sy} C ${sx} ${sy + dy * 0.5}, ${ex} ${ey - dy * 0.5}, ${ex} ${ey}`;
  }

  return (
    <div className="flex w-full h-full bg-[#060A12] overflow-hidden relative font-body text-[#F0F4FF] select-none">

      {/* ── PARALLAX BACKGROUND LAYERS ───────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Layer 1 — deep nebula */}
        <motion.div
          className="absolute inset-0"
          style={{
            y: bg1Y,
            background:
              "radial-gradient(ellipse 80% 50% at 20% 30%, #0A1A3510 0%, transparent 70%), " +
              "radial-gradient(ellipse 60% 60% at 80% 70%, #0D1F3C18 0%, transparent 60%)",
          }}
        />
        {/* Layer 2 — unit color orbs */}
        <motion.div className="absolute inset-0" style={{ y: bg2Y }}>
          {UNITS.map((unit, idx) => (
            <div
              key={unit.id}
              className="absolute rounded-full blur-[120px] opacity-[0.07]"
              style={{
                backgroundColor: unit.color,
                width: 600,
                height: 600,
                top: `${idx * 1200 + 300}px`,
                left: idx % 2 === 0 ? "-15%" : "60%",
              }}
            />
          ))}
        </motion.div>
        {/* Layer 3 — foreground shimmer */}
        <motion.div
          className="absolute inset-0"
          style={{
            y: bg3Y,
            background:
              "radial-gradient(ellipse 40% 30% at 50% 10%, #00D4FF06 0%, transparent 100%)",
          }}
        />
      </div>

      {/* ── STARFIELD CANVAS ──────────────────────────────────────── */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* ── SIDEBAR HUD (lg+) ─────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarChapter && (
          <motion.aside
            layout
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="hidden lg:flex flex-col gap-4 w-60 shrink-0 z-20 p-5 self-start sticky top-24"
          >
            <div
              className="rounded-2xl border p-4 backdrop-blur-md shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${sidebarChapter.color}12, #0F1623E8)`,
                borderColor: `${sidebarChapter.color}35`,
              }}
            >
              <div
                className="text-[9px] font-display font-black uppercase tracking-widest mb-1"
                style={{ color: sidebarChapter.color }}
              >
                Now in
              </div>
              <h3 className="text-sm font-display font-black text-[#F0F4FF] leading-tight mb-1">
                {sidebarChapter.label}
              </h3>
              <p className="text-[10px] text-[#64748B] leading-relaxed mb-3">
                {sidebarChapter.subtitle}
              </p>
              {/* Progress bar (Anime.js animates width) */}
              <div className="h-1.5 bg-[#141E2E] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: sidebarChapter.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${sidebarChapter.progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-[#64748B] mt-1">
                <span>Progress</span>
                <span style={{ color: sidebarChapter.color }}>{sidebarChapter.progress}%</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full">

        {/* ── TOP HUD HEADER ──────────────────────────────────────── */}
        <header className="shrink-0 sticky top-0 z-30 py-3 px-6 bg-[#060A12]/90 backdrop-blur-md border-b border-[#0F1A2A] flex items-center justify-center">
          <div className="w-full max-w-xl flex items-center justify-between gap-4">
            {/* Brand + streak */}
            <div className="flex items-center gap-3">
              <span className="font-display font-black text-sm uppercase tracking-widest text-[#00D4FF]">
                SignSense
              </span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-[#0D1520] rounded-full border border-[#141E2E]">
                <Flame className="h-3 w-3 text-orange-400" />
                <span className="font-mono text-[10px] font-bold">{streak}d</span>
              </div>
            </div>
            {/* XP + Hearts */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0D1520] rounded-full border border-[#141E2E]">
                <Sparkles className="h-3 w-3 text-[#00D4FF]" />
                <span className="font-mono text-[10px] font-bold">{userXp}<span className="text-[#64748B] ml-0.5 text-[8px]">XP</span></span>
              </div>
              <div className="flex items-center gap-0.5 px-2.5 py-1 bg-[#0D1520] rounded-full border border-[#141E2E]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Heart
                    key={i}
                    className="h-3 w-3"
                    style={{
                      color: i < hearts ? "#EF4444" : "#141E2E",
                      fill: i < hearts ? "#EF4444" : "#141E2E",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ── SCROLLABLE TREE ─────────────────────────────────────── */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative z-10"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#141E2E transparent" }}
        >
          <div
            className="relative mx-auto py-10"
            style={{ width: CONTAINER_W, height: svgHeight }}
          >
            {/* ── SVG CONNECTOR PATHS ───────────────────────────── */}
            <svg
              className="absolute inset-0 w-full overflow-visible pointer-events-none z-0"
              style={{ height: svgHeight }}
            >
              <defs>
                {UNITS.map((unit) => (
                  <linearGradient
                    key={`sg-${unit.id}`}
                    id={`path-grad-${unit.id}`}
                    x1="0%" y1="0%" x2="0%" y2="100%"
                  >
                    <stop offset="0%" stopColor={unit.color} stopOpacity="0.9" />
                    <stop offset="100%" stopColor={unit.color} stopOpacity="0.3" />
                  </linearGradient>
                ))}
              </defs>

              {nodeSequence.slice(0, -1).map((nodeA, idx) => {
                const nodeB = nodeSequence[idx + 1];
                const posA = nodePositions[nodeA.id];
                const posB = nodePositions[nodeB.id];
                if (!posA || !posB) return null;

                const isDone = completedLessons.includes(nodeA.lesson.id);
                const pathD = buildPath(posA, posB);
                const gradId = `path-grad-${nodeA.unit.id}`;

                return (
                  <g key={`path-${nodeA.id}`}>
                    {/* Glow blur layer */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isDone ? nodeA.unit.color : "#0F1A2A"}
                      strokeWidth="10"
                      opacity="0.12"
                      style={{ filter: "blur(4px)" }}
                    />
                    {/* Main path */}
                    {isDone ? (
                      /* Completed: shimmer loop via Anime.js */
                      <path
                        ref={(el) => registerShimmerPath(el)}
                        d={pathD}
                        fill="none"
                        stroke={`url(#${gradId})`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.75"
                      />
                    ) : (
                      /* Locked: dashed, draws in on scroll */
                      <path
                        ref={(el) => registerPath(el, idx)}
                        d={pathD}
                        fill="none"
                        stroke="#1B2840"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray="6 5"
                        opacity="0.6"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* ── LAYOUT ITEMS ──────────────────────────────────── */}
            {layoutItems.map((item) => {

              // ── Chapter banner
              if (item.type === "banner") {
                const unit = item.unit;
                const chapterInfo = CHAPTER_MAP[unit.id];
                const completedCount = unit.lessons.filter((l) => completedLessons.includes(l.id)).length;

                return (
                  <div
                    key={item.id}
                    ref={(el) => { if (item.isChapterStart) registerChapterBanner(el, unit.id); }}
                    style={{ top: item.y, position: "absolute", left: 0, right: 0 }}
                    className="px-4 z-10"
                  >
                    {/* Chapter header above unit (only on chapter starts) */}
                    {item.isChapterStart && chapterInfo && (
                      <motion.div
                        initial={{ x: -60, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 160, damping: 20 }}
                        viewport={{ once: true, margin: "-40px" }}
                        className="mb-3 w-full"
                      >
                        <div
                          className="rounded-3xl px-5 py-4 border-2 flex items-center gap-4"
                          style={{
                            background: `linear-gradient(135deg, ${chapterInfo.color}15 0%, #070B1500 100%)`,
                            borderColor: `${chapterInfo.color}35`,
                            boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4)`,
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-2xl shrink-0 border-2"
                            style={{
                              backgroundColor: `${chapterInfo.color}15`,
                              borderColor: `${chapterInfo.color}35`,
                            }}
                          >
                            {chapterInfo.num === 1 ? "🔤" : chapterInfo.num === 2 ? "🤝" : "💬"}
                          </div>
                          <div>
                            <div
                              className="text-[9px] font-display font-black uppercase tracking-widest"
                              style={{ color: chapterInfo.color }}
                            >
                              {chapterInfo.label}
                            </div>
                            <div className="text-[10px] text-[#64748B] mt-0.5">{chapterInfo.subtitle}</div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#64748B] ml-auto shrink-0" />
                        </div>
                      </motion.div>
                    )}

                    {/* Unit sub-banner */}
                    <motion.div
                      initial={{ x: item.unitIdx % 2 === 0 ? -40 : 40, opacity: 0 }}
                      whileInView={{ x: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 180, damping: 22 }}
                      viewport={{ once: false, margin: "-30px" }}
                    >
                      <div
                        className="rounded-2xl px-5 py-3.5 border-2 flex items-center justify-between"
                        style={{
                          background: `linear-gradient(135deg, ${unit.color}14 0%, #0F162395 100%)`,
                          borderColor: `${unit.color}35`,
                          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4)`,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1 self-stretch rounded-full"
                            style={{ backgroundColor: unit.color }}
                          />
                          <div className="text-lg">{unit.icon}</div>
                          <div>
                            <div className="text-[8px] font-display font-black uppercase tracking-wider text-[#64748B]">
                              Unit {item.unitIdx + 1}
                            </div>
                            <div className="text-xs font-display font-bold text-[#F0F4FF]">{unit.title}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono font-bold text-[#F0F4FF]">
                            {completedCount} / {unit.lessons.length}
                          </div>
                          <div className="text-[8px] text-[#64748B]">lessons</div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              }

              // ── Lesson node
              if (item.type === "lesson") {
                const { lesson, color, x, y } = item;
                const isDone = completedLessons.includes(lesson.id);
                const isUnlocked =
                  lesson.unlockAfter === null || completedLessons.includes(lesson.unlockAfter);
                const nodeState = isDone ? "completed" : isUnlocked ? "active" : "locked";
                const isThisActive = lesson.id === activeLessonId;

                return (
                  <div
                    key={lesson.id}
                    style={{
                      position: "absolute",
                      top: y,
                      left: x + PATH_CENTER - 40,
                    }}
                    className="z-20"
                  >
                    {/* Mascot beside active node */}
                    {isThisActive && (
                      <div
                        className="absolute z-30"
                        style={{ top: -4, left: -60, pointerEvents: "none" }}
                      >
                        <MascotCharacter ref={mascotRef} />
                      </div>
                    )}

                    <SkillNode
                      id={lesson.id}
                      title={lesson.title}
                      description={`Practice ${lesson.letters.join(", ")} in ASL`}
                      state={nodeState}
                      icon={lesson.icon}
                      xp={lesson.xp}
                      color={color}
                      onClick={() => {
                        setSelectedLesson(lesson);
                        setSelectedColor(color);
                        audioManager.playTick();
                      }}
                    />
                  </div>
                );
              }

              // ── Milestone chest
              if (item.type === "chest") {
                const unit = item.unit;
                const allDone = unit.lessons.every((l) => completedLessons.includes(l.id));
                return (
                  <div
                    key={item.id}
                    style={{ position: "absolute", top: item.y, left: PATH_CENTER - 32 }}
                    className="z-20"
                  >
                    <MilestoneChest
                      unlocked={allDone}
                      color={unit.color}
                      chapterNum={item.chapterNum}
                    />
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>

      {/* ── AUDIO CONTROL ────────────────────────────────────────── */}
      <div className="absolute bottom-16 right-5 z-40 flex items-center gap-3">
        <AnimatePresence>
          {showVolumeSlider && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center bg-[#0D1520] border border-[#141E2E] px-3 py-1.5 rounded-lg shadow-xl"
            >
              <input
                type="range" min="0" max="0.8" step="0.05"
                value={bgmVolume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setBgmVolume(v);
                  audioManager.setBgmVolume(v);
                }}
                className="w-20 accent-[#00D4FF] h-1 cursor-pointer"
              />
              <span className="font-mono text-[9px] text-[#64748B] ml-2 w-6 text-right">
                {Math.round(bgmVolume * 100)}%
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => { const next = !isMuted; setIsMuted(next); audioManager.setMute(next); }}
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setTimeout(() => setShowVolumeSlider(false), 3000)}
          className="h-9 w-9 rounded-full bg-[#0D1520] border border-[#141E2E] flex items-center justify-center text-[#64748B] shadow-lg transition-colors hover:bg-[#141E2E]"
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-red-500" /> : <Volume2 className="h-4 w-4 text-[#00D4FF]" />}
        </motion.button>
      </div>

      {/* ── CONTROL HINT BAR ─────────────────────────────────────── */}
      <AnimatePresence>
        {hintsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-center gap-6 py-2 bg-[#060A12]/80 backdrop-blur-sm border-t border-[#0F1A2A]"
          >
            {[
              { key: "Enter", label: "Practice Skill" },
              { key: "Space", label: "Preview Sign" },
              { key: "Esc", label: "Back" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded border border-[#1B2840] bg-[#0D1520] font-mono text-[9px] text-[#64748B]">
                  {key}
                </kbd>
                <span className="text-[9px] text-[#3D4F6A]">{label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM SHEET LESSON MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {selectedLesson && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLesson(null)}
              className="absolute inset-0 z-40 bg-[#060A12]/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 230, damping: 26 }}
              className="absolute bottom-0 inset-x-0 z-50 rounded-t-[32px] border-t-2 border-[#141E2E] bg-[#0f1623] shadow-[0_-16px_48px_rgba(0,0,0,0.6)] p-6"
            >
              <div className="max-w-lg mx-auto flex flex-col gap-5 relative">
                {/* Close */}
                <button
                  type="button"
                  onClick={() => setSelectedLesson(null)}
                  className="absolute top-0 right-0 h-8 w-8 rounded-full bg-[#141E2E] hover:bg-[#1B2840] flex items-center justify-center border border-[#1B2840] transition-colors"
                >
                  <X className="h-4 w-4 text-[#64748B]" />
                </button>

                {/* Lesson info */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[9px] font-display font-black uppercase tracking-widest px-2 py-0.5 rounded-md border"
                      style={{
                        color: selectedColor,
                        borderColor: `${selectedColor}40`,
                        backgroundColor: `${selectedColor}12`,
                      }}
                    >
                      Lesson
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: selectedColor }} />
                  </div>
                  <h3 className="font-display text-xl font-black text-[#F0F4FF]">{selectedLesson.title}</h3>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Practice signing:{" "}
                    <span className="text-[#F0F4FF] font-semibold">{selectedLesson.letters.join(", ")}</span>
                  </p>
                </div>

                {/* XP + Difficulty */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#080C14] border-2 border-[#141E2E] rounded-2xl p-3.5 flex flex-col gap-1.5 shadow-inner">
                    <span className="text-[8px] font-display font-black uppercase tracking-wider text-[#64748B]">XP Reward</span>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#4f8ef7]" />
                      <span className="font-mono text-sm font-bold text-[#FFD700]">+{selectedLesson.xp} XP</span>
                    </div>
                  </div>
                  <div className="bg-[#080C14] border-2 border-[#141E2E] rounded-2xl p-3.5 flex flex-col gap-1.5 shadow-inner">
                    <span className="text-[8px] font-display font-black uppercase tracking-wider text-[#64748B]">Difficulty</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Star
                           key={i}
                           className="h-4 w-4"
                           style={{
                             color: i < selectedLesson.difficulty ? "#FFD700" : "#141E2E",
                             fill: i < selectedLesson.difficulty ? "#FFD700" : "#141E2E",
                           }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Start button */}
                <button
                  type="button"
                  onClick={() => { handleStartLesson(selectedLesson.id); setSelectedLesson(null); }}
                  className="w-full h-12 rounded-2xl font-display font-extrabold text-sm uppercase tracking-widest flex items-center justify-center transition-all duration-100"
                  style={{
                    backgroundColor: selectedColor,
                    color: "#080c14",
                    boxShadow: `0 4px 0 ${selectedColor}bb`,
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "translateY(4px)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = `0 4px 0 ${selectedColor}bb`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = `0 4px 0 ${selectedColor}bb`;
                  }}
                >
                  Start Lesson →
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
