export const DESIGN_TOKENS = {
  colors: {
    bgPrimary: "#080C14",
    bgElevated: "#0F1623",
    bgCard: "#141E2E",
    accentPrimary: "#00D4FF",
    accentSecondary: "#7C3AED",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    textPrimary: "#F0F4FF",
    textMuted: "#64748B",
  },
  fonts: {
    display: "var(--font-display), Orbitron, sans-serif",
    body: "var(--font-body), Inter, sans-serif",
    mono: "var(--font-mono), monospace",
  },
  transitions: {
    spring: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
    ease: {
      ease: [0.16, 1, 0.3, 1],
      duration: 0.6,
    },
  },
} as const;
