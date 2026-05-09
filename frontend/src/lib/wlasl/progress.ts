import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isWLASLLessonUnlocked, type WLASLLessonDef } from "./lesson-data";

interface WLASLProgress {
  completedLessons: string[];
  completedWords: string[];
  xp: number;
}

const INITIAL: WLASLProgress = {
  completedLessons: [],
  completedWords: [],
  xp: 0,
};

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

interface WLASLProgressStore extends WLASLProgress {
  markWordDone: (word: string, xpDelta?: number) => void;
  markLessonComplete: (lessonId: string) => void;
  isLessonUnlocked: (lesson: Pick<WLASLLessonDef, "unlockAfter">) => boolean;
  resetProgress: () => void;
}

export const useWLASLProgressStore = create<WLASLProgressStore>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      markWordDone: (word: string, xpDelta = 15) =>
        set((state) => ({
          completedWords: dedupe([...state.completedWords, word.toUpperCase()]),
          xp: state.xp + xpDelta,
        })),

      markLessonComplete: (lessonId: string) =>
        set((state) => ({
          completedLessons: dedupe([...state.completedLessons, lessonId]),
        })),

      isLessonUnlocked: (lesson) =>
        isWLASLLessonUnlocked(get().completedLessons, lesson.unlockAfter),

      resetProgress: () => set(INITIAL),
    }),
    { name: "signsense-wlasl-progress" },
  ),
);
