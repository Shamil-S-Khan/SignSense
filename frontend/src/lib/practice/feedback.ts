export interface ScoreBreakdown {
  handshape: number;
  movement: number;
  orientation: number;
}

export interface DetectionSample {
  sign: string;
  confidence: number;
  scores: ScoreBreakdown;
}

export interface SmoothedDetection {
  sign: string;
  confidence: number;
  scores: ScoreBreakdown;
}

export function smoothDetections(history: DetectionSample[], requiredMatches = 3): SmoothedDetection | null {
  if (history.length < requiredMatches) return null;

  const recent = history.slice(-requiredMatches);
  const [first] = recent;
  if (!first || recent.some((sample) => sample.sign !== first.sign)) {
    return null;
  }

  const total = recent.reduce(
    (acc, sample) => {
      acc.confidence += sample.confidence;
      acc.handshape += sample.scores.handshape;
      acc.movement += sample.scores.movement;
      acc.orientation += sample.scores.orientation;
      return acc;
    },
    { confidence: 0, handshape: 0, movement: 0, orientation: 0 },
  );

  return {
    sign: first.sign,
    confidence: total.confidence / recent.length,
    scores: {
      handshape: total.handshape / recent.length,
      movement: total.movement / recent.length,
      orientation: total.orientation / recent.length,
    },
  };
}

export function shouldAllowSuccess(lastSuccessAt: number | null, now: number, cooldownMs = 1500): boolean {
  return lastSuccessAt === null || now - lastSuccessAt >= cooldownMs;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
