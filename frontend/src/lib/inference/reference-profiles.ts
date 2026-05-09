/**
 * Reference feature profiles for the six ambiguous ASL letters: E M N R S T.
 *
 * HOW TO POPULATE:
 *   1. Run the dev server  (`npm run dev`)
 *   2. Navigate to        `/debug/reference-extractor`
 *   3. Wait for all six letters to render
 *   4. Copy the JSON output into the `referenceFeatureProfiles` object below
 *   5. The `DISAMBIGUATION_THRESHOLDS` constants are derived automatically
 *      from the midpoints of adjacent confusable pairs.
 *
 * Until the extractor has been run, all values are 0 (placeholders).
 * The 2-stage classifier degrades gracefully with placeholder values
 * (it will still apply the structural rule checks; only distance-based
 * thresholds will be off until real values are filled in).
 */

import type { FistFeatures } from "./features";

// ---------------------------------------------------------------------------
// Per-letter reference feature snapshots
// ---------------------------------------------------------------------------

export const referenceFeatureProfiles: Record<"E" | "M" | "N" | "R" | "S" | "T", FistFeatures> = {
  // ── Measured from reference PNG via /debug/reference-extractor ─────────
  // Landmark 4=THUMB_TIP, 5=INDEX_MCP, 8=INDEX_TIP, 9=MIDDLE_MCP,
  // 12=MIDDLE_TIP, 13=RING_MCP, 16=RING_TIP, 17=PINKY_MCP, 20=PINKY_TIP
  E: {
    extendedFingerCount: 0,
    thumbToIndexTip: 0.5215,
    thumbToMiddleTip: 0.3416,
    thumbToRingTip: 0.1736,   // lm4→lm16: ring tip folds TO thumb pad ← E key
    thumbToPinkyTip: 0.1306,  // lm4→lm20: pinky tip also folds to thumb pad ← E key
    thumbToIndexMcp: 0.5561,  // lm4→lm5:  index MCP far
    thumbToMiddleMcp: 0.3866, // lm4→lm9:  middle MCP moderate
    thumbToRingMcp: 0.2734,   // lm4→lm13: ring MCP close (fingertips bent toward thumb)
    thumbToPinkyMcp: 0.35,    // lm4→lm17: pinky MCP moderate (estimated)
    tipClusterSpread: 0.5695,
    fistCompactness: 0.3001,
    thumbUnderCount: 2,
    indexMiddleCrossMetric: -0.091,
    indexMiddleTipSeparation: 0.2069,
  },
  // ── Anatomically derived ─────────────────────────────────────────────────
  // M: thumb between RING(13) and PINKY(17)
  //   3 fingers curl over the fist; thumb peeks out from the ring+pinky gap.
  //   → both thumbToRingMcp AND thumbToPinkyMcp are small
  //   → ring+pinky TIPS are curled OVER (large), not touching the thumb pad
  M: {
    extendedFingerCount: 0,
    thumbToIndexTip: 0.50,
    thumbToMiddleTip: 0.45,
    thumbToRingTip: 0.45,     // large — ring tip curled OVER fist
    thumbToPinkyTip: 0.40,    // large — pinky tip curled OVER fist
    thumbToIndexMcp: 0.48,    // lm4→lm5:  large — index far
    thumbToMiddleMcp: 0.38,   // lm4→lm9:  moderate
    thumbToRingMcp: 0.18,     // lm4→lm13: SMALL — near ring+pinky gap ← M key
    thumbToPinkyMcp: 0.20,    // lm4→lm17: SMALL — near ring+pinky gap ← M key
    tipClusterSpread: 0.55,
    fistCompactness: 0.42,
    thumbUnderCount: 3,
    indexMiddleCrossMetric: -0.10,
    indexMiddleTipSeparation: 0.21,
  },
  // ── Measured from reference PNG ──────────────────────────────────────────
  // N: thumb between MIDDLE(9) and RING(13)
  //   → thumbToMiddleMcp AND thumbToRingMcp are small
  //   → thumbToPinkyMcp is LARGE (distinguishes N from M)
  //   → thumbToIndexMcp is the farthest MCP
  N: {
    extendedFingerCount: 0,
    thumbToIndexTip: 0.3756,
    thumbToMiddleTip: 0.3567,
    thumbToRingTip: 0.3685,
    thumbToPinkyTip: 0.4547,
    thumbToIndexMcp: 0.3686,  // lm4→lm5:  LARGEST — index far ← N key
    thumbToMiddleMcp: 0.1786, // lm4→lm9:  small
    thumbToRingMcp: 0.2516,   // lm4→lm13: small — thumb in middle+ring gap ← N key
    thumbToPinkyMcp: 0.42,    // lm4→lm17: LARGE — pinky far (NOT in M's gap)← N key
    tipClusterSpread: 0.5517,
    fistCompactness: 0.4082,
    thumbUnderCount: 3,
    indexMiddleCrossMetric: -0.091,
    indexMiddleTipSeparation: 0.1978,
  },
  // ── Anatomically derived ─────────────────────────────────────────────────
  // T: thumb between INDEX(5) and MIDDLE(9)
  //   → thumbToIndexMcp AND thumbToMiddleMcp are small
  //   → thumbToRingMcp is the farthest MCP
  //   → thumbToPinkyMcp is also large
  T: {
    extendedFingerCount: 0,
    thumbToIndexTip: 0.45,
    thumbToMiddleTip: 0.38,
    thumbToRingTip: 0.48,
    thumbToPinkyTip: 0.52,
    thumbToIndexMcp: 0.22,    // lm4→lm5:  SMALL — index MCP close ← T key
    thumbToMiddleMcp: 0.24,   // lm4→lm9:  SMALL — middle MCP close ← T key
    thumbToRingMcp: 0.45,     // lm4→lm13: LARGE — ring is farthest ← T key
    thumbToPinkyMcp: 0.52,    // lm4→lm17: large — pinky also far
    tipClusterSpread: 0.55,
    fistCompactness: 0.38,
    thumbUnderCount: 2,
    indexMiddleCrossMetric: -0.05,
    indexMiddleTipSeparation: 0.22,
  },
  // ── Pending live measurement ─────────────────────────────────────────────
  R: {
    extendedFingerCount: 2,
    thumbToIndexTip: 0,
    thumbToMiddleTip: 0,
    thumbToRingTip: 0,
    thumbToPinkyTip: 0,
    thumbToIndexMcp: 0,
    thumbToMiddleMcp: 0,
    thumbToRingMcp: 0,
    thumbToPinkyMcp: 0,
    tipClusterSpread: 0,
    fistCompactness: 0,
    thumbUnderCount: 0,
    indexMiddleCrossMetric: -0.15,
    indexMiddleTipSeparation: 0.25,
  },
  // S: plain fist, thumb wraps across front (index+middle knuckles)
  //   → thumbToRingMcp is farthest (thumb near index side)
  //   → thumbToMiddleMcp is NOT small (unlike T where thumb is in the gap)
  //   → thumbToPinkyMcp is large
  S: {
    extendedFingerCount: 0,
    thumbToIndexTip: 0,
    thumbToMiddleTip: 0,
    thumbToRingTip: 0,
    thumbToPinkyTip: 0,
    thumbToIndexMcp: 0,
    thumbToMiddleMcp: 0,
    thumbToRingMcp: 0,
    thumbToPinkyMcp: 0,
    tipClusterSpread: 0,
    fistCompactness: 0,
    thumbUnderCount: 0,
    indexMiddleCrossMetric: 0,
    indexMiddleTipSeparation: 0,
  },
};

// ---------------------------------------------------------------------------
// Disambiguation thresholds
// ---------------------------------------------------------------------------
// These are calibrated midpoints between adjacent confusable pairs.
// After running the reference extractor, replace the placeholder values
// below with midpoints computed from the measured reference profiles.
// Each threshold is intentionally widened by ~10 % (0.1 * palmScale ≈ 0.1
// in normalised coordinates) to tolerate webcam noise.

export const DISAMBIGUATION_THRESHOLDS = {
  /**
   * E: thumbToRingTip upper bound.
   * In E the ring fingertip folds down to touch the thumb pad.
   * Calibrated from measured E ref (0.1736) + 0.11 tolerance = 0.28.
   * If thumbToRingTip < this  → ring tip is close → E candidate.
   */
  e_ringTipThresh: 0.28,

  /**
   * E: thumbToPinkyTip upper bound (reinforces E).
   * Calibrated from measured E ref (0.1306) + 0.09 tolerance = 0.22.
   */
  e_pinkyTipThresh: 0.22,

  /**
   * T: thumbToMiddleMcp upper bound.
   * Thumb tucked between index+middle → middle MCP must be close.
   * Separates T (gap sign) from S (thumb in front, middle MCP farther away).
   */
  t_middleMcpThresh: 0.30,

  /**
   * M: thumbToPinkyMcp upper bound.
   * Thumb in the ring+pinky gap → pinky MCP (lm17) must be close to thumb.
   * This is the PRIMARY separator between M and N:
   *   M: both thumbToRingMcp AND thumbToPinkyMcp are small
   *   N: thumbToRingMcp is small but thumbToPinkyMcp is LARGE (~0.42)
   * Calibrated: M ref thumbToPinkyMcp=0.20, midpoint with N ref 0.42 → 0.31
   */
  m_pinkyMcpThresh: 0.30,

  /**
   * M: thumbToRingMcp upper bound.
   * Ring MCP (lm13) is the inner edge of the ring+pinky gap.
   * Calibrated: M ref 0.18 + tolerance → 0.28.
   */
  m_ringMcpThresh: 0.28,

  /**
   * N: thumbToRingMcp upper bound.
   * Thumb tucked between middle+ring → ring MCP must be close.
   * Calibrated: N ref thumbToRingMcp = 0.252, threshold = 0.30.
   */
  n_ringMcpThresh: 0.30,

  /**
   * M/E boundary: thumbToRingTip.
   * M has ring fingertip curled OVER the fist (large value).
   * E has ring fingertip folded INTO the thumb pad (small value).
   */
  m_ringTipThresh: 0.28,

  /**
   * R: indexMiddleCrossMetric must be below this to qualify as "crossed".
   * Negative by definition for a true R.
   */
  r_crossMetricThreshold: -0.05,

  /**
   * R: indexMiddleTipSeparation upper bound — tips close together when crossed.
   */
  r_tipSeparationThreshold: 0.35,

  /**
   * Minimum score margin required for the bucket winner to be accepted.
   * If winner_score − second_score < this, the classifier returns null and
   * blocks the smoothing window (prevents awarding an ambiguous detection).
   */
  minimumMargin: 0.12,
} as const;
