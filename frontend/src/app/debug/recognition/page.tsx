"use client";

/**
 * Live recognition debug page.
 *
 * Renders a webcam feed, runs the 2-stage classifier in debug mode on every
 * landmarks frame, and displays the RecognitionDebugOverlay with full feature
 * values, bucket, candidate scores, and rejection reasons.
 *
 * Only available in development mode.
 *
 * URL: /debug/recognition
 */

import { useCallback, useRef, useState } from "react";
import type { NormalizedLandmarks } from "@/workers/mediapipe.types";
import * as FingerspellingModule from "@/lib/inference/fingerspelling-fallback";
import type { DebugRecognitionOutput } from "@/lib/inference/features";
import { RecognitionDebugOverlay } from "@/components/debug/RecognitionDebugOverlay";
import { WebcamFeed } from "@/components/webcam/WebcamFeed";

const IS_DEV = process.env.NODE_ENV !== "production";

export default function DebugRecognitionPage() {
  const [debugOutput, setDebugOutput] = useState<DebugRecognitionOutput | null>(null);
  const [detectedLetter, setDetectedLetter] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const frameCountRef = useRef(0);

  const handleLandmarks = useCallback((landmarks: NormalizedLandmarks) => {
    const hand =
      landmarks.rightHand.length === 21
        ? landmarks.rightHand
        : landmarks.leftHand.length === 21
        ? landmarks.leftHand
        : null;

    if (!hand) {
      setDebugOutput(null);
      return;
    }

    // Call with debug=true so lastDebugOutput is populated as a side-effect.
    const result = FingerspellingModule.classifyFingerspellingFallback(hand, true);

    // lastDebugOutput is a live ES-module binding; it was just set synchronously.
    setDebugOutput(FingerspellingModule.lastDebugOutput);

    if (result) {
      setDetectedLetter(result.letter);
      setConfidence(result.confidence);
    } else {
      setDetectedLetter(null);
      setConfidence(null);
    }

    frameCountRef.current++;
  }, []);

  if (!IS_DEV) {
    return (
      <div className="p-8 text-red-500 font-mono">
        This page is only available in development mode.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-cyan-400 font-mono">
          Recognition Debug
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Hold E, M, N, R, S, or T in front of the camera to inspect feature
          values and bucket classification.
        </p>
      </div>

      <div className="relative w-full max-w-xl">
        <WebcamFeed
          disablePose
          onLandmarks={handleLandmarks}
          onSignDetected={(sign: string, conf: number) => {
            setDetectedLetter(sign);
            setConfidence(conf);
          }}
        />

        {/* Large letter readout centred over the feed */}
        {detectedLetter && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-8xl font-black text-white/80 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {detectedLetter}
            </span>
          </div>
        )}
      </div>

      {/* Prompt cards */}
      <div className="flex gap-3 flex-wrap justify-center">
        {(["E", "M", "N", "R", "S", "T"] as const).map((l) => (
          <div
            key={l}
            className={`w-14 h-14 flex items-center justify-center rounded-xl border-2 text-2xl font-black transition-all ${
              detectedLetter === l
                ? "border-cyan-400 bg-cyan-900/60 text-cyan-300 scale-110"
                : "border-gray-700 bg-gray-900 text-gray-500"
            }`}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Debug overlay (floating panel) */}
      <RecognitionDebugOverlay
        output={debugOutput}
        detectedLetter={detectedLetter}
        confidence={confidence}
      />
    </main>
  );
}
