import { motion } from "framer-motion";

interface Props {
  hearts: number;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"
        fill={filled ? "#ff4b8c" : "none"}
        stroke={filled ? "#ff4b8c" : "#e5e5e5"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function HeartBar({ hearts }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= hearts;
        return (
          <motion.div
            key={i}
            animate={{ scale: 1, opacity: filled ? 1 : 0.4 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="drop-shadow-sm"
          >
            <HeartIcon filled={filled} />
          </motion.div>
        );
      })}
      <span className="ml-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b0b0b0]">
        {hearts}/5
      </span>
    </div>
  );
}
