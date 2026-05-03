"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface Props {
  sign: string;
  description: string;
  rewardXp: number;
  completed: boolean;
}

export function DailyChallengeCard({ sign, description, rewardXp, completed }: Props) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`p-6 rounded-2xl border-2 ${completed ? 'bg-green-900/20 border-green-500/50' : 'bg-blue-900/20 border-blue-500/50'} backdrop-blur-md relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 font-bold text-6xl pointer-events-none">
        {sign}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Daily Challenge</h3>
      <p className="text-gray-300 mb-4">{description}</p>
      
      <div className="flex justify-between items-center mt-4">
        <span className="text-yellow-400 font-bold">+{rewardXp} XP</span>
        {completed ? (
          <span className="text-green-400 font-bold px-4 py-2 bg-green-900/50 rounded-lg">Completed</span>
        ) : (
          <Link href="/lesson/daily" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-xl transition-colors">
            Start
          </Link>
        )}
      </div>
    </motion.div>
  );
}
