"use client";

import { motion } from "framer-motion";

interface Node {
  id: string;
  label: string;
  unlocked: boolean;
  completed: boolean;
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
}

interface Props {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
}

export function SkillTreeCanvas({ nodes, edges, onNodeClick }: Props) {
  const drawEdge = (fromNode: Node, toNode: Node) => {
    const startX = fromNode.x;
    const startY = fromNode.y;
    const endX = toNode.x;
    const endY = toNode.y;
    const cp1x = startX;
    const cp1y = startY + (endY - startY) / 2;
    const cp2x = endX;
    const cp2y = startY + (endY - startY) / 2;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  };

  return (
    <div className="relative mx-auto h-[860px] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#e5e5e5] bg-white p-8 shadow-md">
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {edges.map((edge) => {
          const fromNode = nodes.find((node) => node.id === edge.from);
          const toNode = nodes.find((node) => node.id === edge.to);
          if (!fromNode || !toNode) return null;

          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={drawEdge(fromNode, toNode)}
              fill="none"
              stroke={toNode.unlocked ? "rgba(255,75,140,0.8)" : "rgba(200,200,200,0.8)"}
              strokeWidth="5"
              strokeDasharray={toNode.unlocked ? "none" : "10 10"}
            />
          );
        })}
      </svg>

      {nodes.map((node) => (
        <motion.button
          key={node.id}
          type="button"
          className={`absolute flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-center transition ${
            node.completed
              ? "border-[#58cc02] bg-[#edffd6] text-[#3c3c3c] shadow-[0_0_20px_rgba(88,204,2,0.25)]"
              : node.unlocked
                ? "border-[#1cb0f6] bg-[#e8f9ff] text-[#3c3c3c] animate-glow-pulse"
                : "border-[#e5e5e5] bg-white/60 text-[#b0b0b0] backdrop-blur-sm"
          }`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          whileHover={node.unlocked ? { scale: 1.05 } : undefined}
          whileTap={node.unlocked ? { scale: 0.97 } : undefined}
          onClick={() => node.unlocked && onNodeClick(node)}
        >
          {node.completed ? (
            <>
              <span className="text-2xl">&#10003;</span>
              <span className="mt-1 text-xs font-bold uppercase tracking-[0.18em]">{node.label}</span>
            </>
          ) : node.unlocked ? (
            <>
              <span className="text-2xl font-black">GO</span>
              <span className="mt-1 text-xs font-bold uppercase tracking-[0.18em]">{node.label}</span>
            </>
          ) : (
            <>
              <span className="text-xl opacity-40">&#128274;</span>
              <span className="mt-1 text-xs font-bold uppercase tracking-[0.18em] opacity-50">{node.label}</span>
            </>
          )}
        </motion.button>
      ))}
    </div>
  );
}
