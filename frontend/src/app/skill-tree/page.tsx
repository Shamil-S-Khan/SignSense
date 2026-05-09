"use client";

import { useState } from "react";
import Link from "next/link";
import { SkillNodePanel } from "@/components/skill-tree/SkillNodePanel";
import { SkillTreeCanvas } from "@/components/skill-tree/SkillTreeCanvas";
import { LESSONS } from "@/lib/practice/lesson-data";
import { isLessonUnlocked, useLocalPracticeStore } from "@/lib/practice/progress";
import { WLASL_LESSONS, isWLASLLessonUnlocked } from "@/lib/wlasl/lesson-data";
import { useWLASLProgressStore } from "@/lib/wlasl/progress";
import { useDevSettingsStore } from "@/lib/dev-settings";

const NODE_POSITIONS = [
  { x: 50, y: 10 },
  { x: 28, y: 24 },
  { x: 72, y: 24 },
  { x: 50, y: 40 },
  { x: 28, y: 56 },
  { x: 72, y: 56 },
  { x: 50, y: 72 },
  { x: 34, y: 88 },
  { x: 66, y: 88 },
] as const;

const CATEGORY_META: Record<string, { color: string; badge: string; border: string; bg: string; text: string }> = {
  Beginner:     { color: "green",  badge: "bg-[#edffd6] text-[#45a301]",   border: "border-[#58cc02]/25",  bg: "bg-[#edffd6]/50",  text: "text-[#45a301]" },
  Intermediate: { color: "blue",   badge: "bg-[#e8f9ff] text-[#0a9de0]",   border: "border-[#1cb0f6]/25",  bg: "bg-[#e8f9ff]/50",  text: "text-[#0a9de0]" },
  Advanced:     { color: "purple", badge: "bg-[#f5e8ff] text-[#a855f7]",   border: "border-[#ce82ff]/25",  bg: "bg-[#f5e8ff]/50",  text: "text-[#a855f7]" },
  Expert:       { color: "yellow", badge: "bg-[#fff9e0] text-[#ff9600]",   border: "border-[#ffc800]/25",  bg: "bg-[#fff9e0]/50",  text: "text-[#ff9600]" },
};

export default function SkillTreePage() {
  const completedLessons = useLocalPracticeStore((state) => state.completedLessons);
  const completedLetters = useLocalPracticeStore((state) => state.completedLetters);
  const xp = useLocalPracticeStore((state) => state.xp);

  const wlaslCompleted = useWLASLProgressStore((state) => state.completedLessons);
  const wlaslXp = useWLASLProgressStore((state) => state.xp);

  const devUnlockAll = useDevSettingsStore((s) => s.devUnlockAll);
  const toggleDevUnlockAll = useDevSettingsStore((s) => s.toggleDevUnlockAll);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodes = LESSONS.map((lesson, index) => ({
    id: lesson.id,
    label: lesson.title,
    signs: lesson.letters,
    guidedOnly: lesson.guidedOnly,
    completed: completedLessons.includes(lesson.id),
    unlocked: isLessonUnlocked(
      {
        xp: 0,
        streak: 0,
        lastPracticeDate: null,
        completedLetters,
        completedLessons,
        currentLessonId: null,
        heartsRemaining: 5,
        recentSessionStats: [],
      },
      lesson.unlockAfter,
    ),
    x: NODE_POSITIONS[index]?.x ?? 50,
    y: NODE_POSITIONS[index]?.y ?? 50,
  }));

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const edges = LESSONS.slice(1).map((lesson) => ({ from: lesson.unlockAfter ?? LESSONS[0].id, to: lesson.id }));

  const totalXp = xp + wlaslXp;
  const alphabetProgress = Math.round((completedLetters.length / 26) * 100);

  return (
    <main className="min-h-screen bg-[#b985e8] px-4 py-5 text-[#3c3c3c] md:px-8">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5">

        {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <header className="relative overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white p-6 shadow-md">

          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Link
                  href="/"
                  className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b0b0b0] transition hover:text-[#777777]"
                >
                  SignSense
                </Link>
                <span className="text-[#d0d0d0]">/</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1cb0f6]">
                  Skill Tree
                </span>
              </div>
              <h1 className="font-display text-4xl font-extrabold text-[#3c3c3c] md:text-5xl">
                Your <span className="text-gradient-pink">Progress</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#777777]">
                Work through the alphabet and unlock WLASL video lessons. Guided prompts help with letters that need motion-aware recognition.
              </p>

              {/* Alphabet progress bar */}
              <div className="mt-4 max-w-sm">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  <span>Alphabet mastery</span>
                  <span className="text-[#ff4b8c]">{completedLetters.length}/26</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#ffd6e7]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${alphabetProgress}%`,
                      background: "#ff4b8c",
                      boxShadow: "0 0 8px rgba(255,75,140,0.4)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Stats + controls */}
            <div className="flex flex-wrap items-center gap-2">
              <XpOrb value={totalXp} label="Total XP" />
              <ProgressOrb value={completedLessons.length} max={LESSONS.length} label="Lessons" color="emerald" />
              <ProgressOrb value={wlaslCompleted.length} max={WLASL_LESSONS.length} label="WLASL" color="violet" />

              {/* Dev toggle */}
              <button
                type="button"
                onClick={toggleDevUnlockAll}
                title={devUnlockAll ? "Dev: all lessons unlocked" : "Dev: progression locked"}
                className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.16em] transition ${
                  devUnlockAll
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    : "border-[#e5e5e5] bg-[#f5f5f5] text-[#b0b0b0] hover:border-[#cccccc] hover:text-[#777777]"
                }`}
              >
                <span
                  className={`relative inline-block h-3 w-6 rounded-full transition-colors ${
                    devUnlockAll ? "bg-amber-400" : "bg-[#e5e5e5]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-2 w-2 rounded-full bg-white shadow transition-all ${
                      devUnlockAll ? "left-[calc(100%-10px)]" : "left-0.5"
                    }`}
                  />
                </span>
                DEV
              </button>

              <Link
                href="/collect"
                className="inline-flex h-10 items-center rounded-xl border border-[#ffc800]/30 bg-[#fff9e0] px-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#ff9600] transition hover:bg-[#fff3c0]"
              >
                Collect Data
              </Link>

              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#777777] transition hover:bg-[#eeeeee]"
              >
                &#x2190; Home
              </Link>
            </div>
          </div>
        </header>

        <SkillTreeCanvas nodes={nodes} edges={edges} onNodeClick={(node) => setSelectedNodeId(node.id)} />
        <SkillNodePanel node={selectedNode} isOpen={selectedNode !== null} onClose={() => setSelectedNodeId(null)} />

        {/* â”€â”€ WLASL Words Track â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="rounded-3xl border border-[#e5e5e5] bg-white p-6 shadow-md">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#a855f7]">
                I3D · Video recognition
              </p>
              <h2 className="font-display mt-1 text-2xl font-extrabold text-[#3c3c3c]">WLASL Word Lessons</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[#777777]">
                Record yourself signing each word. The AI analyses your video and checks if it matches. 5 words per lesson &#x2013; 3 hearts each.
              </p>
            </div>
            <div className="flex gap-2">
              <XpOrb value={wlaslXp} label="WLASL XP" />
              <ProgressOrb value={wlaslCompleted.length} max={WLASL_LESSONS.length} label="Done" color="violet" />
            </div>
          </div>

          {(["Beginner", "Intermediate", "Advanced", "Expert"] as const).map((cat) => {
            const catLessons = WLASL_LESSONS.filter((l) => l.category === cat);
            const meta = CATEGORY_META[cat]!;
            return (
              <div key={cat} className="mb-8 last:mb-0">
                <div className="mb-3 flex items-center gap-3">
                  <span className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.22em] ${meta.badge}`}>
                    {cat}
                  </span>
                <div className="h-px flex-1 bg-[#e5e5e5]" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {catLessons.map((lesson) => {
                    const unlocked = devUnlockAll || isWLASLLessonUnlocked(wlaslCompleted, lesson.unlockAfter);
                    const completed = wlaslCompleted.includes(lesson.id);

                    const cardBorder = completed
                      ? "border-[#58cc02]/30"
                      : unlocked
                        ? `${meta.border}`
                        : "border-[#e5e5e5]";
                    const cardBg = completed
                      ? "bg-[#edffd6]/50"
                      : unlocked
                        ? `${meta.bg}`
                        : "bg-[#fafafa]";

                    return (
                      <div
                        key={lesson.id}
                        className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 ${cardBorder} ${cardBg} ${
                          unlocked && !completed ? "hover:-translate-y-0.5 hover:shadow-lg" : ""
                        } ${!unlocked ? "opacity-50" : ""}`}
                      >
                        {/* Left accent bar */}
                        <div
                          className="absolute inset-y-0 left-0 w-0.5 rounded-full"
                          style={{
                            background: completed
                              ? "linear-gradient(to bottom, #34d399, #10b981)"
                              : unlocked
                                ? `linear-gradient(to bottom, var(--${meta.color}), transparent)`
                                : "transparent",
                          }}
                        />

                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b0b0b0]">
                            {lesson.id.replace("wlasl-", "Lesson ")}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              completed
                              ? "bg-[#edffd6] text-[#45a301]"
                              : unlocked
                                ? `${meta.badge}`
                                : "bg-[#f5f5f5] text-[#b0b0b0]"
                            }`}
                          >
                            {completed ? "&#x2713; Done" : unlocked ? "Ready" : "&#x1f512; Locked"}
                          </span>
                        </div>

                        <p className="font-display mb-3 font-bold text-[#3c3c3c]">{lesson.title}</p>

                        {/* Word badges */}
                        <div className="mb-4 flex flex-wrap gap-1.5">
                          {lesson.words.map((w) => (
                            <span
                              key={w}
                              className="rounded-lg border border-[#e5e5e5] bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#777777]"
                            >
                              {w}
                            </span>
                          ))}
                        </div>

                        {unlocked && (
                          <div className="flex gap-2">
                            <Link
                              href={`/wlasl/${lesson.id}`}
                              className={`inline-flex h-9 flex-1 items-center justify-center rounded-xl text-[11px] font-black uppercase tracking-[0.14em] transition ${
                                completed
                                  ? "bg-[#edffd6] text-[#45a301] hover:bg-[#d4ffac]"
                                  : "text-white hover:opacity-90"
                              }`}
                              style={
                                !completed
                                  ? {
                                      background: "#1cb0f6",
                                      boxShadow: "0 3px 0 #0a9de0",
                                      borderRadius: "9999px",
                                    }
                                  : {}
                              }
                            >
                              {completed ? "Redo" : "Start Lesson"}
                            </Link>
                            <Link
                              href={`/wlasl/${lesson.id}?mode=practice`}
                              className="inline-flex h-9 items-center justify-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#777777] transition hover:bg-[#eeeeee]"
                            >
                              Practice
                            </Link>
                          </div>
                        )}

                        {!unlocked && (
                          <div className="flex h-9 w-full items-center justify-center rounded-xl bg-[#f5f5f5] text-[11px] font-bold uppercase tracking-[0.16em] text-[#b0b0b0]">
                            Complete previous lesson
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function XpOrb({ value, label }: { value: number; label: string }) {
  return (
  <div className="rounded-2xl border border-[#ffc800]/30 bg-[#fff9e0] px-4 py-2.5 text-center shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff9600]">⚡ {label}</p>
      <p className="font-display text-xl font-black text-[#3c3c3c]">{value}</p>
    </div>
  );
}

function ProgressOrb({ value, max, label, color }: { value: number; max: number; label: string; color: "emerald" | "violet" }) {
  const colorMap = {
    emerald: "border-[#58cc02]/30 bg-[#edffd6] text-[#45a301]",
    violet:  "border-[#ce82ff]/30 bg-[#f5e8ff] text-[#a855f7]",
  };
  return (
    <div className={`rounded-2xl border px-4 py-2.5 text-center shadow-sm ${colorMap[color]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="font-display text-xl font-black text-[#3c3c3c]">{value}/{max}</p>
    </div>
  );
}

