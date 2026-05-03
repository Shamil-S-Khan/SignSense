import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  user: {
    id: string;
    email: string;
    display_name: string;
    xp: number;
    level: number;
    current_streak: number;
  } | null;
  setUser: (user: any) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: "user-storage",
    }
  )
);
