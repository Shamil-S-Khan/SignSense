import { useEffect, useRef, useState } from "react";
import type { HandLandmark, NormalizedLandmarks } from "@/workers/mediapipe.types";

// MediaPipe hand connections (pairs of landmark indices)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],      // thumb
  [0,5],[5,6],[6,7],[7,8],      // index
  [0,9],[9,10],[10,11],[11,12], // middle
  [0,13],[13,14],[14,15],[15,16],// ring
  [0,17],[17,18],[18,19],[19,20],// pinky
  [5,9],[9,13],[13,17],          // palm
];

// MediaPipe pose connections for upper body
const POSE_CONNECTIONS = [
  [11, 12], // shoulder-to-shoulder
  [11, 13], [13, 15], // left arm (shoulder -> elbow -> wrist)
  [12, 14], [14, 16], // right arm (shoulder -> elbow -> wrist)
  [11, 23], [12, 24], [23, 24], // torso (shoulders to hips)
];

interface Props {
  rawHandsRef: React.MutableRefObject<HandLandmark[][]>;
  landmarksRef?: React.MutableRefObject<NormalizedLandmarks | null>;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const COLORS = ["#00FF88", "#FF6B35"];

export function SkeletonOverlay({ rawHandsRef, landmarksRef, videoRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDimensions = () => {
      if (video.videoWidth && video.videoHeight) {
        setDimensions({ width: video.videoWidth, height: video.videoHeight });
      }
    };

    video.addEventListener("loadedmetadata", updateDimensions);
    video.addEventListener("resize", updateDimensions);

    if (video.videoWidth && video.videoHeight) {
      updateDimensions();
    }

    return () => {
      video.removeEventListener("loadedmetadata", updateDimensions);
      video.removeEventListener("resize", updateDimensions);
    };
  }, [videoRef]);

  useEffect(() => {
    let rafId: number;
    const { width, height } = dimensions;

    const draw = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) { rafId = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw pose skeleton first so hand landmarks render on top
      const landmarks = landmarksRef?.current;
      if (landmarks && landmarks.pose && landmarks.pose.length > 0) {
        const pose = landmarks.pose;

        // Draw pose connection lines
        ctx.strokeStyle = "#00DDFF"; // Neon cyan for skeleton bones
        ctx.lineWidth = 3;
        for (const [a, b] of POSE_CONNECTIONS) {
          const ptA = pose[a];
          const ptB = pose[b];
          if (ptA && ptB && (ptA.x !== 0 || ptA.y !== 0) && (ptB.x !== 0 || ptB.y !== 0)) {
            ctx.beginPath();
            ctx.moveTo(ptA.x * width, ptA.y * height);
            ctx.lineTo(ptB.x * width, ptB.y * height);
            ctx.stroke();
          }
        }

        // Draw pose joint dots for upper body (joints 0 to 24)
        ctx.fillStyle = "#FF00AA"; // Neon pink for skeleton joints
        for (let i = 0; i <= 24; i++) {
          const pt = pose[i];
          if (pt && (pt.x !== 0 || pt.y !== 0)) {
            ctx.beginPath();
            ctx.arc(pt.x * width, pt.y * height, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 2. Draw hand skeletons
      const hands = rawHandsRef.current;
      for (let h = 0; h < hands.length; h++) {
        const hand = hands[h];
        if (!hand || hand.length === 0) continue;
        const color = COLORS[h] ?? COLORS[0];

        // Lines
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
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
  }, [rawHandsRef, landmarksRef, dimensions]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        pointerEvents: "none",
        transform: "scaleX(-1)",
        zIndex: 10,
      }}
    />
  );
}
