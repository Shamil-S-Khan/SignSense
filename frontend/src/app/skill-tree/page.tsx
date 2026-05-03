"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { SkillTreeCanvas } from "@/components/skill-tree/SkillTreeCanvas";
import { SkillNodePanel } from "@/components/skill-tree/SkillNodePanel";
import Link from "next/link";

export default function SkillTreePage() {
  const [treeData, setTreeData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    // Fetch skill tree data
    apiClient.get("/api/skill-tree/asl")
      .then((data: any) => setTreeData(data))
      .catch(console.error);
  }, []);

  if (!treeData) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">Loading...</div>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* Top Nav */}
      <nav className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors">
          ← Back to Dashboard
        </Link>
        <h1 className="text-xl font-bold">ASL Basics</h1>
      </nav>

      {/* Canvas Area */}
      <div className="w-full h-screen overflow-y-auto scrollbar-hide pt-24 pb-24 relative">
        <SkillTreeCanvas 
          nodes={treeData.nodes} 
          edges={treeData.edges} 
          onNodeClick={(node) => setSelectedNode(node)} 
        />
      </div>

      {/* Slide-in Panel */}
      <SkillNodePanel 
        node={selectedNode} 
        isOpen={!!selectedNode} 
        onClose={() => setSelectedNode(null)} 
      />
    </main>
  );
}
