import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isASLCitizenLessonUnlocked, type ASLCitizenLessonDef } from "./lesson-data";

interface ASLCitizenProgress {
  completedLessons: string[];
  completedWords: string[];
  xp: number;
}

const INITIAL: ASLCitizenProgress = {
  completedLessons: [],
  completedWords: [],
  xp: 0,
};

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

interface ASLCitizenProgressStore extends ASLCitizenProgress {
  markWordDone: (word: string, xpDelta?: number) => void;
  markLessonComplete: (lessonId: string) => void;
  isLessonUnlocked: (lesson: Pick<ASLCitizenLessonDef, "unlockAfter">) => boolean;
  resetProgress: () => void;
}

export const useASLCitizenProgressStore = create<ASLCitizenProgressStore>()(
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
        isASLCitizenLessonUnlocked(get().completedLessons, lesson.unlockAfter),

      resetProgress: () => set(INITIAL),
    }),
    { name: "signsense-asl-citizen-progress" },
  ),
);
