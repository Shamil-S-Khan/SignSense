import { create } from "zustand";

interface SessionState {
  currentLessonId: string | null;
  heartsRemaining: number;
  currentAttemptScore: number;
  setLesson: (id: string) => void;
  loseHeart: () => void;
  setScore: (score: number) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentLessonId: null,
  heartsRemaining: 5,
  currentAttemptScore: 0,
  
  setLesson: (id) => set({ currentLessonId: id, heartsRemaining: 5, currentAttemptScore: 0 }),
  loseHeart: () => set((state) => ({ heartsRemaining: Math.max(0, state.heartsRemaining - 1) })),
  setScore: (score) => set({ currentAttemptScore: score }),
  clearSession: () => set({ currentLessonId: null, heartsRemaining: 5, currentAttemptScore: 0 }),
}));
