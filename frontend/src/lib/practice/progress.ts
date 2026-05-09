import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentPracticeStat {
  lessonId: string | null;
  letter: string;
  accuracy: number;
  completedAt: string;
}

export interface LocalPracticeProgress {
  xp: number;
  streak: number;
  lastPracticeDate: string | null;
  completedLetters: string[];
  completedLessons: string[];
  currentLessonId: string | null;
  heartsRemaining: number;
  recentSessionStats: RecentPracticeStat[];
}

export const INITIAL_PROGRESS: LocalPracticeProgress = {
  xp: 0,
  streak: 0,
  lastPracticeDate: null,
  completedLetters: [],
  completedLessons: [],
  currentLessonId: null,
  heartsRemaining: 5,
  recentSessionStats: [],
};

function dedupe(items: string[]): string[] {
  return items.filter((item, index) => items.indexOf(item) === index);
}

export function computeUpdatedStreak(lastPracticeDate: string | null, today: string, currentStreak: number): number {
  if (lastPracticeDate === today) return currentStreak || 1;

  const [year, month, day] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (lastPracticeDate === yesterdayKey) {
    return currentStreak + 1;
  }

  return 1;
}

export function recordLetterSuccess(
  progress: LocalPracticeProgress,
  params: { letter: string; xpDelta: number; today: string; lessonId?: string | null; accuracy: number },
): LocalPracticeProgress {
  const nextStats: RecentPracticeStat[] = [
    {
      lessonId: params.lessonId ?? null,
      letter: params.letter,
      accuracy: params.accuracy,
      completedAt: `${params.today}T12:00:00.000Z`,
    },
    ...progress.recentSessionStats,
  ].slice(0, 12);

  return {
    ...progress,
    xp: progress.xp + params.xpDelta,
    streak: computeUpdatedStreak(progress.lastPracticeDate, params.today, progress.streak),
    lastPracticeDate: params.today,
    completedLetters: dedupe([...progress.completedLetters, params.letter]),
    recentSessionStats: nextStats,
  };
}

export function completeLesson(progress: LocalPracticeProgress, lessonId: string): LocalPracticeProgress {
  return {
    ...progress,
    completedLessons: dedupe([...progress.completedLessons, lessonId]),
    currentLessonId: null,
    heartsRemaining: 5,
  };
}

export function isLessonUnlocked(progress: LocalPracticeProgress, unlockAfter: string | null): boolean {
  return unlockAfter === null || progress.completedLessons.includes(unlockAfter);
}

interface LocalPracticeStore extends LocalPracticeProgress {
  awardLetterSuccess: (params: { letter: string; xpDelta?: number; lessonId?: string | null; accuracy: number }) => void;
  startLesson: (lessonId: string) => void;
  setHeartsRemaining: (hearts: number) => void;
  loseHeart: () => void;
  markLessonComplete: (lessonId: string) => void;
  resetPractice: () => void;
}

export const useLocalPracticeStore = create<LocalPracticeStore>()(
  persist(
    (set) => ({
      ...INITIAL_PROGRESS,
      awardLetterSuccess: ({ letter, xpDelta = 10, lessonId = null, accuracy }) =>
        set((state) =>
          recordLetterSuccess(state, {
            letter,
            xpDelta,
            today: new Date().toISOString().slice(0, 10),
            lessonId,
            accuracy,
          }),
        ),
      startLesson: (lessonId) => set({ currentLessonId: lessonId, heartsRemaining: 5 }),
      setHeartsRemaining: (heartsRemaining) => set({ heartsRemaining }),
      loseHeart: () => set((state) => ({ heartsRemaining: Math.max(0, state.heartsRemaining - 1) })),
      markLessonComplete: (lessonId) => set((state) => completeLesson(state, lessonId)),
      resetPractice: () => set(INITIAL_PROGRESS),
    }),
    {
      name: "signsense-local-practice",
    },
  ),
);
