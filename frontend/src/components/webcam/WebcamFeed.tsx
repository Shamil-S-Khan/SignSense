"use client";
import { useEffect, useCallback, useRef } from "react";
import { useWebcam } from "@/hooks/useWebcam";
import { useMediaPipeWorker } from "@/hooks/useMediaPipeWorker";
import { SkeletonOverlay } from "./SkeletonOverlay";
import { classifyFingerspellingFallback } from "@/lib/inference/fingerspelling-fallback";

const WIDTH = 640;
const HEIGHT = 480;

interface Props {
  onSignReady?: (frames: Float32Array) => void;
  onSignDetected?: (
    sign: string, 
    confidence: number, 
    scores?: { handshape: number; movement: number; orientation: number }
  ) => void;
  /** Callback to forward raw landmark arrays to WebSocket */
  onLandmarksForWS?: (landmarks: number[]) => void;
  /** Whether backend WebSocket is connected (disables local fallback) */
  wsConnected?: boolean;
  /** Disable pose detection to save performance (good for alphabet) */
  disablePose?: boolean;
}

export function WebcamFeed({ onSignReady, onSignDetected, onLandmarksForWS, wsConnected, disablePose }: Props) {
  const { videoRef, isStreaming, error, startCapture, stopCapture } = useWebcam();
  const { isReady, landmarks, rawHandsRef, vadState, sendFrame, setPoseEnabled, onSignReady: signReadyRef, onSignDetected: signDetectedRef } = useMediaPipeWorker();
  const frameCountRef = useRef(0);

  // Forward disablePose prop to the worker once it's ready
  // Must depend on isReady — before that, workerRef is null and the message is dropped
  useEffect(() => {
    if (!isReady) return;
    setPoseEnabled(!disablePose);
  }, [isReady, disablePose, setPoseEnabled]);

  // Wire up sign ready callback
  useEffect(() => {
    signReadyRef.current = onSignReady ?? null;
  }, [onSignReady, signReadyRef]);

  // Wire up sign detected callback (legacy GRU path — kept as fallback)
  useEffect(() => {
    signDetectedRef.current = (idx, confidence) => {
      if (!wsConnected) {
        onSignDetected?.(`sign_${idx}`, confidence, {
          handshape: confidence * 100,
          movement: 90,
          orientation: 90
        });
      }
    };
  }, [onSignDetected, signDetectedRef, wsConnected]);

  // Forward landmarks to WebSocket + local fallback classification
  useEffect(() => {
    if (!landmarks) return;

    const hand = landmarks.rightHand.length > 0 ? landmarks.rightHand : landmarks.leftHand;
    
    // Skip frames to reduce lag (only send 15fps to the backend)
    frameCountRef.current++;
    const shouldSkip = frameCountRef.current % 2 !== 0;

    // Debug: log detection state every ~60 frames
    if (!shouldSkip && Math.random() < 0.05) {
      console.log(`[WebcamFeed] rightHand=${landmarks.rightHand.length}, leftHand=${landmarks.leftHand.length}, pose=${landmarks.pose.length}, wsConnected=${wsConnected}`);
    }
    
    if (hand.length !== 21 || shouldSkip) return;

    // Always forward to WebSocket if available
    if (onLandmarksForWS) {
      const flat: number[] = [];
      
      // 1. Dominant hand (first 63 floats) — kept for fingerspelling model compatibility
      for (let i = 0; i < 21; i++) {
        const lm = hand[i] || { x: 0, y: 0, z: 0 };
        flat.push(lm.x, lm.y, lm.z);
      }
      
      // 2. Full set for Pose-TGCN (dynamic signs)
      // Left Hand (21)
      for (let i = 0; i < 21; i++) {
        const lm = landmarks.leftHand[i] || { x: 0, y: 0, z: 0 };
        flat.push(lm.x, lm.y, lm.z);
      }
      // Right Hand (21)
      for (let i = 0; i < 21; i++) {
        const lm = landmarks.rightHand[i] || { x: 0, y: 0, z: 0 };
        flat.push(lm.x, lm.y, lm.z);
      }
      // Pose (33)
      for (let i = 0; i < 33; i++) {
        const lm = (!disablePose ? landmarks.pose[i] : null) || { x: 0, y: 0, z: 0 };
        flat.push(lm.x, lm.y, lm.z);
      }
      
      onLandmarksForWS(flat);
    }

    // Local fingerpose fallback only when WS is disconnected
    if (!wsConnected && onSignDetected) {
      const result = classifyFingerspellingFallback(hand);
      if (result) {
        onSignDetected(result.letter, result.confidence, result.scores);
      }
    }
  }, [landmarks, onSignDetected, onLandmarksForWS, wsConnected]);

  // Start capture once MediaPipe is ready
  useEffect(() => {
    if (isReady) startCapture(sendFrame);
    return () => stopCapture();
  }, [isReady, startCapture, stopCapture, sendFrame]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex items-center justify-center bg-black overflow-hidden rounded-3xl border-2 border-gray-800">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
        muted
        playsInline
      />
      <div className="absolute inset-0 pointer-events-none">
        <SkeletonOverlay rawHandsRef={rawHandsRef} width={640} height={480} />
      </div>
      {/* VAD state indicator */}
      <div style={{
        position: "absolute", top: 16, right: 16, padding: "6px 16px",
        borderRadius: 20, fontSize: 14, fontWeight: 700,
        background: vadState === "SIGNING" ? "#22C55E" : vadState === "COOLDOWN" ? "#F59E0B" : "#6B7280",
        color: "#fff",
        zIndex: 20,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
      }}>
        {vadState}
      </div>
      {/* WS connection indicator */}
      <div style={{
        position: "absolute", top: 16, left: 16, padding: "6px 16px",
        borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: wsConnected ? "#22C55E" : "#EF4444",
        color: "#fff",
        zIndex: 20,
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
      }}>
        {wsConnected ? "GPU" : "LOCAL"}
      </div>
      {error && <p className="absolute bottom-4 left-4 text-red-500 bg-black/50 px-2 rounded">{error}</p>}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-400 font-medium">Calibrating Camera...</p>
          </div>
        </div>
      )}
    </div>
  );
}
