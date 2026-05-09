"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { SignReference } from "@/components/lesson/SignReference";

interface SkillNode {
  id: string;
  label: string;
  completed: boolean;
  signs?: string[];
  guidedOnly?: string[];
}

interface Props {
  node: SkillNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SkillNodePanel({ node, isOpen, onClose }: Props) {
  return (
    <AnimatePresence>
      {isOpen && node ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#b985e8]/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 24, stiffness: 220 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-[#e5e5e5] bg-white p-8 shadow-2xl"
          >
            <button type="button" onClick={onClose} className="ml-auto rounded-full border border-[#e5e5e5] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#777777] hover:bg-[#f5f5f5]">
              Close
            </button>

            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1cb0f6]">Local lesson</p>
              <h2 className="mt-3 text-4xl font-black text-[#3c3c3c]">{node.label}</h2>
              <p className="mt-3 text-sm leading-6 text-[#777777]">
                Work through the prompt letters in order. Guided letters use the reference card only, while detectable letters listen for a stable match before advancing.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              {node.signs?.map((sign) => (
                <div key={sign} className="rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
                  <SignReference sign={sign} caption={(node.guidedOnly ?? []).includes(sign) ? "Guided" : "Detectable"} />
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-[#e5e5e5] bg-[#f5f5f5] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b0b0b0]">Status</p>
              <p className="mt-2 text-lg font-black text-[#3c3c3c]">{node.completed ? "Completed locally" : "Ready to practice"}</p>
            </div>

            <Link
              href={`/lesson/${node.id}`}
              className="mt-8 inline-flex h-14 items-center justify-center text-sm font-black uppercase tracking-[0.18em] text-white transition hover:opacity-90"
              style={{ background: "#1cb0f6", boxShadow: "0 4px 0 #0a9de0", borderRadius: "9999px" }}
            >
              Start Lesson
            </Link>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
