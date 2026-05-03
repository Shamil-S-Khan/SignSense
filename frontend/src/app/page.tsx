"use client";

import { useEffect, useState } from "react";
import { DailyChallengeCard } from "@/components/home/DailyChallengeCard";
import { DrillCard } from "@/components/home/DrillCard";
import { WeeklyXPBar } from "@/components/home/WeeklyXPBar";
import { useUserStore } from "@/stores/userStore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const { user } = useUserStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-2xl font-bold">
              {user?.display_name?.charAt(0) || "U"}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user?.display_name || "User"}</h1>
              <p className="text-gray-400">Level {user?.level || 1}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-orange-900/30 px-4 py-2 rounded-xl border border-orange-500/30">
            <span className="text-2xl">🔥</span>
            <span className="text-xl font-bold text-orange-400">{user?.current_streak || 0}</span>
          </div>
        </header>

        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <DailyChallengeCard 
            sign="A" 
            description="Perfect the letter A to earn bonus XP today!" 
            rewardXp={100} 
            completed={false} 
          />
          <DrillCard dueCount={12} />
        </div>

        {/* Continue Button & Weekly Progress */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div className="md:col-span-1" whileHover={{ scale: 1.02 }}>
            <Link href="/skill-tree" className="block h-full bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 flex flex-col justify-center items-center text-center shadow-lg shadow-blue-900/50">
              <span className="text-4xl mb-4">🗺️</span>
              <h2 className="text-2xl font-bold text-white mb-2">Skill Tree</h2>
              <p className="text-blue-200">Continue your ASL journey</p>
            </Link>
          </motion.div>
          <div className="md:col-span-2">
            <WeeklyXPBar currentXp={user?.xp || 0} targetXp={1000} />
          </div>
        </div>
      </div>
    </main>
  );
}
