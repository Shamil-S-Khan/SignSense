"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import Link from "next/link";

interface Props {
  xpEarned: number;
  accuracy: number;
}

export function ResultsScreen({ xpEarned, accuracy }: Props) {
  useEffect(() => {
    // Fire confetti on mount
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#22c55e', '#3b82f6', '#a855f7']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#22c55e', '#3b82f6', '#a855f7']
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center z-50 px-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center shadow-2xl"
      >
        <h1 className="text-4xl font-bold text-white mb-2">Lesson Complete!</h1>
        <p className="text-gray-400 mb-8">Great job expanding your vocabulary.</p>
        
        <div className="flex justify-center gap-6 mb-8">
          <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-2xl w-32">
            <div className="text-sm text-blue-400 font-bold mb-1">XP Earned</div>
            <div className="text-3xl font-bold text-white">+{xpEarned}</div>
          </div>
          <div className="bg-purple-900/30 border border-purple-500/30 p-4 rounded-2xl w-32">
            <div className="text-sm text-purple-400 font-bold mb-1">Accuracy</div>
            <div className="text-3xl font-bold text-white">{accuracy}%</div>
          </div>
        </div>
        
        <Link 
          href="/"
          className="block w-full py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors text-lg"
        >
          Continue
        </Link>
      </motion.div>
    </div>
  );
}
