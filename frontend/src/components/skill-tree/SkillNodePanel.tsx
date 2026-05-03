"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Props {
  node: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SkillNodePanel({ node, isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && node && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-800 p-8 shadow-2xl z-50 overflow-y-auto"
          >
            <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white">
              ✕
            </button>
            
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-3xl mb-6">
              {node.completed ? "★" : "☆"}
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-2">{node.label}</h2>
            <p className="text-gray-400 mb-8">Master the fundamentals to unlock new signs and conversational abilities.</p>
            
            <div className="bg-gray-800/50 rounded-2xl p-6 mb-8 border border-gray-700/50">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Vocabulary</h3>
              <div className="flex flex-wrap gap-2">
                {node.signs?.map((sign: string) => (
                  <span key={sign} className="bg-gray-700 text-white px-3 py-1 rounded-full font-bold">
                    {sign}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <Link 
                href={`/lesson/${node.id}`}
                className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-center py-4 rounded-xl transition-colors shadow-lg shadow-blue-900/20"
              >
                Start Lesson
              </Link>
              
              <Link 
                href={`/lesson/${node.id}?mode=practice`}
                className="block w-full bg-gray-800 hover:bg-gray-700 text-white font-bold text-center py-4 rounded-xl transition-colors border border-gray-700"
              >
                Free Practice
              </Link>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
