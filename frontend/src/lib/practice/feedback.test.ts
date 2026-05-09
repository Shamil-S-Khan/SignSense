import { describe, expect, it } from "vitest";
import { clampScore, shouldAllowSuccess, smoothDetections } from "./feedback";

describe("feedback", () => {
  it("returns a smoothed detection after stable repeated matches", () => {
    const result = smoothDetections([
      { sign: "A", confidence: 0.7, scores: { handshape: 80, movement: 82, orientation: 84 } },
      { sign: "A", confidence: 0.8, scores: { handshape: 82, movement: 83, orientation: 85 } },
      { sign: "A", confidence: 0.9, scores: { handshape: 84, movement: 85, orientation: 86 } },
    ]);

    expect(result?.sign).toBe("A");
    expect(result?.confidence).toBeCloseTo(0.8, 5);
    expect(result?.scores.handshape).toBe(82);
  });

  it("blocks success during cooldown", () => {
    expect(shouldAllowSuccess(1000, 1800, 1000)).toBe(false);
    expect(shouldAllowSuccess(1000, 2200, 1000)).toBe(true);
  });

  it("clamps scores into a user-facing range", () => {
    expect(clampScore(124)).toBe(100);
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(72.3)).toBe(72);
  });
});
