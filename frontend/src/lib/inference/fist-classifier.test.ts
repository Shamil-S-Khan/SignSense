/**
 * Unit and regression tests for the Stage-2 fist-bucket & R-bucket classifiers.
 *
 * Snapshot anatomy (correct ASL fingerspelling):
 *   T  = thumb between index+middle  → farthestMcp=ring,  thumbToMiddleMcp small
 *   N  = thumb between middle+ring   → farthestMcp=index, thumbToRingMcp small, thumbToPinkyMcp LARGE
 *   M  = thumb between ring+pinky    → thumbToRingMcp small, thumbToPinkyMcp SMALL (KEY M≠N)
 *   E  = fingertips fold to thumb    → thumbToRingTip SMALL, thumbToPinkyTip SMALL
 *   S  = plain fist, thumb in front  → farthestMcp=ring, thumbToMiddleMcp LARGE
 */

import { describe, expect, it } from "vitest";
import { classifyFistBucket, classifyRBucket } from "./fist-bucket";
import type { FistFeatures } from "./features";

// ---------------------------------------------------------------------------
// Synthetic snapshot helpers
// ---------------------------------------------------------------------------

const baseFist: FistFeatures = {
  extendedFingerCount: 0,
  thumbToIndexTip: 0.50,
  thumbToMiddleTip: 0.45,
  thumbToRingTip: 0.45,
  thumbToPinkyTip: 0.50,
  thumbToIndexMcp: 0.40,
  thumbToMiddleMcp: 0.40,
  thumbToRingMcp: 0.40,
  thumbToPinkyMcp: 0.45,   // neutral base — will be overridden per letter
  tipClusterSpread: 0.50,
  fistCompactness: 0.38,
  thumbUnderCount: 0,
  indexMiddleCrossMetric: 0.02,
  indexMiddleTipSeparation: 0.45,
};

/** E: fingertips fold down to the thumb pad — ring+pinky tips very close */
function makeE(): FistFeatures {
  return {
    ...baseFist,
    // Measured from reference PNG
    thumbToIndexTip: 0.5215,
    thumbToMiddleTip: 0.3416,
    thumbToRingTip: 0.1736,    // small — ring tip touches thumb
    thumbToPinkyTip: 0.1306,   // small — pinky tip touches thumb
    thumbToIndexMcp: 0.5561,
    thumbToMiddleMcp: 0.3866,
    thumbToRingMcp: 0.2734,
    thumbToPinkyMcp: 0.35,     // moderate — not near a gap
  };
}

/** T: thumb between index and middle — ring MCP is farthest */
function makeT(): FistFeatures {
  return {
    ...baseFist,
    thumbToIndexMcp: 0.22,    // small — index MCP close
    thumbToMiddleMcp: 0.24,   // small — middle MCP close (< 0.30 threshold)
    thumbToRingMcp: 0.45,     // LARGEST — ring is farthest → farthestMcp=ring
    thumbToRingTip: 0.48,     // large — ring tip not close (not E)
    thumbToPinkyTip: 0.52,
    thumbToPinkyMcp: 0.52,    // large — pinky far when thumb between index+middle
  };
}

/** N: thumb between middle and ring — index MCP is farthest, pinky MCP is FAR */
function makeN(): FistFeatures {
  return {
    ...baseFist,
    // Measured from reference PNG (consistent with middle+ring gap)
    thumbToIndexMcp: 0.3686,  // LARGEST — index is farthest → farthestMcp=index
    thumbToMiddleMcp: 0.1786, // small
    thumbToRingMcp: 0.2516,   // small (< 0.30 threshold)
    thumbToRingTip: 0.3685,   // large — ring tip not close (not E)
    thumbToPinkyTip: 0.4547,
    thumbToPinkyMcp: 0.42,    // LARGE — pinky far; KEY separator from M (thumb NOT in ring+pinky gap)
  };
}

/** M: thumb between ring and pinky — BOTH ring and pinky MCPs close, ring tip large */
function makeM(): FistFeatures {
  return {
    ...baseFist,
    thumbToIndexMcp: 0.48,    // large — index far from thumb
    thumbToMiddleMcp: 0.38,   // moderate
    thumbToRingMcp: 0.18,     // small (< 0.28) — ring MCP close → inner edge of ring+pinky gap
    thumbToRingTip: 0.45,     // LARGE — ring finger curled over fist, not near thumb
    thumbToPinkyTip: 0.40,
    thumbToPinkyMcp: 0.20,    // SMALL (< 0.30) — pinky MCP close → outer edge of ring+pinky gap
                              //   ← KEY separator from N (N has thumbToPinkyMcp ~0.42)
  };
}

/** S: plain fist, thumb crosses in front — ring farthest but middle NOT in gap */
function makeS(): FistFeatures {
  return {
    ...baseFist,
    thumbToIndexMcp: 0.25,    // small — thumb near index knuckle (in front)
    thumbToMiddleMcp: 0.40,   // LARGE — middle NOT close (> 0.30, unlike T)
    thumbToRingMcp: 0.55,     // LARGEST — ring is farthest → farthestMcp=ring
    thumbToRingTip: 0.50,     // large — ring tip not close (not E)
    thumbToPinkyTip: 0.58,
    thumbToPinkyMcp: 0.55,    // large — thumb near index side, pinky far
  };
}

function makeR(): FistFeatures {
  return {
    ...baseFist,
    extendedFingerCount: 2,
    indexMiddleCrossMetric: -0.18,
    indexMiddleTipSeparation: 0.20,
  };
}

function makeU(): FistFeatures {
  return {
    ...baseFist,
    extendedFingerCount: 2,
    indexMiddleCrossMetric: 0.12,
    indexMiddleTipSeparation: 0.35,
  };
}

function makeV(): FistFeatures {
  return {
    ...baseFist,
    extendedFingerCount: 2,
    indexMiddleCrossMetric: 0.10,
    indexMiddleTipSeparation: 0.55,
  };
}

// ---------------------------------------------------------------------------
// 1. Positive cases
// ---------------------------------------------------------------------------

describe("fist-bucket positive cases", () => {
  it("E snapshot → winner is E", () => {
    const { winner } = classifyFistBucket(makeE());
    expect(winner).toBe("E");
  });

  it("S snapshot → winner is S", () => {
    const { winner } = classifyFistBucket(makeS());
    expect(winner).toBe("S");
  });

  it("T snapshot → winner is T", () => {
    const { winner } = classifyFistBucket(makeT());
    expect(winner).toBe("T");
  });

  it("N snapshot → winner is N", () => {
    const { winner } = classifyFistBucket(makeN());
    expect(winner).toBe("N");
  });

  it("M snapshot → winner is M", () => {
    const { winner } = classifyFistBucket(makeM());
    expect(winner).toBe("M");
  });
});

describe("R-bucket positive cases", () => {
  it("R snapshot → winner is R", () => {
    const { winner } = classifyRBucket(makeR());
    expect(winner).toBe("R");
  });

  it("U snapshot → winner is U or V (not R)", () => {
    const { winner } = classifyRBucket(makeU());
    expect(winner).not.toBe("R");
  });

  it("V snapshot → winner is V or U (not R)", () => {
    const { winner } = classifyRBucket(makeV());
    expect(winner).not.toBe("R");
  });
});

// ---------------------------------------------------------------------------
// 2. Confusion cases
// ---------------------------------------------------------------------------

describe("E vs M confusion (both have ring MCP close)", () => {
  it("E wins when ring+pinky TIPS are small (fingertips fold to thumb)", () => {
    expect(classifyFistBucket(makeE()).winner).toBe("E");
  });

  it("M wins when ring tip is LARGE (ring finger curled over fist)", () => {
    expect(classifyFistBucket(makeM()).winner).toBe("M");
  });

  it("E and M scores differ on thumbToRingTip", () => {
    const eScores = classifyFistBucket(makeE()).candidateScores;
    const mScores = classifyFistBucket(makeM()).candidateScores;
    expect(eScores.E).toBeGreaterThan(eScores.M);
    expect(mScores.M).toBeGreaterThan(mScores.E);
  });
});

describe("T vs S confusion (both have ring MCP farthest)", () => {
  it("T wins when thumbToMiddleMcp is small (thumb in index+middle gap)", () => {
    expect(classifyFistBucket(makeT()).winner).toBe("T");
  });

  it("S wins when thumbToMiddleMcp is large (thumb in front, not in gap)", () => {
    expect(classifyFistBucket(makeS()).winner).toBe("S");
  });
});

describe("T vs N confusion (different farthest MCPs)", () => {
  it("T wins when farthestMcp=ring (ring far — thumb between index+middle)", () => {
    expect(classifyFistBucket(makeT()).winner).toBe("T");
  });

  it("N wins when farthestMcp=index (index far — thumb between middle+ring)", () => {
    expect(classifyFistBucket(makeN()).winner).toBe("N");
  });
});

describe("N vs M confusion (primary separator: thumbToPinkyMcp)", () => {
  it("N wins when farthestMcp=index and thumbToRingMcp is small", () => {
    expect(classifyFistBucket(makeN()).winner).toBe("N");
  });

  it("M wins when BOTH thumbToRingMcp and thumbToPinkyMcp are small", () => {
    expect(classifyFistBucket(makeM()).winner).toBe("M");
  });

  it("N snapshot thumbToPinkyMcp >= 0.30 (pinky far — thumb NOT in ring+pinky gap)", () => {
    expect(makeN().thumbToPinkyMcp).toBeGreaterThanOrEqual(0.30);
  });

  it("M snapshot thumbToPinkyMcp < 0.30 (pinky close — thumb IS in ring+pinky gap)", () => {
    expect(makeM().thumbToPinkyMcp).toBeLessThan(0.30);
  });
});

describe("R vs U confusion", () => {
  it("R wins when cross metric is negative", () => {
    expect(classifyRBucket(makeR()).winner).toBe("R");
  });

  it("U wins when cross metric is positive", () => {
    expect(classifyRBucket(makeU()).winner).not.toBe("R");
  });
});

describe("R vs V confusion", () => {
  it("R wins when cross metric is negative and tips are close", () => {
    expect(classifyRBucket(makeR()).winner).toBe("R");
  });

  it("V wins when tips are spread", () => {
    expect(classifyRBucket(makeV()).winner).not.toBe("R");
  });
});

// ---------------------------------------------------------------------------
// 3. Regression invariants
// ---------------------------------------------------------------------------

describe("regression: E anatomy", () => {
  it("E snapshot has thumbToRingTip and thumbToPinkyTip both < 0.28", () => {
    const e = makeE();
    expect(e.thumbToRingTip).toBeLessThan(0.28);
    expect(e.thumbToPinkyTip).toBeLessThan(0.22);
  });
});

describe("regression: T anatomy — ring MCP is farthest", () => {
  it("T snapshot: thumbToRingMcp > thumbToIndexMcp and thumbToMiddleMcp", () => {
    const t = makeT();
    expect(t.thumbToRingMcp).toBeGreaterThan(t.thumbToIndexMcp);
    expect(t.thumbToRingMcp).toBeGreaterThan(t.thumbToMiddleMcp);
  });

  it("T snapshot: thumbToMiddleMcp < 0.30 (thumb in the gap)", () => {
    expect(makeT().thumbToMiddleMcp).toBeLessThan(0.30);
  });
});

describe("regression: N anatomy — index MCP is farthest", () => {
  it("N snapshot: thumbToIndexMcp > thumbToMiddleMcp and thumbToRingMcp", () => {
    const n = makeN();
    expect(n.thumbToIndexMcp).toBeGreaterThan(n.thumbToMiddleMcp);
    expect(n.thumbToIndexMcp).toBeGreaterThan(n.thumbToRingMcp);
  });

  it("N snapshot: thumbToRingMcp < 0.30 (ring also close)", () => {
    expect(makeN().thumbToRingMcp).toBeLessThan(0.30);
  });
});

describe("regression: M anatomy — ring+pinky MCPs both close, ring tip large", () => {
  it("M snapshot: thumbToRingMcp < 0.28 (inner edge of ring+pinky gap)", () => {
    expect(makeM().thumbToRingMcp).toBeLessThan(0.28);
  });

  it("M snapshot: thumbToPinkyMcp < 0.30 (outer edge of ring+pinky gap — KEY M≠N)", () => {
    expect(makeM().thumbToPinkyMcp).toBeLessThan(0.30);
  });

  it("M snapshot: thumbToRingTip >= 0.28 (ring finger NOT folded to thumb)", () => {
    expect(makeM().thumbToRingTip).toBeGreaterThanOrEqual(0.28);
  });
});

describe("regression: S anatomy — ring farthest but middle NOT in gap", () => {
  it("S snapshot: thumbToRingMcp is the farthest MCP", () => {
    const s = makeS();
    expect(s.thumbToRingMcp).toBeGreaterThan(s.thumbToIndexMcp);
    expect(s.thumbToRingMcp).toBeGreaterThan(s.thumbToMiddleMcp);
  });

  it("S snapshot: thumbToMiddleMcp >= 0.30 (middle not in gap, unlike T)", () => {
    expect(makeS().thumbToMiddleMcp).toBeGreaterThanOrEqual(0.30);
  });
});

describe("regression: R-bucket classification", () => {
  it("R requires a negative indexMiddleCrossMetric", () => {
    const notR: FistFeatures = { ...makeR(), indexMiddleCrossMetric: 0.10 };
    expect(classifyRBucket(notR).winner).not.toBe("R");
  });

  it("R score drops when tips are too far apart", () => {
    const spreadR: FistFeatures = { ...makeR(), indexMiddleTipSeparation: 0.60 };
    const tightR = classifyRBucket(makeR());
    const { winner } = classifyRBucket(spreadR);
    if (winner === "R") {
      expect(classifyRBucket(spreadR).margin).toBeLessThanOrEqual(tightR.margin);
    } else {
      expect(winner).not.toBe("R");
    }
  });
});

describe("regression: fist-bucket never returns R", () => {
  it("classifyFistBucket candidates do not include R", () => {
    expect(Object.keys(classifyFistBucket(makeE()).candidateScores)).not.toContain("R");
  });
});

describe("regression: changing M ring tip to small value switches winner to E", () => {
  it("M with thumbToRingTip < 0.28 should not win as M", () => {
    const notM: FistFeatures = { ...makeM(), thumbToRingTip: 0.15, thumbToPinkyTip: 0.12 };
    expect(classifyFistBucket(notM).winner).not.toBe("M");
  });
});
