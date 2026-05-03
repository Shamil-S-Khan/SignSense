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
  // Simple cubic bezier drawing
  const drawEdge = (fromNode: Node, toNode: Node) => {
    const startX = fromNode.x;
    const startY = fromNode.y;
    const endX = toNode.x;
    const endY = toNode.y;
    
    // Control points for vertical tree
    const cp1x = startX;
    const cp1y = startY + (endY - startY) / 2;
    const cp2x = endX;
    const cp2y = startY + (endY - startY) / 2;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto h-[800px]">
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {edges.map((edge, i) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;
          
          return (
            <path 
              key={i}
              d={drawEdge(fromNode, toNode)}
              fill="none"
              stroke={toNode.unlocked ? "#3B82F6" : "#374151"}
              strokeWidth="4"
              strokeDasharray={toNode.unlocked ? "none" : "8,8"}
            />
          );
        })}
      </svg>

      {nodes.map(node => (
        <motion.div
          key={node.id}
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full w-20 h-20 flex flex-col items-center justify-center cursor-pointer
            ${node.completed ? 'bg-gradient-to-tr from-blue-600 to-purple-600 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 
              node.unlocked ? 'bg-gray-800 border-2 border-blue-500 text-white' : 
              'bg-gray-900 border-2 border-gray-700 text-gray-600'}`}
          style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: 10 }}
          whileHover={node.unlocked ? { scale: 1.1 } : {}}
          whileTap={node.unlocked ? { scale: 0.95 } : {}}
          onClick={() => node.unlocked && onNodeClick(node)}
        >
          {node.completed ? (
            <span className="text-2xl text-white font-bold">★</span>
          ) : !node.unlocked ? (
            <span className="text-xl">🔒</span>
          ) : (
            <span className="text-xl">☆</span>
          )}
          <span className="absolute -bottom-8 whitespace-nowrap font-bold text-sm text-gray-300">
            {node.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
