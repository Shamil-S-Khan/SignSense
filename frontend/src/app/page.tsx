"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Layers, X } from "lucide-react";
import toast from "react-hot-toast";

import { ProgressHeader } from "@/components/polished/ProgressHeader";
import { WordLearningCard, type WordData } from "@/components/polished/WordLearningCard";
import { SentenceBuilder } from "@/components/polished/SentenceBuilder";
import { LetterDrill } from "@/components/polished/LetterDrill";
import { SkillTree } from "@/components/polished/SkillTree";

import { SignReference } from "@/components/lesson/SignReference";
import { ScoreBars } from "@/components/lesson/ScoreBars";
import { WebcamFeed } from "@/components/webcam/WebcamFeed";
import { smoothDetections, shouldAllowSuccess, type DetectionSample, type ScoreBreakdown } from "@/lib/practice/feedback";
import { ALL_REFERENCE_LETTERS, isGuidedOnlyLetter } from "@/lib/practice/lesson-data";
import { useLocalPracticeStore } from "@/lib/practice/progress";
import type { VADState, WorkerMetrics } from "@/workers/mediapipe.types";

const INITIAL_SCORES: ScoreBreakdown = { handshape: 0, movement: 0, orientation: 0 };
const INITIAL_METRICS: WorkerMetrics = { fps: 0, latencyMs: 0, droppedFrames: 0 };

interface SkillNode {
  id: string;
  title: string;
  type: "letters" | "sentences";
  items: string[];
  unlockAfter: string | null;
  description: string;
}

const _SKILL_TREE_NODES: SkillNode[] = [
  {
    id: "node-abc",
    title: "Alphabet Basics",
    type: "letters",
    items: ["A", "B", "C"],
    unlockAfter: null,
    description: "Learn the core hand silhouettes for fingerspelling letters A, B, and C."
  },
  {
    id: "node-def",
    title: "Fingerspelling Prep",
    type: "letters",
    items: ["D", "E", "F"],
    unlockAfter: "node-abc",
    description: "Expand your manual spelling vocabulary with D, E, and F shape poses."
  },
  {
    id: "node-sent1",
    title: "Sentences: Topic-Comment",
    type: "sentences",
    items: ["BOOK WANT", "SCHOOL GO"],
    unlockAfter: "node-def",
    description: "Construct fundamental ASL sentences following topic-comment grammar order."
  },
  {
    id: "node-ghi",
    title: "Advanced Handshapes",
    type: "letters",
    items: ["G", "H", "I"],
    unlockAfter: "node-sent1",
    description: "Master horizontal gestures and smallest finger poses for G, H, and I."
  },
  {
    id: "node-sent2",
    title: "Sentences: Question Forms",
    type: "sentences",
    items: ["WHAT TIME", "WHO PLAY"],
    unlockAfter: "node-ghi",
    description: "Analyze and practice visual grammar for simple query sentences."
  },
  {
    id: "node-jkl",
    title: "Fingerspelling Mastery",
    type: "letters",
    items: ["J", "K", "L"],
    unlockAfter: "node-sent2",
    description: "Learn dynamic wrist rotations and finger junctions for J, K, and L."
  },
  {
    id: "node-sent3",
    title: "Sentences: Subject-Verb-Object",
    type: "sentences",
    items: ["DOG LIKE PLAY", "FAMILY EAT NOW"],
    unlockAfter: "node-jkl",
    description: "Synthesize full sentences using subject-verb-object spatial alignments."
  }
];

const MOCK_WORD_CARDS: WordData[] = [
  {
    word: "BOOK",
    phonetic: "bʊk",
    example: "Open and close both palms flat, like opening a book. Used in sentences like: BOOK WANT.",
    status: "mastered",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-writing-in-a-book-with-a-pen-43093-large.mp4"
  },
  {
    word: "DRINK",
    phonetic: "drɪŋk",
    example: "Form a C-hand and move it to your mouth as if drinking. Used in: DRINK NOW.",
    status: "learning",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-glass-of-water-43085-large.mp4"
  },
  {
    word: "COMPUTER",
    phonetic: "kəmˈpjuːtər",
    example: "Brush the dominant C-hand along the non-dominant forearm. Used in: COMPUTER WORK.",
    status: "unseen",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-typing-on-a-computer-keyboard-43091-large.mp4"
  },
  {
    word: "GO",
    phonetic: "ɡoʊ",
    example: "Point both index fingers and arc them forward together. Used in: SCHOOL GO.",
    status: "mastered",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hand-pointing-forward-43087-large.mp4"
  },
  {
    word: "PLAY",
    phonetic: "pleɪ",
    example: "Shake Y-hands loosely at the sides. Used in: WHO PLAY or DOG LIKE PLAY.",
    status: "learning",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-kids-hands-playing-with-blocks-43089-large.mp4"
  },
  {
    word: "SCHOOL",
    phonetic: "skuːl",
    example: "Clap hands twice with a slight offset. Used in: SCHOOL GO.",
    status: "unseen",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-writing-on-a-notebook-43095-large.mp4"
  }
];

export default function Home() {
  // Navigation Tabs: 'tree' | 'practice'
  const [activeTab, setActiveTab] = useState<"tree" | "practice">("tree");

  // Free Practice Selector Sub-tabs: 'letters' | 'words'
  const [practiceSubTab, setPracticeSubTab] = useState<"letters" | "words">("letters");

  // Zustand Store variables

  const _completedLessons = useLocalPracticeStore((state) => state.completedLessons);
  const awardLetterSuccess = useLocalPracticeStore((state) => state.awardLetterSuccess);
  const markLessonComplete = useLocalPracticeStore((state) => state.markLessonComplete);
  const _xp = useLocalPracticeStore((state) => state.xp);
  const _streak = useLocalPracticeStore((state) => state.streak);
  const _heartsRemaining = useLocalPracticeStore((state) => state.heartsRemaining);
  const _loseHeart = useLocalPracticeStore((state) => state.loseHeart);

  // Active fingerspelling target in Free Practice
  const [targetLetter, setTargetLetter] = useState("A");
  const isGuided = isGuidedOnlyLetter(targetLetter);

  // Feedback and overlay tracking
  const [scores, setScores] = useState<ScoreBreakdown>(INITIAL_SCORES);
  const [lastDetection, setLastDetection] = useState<{ sign: string; confidence: number } | null>(null);
  const [feedback, setFeedback] = useState("Start the camera and match the target handshape.");
  const [overlayMessage, setOverlayMessage] = useState<string | null>(null);
  const [overlayTone, setOverlayTone] = useState<"success" | "guided" | "neutral">("neutral");
  const [vadState, setVadState] = useState<VADState>("IDLE");
  const [metrics, setMetrics] = useState<WorkerMetrics>(INITIAL_METRICS);
  const [segmentCount, setSegmentCount] = useState(0);
  const [xpBurst, setXpBurst] = useState<number | null>(null);
  const [isCorrectFlash, setIsCorrectFlash] = useState(false);

  const detectionHistoryRef = useRef<DetectionSample[]>([]);
  const lastSuccessAtRef = useRef<number | null>(null);

  // Modal active lesson from Skill Tree
  const [activeLessonNode, setActiveLessonNode] = useState<SkillNode | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [lessonFeedback, setLessonFeedback] = useState("Perform the target signs to advance.");

  // Word learning card selected item simulation
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);

  // Target letter practice logic
  const handleDetection = (sign: string, confidence: number, detailScores: ScoreBreakdown) => {
    setLastDetection({ sign, confidence });
    setScores(detailScores);

    detectionHistoryRef.current = [...detectionHistoryRef.current.slice(-2), { sign, confidence, scores: detailScores }];
    const smoothed = smoothDetections(detectionHistoryRef.current);
    if (!smoothed) {
      if (confidence >= 0.35) {
        const msg = `Detected ${sign}. Hold steady for ${activeLessonNode ? activeLessonNode.items[activeLessonIndex] : targetLetter}.`;
        if (activeLessonNode) setLessonFeedback(msg);
        else setFeedback(msg);
      }
      return;
    }

    const currentTarget = activeLessonNode ? activeLessonNode.items[activeLessonIndex] : targetLetter;

    if (smoothed.sign !== currentTarget) {
      const msg = `Stable read is ${smoothed.sign}. Adjust toward ${currentTarget}.`;
      if (activeLessonNode) setLessonFeedback(msg);
      else setFeedback(msg);
      return;
    }

    const averageAccuracy = Math.round((smoothed.scores.handshape + smoothed.scores.movement + smoothed.scores.orientation) / 3);
    if (smoothed.confidence >= 0.45 && shouldAllowSuccess(lastSuccessAtRef.current, performance.now())) {
      triggerSuccess(currentTarget, averageAccuracy);
    }
  };

  const triggerSuccess = (matchedSign: string, accuracy: number) => {
    lastSuccessAtRef.current = performance.now();
    awardLetterSuccess({ letter: matchedSign, accuracy });
    setXpBurst(10);
    setIsCorrectFlash(true);
    setOverlayTone("success");
    setOverlayMessage("Correct");

    const successMsg = `Clean match for ${matchedSign}. +10 XP`;
    if (activeLessonNode) setLessonFeedback(successMsg);
    else setFeedback(successMsg);

    window.setTimeout(() => setXpBurst(null), 900);
    window.setTimeout(() => setOverlayMessage(null), 800);
    window.setTimeout(() => setIsCorrectFlash(false), 950);

    window.setTimeout(() => {
      if (activeLessonNode) {
        // Advance in active letter lesson
        if (activeLessonIndex < activeLessonNode.items.length - 1) {
          setActiveLessonIndex((prev) => prev + 1);
          setScores(INITIAL_SCORES);
          setLastDetection(null);
          detectionHistoryRef.current = [];
          setLessonFeedback(`Match target: ${activeLessonNode.items[activeLessonIndex + 1]}`);
        } else {
          // Finished lesson!
          markLessonComplete(activeLessonNode.id);
          toast.success(`Lesson complete! ${activeLessonNode.title} mastered. +25 XP bonus!`);
          // Boost extra XP
          awardLetterSuccess({ letter: matchedSign, xpDelta: 25, accuracy });
          setActiveLessonNode(null);
        }
      } else {
        // Free Practice: cycle target letter
        const currentIdx = ALL_REFERENCE_LETTERS.indexOf(matchedSign as typeof ALL_REFERENCE_LETTERS[number]);
        const nextLetter = ALL_REFERENCE_LETTERS[(currentIdx + 1) % ALL_REFERENCE_LETTERS.length];
        setTargetLetter(nextLetter);
        setScores(INITIAL_SCORES);
        setLastDetection(null);
        detectionHistoryRef.current = [];
        setFeedback(`Next target: ${nextLetter}. Hold steady.`);
      }
    }, 1050);
  };

  const handleGuidedPractice = () => {
    setOverlayTone("guided");
    setOverlayMessage("Guided");
    const currentTarget = activeLessonNode ? activeLessonNode.items[activeLessonIndex] : targetLetter;
    
    const msg = `Marked ${currentTarget} as guided. Advanced!`;
    if (activeLessonNode) setLessonFeedback(msg);
    else setFeedback(msg);
    
    triggerSuccess(currentTarget, 88);
  };

  // Jump from LetterDrill or card grid straight to Free Practice target letter
  const handleLoadLetterToPractice = (letter: string) => {
    setTargetLetter(letter);
    setScores(INITIAL_SCORES);
    setLastDetection(null);
    detectionHistoryRef.current = [];
    setFeedback(`${letter} loaded. Match the target pose.`);
  };

  return (
    <div className="h-screen w-screen bg-[#0f1117] text-[#f0f2f8] flex flex-col overflow-hidden font-body select-none">
      
      {/* P0 — Persistent Progress & Stats Header */}
      <ProgressHeader />

      {/* Tabs Menu Bar */}
      <section className="bg-[#0f1623]/80 border-b-2 border-[#141e2e] px-6 py-3.5 flex items-center justify-between shrink-0 z-20">
        <div className="flex bg-[#080c14] p-1 rounded-full border-2 border-[#141e2e] gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("tree")}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-extrabold uppercase tracking-wider transition-all rounded-full ${
              activeTab === "tree" 
                ? "text-[#ffffff] bg-[#4f8ef7] shadow-[0_2px_0_#2860c2]" 
                : "text-[#6b7280] hover:text-[#9ca3af]"
            }`}
          >
            <Layers className="h-4 w-4" />
            Progression Tree
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("practice")}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-extrabold uppercase tracking-wider transition-all rounded-full ${
              activeTab === "practice" 
                ? "text-[#ffffff] bg-[#4f8ef7] shadow-[0_2px_0_#2860c2]" 
                : "text-[#6b7280] hover:text-[#9ca3af]"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Free Practice Playground
          </button>
        </div>

        {/* Small SVG hand trail decoration */}
        <div className="h-8 w-20 opacity-20 pointer-events-none hidden md:block">
          <svg className="h-full w-full stroke-[#4f8ef7] fill-none" viewBox="0 0 100 20">
            <motion.path
              d="M 5 15 Q 30 2 55 15 T 95 2"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 4, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
            />
          </svg>
        </div>
      </section>

      {/* Main Container - fits exactly on one page */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">

          {/* ──────────────── TAB 1: PROGRESSION TREE ──────────────── */}
          {activeTab === "tree" && (
            <motion.div
              key="tree"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full w-full overflow-hidden"
            >
              <SkillTree />

            </motion.div>
          )}

          {/* ──────────────── TAB 2: FREE PRACTICE PLAYGROUND ──────────────── */}
          {activeTab === "practice" && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full w-full grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] p-6 gap-6 overflow-hidden"
            >
              {/* Left Column: Webcam and scores indicators */}
              <div className="flex flex-col gap-4 overflow-hidden h-full">
                
                {/* 16:9 mirror camera element */}
                <div className="shrink-0 relative">
                  <WebcamFeed
                    disablePose
                    overlayMessage={overlayMessage}
                    overlayTone={overlayTone}
                    onSignDetected={handleDetection}
                    onSignSegment={() => setSegmentCount((count) => count + 1)}
                    onStatusChange={({ vadState: nextVadState, metrics: nextMetrics }) => {
                      setVadState(nextVadState);
                      setMetrics(nextMetrics);
                    }}
                  />
                </div>

                {/* Score indicators */}
                <div className="shrink-0">
                  <ScoreBars
                    handshapeScore={scores.handshape}
                    movementScore={scores.movement}
                    orientationScore={scores.orientation}
                  />
                </div>

                {/* VAD feedback & performance metrics logs */}
                <div className="flex-1 bg-[#1a1d27] border border-[#22263a] rounded-xl p-4 flex flex-col justify-between min-h-0 overflow-y-auto">
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-bold text-[#6b7280] tracking-widest block">Live Feedback</span>
                    <p className="text-xs text-[#9ca3af] leading-relaxed pr-2">{feedback}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#22263a]/40 shrink-0">
                      <div className="bg-[#0f1117] p-2 rounded-lg border border-[#22263a]">
                        <span className="text-[9px] uppercase font-bold text-[#6b7280]">Detected</span>
                        <p className="text-xs font-semibold text-[#f0f2f8] mt-0.5">{lastDetection?.sign ?? "—"}</p>
                      </div>
                      <div className="bg-[#0f1117] p-2 rounded-lg border border-[#22263a]">
                        <span className="text-[9px] uppercase font-bold text-[#6b7280]">Confidence</span>
                        <p className="text-xs font-semibold text-[#f0f2f8] mt-0.5">
                          {lastDetection ? `${Math.round(lastDetection.confidence * 100)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-[#22263a]/40 pt-3 mt-3">
                    <div className="text-center">
                      <div className="text-[9px] font-mono text-[#6b7280] uppercase">FPS</div>
                      <div className="text-xs font-bold text-[#f0f2f8] font-mono">{metrics.fps || "—"}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] font-mono text-[#6b7280] uppercase">Latency</div>
                      <div className="text-xs font-bold text-[#f0f2f8] font-mono">{metrics.latencyMs ? `${metrics.latencyMs}ms` : "—"}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] font-mono text-[#6b7280] uppercase">Segments</div>
                      <div className="text-xs font-bold text-[#f0f2f8] font-mono">{segmentCount}</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Active target details and Compact grids */}
              <div className="flex flex-col gap-4 overflow-hidden h-full">
                
                {/* Active Target Card */}
                <div className="bg-[#1a1d27] border border-[#22263a] rounded-xl p-4 flex items-center justify-between shrink-0 relative overflow-hidden">
                  {xpBurst !== null && (
                    <div className="absolute right-4 top-4 bg-[#3dd68c] text-[#0f1117] text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px]">
                      +{xpBurst} XP
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#6b7280] tracking-widest block">Active target</span>
                      <h3 className="font-display text-4xl font-black text-[#f0f2f8] mt-1">{targetLetter}</h3>
                      
                      <div className="flex gap-1.5 mt-2">
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isGuided ? "bg-[#f7a84f]/10 text-[#f7a84f] border border-[#f7a84f]/25" : "bg-[#4f8ef7]/10 text-[#4f8ef7] border border-[#4f8ef7]/25"
                        }`}>
                          {isGuided ? "Guided Poses" : "Real-time AI"}
                        </span>
                        <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#22263a] text-[#9ca3af]">
                          {vadState}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-24">
                    <SignReference
                      sign={targetLetter}
                      isHighlighted={isCorrectFlash}
                      caption={isGuided ? "Match Pose" : "Align Hand"}
                    />
                  </div>
                </div>

                {/* Toggle tab selectors for Free Practice target components */}
                <div className="flex-1 bg-[#1a1d27] border border-[#22263a] rounded-xl p-4 flex flex-col overflow-hidden">
                  <div className="flex border-b border-[#22263a] pb-2 mb-3 shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setPracticeSubTab("letters")}
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
                        practiceSubTab === "letters" ? "bg-[#4f8ef7]/15 text-[#4f8ef7]" : "text-[#6b7280] hover:text-[#9ca3af]"
                      }`}
                    >
                      Alphabet Grid
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setPracticeSubTab("words")}
                      className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded transition-colors ${
                        practiceSubTab === "words" ? "bg-[#4f8ef7]/15 text-[#4f8ef7]" : "text-[#6b7280] hover:text-[#9ca3af]"
                      }`}
                    >
                      Vocabulary flashcards
                    </button>
                  </div>

                  {/* Scrollable target lists */}
                  <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    {practiceSubTab === "letters" ? (
                      <LetterDrill onPracticeLetter={handleLoadLetterToPractice} />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                        {MOCK_WORD_CARDS.map((word, idx) => (
                          <WordLearningCard
                            key={word.word}
                            data={word}
                            cardState={selectedWordIndex === idx ? "selected" : "idle"}
                            onSelect={() => setSelectedWordIndex(idx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ──────────────── ACTIVE LESSON MODAL OVERLAY ──────────────── */}
      <AnimatePresence>
        {activeLessonNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#0f1117]/95 flex items-center justify-center p-6"
          >
            <div className="max-w-4xl w-full h-[85vh] bg-[#1a1d27] border border-[#22263a] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
              
              {/* Close/Quit Lesson Button */}
              <button
                type="button"
                onClick={() => setActiveLessonNode(null)}
                className="absolute top-4 right-4 h-9 w-9 rounded-full bg-[#22263a] hover:bg-[#2b304c] text-[#9ca3af] flex items-center justify-center transition-colors z-50"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Lesson header */}
              <div className="px-6 py-4 border-b border-[#22263a] bg-[#1a1d27] shrink-0">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#4f8ef7]">
                  Active Lesson Path Node
                </span>
                <h3 className="font-display text-lg font-bold text-[#f0f2f8] mt-0.5">
                  {activeLessonNode.title}
                </h3>
              </div>

              {/* Lesson core content zone */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6">
                {activeLessonNode.type === "letters" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 h-full items-start">
                    
                    {/* Left side: Mirrored aspect-video camera feed */}
                    <div className="space-y-4">
                      <div className="relative">
                        <WebcamFeed
                          disablePose
                          overlayMessage={overlayMessage}
                          overlayTone={overlayTone}
                          onSignDetected={handleDetection}
                          onSignSegment={() => setSegmentCount((count) => count + 1)}
                        />
                      </div>
                      <ScoreBars
                        handshapeScore={scores.handshape}
                        movementScore={scores.movement}
                        orientationScore={scores.orientation}
                      />
                    </div>

                    {/* Right side: target card */}
                    <div className="space-y-4">
                      <div className="bg-[#0f1117] border border-[#22263a] rounded-xl p-5 flex items-center justify-between relative overflow-hidden">
                        {xpBurst !== null && (
                          <div className="absolute right-4 top-4 bg-[#3dd68c] text-[#0f1117] text-[10px] font-mono font-bold px-2 py-0.5 rounded-[6px]">
                            +{xpBurst} XP
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#6b7280] tracking-widest block">Sign target</span>
                          <h4 className="font-display text-5xl font-black text-[#f0f2f8] mt-1">
                            {activeLessonNode.items[activeLessonIndex]}
                          </h4>
                          <span className="text-[9px] uppercase font-bold text-[#9ca3af] bg-[#22263a] px-2 py-0.5 rounded-full mt-2 inline-block">
                            Progress: {activeLessonIndex + 1}/{activeLessonNode.items.length}
                          </span>
                        </div>

                        <div className="shrink-0 w-24">
                          <SignReference
                            sign={activeLessonNode.items[activeLessonIndex]}
                            isHighlighted={isCorrectFlash}
                            caption="Match Poses"
                          />
                        </div>
                      </div>

                      {/* Lesson specific guidance logs */}
                      <div className="bg-[#0f1117]/50 border border-[#22263a] rounded-xl p-4 space-y-2">
                        <span className="text-[9px] uppercase font-bold text-[#6b7280] tracking-widest block">Instructions</span>
                        <p className="text-xs text-[#9ca3af] leading-relaxed">{lessonFeedback}</p>
                        {isGuidedOnlyLetter(activeLessonNode.items[activeLessonIndex]) && (
                          <button
                            type="button"
                            onClick={handleGuidedPractice}
                            className="w-full h-10 mt-2 bg-[#f7a84f] text-[#0f1117] font-bold text-xs rounded-lg hover:bg-amber-400 active:bg-amber-600 transition-colors"
                          >
                            ✅ Mark Pose Complete (Guided reference)
                          </button>
                        )}
                      </div>

                    </div>

                  </div>
                ) : (
                  // Sentence lesson node launches SentenceBuilder directly inside modal
                  <div className="h-full pb-4">
                    <SentenceBuilder />
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
