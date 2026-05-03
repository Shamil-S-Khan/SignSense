"use client";

import { motion } from "framer-motion";

interface Props {
  handshapeScore: number;
  movementScore: number;
  orientationScore: number;
}

export function ScoreBars({ handshapeScore, movementScore, orientationScore }: Props) {
  const getColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const renderBar = (label: string, score: number) => (
    <div className="mb-4">
      <div className="flex justify-between text-sm font-bold text-gray-300 mb-1">
        <span>{label}</span>
        <span>{Math.round(score)}%</span>
      </div>
      <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className={`h-full rounded-full ${getColor(score)}`}
        />
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900 border-2 border-gray-800 p-6 rounded-2xl">
      <h3 className="text-xl font-bold text-white mb-6">Execution Analysis</h3>
      {renderBar("Handshape", handshapeScore)}
      {renderBar("Movement", movementScore)}
      {renderBar("Orientation", orientationScore)}
    </div>
  );
}
