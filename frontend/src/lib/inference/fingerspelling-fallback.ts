import * as fp from "fingerpose";
import type { HandLandmark } from "@/workers/mediapipe.types";
import { clampScore } from "@/lib/practice/feedback";
import { extractFistFeatures } from "./features";
import type { FistFeatures, DebugRecognitionOutput } from "./features";
import { classifyFistBucket, classifyRBucket } from "./fist-bucket";
import { DISAMBIGUATION_THRESHOLDS } from "./reference-profiles";

/**
 * Set to true when calling classifyFingerspellingFallback to populate
 * lastDebugOutput with a full feature / bucket / rejection snapshot.
 * Reading this module-level export from the main thread is safe because
 * fingerspelling classification always runs on the main thread.
 */
export let lastDebugOutput: DebugRecognitionOutput | null = null;

const DIAGONAL_DOWN_LEFT = 7 as fp.FingerDirection;
const DIAGONAL_DOWN_RIGHT = 6 as fp.FingerDirection;

// Helper to define basic ASL letters using Fingerpose
// Full ASL Gestures A-Y (Static)
const createASLGestures = () => {
  const gestures: fp.GestureDescription[] = [];

  // A
  const letterA = new fp.GestureDescription("A");
  letterA.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  letterA.addDirection(fp.Finger.Thumb, fp.FingerDirection.VerticalUp, 1.0);
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterA.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterA.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterA);

  // B
  const letterB = new fp.GestureDescription("B");
  letterB.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
  letterB.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.9);
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterB.addCurl(f, fp.FingerCurl.NoCurl, 1.0);
    letterB.addDirection(f, fp.FingerDirection.VerticalUp, 1.0);
  }
  gestures.push(letterB);

  // C
  const letterC = new fp.GestureDescription("C");
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterC.addCurl(f, fp.FingerCurl.HalfCurl, 1.0);
    letterC.addCurl(f, fp.FingerCurl.NoCurl, 0.2);
  }
  letterC.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  letterC.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.8);
  gestures.push(letterC);

  // D
  const letterD = new fp.GestureDescription("D");
  letterD.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterD.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
  for (const f of [fp.Finger.Thumb, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterD.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterD.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterD);

  // E
  const letterE = new fp.GestureDescription("E");
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky, fp.Finger.Thumb]) {
    letterE.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterE.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterE);

  // F
  const letterF = new fp.GestureDescription("F");
  letterF.addCurl(fp.Finger.Index, fp.FingerCurl.FullCurl, 1.0);
  letterF.addCurl(fp.Finger.Index, fp.FingerCurl.HalfCurl, 0.9);
  letterF.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterF.addCurl(f, fp.FingerCurl.NoCurl, 1.0);
    letterF.addDirection(f, fp.FingerDirection.VerticalUp, 1.0);
  }
  gestures.push(letterF);

  // G
  const letterG = new fp.GestureDescription("G");
  letterG.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterG.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalLeft, 1.0);
  letterG.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalRight, 1.0);
  letterG.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterG.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterG.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterG);

  // H
  const letterH = new fp.GestureDescription("H");
  letterH.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterH.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalLeft, 1.0);
  letterH.addDirection(fp.Finger.Index, fp.FingerDirection.HorizontalRight, 1.0);
  letterH.addCurl(fp.Finger.Middle, fp.FingerCurl.NoCurl, 1.0);
  letterH.addDirection(fp.Finger.Middle, fp.FingerDirection.HorizontalLeft, 1.0);
  letterH.addDirection(fp.Finger.Middle, fp.FingerDirection.HorizontalRight, 1.0);
  for (const f of [fp.Finger.Thumb, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterH.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterH.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterH);

  // I
  const letterI = new fp.GestureDescription("I");
  letterI.addCurl(fp.Finger.Pinky, fp.FingerCurl.NoCurl, 1.0);
  letterI.addDirection(fp.Finger.Pinky, fp.FingerDirection.VerticalUp, 1.0);
  for (const f of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
    letterI.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterI.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterI);

  // K
  const letterK = new fp.GestureDescription("K");
  letterK.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterK.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
  letterK.addCurl(fp.Finger.Middle, fp.FingerCurl.NoCurl, 1.0);
  letterK.addDirection(fp.Finger.Middle, fp.FingerDirection.VerticalUp, 1.0);
  letterK.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  letterK.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.8);
  for (const f of [fp.Finger.Ring, fp.Finger.Pinky]) {
    letterK.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterK.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterK);

  // L
  const letterL = new fp.GestureDescription("L");
  letterL.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterL.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
  letterL.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterL.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterL.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterL);

  // M
  const letterM = new fp.GestureDescription("M");
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
    letterM.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterM.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  letterM.addCurl(fp.Finger.Pinky, fp.FingerCurl.HalfCurl, 1.0);
  letterM.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
  gestures.push(letterM);

  // N
  const letterN = new fp.GestureDescription("N");
  for (const f of [fp.Finger.Index, fp.Finger.Middle]) {
    letterN.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterN.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  for (const f of [fp.Finger.Ring, fp.Finger.Pinky]) {
    letterN.addCurl(f, fp.FingerCurl.FullCurl, 0.9);
  }
  letterN.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
  gestures.push(letterN);

  // O
  const letterO = new fp.GestureDescription("O");
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky, fp.Finger.Thumb]) {
    letterO.addCurl(f, fp.FingerCurl.HalfCurl, 1.0);
    letterO.addCurl(f, fp.FingerCurl.FullCurl, 0.8);
  }
  gestures.push(letterO);

  // P
  const letterP = new fp.GestureDescription("P");
  for (const f of [fp.Finger.Index, fp.Finger.Middle]) {
    letterP.addCurl(f, fp.FingerCurl.NoCurl, 1.0);
    letterP.addDirection(f, DIAGONAL_DOWN_LEFT, 0.9);
    letterP.addDirection(f, DIAGONAL_DOWN_RIGHT, 0.9);
  }
  letterP.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Ring, fp.Finger.Pinky]) {
    letterP.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
  }
  gestures.push(letterP);

  // Q
  const letterQ = new fp.GestureDescription("Q");
  letterQ.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterQ.addDirection(fp.Finger.Index, DIAGONAL_DOWN_LEFT, 1.0);
  letterQ.addDirection(fp.Finger.Index, DIAGONAL_DOWN_RIGHT, 1.0);
  letterQ.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterQ.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
  }
  gestures.push(letterQ);

  // R
  const letterR = new fp.GestureDescription("R");
  for (const f of [fp.Finger.Index, fp.Finger.Middle]) {
    letterR.addCurl(f, fp.FingerCurl.NoCurl, 1.0);
    letterR.addDirection(f, fp.FingerDirection.VerticalUp, 0.9);
  }
  for (const f of [fp.Finger.Thumb, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterR.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
  }
  gestures.push(letterR);

  // S
  const letterS = new fp.GestureDescription("S");
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterS.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterS.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  letterS.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
  letterS.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.9);
  gestures.push(letterS);

  // T
  const letterT = new fp.GestureDescription("T");
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterT.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterT.addCurl(f, fp.FingerCurl.HalfCurl, 0.8);
  }
  letterT.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
  gestures.push(letterT);

  // U
  const letterU = new fp.GestureDescription("U");
  letterU.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterU.addCurl(fp.Finger.Middle, fp.FingerCurl.NoCurl, 1.0);
  letterU.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
  letterU.addDirection(fp.Finger.Middle, fp.FingerDirection.VerticalUp, 1.0);
  for (const f of [fp.Finger.Thumb, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterU.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterU.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterU);

  // V
  const letterV = new fp.GestureDescription("V");
  letterV.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterV.addCurl(fp.Finger.Middle, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Thumb, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterV.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterV.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterV);

  // W
  const letterW = new fp.GestureDescription("W");
  letterW.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  letterW.addCurl(fp.Finger.Middle, fp.FingerCurl.NoCurl, 1.0);
  letterW.addCurl(fp.Finger.Ring, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Thumb, fp.Finger.Pinky]) {
    letterW.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterW.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterW);

  // X
  const letterX = new fp.GestureDescription("X");
  letterX.addCurl(fp.Finger.Index, fp.FingerCurl.HalfCurl, 1.0);
  letterX.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 0.9);
  for (const f of [fp.Finger.Thumb, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
    letterX.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
  }
  gestures.push(letterX);

  // Y
  const letterY = new fp.GestureDescription("Y");
  letterY.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  letterY.addCurl(fp.Finger.Pinky, fp.FingerCurl.NoCurl, 1.0);
  for (const f of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
    letterY.addCurl(f, fp.FingerCurl.FullCurl, 1.0);
    letterY.addCurl(f, fp.FingerCurl.HalfCurl, 0.9);
  }
  gestures.push(letterY);

  return gestures;
};

const GE = new fp.GestureEstimator(createASLGestures());

export interface DetailedSignResult {
  letter: string;
  confidence: number;
  scores: {
    handshape: number;
    movement: number;
    orientation: number;
  };
}

function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function detectHeuristicLetter(landmarks: HandLandmark[]): { letter: string; confidence: number } | null {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const thumbIndexGap = distance(thumbTip, indexTip);
  const fingerSpread = distance(indexTip, middleTip) + distance(middleTip, ringTip) + distance(ringTip, pinkyTip);
  const compactness = distance(indexTip, pinkyTip);

  if (thumbIndexGap < 0.05 && fingerSpread < 0.18) {
    return { letter: "O", confidence: 0.68 };
  }

  if (thumbTip.y > wrist.y && indexTip.y < middleTip.y && middleTip.y < ringTip.y) {
    return { letter: "P", confidence: 0.58 };
  }

  if (thumbTip.y > wrist.y && indexTip.y > middleTip.y && compactness < 0.12) {
    return { letter: "Q", confidence: 0.56 };
  }

  // NOTE: R is now handled by the 2-stage classifier in classifyFingerspellingFallback;
  // the old heuristic (compactness + x-position) is superseded by the crossing metric.

  return null;
}

const FIST_LETTERS = new Set(["E", "M", "N", "S", "T"]);

export function classifyFingerspellingFallback(
  landmarks: HandLandmark[],
  debug = false,
): DetailedSignResult | null {
  if (!landmarks || landmarks.length !== 21) return null;

  // ------------------------------------------------------------------
  // Stage 1: fingerpose coarse classification
  // ------------------------------------------------------------------
  const fpLandmarks = landmarks.map((lm) => [lm.x, lm.y, lm.z]);
  const estimated = GE.estimate(fpLandmarks, 5.5);
  const bestGesture =
    estimated.gestures.length > 0
      ? estimated.gestures.reduce((previous, current) =>
          previous.score > current.score ? previous : current,
        )
      : null;
  const heuristic = detectHeuristicLetter(landmarks);

  let stageOneResult = bestGesture
    ? { letter: bestGesture.name, confidence: bestGesture.score / 10.0 }
    : heuristic;

  // ------------------------------------------------------------------
  // Stage 2: geometric disambiguation for ambiguous buckets
  // ------------------------------------------------------------------
  const fistFeatures: FistFeatures = extractFistFeatures(landmarks);
  const extCount = fistFeatures.extendedFingerCount;

  let bucket = "other";
  let debugCandidateScores: Record<string, number> = {};
  let debugRejections: Record<string, string> = {};

  // --- Fist bucket: E / M / N / S / T ---
  if (extCount === 0 && stageOneResult && FIST_LETTERS.has(stageOneResult.letter)) {
    bucket = "fist";
    const fistResult = classifyFistBucket(fistFeatures);

    debugCandidateScores = fistResult.candidateScores as Record<string, number>;
    debugRejections = fistResult.rejectionReasons as Record<string, string>;

    if (fistResult.margin < DISAMBIGUATION_THRESHOLDS.minimumMargin) {
      // Ambiguous — block this frame so smoothDetections won't count it
      if (debug) {
        lastDebugOutput = {
          bucket,
          candidateScores: debugCandidateScores,
          featureSnapshot: fistFeatures,
          rejectionReasons: {
            ...debugRejections,
            _margin: `margin=${fistResult.margin.toFixed(3)} < ${DISAMBIGUATION_THRESHOLDS.minimumMargin} (blocked)`,
          },
        };
      }
      return null;
    }

    // Confidence comes from the winner's rule-score rather than raw fingerpose
    stageOneResult = {
      letter: fistResult.winner,
      confidence: 0.5 + fistResult.candidateScores[fistResult.winner]! * 0.5,
    };
  }

  // --- R bucket: R / U / V ---
  const indexExtended = distance(landmarks[8]!, landmarks[5]!) > 0.5 * distance(landmarks[0]!, landmarks[9]!);
  const middleExtended = distance(landmarks[12]!, landmarks[9]!) > 0.5 * distance(landmarks[0]!, landmarks[9]!);

  if (
    extCount === 2 &&
    indexExtended &&
    middleExtended &&
    (stageOneResult?.letter === "R" ||
      stageOneResult?.letter === "U" ||
      stageOneResult?.letter === "V")
  ) {
    bucket = "R";
    const rResult = classifyRBucket(fistFeatures);

    debugCandidateScores = { R: 0, U: 0, V: 0 };
    debugCandidateScores[rResult.winner] = 1;
    debugRejections = { _rBucket: rResult.rejections.join("; ") || "passed" };

    if (rResult.winner === "R" && rResult.margin >= DISAMBIGUATION_THRESHOLDS.minimumMargin) {
      stageOneResult = { letter: "R", confidence: 0.55 + rResult.margin * 0.4 };
    } else if (rResult.winner !== "R") {
      // Defer back to fingerpose winner (U or V)
      stageOneResult = bestGesture
        ? { letter: bestGesture.name, confidence: bestGesture.score / 10.0 }
        : null;
    }
    // If R wins but margin is too tight, keep fingerpose result
  }

  if (debug) {
    lastDebugOutput = {
      bucket,
      candidateScores: debugCandidateScores,
      featureSnapshot: fistFeatures,
      rejectionReasons: debugRejections,
    };
  } else {
    lastDebugOutput = null;
  }

  // ------------------------------------------------------------------
  // Build final DetailedSignResult
  // ------------------------------------------------------------------
  const result = stageOneResult;
  if (!result) return null;

  const wrist = landmarks[0]!;
  const middleMcp = landmarks[9]!;
  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const angle = Math.abs(Math.atan2(dx, -dy) * (180 / Math.PI));
  const openness =
    distance(landmarks[8]!, landmarks[20]!) + distance(landmarks[4]!, landmarks[8]!);
  const handshape = clampScore(result.confidence * 100);
  const orientation = clampScore(100 - angle * 1.45);
  const movement = clampScore(78 + result.confidence * 14 - openness * 18);

  return {
    letter: result.letter,
    confidence: result.confidence,
    scores: { handshape, movement, orientation },
  };
}
