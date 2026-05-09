/**
 * Geometric feature extraction for ASL fingerspelling disambiguation.
 *
 * All distances are normalized by palm scale (wrist → middle MCP) so that
 * thresholds are webcam-distance-invariant.
 *
 * MediaPipe hand landmark indices used:
 *   0  wrist
 *   2  thumbMcp,  4  thumbTip
 *   5  indexMcp,  6  indexPip,  8  indexTip
 *   9  middleMcp, 10 middlePip, 12 middleTip
 *   13 ringMcp,   14 ringPip,   16 ringTip
 *   17 pinkyMcp,               20 pinkyTip
 */

import type { HandLandmark } from "@/workers/mediapipe.types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FistFeatures {
  /** Number of fingers (index–pinky) whose tips are far from their MCP. */
  extendedFingerCount: number;

  // Thumb-tip to each fingertip, palm-normalised
  thumbToIndexTip: number;
  thumbToMiddleTip: number;
  thumbToRingTip: number;
  thumbToPinkyTip: number;

  // Thumb-tip to each finger's MCP (proximal knuckle), palm-normalised
  thumbToIndexMcp: number;
  thumbToMiddleMcp: number;
  thumbToRingMcp: number;
  thumbToPinkyMcp: number;

  /**
   * Max pairwise distance among the four fingertips (index/middle/ring/pinky),
   * palm-normalised. Small → tips clustered (E-like), large → fingers spread.
   */
  tipClusterSpread: number;

  /**
   * Average distance from each fingertip to the palm centre (average of the
   * four finger MCPs), palm-normalised. Small → fingers curled into palm.
   */
  fistCompactness: number;

  /**
   * Count of fingers whose MCP the thumb tip "hides under":
   *   0 → S (thumb outside in front)
   *   2 → T or N (thumb under index+middle)
   *   3 → M (thumb under index+middle+ring)
   */
  thumbUnderCount: number;

  /**
   * 2-D cross-product z-component of the index-finger axis and middle-finger
   * axis vectors (both originating from their respective MCPs).
   * Negative → index crosses over middle (R shape).
   * Positive / near-zero → fingers parallel (U/V shape).
   */
  indexMiddleCrossMetric: number;

  /** Distance between index tip and middle tip, palm-normalised. */
  indexMiddleTipSeparation: number;
}

export interface DebugRecognitionOutput {
  /** Coarse bucket name, e.g. "fist", "R", or "other". */
  bucket: string;
  /** Score for each candidate letter in this bucket (0–1). */
  candidateScores: Record<string, number>;
  /** Feature snapshot from this frame. */
  featureSnapshot: FistFeatures;
  /** Per-candidate human-readable reason the candidate was rejected / down-scored. */
  rejectionReasons: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dist(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function sub(a: HandLandmark, b: HandLandmark): [number, number, number] {
  return [a.x - b.x, a.y - b.y, a.z - b.z];
}

function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function len3(v: [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const l = len3(v) || 1e-9;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Palm scale: wrist (0) → middle MCP (9). Used as the normalization unit.
 */
export function getPalmScale(lm: HandLandmark[]): number {
  return dist(lm[0], lm[9]) || 1e-6;
}

/**
 * Count how many of the four fingers (index/middle/ring/pinky) are extended.
 * A finger is "extended" when its tip is at least 50 % of palm scale away from
 * its own MCP in Euclidean distance (i.e., the tip has left the palm region).
 */
export function countExtendedFingers(lm: HandLandmark[]): number {
  const palmScale = getPalmScale(lm);
  const pairs: [number, number][] = [
    [8, 5],   // index tip, index mcp
    [12, 9],  // middle tip, middle mcp
    [16, 13], // ring tip, ring mcp
    [20, 17], // pinky tip, pinky mcp
  ];
  return pairs.filter(([tip, mcp]) => dist(lm[tip], lm[mcp]) > 0.5 * palmScale).length;
}

/**
 * Extract all 13 geometric features needed for fist-bucket disambiguation.
 */
export function extractFistFeatures(lm: HandLandmark[]): FistFeatures {
  const palmScale = getPalmScale(lm);

  // -- thumb-tip distances ------------------------------------------------
  const thumbTip = lm[4];
  const thumbToIndexTip = dist(thumbTip, lm[8]) / palmScale;
  const thumbToMiddleTip = dist(thumbTip, lm[12]) / palmScale;
  const thumbToRingTip = dist(thumbTip, lm[16]) / palmScale;
  const thumbToPinkyTip = dist(thumbTip, lm[20]) / palmScale;

  const thumbToIndexMcp = dist(thumbTip, lm[5]) / palmScale;
  const thumbToMiddleMcp = dist(thumbTip, lm[9]) / palmScale;
  const thumbToRingMcp = dist(thumbTip, lm[13]) / palmScale;
  const thumbToPinkyMcp = dist(thumbTip, lm[17]) / palmScale;

  // -- tip cluster spread -------------------------------------------------
  const tips = [lm[8], lm[12], lm[16], lm[20]];
  let maxPairDist = 0;
  for (let i = 0; i < tips.length; i++) {
    for (let j = i + 1; j < tips.length; j++) {
      const d = dist(tips[i]!, tips[j]!);
      if (d > maxPairDist) maxPairDist = d;
    }
  }
  const tipClusterSpread = maxPairDist / palmScale;

  // -- fist compactness ---------------------------------------------------
  const palmCentre: HandLandmark = {
    x: (lm[5]!.x + lm[9]!.x + lm[13]!.x + lm[17]!.x) / 4,
    y: (lm[5]!.y + lm[9]!.y + lm[13]!.y + lm[17]!.y) / 4,
    z: (lm[5]!.z + lm[9]!.z + lm[13]!.z + lm[17]!.z) / 4,
  };
  const fistCompactness =
    tips.reduce((sum, t) => sum + dist(t, palmCentre), 0) / (tips.length * palmScale);

  // -- thumbUnderCount ----------------------------------------------------
  // For each of {index MCP (5), middle MCP (9), ring MCP (13)} test whether
  // the thumb tip lies within the proximal "corridor" of that finger.
  //
  // Corridor test:
  //   1. Project thumbTip onto the wrist→fingerMcp axis.
  //   2. t = projection parameter in [0, 1] — accept if t in (0.1, 1.2)
  //   3. Lateral offset (perpendicular distance) < 0.35 * palmScale
  const wrist = lm[0]!;
  const fingerMcpIndices = [5, 9, 13] as const;
  let thumbUnderCount = 0;

  for (const mcpIdx of fingerMcpIndices) {
    const mcp = lm[mcpIdx]!;
    const axis = sub(mcp, wrist);
    const toThumb = sub(thumbTip, wrist);
    const axisLen = len3(axis);
    if (axisLen < 1e-9) continue;

    const t = dot3(toThumb, axis) / (axisLen * axisLen);
    // Projection parameter within the proximal half of the finger
    if (t < 0.1 || t > 1.2) continue;

    // Lateral distance from the axis
    const proj: [number, number, number] = [
      wrist.x + t * axis[0],
      wrist.y + t * axis[1],
      wrist.z + t * axis[2],
    ];
    const lateral = Math.hypot(
      thumbTip.x - proj[0],
      thumbTip.y - proj[1],
      thumbTip.z - proj[2],
    );
    if (lateral < 0.35 * palmScale) {
      thumbUnderCount++;
    }
  }

  // -- index–middle cross metric -----------------------------------------
  // 2-D cross product of the two finger axis vectors in the XY image plane.
  // indexAxis = indexTip − indexMcp (normalised)
  // middleAxis = middleTip − middleMcp (normalised)
  // cross_z = indexAxis.x * middleAxis.y − indexAxis.y * middleAxis.x
  // Negative → index crosses over middle (R). Positive → parallel/spread (U/V).
  const idxAxis = normalize3(sub(lm[8]!, lm[5]!));
  const midAxis = normalize3(sub(lm[12]!, lm[9]!));
  const indexMiddleCrossMetric = idxAxis[0] * midAxis[1] - idxAxis[1] * midAxis[0];

  const indexMiddleTipSeparation = dist(lm[8]!, lm[12]!) / palmScale;

  const extendedFingerCount = countExtendedFingers(lm);

  return {
    extendedFingerCount,
    thumbToIndexTip,
    thumbToMiddleTip,
    thumbToRingTip,
    thumbToPinkyTip,
    thumbToIndexMcp,
    thumbToMiddleMcp,
    thumbToRingMcp,
    thumbToPinkyMcp,
    tipClusterSpread,
    fistCompactness,
    thumbUnderCount,
    indexMiddleCrossMetric,
    indexMiddleTipSeparation,
  };
}
