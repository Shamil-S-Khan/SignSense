"use client";

import { useState } from "react";
import { useLocalPracticeStore } from "@/lib/practice/progress";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Sparkles } from "lucide-react";
import { isGuidedOnlyLetter } from "@/lib/practice/lesson-data";

// Helper hand silhouette SVG paths to render as decorative icons
const HAND_SILHOUETTE_PATHS = {
  default: "M12,2A3,3,0,0,0,9,5V12.75L7.41,11.16a2,2,0,0,0-2.83,0,2,2,0,0,0,0,2.83L9,18v1a3,3,0,0,0,3,3h4a3,3,0,0,0,3-3V7a3,3,0,0,0-6,0v5.75L12,2Z",
  fist: "M12 2a3 3 0 0 0-3 3v2H7.5A2.5 2.5 0 0 0 5 9.5v5A3.5 3.5 0 0 0 8.5 18h7a3.5 3.5 0 0 0 3.5-3.5v-5A2.5 2.5 0 0 0 16.5 7H15V5a3 3 0 0 0-3-3z",
  open: "M12,1V8.75L9.67,6.42a1.5,1.5 0 0 0-2.12,0,1.5,1.5 0 0 0,0,2.12L12,13v8a2,2,0,0,0,2,2h4a2,2,0,0,0,2-2V4a1.5,1.5 0 0 0-3,0v4.75L15,1.5a1.5,1.5 0 0 0-3,0Z"
};

// Finger callouts for each letter to make it feel grounded in ASL pedagogy
const LETTER_PEDAGOGY: Record<string, { callouts: string[]; desc: string }> = {
  A: { callouts: ["Thumb resting on side of index finger", "Fingers curled into a tight fist"], desc: "Fist with thumb resting flat against the side of the index finger." },
  B: { callouts: ["Four fingers straight and pressed together", "Thumb crossed flat over palm"], desc: "Flat hand with fingers pointing straight up, thumb folded." },
  C: { callouts: ["All fingers curved in unison", "Thumb bent to parallel fingers"], desc: "Curved shape resembling the letter C, forming an open arc." },
  D: { callouts: ["Index pointing straight up", "Thumb touching middle, ring, and pinky tips"], desc: "Circle formed by thumb and other fingers, index straight." },
  E: { callouts: ["Fingers curled with tips touching thumb", "Thumb tucked tight under index"], desc: "Clawed fist where finger tips rest above or near the thumb." },
  F: { callouts: ["Index and thumb touching at tips", "Middle, ring, and pinky fanned out"], desc: "OK sign with remaining three fingers straight and separated." },
  G: { callouts: ["Index pointing horizontally inward", "Thumb parallel to index pointing left"], desc: "Horizontal pinching gesture without tips touching." },
  H: { callouts: ["Index and middle parallel horizontally", "Thumb folded behind palm"], desc: "Two fingers pointing sideways, similar to G but with two fingers." },
  I: { callouts: ["Pinky pointing straight up", "Fingers folded, thumb closed over them"], desc: "Fist with only the smallest finger extended upward." },
  J: { callouts: ["Pinky hooks downward in a J-shape", "Wrist rotates slightly inward"], desc: "Dynamic sign tracing the letter J in space with pinky." },
  K: { callouts: ["Index and middle pointing up", "Thumb tip touching middle finger knuckle"], desc: "V-shape with thumb tucked between index and middle fingers." },
  L: { callouts: ["Index pointing straight up", "Thumb pointing straight out"], desc: "Classic L shape formed with index and thumb." },
  M: { callouts: ["Thumb tucked under index, middle, and ring", "Three fingers folded over thumb"], desc: "Fist with thumb emerging between ring and pinky fingers." },
  N: { callouts: ["Thumb tucked under index and middle", "Two fingers folded over thumb"], desc: "Fist with thumb emerging between middle and ring fingers." },
  O: { callouts: ["All fingertips touching thumb tip", "Rounded oval profile"], desc: "A closed circle mimicking the letter O." },
  P: { callouts: ["K shape pointed downwards", "Index finger parallel to floor"], desc: "Inverted K sign with index pointing forward, middle down." },
  Q: { callouts: ["G shape pointed downwards", "Thumb and index pointing at floor"], desc: "Inverted G sign pointing down toward the ground." },
  R: { callouts: ["Index and middle crossed tightly", "Thumb resting over ring finger"], desc: "Crossing fingers as if wishing for luck." },
  S: { callouts: ["Thumb closed over front of fingers", "Tight compact fist"], desc: "Classic fist with thumb wrapped securely across the front." },
  T: { callouts: ["Thumb tucked under index finger", "Single knuckle raised slightly"], desc: "Fist with thumb emerging between index and middle fingers." },
  U: { callouts: ["Index and middle standing straight", "Fingers pressed side-by-side"], desc: "Two fingers straight, joined together." },
  V: { callouts: ["Index and middle spread apart", "V shape formed"], desc: "Standard peace sign shape." },
  W: { callouts: ["Index, middle, and ring fanned out", "Pinky touching thumb tip"], desc: "Three fingers extended, similar to number 3." },
  X: { callouts: ["Index finger hooked like a claw", "Other fingers curled tightly"], desc: "Hooked index finger resembling a pirate's hook." },
  Y: { callouts: ["Thumb and pinky fully extended", "Middle three fingers curled flat"], desc: "Shaka sign shape, thumb and pinky out." },
  Z: { callouts: ["Index finger traces a Z in the air", "Hand moves in zig-zag path"], desc: "Dynamic sign tracing the letter Z in front of body." }
};

interface LetterDrillProps {
  onPracticeLetter: (letter: string) => void;
}

export function LetterDrill({ onPracticeLetter }: LetterDrillProps) {
  const recentSessionStats = useLocalPracticeStore((state) => state.recentSessionStats);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // Compute average accuracy and mastery scale for each letter
  const getLetterStats = (letter: string) => {
    const letterStats = recentSessionStats.filter((s) => s.letter.toUpperCase() === letter.toUpperCase());
    if (letterStats.length === 0) return { count: 0, avgAccuracy: 0 };
    
    const sum = letterStats.reduce((acc, curr) => acc + curr.accuracy, 0);
    return {
      count: letterStats.length,
      avgAccuracy: Math.round(sum / letterStats.length)
    };
  };

  // Get color fill intensity based on mastery
  // Get color fill intensity based on mastery
  const getMasteryColor = (letter: string) => {
    const { count, avgAccuracy } = getLetterStats(letter);
    const base = "border-2 transition-all active:translate-y-[2px] duration-100";
    if (count === 0) {
      return `${base} bg-[#1a1d27] border-[#22263a] border-b-4 text-[#9ca3af] hover:bg-[#22263a] active:border-b-2`;
    }
    if (avgAccuracy < 70) {
      return `${base} bg-[#4f8ef7]/10 border-[#4f8ef7]/30 border-b-4 text-[#4f8ef7] hover:bg-[#4f8ef7]/20 active:border-b-2`;
    }
    if (avgAccuracy >= 70 && avgAccuracy < 85) {
      return `${base} bg-[#4f8ef7]/20 border-[#4f8ef7]/50 border-b-4 text-[#f0f2f8] hover:bg-[#4f8ef7]/35 active:border-b-2`;
    }
    if (avgAccuracy >= 85 && avgAccuracy < 95) {
      return `${base} bg-[#4f8ef7]/40 border-[#4f8ef7]/75 border-b-4 text-[#f0f2f8] hover:bg-[#4f8ef7]/55 active:border-b-2`;
    }
    // Mastered (Green)
    return `${base} bg-[#3dd68c]/15 border-[#3dd68c]/60 border-b-4 text-[#3dd68c] hover:bg-[#3dd68c]/30 active:border-b-2`;
  };

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const pedagogy = selectedLetter ? LETTER_PEDAGOGY[selectedLetter] : null;

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#4f8ef7]">Fingerspelling Mastery</span>
        <h2 className="font-display text-2xl font-bold text-[#f0f2f8] mt-1">Manual Alphabet Grid</h2>
        <p className="text-xs text-[#9ca3af] mt-2">
          Heatmap opacity indicates mastery based on your recent accuracy. Tap cells to reveal pedagogy callouts, sign video loops, and fast practice shortcuts.
        </p>
      </div>

      {/* 5-Column Grid */}
      <div className="grid grid-cols-5 gap-3">
        {alphabet.map((letter) => {
          const stats = getLetterStats(letter);
          const isFist = ["A", "E", "S", "T", "M", "N"].includes(letter);
          const isOpen = ["B", "C", "F", "L", "W", "Y"].includes(letter);
          const silhouette = isFist 
            ? HAND_SILHOUETTE_PATHS.fist 
            : isOpen 
              ? HAND_SILHOUETTE_PATHS.open 
              : HAND_SILHOUETTE_PATHS.default;

          return (
            <motion.button
              key={letter}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedLetter(letter)}
              className={`h-24 rounded-2xl flex flex-col items-center justify-between p-3 relative overflow-hidden ${getMasteryColor(
                letter
              )}`}
            >
              {/* Header inside cell: Letter + Silhouette icon */}
              <div className="flex items-center justify-between w-full relative z-10">
                <span className="font-display text-2xl font-black">{letter}</span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4.5 w-4.5 fill-current opacity-40 text-current"
                >
                  <path d={silhouette} />
                </svg>
              </div>
              
              {/* Stats/Status badge */}
              {stats.count > 0 ? (
                <span className="font-mono text-[9px] font-semibold bg-[#0f1117]/30 px-1.5 py-0.5 rounded-[4px] relative z-10">
                  {stats.avgAccuracy}% Acc
                </span>
              ) : (
                <span className="text-[9px] font-bold opacity-40 uppercase font-mono relative z-10">Unseen</span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-end gap-3 text-[10px] text-[#6b7280]">
        <span>Mastery Level:</span>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#1a1d27] border-2 border-[#22263a]" />
          <span>0%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#4f8ef7]/15 border-2 border-[#4f8ef7]/35" />
          <span>&lt;70%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#4f8ef7]/40 border-2 border-[#4f8ef7]/50" />
          <span>70-85%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#4f8ef7]/70 border-2 border-[#4f8ef7]" />
          <span>85-95%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#3dd68c]/75 border-2 border-[#3dd68c]" />
          <span>95%+</span>
        </div>
      </div>

      {/* Detailed Callout Modal */}
      <AnimatePresence>
        {selectedLetter && pedagogy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f1117]/90 px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="max-w-xl w-full bg-[#0f1623] border-2 border-[#22263a] rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden relative"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedLetter(null)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-[#22263a] hover:bg-[#2b304c] text-[#9ca3af] flex items-center justify-center transition-colors z-10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* 16:9 Video Loop + PNG Reference Grid */}
              <div className="w-full grid grid-cols-2 bg-[#0f1117] border-b border-[#22263a] relative overflow-hidden">
                {/* Motion Loop player */}
                <div className="relative aspect-video bg-[#0f1117] border-r border-[#22263a]/50 overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-[#22263a] to-transparent pointer-events-none" />
                  <video
                    src="https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-glass-of-water-43085-large.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover sign-demo-media"
                  />
                  <div className="absolute bottom-2 left-2 bg-[#0f1117]/80 border border-[#22263a] rounded-[6px] px-1.5 py-0.5 text-[8px] font-mono text-[#9ca3af] uppercase">
                    Motion Demo
                  </div>
                </div>

                {/* Static PNG landmarks */}
                <div className="relative aspect-video bg-[#0f1117] overflow-hidden flex items-center justify-center p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/references/${selectedLetter}.png`}
                    alt={`ASL Letter ${selectedLetter}`}
                    className="max-h-[90%] max-w-[90%] object-contain relative z-5 sign-demo-media"
                  />
                  <div className="absolute bottom-2 left-2 bg-[#0f1117]/80 border border-[#22263a] rounded-[6px] px-1.5 py-0.5 text-[8px] font-mono text-[#9ca3af] uppercase">
                    Landmarks
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4f8ef7]">Pedagogy Guide</span>
                    <h3 className="font-display text-2xl font-bold text-[#f0f2f8] mt-1">Letter {selectedLetter}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#f7a84f] bg-[#f7a84f]/10 px-2 py-0.5 rounded-[6px] border border-[#f7a84f]/25">
                    {isGuidedOnlyLetter(selectedLetter) ? "✋ Guided Demonstration" : "👍 Webcam Detectable"}
                  </span>
                </div>

                <p className="text-xs text-[#9ca3af] leading-5 mt-3">{pedagogy.desc}</p>

                {/* Pedagogy Callout Labels */}
                <div className="mt-4 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Critical Landmarks</span>
                  <div className="space-y-1.5">
                    {pedagogy.callouts.map((callout, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-[#f0f2f8] bg-[#22263a]/40 p-2 rounded-xl border border-[#22263a]/50">
                        <Sparkles className="h-3.5 w-3.5 text-[#f7a84f] shrink-0 mt-0.5" />
                        <span>{callout}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Practice Action CTA */}
                <button
                  type="button"
                  onClick={() => {
                    onPracticeLetter(selectedLetter);
                    setSelectedLetter(null);
                  }}
                  className="mt-6 h-12 w-full btn-blue flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Load into Practice Zone
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
