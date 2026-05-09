"use client";

/**
 * Live recognition debug overlay.
 *
 * Shows the current coarse bucket, all feature values colour-coded against the
 * reference midpoints, candidate scores for letters in the bucket, and which
 * rule rejected each candidate.
 *
 * Props:
 *   output — latest DebugRecognitionOutput from classifyFingerspellingFallback,
 *            or null when no hand is detected / not in debug mode.
 */

import type { DebugRecognitionOutput, FistFeatures } from "@/lib/inference/features";

interface Props {
  output: DebugRecognitionOutput | null;
  detectedLetter: string | null;
  confidence: number | null;
}

// Feature keys shown in the table, in display order
const FEATURE_KEYS: (keyof FistFeatures)[] = [
  "extendedFingerCount",
  "thumbUnderCount",
  "tipClusterSpread",
  "fistCompactness",
  "thumbToIndexTip",
  "thumbToMiddleTip",
  "thumbToRingTip",
  "thumbToPinkyTip",
  "thumbToIndexMcp",
  "thumbToMiddleMcp",
  "thumbToRingMcp",
  "thumbToPinkyMcp",
  "indexMiddleCrossMetric",
  "indexMiddleTipSeparation",
];

const FEATURE_LABELS: Record<keyof FistFeatures, string> = {
  extendedFingerCount: "extended fingers",
  thumbUnderCount: "thumb under count",
  tipClusterSpread: "tip cluster spread",
  fistCompactness: "fist compactness",
  thumbToIndexTip: "thumb → index tip",
  thumbToMiddleTip: "thumb → middle tip",
  thumbToRingTip: "thumb → ring tip",
  thumbToPinkyTip: "thumb → pinky tip",
  thumbToIndexMcp: "thumb → index MCP",
  thumbToMiddleMcp: "thumb → middle MCP",
  thumbToRingMcp: "thumb → ring MCP",
  thumbToPinkyMcp: "thumb → pinky MCP",
  indexMiddleCrossMetric: "cross metric",
  indexMiddleTipSeparation: "idx/mid tip sep",
};

function fmt(v: number, isInt = false): string {
  return isInt ? String(Math.round(v)) : v.toFixed(3);
}

function scoreColor(score: number): string {
  if (score >= 0.85) return "text-green-400";
  if (score >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

function featureColor(key: keyof FistFeatures, value: number): string {
  // For integer counts, just show neutral
  if (key === "extendedFingerCount" || key === "thumbUnderCount") return "text-blue-300";
  // Cross metric: negative is meaningful for R
  if (key === "indexMiddleCrossMetric") {
    return value < -0.05 ? "text-green-400" : value < 0.05 ? "text-yellow-400" : "text-gray-400";
  }
  return "text-gray-300";
}

export function RecognitionDebugOverlay({ output, detectedLetter, confidence }: Props) {
  if (!output) {
    return (
      <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-gray-700 bg-gray-950/95 p-4 text-xs text-gray-500 font-mono w-72">
        <div className="text-gray-600">No hand detected</div>
      </div>
    );
  }

  const { bucket, candidateScores, featureSnapshot, rejectionReasons } = output;
  const sortedCandidates = Object.entries(candidateScores).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-gray-700 bg-gray-950/95 p-4 font-mono text-xs shadow-2xl w-80 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 uppercase tracking-wider text-[10px]">
          Recognition Debug
        </span>
        {detectedLetter && (
          <span className="text-2xl font-black text-cyan-400">
            {detectedLetter}
            {confidence !== null && (
              <span className="ml-1 text-sm text-gray-400">
                {(confidence * 100).toFixed(0)}%
              </span>
            )}
          </span>
        )}
      </div>

      {/* Bucket badge */}
      <div className="mb-3">
        <span className="text-gray-500 mr-2">bucket</span>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            bucket === "fist"
              ? "bg-purple-900 text-purple-300"
              : bucket === "R"
              ? "bg-blue-900 text-blue-300"
              : "bg-gray-800 text-gray-400"
          }`}
        >
          {bucket}
        </span>
      </div>

      {/* Candidate scores */}
      {sortedCandidates.length > 0 && (
        <div className="mb-3">
          <div className="text-gray-500 mb-1">candidates</div>
          <div className="space-y-1">
            {sortedCandidates.map(([letter, score]) => (
              <div key={letter} className="flex items-center gap-2">
                <span className="w-4 font-bold text-white">{letter}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      score >= 0.85
                        ? "bg-green-400"
                        : score >= 0.5
                        ? "bg-yellow-400"
                        : "bg-red-600"
                    }`}
                    style={{ width: `${(score * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className={`w-10 text-right ${scoreColor(score)}`}>
                  {fmt(score)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature table */}
      <div className="mb-3">
        <div className="text-gray-500 mb-1">features</div>
        <table className="w-full">
          <tbody>
            {FEATURE_KEYS.map((key) => {
              const val = featureSnapshot[key];
              const isInt = key === "extendedFingerCount" || key === "thumbUnderCount";
              return (
                <tr key={key} className="border-t border-gray-800">
                  <td className="py-0.5 text-gray-500 pr-2 whitespace-nowrap">
                    {FEATURE_LABELS[key]}
                  </td>
                  <td className={`py-0.5 text-right ${featureColor(key, val)}`}>
                    {fmt(val, isInt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Rejection reasons */}
      {Object.keys(rejectionReasons).length > 0 && (
        <details className="mt-1">
          <summary className="text-gray-500 cursor-pointer hover:text-gray-300">
            rejection log ({Object.keys(rejectionReasons).length})
          </summary>
          <div className="mt-1 space-y-1 pl-1">
            {Object.entries(rejectionReasons).map(([letter, reason]) => (
              <div key={letter} className="text-[10px]">
                <span className="text-red-400 font-bold">{letter}: </span>
                <span className="text-gray-500">{reason}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
