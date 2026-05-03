"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface Props {
  dueCount: number;
}

export function DrillCard({ dueCount }: Props) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="p-6 rounded-2xl bg-purple-900/20 border-2 border-purple-500/50 backdrop-blur-md"
    >
      <h3 className="text-xl font-bold text-white mb-2">Spaced Repetition Drill</h3>
      <p className="text-gray-300 mb-4">
        {dueCount > 0 
          ? `You have ${dueCount} signs due for review.` 
          : "You're all caught up! Practice random signs."}
      </p>
      
      <div className="flex justify-between items-center mt-4">
        <span className="text-purple-400 font-bold">Adaptive</span>
        <Link href="/lesson/drill" className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-xl transition-colors">
          Practice
        </Link>
      </div>
    </motion.div>
  );
}
