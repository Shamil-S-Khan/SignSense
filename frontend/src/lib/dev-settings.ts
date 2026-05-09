import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DevSettingsStore {
  devUnlockAll: boolean;
  toggleDevUnlockAll: () => void;
}

export const useDevSettingsStore = create<DevSettingsStore>()(
  persist(
    (set) => ({
      devUnlockAll: false,
      toggleDevUnlockAll: () => set((s) => ({ devUnlockAll: !s.devUnlockAll })),
    }),
    { name: "signsense-dev-settings" },
  ),
);
