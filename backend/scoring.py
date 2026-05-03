"""
Scoring engine — runs AFTER a drill completes.

Computes three scores (0-100):
  1. Handshape  — average model confidence across middle 60% of frames
  2. Orientation — cosine similarity of palm normal vs stored reference
  3. Movement   — DTW distance (inverted + normalized) vs stored reference

Reference trajectories are numpy arrays in references/{SIGN_NAME}.npy
"""

import os
import logging
import numpy as np
from typing import Dict, List, Optional
from pathlib import Path

logger = logging.getLogger("scoring")

# Try tslearn for DTW; fall back to a simple manual implementation
try:
    from tslearn.metrics import dtw as tslearn_dtw
    HAS_TSLEARN = True
except ImportError:
    HAS_TSLEARN = False
    logger.info("tslearn not installed — using simple Euclidean DTW fallback.")


def simple_dtw(seq1: np.ndarray, seq2: np.ndarray) -> float:
    """Minimal DTW implementation (O(n*m)) for when tslearn is unavailable."""
    n, m = len(seq1), len(seq2)
    cost = np.full((n + 1, m + 1), np.inf)
    cost[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = float(np.linalg.norm(seq1[i - 1] - seq2[j - 1]))
            cost[i, j] = d + min(cost[i - 1, j], cost[i, j - 1], cost[i - 1, j - 1])
    return float(cost[n, m])


class ScoringEngine:
    def __init__(self, references_dir: str = "references"):
        self._references: Dict[str, np.ndarray] = {}
        ref_path = Path(references_dir)
        if ref_path.exists():
            for f in ref_path.glob("*.npy"):
                self._references[f.stem.upper()] = np.load(f)
            logger.info("Scoring engine loaded %d references.", len(self._references))

    def score(
        self,
        target_sign: str,
        captured_frames: List[List[float]],
        per_frame_confidences: List[float],
    ) -> Dict[str, float]:
        """
        Compute handshape, orientation, and movement scores.

        Args:
            target_sign: The sign the user was trying to make (e.g. "A")
            captured_frames: List of landmark arrays, one per frame.
                             Each is 63 floats (21 landmarks * 3 axes).
            per_frame_confidences: Model confidence for correct class per frame.

        Returns:
            {"handshape": 0-100, "orientation": 0-100, "movement": 0-100,
             "issues": ["wrist rotation off by ~20deg", ...]}
        """
        issues: List[str] = []

        # ── 1. Handshape Score ──────────────────────────────
        # Average confidence across the middle 60% of frames (skip ramp-up/down)
        n = len(per_frame_confidences)
        if n == 0:
            return {"handshape": 0, "orientation": 0, "movement": 0, "issues": ["No frames captured"]}

        start = max(0, int(n * 0.2))
        end = min(n, int(n * 0.8))
        middle_confs = per_frame_confidences[start:end] if end > start else per_frame_confidences
        handshape = float(np.mean(middle_confs)) * 100
        handshape = min(100.0, max(0.0, handshape))

        if handshape < 60:
            issues.append("finger curl pattern doesn't match the target sign well")

        # ── 2. Orientation Score ────────────────────────────
        # Compute wrist→middle-knuckle vector per frame, compare to reference
        orientation_scores: List[float] = []
        ref = self._references.get(target_sign.upper())

        for frame in captured_frames:
            if len(frame) < 63:
                continue
            arr = np.array(frame[:63]).reshape(21, 3)
            wrist = arr[0]
            middle_mcp = arr[9]
            user_vec = middle_mcp - wrist
            user_norm = np.linalg.norm(user_vec)
            if user_norm < 1e-6:
                continue

            if ref is not None and len(ref) > 0:
                ref_frame = ref[len(ref) // 2]  # middle frame of reference
                if len(ref_frame) >= 63:
                    ref_arr = np.array(ref_frame[:63]).reshape(21, 3)
                    ref_vec = ref_arr[9] - ref_arr[0]
                    ref_norm = np.linalg.norm(ref_vec)
                    if ref_norm > 1e-6:
                        cos_sim = float(np.dot(user_vec, ref_vec) / (user_norm * ref_norm))
                        orientation_scores.append(max(0.0, (cos_sim + 1) / 2))  # map [-1,1] to [0,1]
                        continue

            # No reference: assume vertical is correct for static signs
            vertical = np.array([0, -1, 0], dtype=np.float32)
            cos_sim = float(np.dot(user_vec / user_norm, vertical))
            orientation_scores.append(max(0.0, (cos_sim + 1) / 2))

        orientation = float(np.mean(orientation_scores) * 100) if orientation_scores else 75.0

        if orientation < 60:
            issues.append("wrist rotation off — try rotating your hand to face the camera")

        # ── 3. Movement Score ──────────────────────────────
        # DTW distance between user trajectory and reference
        movement = 85.0  # Default for static signs (low movement = good)

        if ref is not None and len(captured_frames) > 5:
            user_seq = np.array([f[:63] for f in captured_frames if len(f) >= 63])
            ref_seq = np.array([r[:63] for r in ref if len(r) >= 63]) if ref.ndim == 2 else ref

            if len(user_seq) > 0 and len(ref_seq) > 0:
                try:
                    if HAS_TSLEARN:
                        dist = tslearn_dtw(user_seq, ref_seq)
                    else:
                        dist = simple_dtw(user_seq, ref_seq)

                    # Normalize: typical DTW distances range 0-50 for similar sequences
                    max_dist = 50.0
                    movement = max(0.0, min(100.0, (1.0 - dist / max_dist) * 100))
                except Exception as e:
                    logger.warning("DTW failed: %s", e)
                    movement = 70.0

            if movement < 60:
                issues.append("movement trajectory differs from the expected pattern")

        return {
            "handshape": round(handshape, 1),
            "orientation": round(orientation, 1),
            "movement": round(movement, 1),
            "issues": issues,
        }


# Module-level singleton
scoring_engine = ScoringEngine()
