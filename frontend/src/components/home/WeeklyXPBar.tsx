"use client";

import { motion } from "framer-motion";

interface Props {
  currentXp: number;
  targetXp: number;
}

export function WeeklyXPBar({ currentXp, targetXp }: Props) {
  const progress = Math.min(100, Math.max(0, (currentXp / targetXp) * 100));

  return (
    <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 backdrop-blur-md">
      <div className="flex justify-between items-end mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">Weekly Goal</h3>
          <p className="text-sm text-gray-400">Reach {targetXp} XP to advance league</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-yellow-400">{currentXp}</span>
          <span className="text-gray-500"> / {targetXp} XP</span>
        </div>
      </div>
      
      <div className="h-4 w-full bg-gray-800 rounded-full overflow-hidden mt-4">
        <motion.div 
          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
