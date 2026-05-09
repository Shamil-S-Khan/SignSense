"use client";
import { useEffect, useRef } from "react";
import type { HandLandmark } from "@/workers/mediapipe.types";

// MediaPipe hand connections (pairs of landmark indices)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],      // thumb
  [0,5],[5,6],[6,7],[7,8],      // index
  [0,9],[9,10],[10,11],[11,12], // middle
  [0,13],[13,14],[14,15],[15,16],// ring
  [0,17],[17,18],[18,19],[19,20],// pinky
  [5,9],[9,13],[13,17],          // palm
];

interface Props {
  rawHandsRef: React.MutableRefObject<HandLandmark[][]>;
  width: number;
  height: number;
}

const COLORS = ["#00FF88", "#FF6B35"];

export function SkeletonOverlay({ rawHandsRef, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId: number;

    const draw = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) { rafId = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, width, height);
      const hands = rawHandsRef.current;

      for (let h = 0; h < hands.length; h++) {
        const hand = hands[h];
        if (!hand || hand.length === 0) continue;
        const color = COLORS[h] ?? COLORS[0];

        // Lines
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
          if (!hand[a] || !hand[b]) continue;
          ctx.beginPath();
          ctx.moveTo(hand[a].x * width, hand[a].y * height);
          ctx.lineTo(hand[b].x * width, hand[b].y * height);
          ctx.stroke();
        }

        // Dots
        ctx.fillStyle = color;
        for (const lm of hand) {
          ctx.beginPath();
          ctx.arc(lm.x * width, lm.y * height, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [rawHandsRef, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        transform: "scaleX(-1)",
        zIndex: 10,
      }}
    />
  );
}
