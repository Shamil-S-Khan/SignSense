/**
 * Stage-2 disambiguation rules for the two ambiguous buckets:
 *   • Fist bucket: E, M, N, S, T  (extendedFingerCount === 0, compact fist)
 *   • R bucket:    R, U, V         (extendedFingerCount === 2, index+middle up)
 *
 * ── Correct ASL anatomy & MediaPipe landmark basis ────────────────────────
 *
 *   T  →  thumb between INDEX(lm5)  and MIDDLE(lm9)
 *         → thumbToIndexMcp(4→5) small + thumbToMiddleMcp(4→9) small
 *         → thumbToRingMcp(4→13) is FARTHEST
 *
 *   N  →  thumb between MIDDLE(lm9) and RING(lm13)
 *         → thumbToMiddleMcp small + thumbToRingMcp(4→13) small
 *         → thumbToPinkyMcp(4→17) LARGE   ← primary M≠N separator
 *         → thumbToIndexMcp is FARTHEST
 *
 *   M  →  thumb between RING(lm13) and PINKY(lm17)
 *         → thumbToRingMcp(4→13) small + thumbToPinkyMcp(4→17) small
 *         → ring+pinky TIPS curled OVER (large), NOT touching thumb pad
 *
 *   E  →  fingertips fold to thumb pad
 *         → thumbToRingTip(4→16) small + thumbToPinkyTip(4→20) small
 *
 *   S  →  plain fist, thumb wraps across front
 *         → ring MCP farthest, middle MCP NOT in gap (unlike T)
 *
 * ── Measured values (palm-normalised) ────────────────────────────────────
 *   E:  thumbToRingTip=0.174, thumbToPinkyTip=0.131
 *   N:  thumbToIndexMcp=0.369 (far), thumbToRingMcp=0.252, thumbToPinkyMcp≈0.42 (far)
 *   M:  thumbToRingMcp=0.18, thumbToPinkyMcp≈0.20 (both small)
 *   T:  thumbToMiddleMcp=0.24, thumbToRingMcp=0.45 (far)
 */

import type { FistFeatures } from "./features";
import {
  DISAMBIGUATION_THRESHOLDS as T,
} from "./reference-profiles";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Which MCP is farthest from the thumb tip. */
function farthestMcp(f: FistFeatures): "index" | "middle" | "ring" {
  const { thumbToIndexMcp: i, thumbToMiddleMcp: m, thumbToRingMcp: r } = f;
  if (r >= i && r >= m) return "ring";
  if (i >= m && i >= r) return "index";
  return "middle";
}

// ---------------------------------------------------------------------------
// Per-letter fist-bucket scorers
// ---------------------------------------------------------------------------

type FistLetter = "E" | "M" | "N" | "S" | "T";

interface LetterScore {
  score: number;
  rejections: string[];
}

function scoreE(f: FistFeatures): LetterScore {
  const rejections: string[] = [];
  let passed = 0;
  const total = 3;

  // 1. No extended fingers
  if (f.extendedFingerCount === 0) {
    passed++;
  } else {
    rejections.push(`extendedFingerCount=${f.extendedFingerCount} (want 0)`);
  }

  // 2. Ring fingertip is CLOSE to thumb (fingertips fold into thumb pad)
  //    Measured E ref: thumbToRingTip=0.174 → threshold 0.28
  if (f.thumbToRingTip < T.e_ringTipThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToRingTip=${f.thumbToRingTip.toFixed(3)} >= ${T.e_ringTipThresh} (E: ring tip should be close to thumb)`,
    );
  }

  // 3. Pinky fingertip also close (reinforces E, separates from M where pinky is curled over)
  //    Measured E ref: thumbToPinkyTip=0.131 → threshold 0.22
  if (f.thumbToPinkyTip < T.e_pinkyTipThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToPinkyTip=${f.thumbToPinkyTip.toFixed(3)} >= ${T.e_pinkyTipThresh} (E: pinky tip should be close to thumb)`,
    );
  }

  return { score: passed / total, rejections };
}

function scoreT(f: FistFeatures): LetterScore {
  const rejections: string[] = [];
  let passed = 0;
  const total = 3;

  // 1. No extended fingers
  if (f.extendedFingerCount === 0) {
    passed++;
  } else {
    rejections.push(`extendedFingerCount=${f.extendedFingerCount} (want 0)`);
  }

  // 2. Ring MCP is FARTHEST — thumb is on the index+middle side
  //    T: thumb between index+middle → index and middle MCPs are close, ring is far
  if (farthestMcp(f) === "ring") {
    passed++;
  } else {
    rejections.push(
      `farthestMcp=${farthestMcp(f)} (T: ring MCP should be farthest — thumb between index+middle)`,
    );
  }

  // 3. Middle MCP is close — thumb is actually IN the index+middle gap
  //    Separates T from S (S also has ring farthest but middle MCP is NOT close)
  if (f.thumbToMiddleMcp < T.t_middleMcpThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToMiddleMcp=${f.thumbToMiddleMcp.toFixed(3)} >= ${T.t_middleMcpThresh} (T: middle MCP should be close — thumb in gap)`,
    );
  }

  return { score: passed / total, rejections };
}

function scoreN(f: FistFeatures): LetterScore {
  const rejections: string[] = [];
  let passed = 0;
  const total = 4;

  // 1. No extended fingers
  if (f.extendedFingerCount === 0) {
    passed++;
  } else {
    rejections.push(`extendedFingerCount=${f.extendedFingerCount} (want 0)`);
  }

  // 2. Index MCP is FARTHEST — thumb is on the middle+ring side
  //    N: thumb between middle(lm9)+ring(lm13) → index(lm5) is farthest
  //    Measured N ref: thumbToIndexMcp=0.369 is the largest MCP distance
  if (farthestMcp(f) === "index") {
    passed++;
  } else {
    rejections.push(
      `farthestMcp=${farthestMcp(f)} (N: index MCP should be farthest — thumb between middle+ring)`,
    );
  }

  // 3. Ring MCP is close — thumb is in the middle+ring gap
  //    Measured N ref: thumbToRingMcp=0.252 → threshold 0.30
  if (f.thumbToRingMcp < T.n_ringMcpThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToRingMcp=${f.thumbToRingMcp.toFixed(3)} >= ${T.n_ringMcpThresh} (N: ring MCP close — thumb in middle+ring gap)`,
    );
  }

  // 4. Pinky MCP is FAR — this is the primary separator from M
  //    M has thumb in the ring+PINKY gap so thumbToPinkyMcp is small.
  //    N has thumb in the middle+RING gap so thumbToPinkyMcp is large (~0.42).
  if (f.thumbToPinkyMcp >= T.m_pinkyMcpThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToPinkyMcp=${f.thumbToPinkyMcp.toFixed(3)} < ${T.m_pinkyMcpThresh} (N: pinky MCP should be FAR — thumb not in ring+pinky gap)`,
    );
  }

  return { score: passed / total, rejections };
}

function scoreM(f: FistFeatures): LetterScore {
  const rejections: string[] = [];
  let passed = 0;
  const total = 4;

  // 1. No extended fingers
  if (f.extendedFingerCount === 0) {
    passed++;
  } else {
    rejections.push(`extendedFingerCount=${f.extendedFingerCount} (want 0)`);
  }

  // 2. Ring MCP (lm13) is close — inner edge of the ring+pinky gap
  //    M: thumb peeks out between ring(lm13) and pinky(lm17)
  //    Calibrated: M ref thumbToRingMcp=0.18 → threshold 0.28
  if (f.thumbToRingMcp < T.m_ringMcpThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToRingMcp=${f.thumbToRingMcp.toFixed(3)} >= ${T.m_ringMcpThresh} (M: ring MCP should be close — inner edge of ring+pinky gap)`,
    );
  }

  // 3. Pinky MCP (lm17) is ALSO close — outer edge of the ring+pinky gap
  //    This is the KEY separator from N (which has thumbToPinkyMcp ~0.42).
  //    Calibrated: M ref thumbToPinkyMcp=0.20, midpoint with N=0.42 → threshold 0.30
  if (f.thumbToPinkyMcp < T.m_pinkyMcpThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToPinkyMcp=${f.thumbToPinkyMcp.toFixed(3)} >= ${T.m_pinkyMcpThresh} (M: pinky MCP (lm17) should be close — outer edge of ring+pinky gap)`,
    );
  }

  // 4. Ring fingertip is FAR — ring finger is curled OVER the fist
  //    Separates M from E (which also has ring MCP close, but E’s ring TIP
  //    folds DOWN to touch the thumb pad).
  if (f.thumbToRingTip >= T.m_ringTipThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToRingTip=${f.thumbToRingTip.toFixed(3)} < ${T.m_ringTipThresh} (M: ring tip far — finger curled over fist, not folded to thumb pad)`,
    );
  }

  return { score: passed / total, rejections };
}

function scoreS(f: FistFeatures): LetterScore {
  const rejections: string[] = [];
  let passed = 0;
  const total = 3;

  // 1. No extended fingers
  if (f.extendedFingerCount === 0) {
    passed++;
  } else {
    rejections.push(`extendedFingerCount=${f.extendedFingerCount} (want 0)`);
  }

  // 2. Ring fingertip is NOT close — not E
  if (f.thumbToRingTip >= T.e_ringTipThresh) {
    passed++;
  } else {
    rejections.push(
      `thumbToRingTip=${f.thumbToRingTip.toFixed(3)} < ${T.e_ringTipThresh} (S: ring tip too close — looks like E)`,
    );
  }

  // 3. Thumb is in front of the fist (not in a finger gap):
  //    • ring MCP is farthest (thumb near index side), AND
  //    • middle MCP is NOT close (unlike T where thumb is in the index+middle gap)
  //    This separates S from T (which also has ring farthest but middle MCP is close).
  if (farthestMcp(f) === "ring" && f.thumbToMiddleMcp >= T.t_middleMcpThresh) {
    passed++;
  } else {
    rejections.push(
      `farthestMcp=${farthestMcp(f)}, thumbToMiddleMcp=${f.thumbToMiddleMcp.toFixed(3)} ` +
      `(S: expect ring farthest and middle NOT close; if middle IS close it's T)`,
    );
  }

  return { score: passed / total, rejections };
}

// ---------------------------------------------------------------------------
// Public: fist-bucket classifier
// ---------------------------------------------------------------------------

export interface FistBucketResult {
  winner: FistLetter;
  margin: number;
  candidateScores: Record<FistLetter, number>;
  rejectionReasons: Record<FistLetter, string>;
}

export function classifyFistBucket(f: FistFeatures): FistBucketResult {
  const letters: FistLetter[] = ["E", "M", "N", "S", "T"];
  const scoreFns: Record<FistLetter, (f: FistFeatures) => LetterScore> = {
    E: scoreE,
    M: scoreM,
    N: scoreN,
    S: scoreS,
    T: scoreT,
  };

  const candidateScores = {} as Record<FistLetter, number>;
  const rejectionReasons = {} as Record<FistLetter, string>;

  for (const letter of letters) {
    const result = scoreFns[letter]!(f);
    candidateScores[letter] = result.score;
    rejectionReasons[letter] =
      result.rejections.length > 0 ? result.rejections.join("; ") : "passed";
  }

  const sorted = [...letters].sort(
    (a, b) => candidateScores[b]! - candidateScores[a]!,
  );
  const winner = sorted[0]!;
  const second = sorted[1]!;
  const margin = candidateScores[winner]! - candidateScores[second]!;

  return { winner, margin, candidateScores, rejectionReasons };
}

// ---------------------------------------------------------------------------
// Public: R-bucket classifier
// ---------------------------------------------------------------------------

export type RBucketLetter = "R" | "U" | "V";

export interface RBucketResult {
  winner: RBucketLetter;
  margin: number;
  rejections: string[];
}

export function classifyRBucket(f: FistFeatures): RBucketResult {
  const rejections: string[] = [];
  let rScore = 0;
  const rTotal = 3;

  // 1. Exactly 2 fingers extended
  if (f.extendedFingerCount === 2) {
    rScore++;
  } else {
    rejections.push(`extendedFingerCount=${f.extendedFingerCount} (want 2 for R)`);
  }

  // 2. Cross metric is negative (index crosses over middle)
  if (f.indexMiddleCrossMetric < T.r_crossMetricThreshold) {
    rScore++;
  } else {
    rejections.push(
      `crossMetric=${f.indexMiddleCrossMetric.toFixed(3)} >= threshold ${T.r_crossMetricThreshold.toFixed(3)} (R needs negative / index-over-middle)`,
    );
  }

  // 3. Tips are close together (crossing brings them together)
  if (f.indexMiddleTipSeparation < T.r_tipSeparationThreshold) {
    rScore++;
  } else {
    rejections.push(
      `tipSeparation=${f.indexMiddleTipSeparation.toFixed(3)} >= threshold ${T.r_tipSeparationThreshold.toFixed(3)} (R tips should be close)`,
    );
  }

  const rFrac = rScore / rTotal;

  // U vs V: V has a larger tip separation
  // Both require: extendedFingerCount === 2, crossMetric >= threshold
  const uvSeparation = f.indexMiddleTipSeparation;
  // V threshold: tips spread wider than the R threshold; use a midpoint heuristic
  // (0.45 is a reasonable default before calibration)
  const vThreshold = 0.45;
  const uFrac = f.extendedFingerCount === 2 ? (uvSeparation <= vThreshold ? 0.8 : 0.6) : 0;
  const vFrac = f.extendedFingerCount === 2 ? (uvSeparation > vThreshold ? 0.8 : 0.5) : 0;

  if (rFrac >= uFrac && rFrac >= vFrac) {
    const margin = rFrac - Math.max(uFrac, vFrac);
    return { winner: "R", margin, rejections };
  } else if (uFrac >= vFrac) {
    const margin = uFrac - Math.max(rFrac, vFrac);
    return { winner: "U", margin, rejections };
  } else {
    const margin = vFrac - Math.max(rFrac, uFrac);
    return { winner: "V", margin, rejections };
  }
}
