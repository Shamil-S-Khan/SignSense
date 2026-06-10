"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Check, Lock, Camera, HelpCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useLocalPracticeStore } from "@/lib/practice/progress";
import toast from "react-hot-toast";

interface CuratedSentence {
  gloss: string[];
  english: string;
  description: string;
}

const CURATED_SENTENCES: CuratedSentence[] = [
  { gloss: ["BOOK", "WANT"], english: "I want a book", description: "Topic-Comment: BOOK then WANT" },
  { gloss: ["SCHOOL", "GO"], english: "Go to school", description: "Topic-Comment: SCHOOL then GO" },
  { gloss: ["BED", "NOW"], english: "Go to bed now", description: "Topic-Comment: BED then NOW" },
  { gloss: ["WHAT", "TIME"], english: "What time is it?", description: "Topic-Comment: TIME then WHAT" },
  { gloss: ["WHO", "PLAY"], english: "Who is playing?", description: "Topic-Comment: PLAY then WHO" },
  { gloss: ["DOG", "LIKE", "PLAY"], english: "The dog likes to play", description: "Subject-Verb-Object: DOG then LIKE then PLAY" },
  { gloss: ["FAMILY", "EAT", "NOW"], english: "The family is eating now", description: "Subject-Verb-Time: FAMILY then EAT then NOW" }
];

const GLOSS_TO_ENGLISH: Record<string, string> = {
  BOOK: "book",
  WANT: "want",
  SCHOOL: "school",
  GO: "go",
  BED: "bed",
  NOW: "now",
  WHAT: "what",
  TIME: "time",
  WHO: "who",
  PLAY: "play",
  DOG: "dog",
  LIKE: "like",
  FAMILY: "family",
  EAT: "eat"
};

const SIGN_VIDEOS: Record<string, string> = {
  BOOK: "https://assets.mixkit.co/videos/preview/mixkit-writing-in-a-book-with-a-pen-43093-large.mp4",
  GO: "https://assets.mixkit.co/videos/preview/mixkit-hand-pointing-forward-43087-large.mp4",
  PLAY: "https://assets.mixkit.co/videos/preview/mixkit-kids-hands-playing-with-blocks-43089-large.mp4",
  SCHOOL: "https://assets.mixkit.co/videos/preview/mixkit-writing-on-a-notebook-43095-large.mp4",
  WANT: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-glass-of-water-43085-large.mp4",
  BED: "https://assets.mixkit.co/videos/preview/mixkit-kids-hands-playing-with-blocks-43089-large.mp4",
  NOW: "https://assets.mixkit.co/videos/preview/mixkit-typing-on-a-computer-keyboard-43091-large.mp4",
  WHAT: "https://assets.mixkit.co/videos/preview/mixkit-hand-pointing-forward-43087-large.mp4",
  TIME: "https://assets.mixkit.co/videos/preview/mixkit-writing-in-a-book-with-a-pen-43093-large.mp4",
  WHO: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-glass-of-water-43085-large.mp4",
  DOG: "https://assets.mixkit.co/videos/preview/mixkit-kids-hands-playing-with-blocks-43089-large.mp4",
  LIKE: "https://assets.mixkit.co/videos/preview/mixkit-writing-on-a-notebook-43095-large.mp4",
  FAMILY: "https://assets.mixkit.co/videos/preview/mixkit-typing-on-a-computer-keyboard-43091-large.mp4",
  EAT: "https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-glass-of-water-43085-large.mp4"
};

export function SentenceBuilder() {
  const awardLetterSuccess = useLocalPracticeStore((state) => state.awardLetterSuccess);
  
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(0);
  const sentence = CURATED_SENTENCES[selectedSentenceIndex]!;
  
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [completedSlots, setCompletedSlots] = useState<boolean[]>([]);
  
  // Detection state machine: IDLE | LISTENING | DETECTED | CONFIRMED | REJECTED
  const [detectionState, setDetectionState] = useState<"IDLE" | "LISTENING" | "DETECTED" | "CONFIRMED" | "REJECTED">("IDLE");
  
  const [predictionLabel, setPredictionLabel] = useState("");
  const [predictionConfidence, setPredictionConfidence] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [handsDetected, setHandsDetected] = useState(false);
  const [timerProgress, setTimerProgress] = useState(0);
  
  // Real Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Floating +15 XP text animations
  const [xpFloats, setXpFloats] = useState<{ id: number; text: string }[]>([]);

  const controls = useAnimation(); // For shaking rejected items
  const activeWord = sentence.gloss[activeSlotIndex] || "";

  // Initialize completed slots when sentence changes
  useEffect(() => {
    setCompletedSlots(new Array(sentence.gloss.length).fill(false));
    setActiveSlotIndex(0);
    setFailureCount(0);
    setShowHint(false);
    setDetectionState("IDLE");
    setTimerProgress(0);
  }, [selectedSentenceIndex, sentence]);

  // Request webcam on mount
  const startCamera = async () => {
    try {
      setCameraError(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360, facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("Webcam access error in SentenceBuilder:", err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle circular progress when LISTENING starts
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (detectionState === "LISTENING") {
      setTimerProgress(0);
      const startTime = Date.now();
      const duration = 1500; // 1.5s window

      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setTimerProgress(progress);

        if (progress >= 100) {
          if (interval) clearInterval(interval);
        }
      }, 30);
    } else {
      setTimerProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [detectionState]);

  // Trigger simulated recognition sequences
  const simulateSignDetection = (matched: boolean) => {
    if (detectionState !== "IDLE") return;
    
    // 1. Move to LISTENING
    setDetectionState("LISTENING");
    setShowHint(false);
    
    // 2. After 1.5s, move to DETECTED
    setTimeout(() => {
      setDetectionState("DETECTED");
      const label = matched ? activeWord : "DARK"; // wrong word
      setPredictionLabel(label);
      setPredictionConfidence(matched ? 0.94 : 0.76);
      
      // 3. After 1s, either CONFIRM or REJECT
      setTimeout(() => {
        if (matched) {
          setDetectionState("CONFIRMED");
          
          // Trigger floating XP (+15 XP)
          const floatId = Date.now();
          setXpFloats((prev) => [...prev, { id: floatId, text: "+15 XP" }]);

          // Trigger XP store boost (+15 XP)
          awardLetterSuccess({ letter: activeWord, xpDelta: 15, accuracy: 94 });
          toast.success(`Correct sign: ${activeWord}! +15 XP`);
          
          // Mark current slot as completed
          setCompletedSlots((prev) => {
            const next = [...prev];
            next[activeSlotIndex] = true;
            return next;
          });
          
          // Auto advance after 600ms
          setTimeout(() => {
            setDetectionState("IDLE");
            if (activeSlotIndex < sentence.gloss.length - 1) {
              setActiveSlotIndex((prev) => prev + 1);
              setFailureCount(0);
            } else {
              toast.success("Sentence complete! Magnificent phrasing.");
            }
          }, 600);
          
        } else {
          setDetectionState("REJECTED");
          setFailureCount((prev) => prev + 1);
          controls.start({
            x: [0, -6, 6, -6, 6, 0],
            transition: { duration: 0.4 }
          });
          
          // Return to idle after 1.5s so they can try again
          setTimeout(() => {
            setDetectionState("IDLE");
          }, 1500);
        }
      }, 1000);
    }, 1500);
  };

  const showConfidence = predictionConfidence >= 0.60;

  return (
    <div className="card w-full flex flex-col overflow-hidden bg-[#1a1d27] border border-[#22263a] rounded-xl font-body">
      
      {/* ──────────────── TOP ZONE (60% Height) ──────────────── */}
      <div className="p-6 border-b border-[#22263a] bg-[#1a1d27] flex flex-col justify-between min-h-[260px]">
        
        {/* Sentence Selection */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6b7280]">Curriculum Zone</span>
            <h2 className="font-display text-xl font-bold text-[#f0f2f8] mt-1">Topic-Comment Sentence Builder</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9ca3af]">Sentence:</span>
            <select
              value={selectedSentenceIndex}
              onChange={(e) => setSelectedSentenceIndex(Number(e.target.value))}
              className="bg-[#0f1117] border border-[#22263a] text-xs rounded-md text-[#f0f2f8] px-3 py-1.5 focus:outline-none focus:border-[#4f8ef7]"
            >
              {CURATED_SENTENCES.map((s, idx) => (
                <option key={idx} value={idx}>
                  {s.gloss.join(" ")} ({s.english})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sentence display zone */}
        <div className="my-6 relative">
          
          {/* Floating XP animations */}
          <AnimatePresence>
            {xpFloats.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, y: 10, scale: 0.8 }}
                animate={{ opacity: 0, y: -45, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                onAnimationComplete={() => {
                  setXpFloats((prev) => prev.filter((item) => item.id !== f.id));
                }}
                className="absolute z-20 text-[#3dd68c] font-mono text-xs font-bold bg-[#132a22] border border-[#3dd68c]/35 px-2 py-0.5 rounded-[6px] shadow-[0_0_12px_rgba(61,214,140,0.2)] left-10 top-0"
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-4">
            {sentence.gloss.map((word, idx) => {
              const isCompleted = completedSlots[idx];
              const isActive = idx === activeSlotIndex && !isCompleted;

              const englishLabel = GLOSS_TO_ENGLISH[word] || word.toLowerCase();

              return (
                <div key={idx} className="flex flex-col items-center min-w-[100px]">
                  {/* English Gloss above chip */}
                  <span className="text-[10px] font-bold text-[#9ca3af] mb-1.5 uppercase tracking-wider font-mono">
                    {englishLabel}
                  </span>

                  {/* Slot chip with shared layoutId */}
                  <motion.div
                    layoutId={`word-slot-${word}`}
                    className={`h-14 w-full px-4 rounded-xl flex items-center justify-center gap-2 border transition-all duration-300 relative ${
                      isCompleted
                        ? "bg-[#3dd68c] border-[#3dd68c] text-[#0f1117] font-semibold"
                        : isActive
                          ? "border-[#4f8ef7] bg-[#1a2035] text-[#f0f2f8] ring-2 ring-[#4f8ef7]/40 ring-offset-2 ring-offset-[#0f1117] shadow-[0_0_12px_rgba(79,142,247,0.2)]"
                          : "border-[#6b7280]/20 bg-[#0f1117]/50 text-[#6b7280]"
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <Check className="h-4 w-4 stroke-[3px]" />
                        <span className="font-display font-bold text-sm">{word}</span>
                      </>
                    ) : isActive ? (
                      <div className="relative flex items-center justify-center gap-2 pl-2">
                        {/* Circular Progress timer ring */}
                        {detectionState === "LISTENING" && (
                          <svg className="absolute -left-5 h-4.5 w-4.5 -rotate-90">
                            <circle
                              cx="9"
                              cy="9"
                              r="7"
                              stroke="rgba(79, 142, 247, 0.15)"
                              strokeWidth="2"
                              fill="transparent"
                            />
                            <circle
                              cx="9"
                              cy="9"
                              r="7"
                              stroke="#4f8ef7"
                              strokeWidth="2"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 7}
                              strokeDashoffset={2 * Math.PI * 7 - (timerProgress / 100) * 2 * Math.PI * 7}
                            />
                          </svg>
                        )}
                        <span className="font-display font-bold text-sm tracking-wide animate-pulse">{word}</span>
                      </div>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span className="font-display font-medium text-sm">{word}</span>
                      </>
                    )}
                  </motion.div>

                  {/* Try again sub-label */}
                  <AnimatePresence>
                    {isActive && detectionState === "REJECTED" && (
                      <motion.span
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-[10px] text-[#f75f5f] font-bold mt-1.5 uppercase tracking-wider animate-pulse font-mono"
                      >
                        Try again
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-[#9ca3af] italic">
            English translation: &ldquo;{sentence.english}&rdquo; &#8212; {sentence.description}
          </p>
        </div>

        {/* State description */}
        <div className="flex items-center justify-between text-xs text-[#6b7280]">
          <span>Vocabulary: WLASL-100 Curated List</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#4f8ef7] animate-pulse" />
            <span className="text-[#9ca3af] uppercase font-semibold tracking-wider font-mono">
              Status: {detectionState}
            </span>
          </div>
        </div>

      </div>

      {/* ──────────────── BOTTOM ZONE (40% Height) ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] h-[260px] bg-[#0f1117] relative">
        
        {/* Left Side: Live Feed Container */}
        <div className="relative h-full flex items-center justify-center p-3 border-r border-[#22263a]/40">
          
          {/* 16:9 Camera Feed Wrapper (rounded-12/rounded-xl) */}
          <div
            className={`w-full max-w-[320px] aspect-video rounded-xl overflow-hidden bg-[#1a1d27] relative transition-all duration-300 ${
              detectionState === "CONFIRMED"
                ? "border-4 border-[#3dd68c] shadow-[0_0_15px_rgba(61,214,140,0.2)]"
                : handsDetected
                  ? "border-2 border-[#4f8ef7]"
                  : "border border-[#22263a]"
            }`}
          >
            {/* Real Camera Stream */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ transform: "scaleX(-1)", objectFit: "cover" }}
              className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
                cameraActive ? "opacity-100" : "opacity-0"
              }`}
            />

            <div className="absolute inset-0 z-5 flex items-center justify-center bg-zinc-950/80 pointer-events-none">
              {!cameraActive && (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-8 w-8 text-[#6b7280] opacity-40 animate-pulse" />
                  <span className="text-[10px] text-[#6b7280] font-mono">
                    {cameraError ? "Camera Access Denied" : "Camera Offline"}
                  </span>
                </div>
              )}
              
              {/* Hand Detection Overlay prompt */}
              {!handsDetected && cameraActive && (
                <div className="absolute inset-x-0 bottom-4 text-center z-10">
                  <span className="bg-[#1a1d27]/90 text-[10px] px-2.5 py-1 rounded-md border border-[#22263a] text-[#9ca3af] uppercase tracking-wider font-mono">
                    Show your hands in frame
                  </span>
                </div>
              )}

              {/* Skeletal mock overlay simulating landmarks */}
              {handsDetected && cameraActive && (
                <svg className="absolute inset-0 h-full w-full pointer-events-none z-10" viewBox="0 0 100 100">
                  <path d="M50,85 L48,70 L40,55 L35,45 M50,85 L58,72 L62,58 L68,48" stroke="#4f8ef7" strokeWidth="1.5" fill="none" opacity="0.6" />
                  <circle cx="35" cy="45" r="2" fill="#3dd68c" />
                  <circle cx="68" cy="48" r="2" fill="#3dd68c" />
                  <circle cx="50" cy="85" r="2.5" fill="#f7a84f" />
                </svg>
              )}

              {/* 3s Hint video overlay loop */}
              {showHint && (
                <div className="absolute inset-0 z-20 bg-black/95 flex flex-col items-center justify-center p-2 pointer-events-auto">
                  <span className="text-[10px] uppercase font-bold text-[#f7a84f] mb-1 font-mono">3s Demonstration</span>
                  <div className="w-full aspect-video bg-[#22263a] rounded border border-[#22263a] relative overflow-hidden flex items-center justify-center">
                    <video
                      src={SIGN_VIDEOS[activeWord] || SIGN_VIDEOS.BOOK}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover sign-demo-media"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHint(false)}
                    className="mt-2 text-[10px] font-bold text-[#f75f5f] hover:underline uppercase tracking-wider font-mono"
                  >
                    Close Demo
                  </button>
                </div>
              )}
            </div>

            {/* Float-up prediction info when DETECTED */}
            <AnimatePresence>
              {(detectionState === "DETECTED" || detectionState === "CONFIRMED" || detectionState === "REJECTED") && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="absolute inset-x-0 top-3 flex justify-center z-30 pointer-events-none"
                >
                  <motion.div
                    animate={detectionState === "REJECTED" ? controls : {}}
                    className={`px-3 py-1.5 rounded-full border shadow-lg flex items-center gap-2 pointer-events-auto ${
                      detectionState === "CONFIRMED"
                        ? "bg-[#132a22] border-[#3dd68c] text-[#3dd68c]"
                        : detectionState === "REJECTED"
                          ? "bg-[#2d1b20] border-[#f75f5f] text-[#f75f5f]"
                          : "bg-[#1a1d27] border-[#4f8ef7] text-[#4f8ef7]"
                    }`}
                  >
                    <span className="font-display font-bold text-xs">{predictionLabel}</span>
                    {showConfidence && (
                      <span className="font-mono text-[10px] font-medium opacity-80">
                        {Math.round(predictionConfidence * 100)}%
                      </span>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

        {/* Right Side: Interactive Simulation & Dev Controls */}
        <div className="h-full p-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Simulation Deck</span>
              {detectionState === "IDLE" && (
                <span className="text-[9px] uppercase font-bold text-[#6b7280] font-mono">Sign when ready</span>
              )}
            </div>
            
            {/* Waveform indicator */}
            {detectionState === "LISTENING" && (
              <div className="flex items-center gap-1.5 h-6">
                <span className="text-xs text-[#6b7280]">LISTENING:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((bar) => (
                    <motion.div
                      key={bar}
                      animate={{ height: [4, 16, 4] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: bar * 0.15 }}
                      className="w-1 bg-[#4f8ef7] rounded-full"
                    />
                  ))}
                </div>
              </div>
            )}

            {detectionState === "REJECTED" && (
              <div className="flex items-center gap-1.5 h-6 text-[#f75f5f]">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold">Try again: shape offset too high</span>
              </div>
            )}

            {detectionState === "IDLE" && (
              <div className="text-xs text-[#6b7280] h-6 flex items-center">
                Mime or trigger sign matching sequence
              </div>
            )}
          </div>

          {/* Interactive Trigger Buttons */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={detectionState !== "IDLE" || completedSlots[activeSlotIndex]}
                onClick={() => simulateSignDetection(true)}
                className="h-10 text-xs font-bold rounded-lg border border-[#4f8ef7]/30 bg-[#4f8ef7]/10 hover:bg-[#4f8ef7]/20 text-[#4f8ef7] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                Sign Match
              </button>
              
              <button
                type="button"
                disabled={detectionState !== "IDLE" || completedSlots[activeSlotIndex]}
                onClick={() => simulateSignDetection(false)}
                className="h-10 text-xs font-bold rounded-lg border border-[#f75f5f]/30 bg-[#f75f5f]/10 hover:bg-[#f75f5f]/20 text-[#f75f5f] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Sign Deviant
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Landmark simulator helper */}
              <button
                type="button"
                onClick={() => setHandsDetected(!handsDetected)}
                className={`h-9 rounded-md border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                  handsDetected
                    ? "bg-[#3dd68c]/10 border-[#3dd68c]/30 text-[#3dd68c]"
                    : "bg-[#22263a] border-zinc-800 text-[#9ca3af]"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                {handsDetected ? "Hands On" : "Hands Off"}
              </button>

              {/* Camera Toggle control */}
              <button
                type="button"
                onClick={cameraActive ? stopCamera : startCamera}
                className={`h-9 rounded-md border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                  cameraActive
                    ? "bg-[#4f8ef7]/10 border-[#4f8ef7]/30 text-[#4f8ef7]"
                    : "bg-[#22263a] border-zinc-800 text-[#9ca3af]"
                }`}
              >
                {cameraActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {cameraActive ? "Cam Off" : "Cam On"}
              </button>
            </div>

            {/* Hint Trigger */}
            {failureCount >= 3 && (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="h-9 w-full bg-[#f7a84f] text-[#0f1117] font-bold text-xs rounded-md hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5 uppercase tracking-wider font-mono shadow-md shadow-[#f7a84f]/15"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Need a hint?
              </button>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
