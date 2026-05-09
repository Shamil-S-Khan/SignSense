"use client";

/**
 * One-time development tool: Reference Feature Extractor
 *
 * Loads the six ambiguous reference PNGs (E M N R S T), runs MediaPipe
 * HandLandmarker on each in IMAGE mode, extracts geometric features via
 * extractFistFeatures(), and renders the results as copyable JSON.
 *
 * USAGE:
 *   1. `npm run dev`
 *   2. Open http://localhost:3000/debug/reference-extractor
 *   3. Wait for the table to populate (takes ~5 s on first load)
 *   4. Click "Copy JSON" and paste into reference-profiles.ts
 *
 * Only available in development mode.
 */

import { useEffect, useRef, useState } from "react";

// Guard — redirect in production is handled by not linking to this page;
// we keep a runtime guard as well.
const IS_DEV = process.env.NODE_ENV !== "production";

const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const TARGET_LETTERS = ["E", "M", "N", "R", "S", "T"] as const;
type TargetLetter = (typeof TARGET_LETTERS)[number];

interface ExtractionResult {
  letter: TargetLetter;
  status: "pending" | "ok" | "no-hand" | "error";
  features: Record<string, number> | null;
  rawLandmarks: { x: number; y: number; z: number }[] | null;
  error?: string;
}

export default function ReferenceExtractorPage() {
  const [results, setResults] = useState<ExtractionResult[]>(
    TARGET_LETTERS.map((l) => ({
      letter: l,
      status: "pending",
      features: null,
      rawLandmarks: null,
    })),
  );
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!IS_DEV) return;

    let cancelled = false;

    async function run() {
      // Dynamic import so this module is never included in production bundles.
      const { HandLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );

      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_MODEL,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numHands: 1,
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });

      if (cancelled) {
        landmarker.close();
        return;
      }

      const { extractFistFeatures } = await import(
        "@/lib/inference/features"
      );

      for (const letter of TARGET_LETTERS) {
        if (cancelled) break;

        try {
          const img = await loadImage(`/references/${letter}.png`);
          const canvas = canvasRef.current!;
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);

          const result = landmarker.detect(canvas);

          if (!result.landmarks || result.landmarks.length === 0) {
            setResults((prev) =>
              prev.map((r) =>
                r.letter === letter
                  ? { ...r, status: "no-hand", features: null, rawLandmarks: null }
                  : r,
              ),
            );
            continue;
          }

          const lm = result.landmarks[0]!.map((p) => ({
            x: p.x,
            y: p.y,
            z: p.z,
          }));

          const features = extractFistFeatures(lm);
          const featuresRecord: Record<string, number> = {};
          for (const [k, v] of Object.entries(features)) {
            featuresRecord[k] = Math.round((v as number) * 10000) / 10000;
          }

          setResults((prev) =>
            prev.map((r) =>
              r.letter === letter
                ? {
                    ...r,
                    status: "ok",
                    features: featuresRecord,
                    rawLandmarks: lm,
                  }
                : r,
            ),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setResults((prev) =>
            prev.map((r) =>
              r.letter === letter
                ? { ...r, status: "error", error: msg, features: null, rawLandmarks: null }
                : r,
            ),
          );
        }
      }

      landmarker.close();
    }

    run().catch((err) => {
      console.error("[reference-extractor]", err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const okResults = results.filter((r) => r.status === "ok" && r.features);

  const exportJson = JSON.stringify(
    Object.fromEntries(okResults.map((r) => [r.letter, r.features])),
    null,
    2,
  );

  async function handleCopy() {
    await navigator.clipboard.writeText(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!IS_DEV) {
    return (
      <div className="p-8 text-red-500 font-mono">
        This page is only available in development mode.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8 font-mono">
      <h1 className="text-2xl font-bold mb-2 text-cyan-400">
        Reference Feature Extractor
      </h1>
      <p className="text-gray-400 mb-6 text-sm">
        Runs MediaPipe HandLandmarker on each reference PNG and extracts
        geometric features. Copy the JSON output and paste it into{" "}
        <span className="text-amber-400">
          frontend/src/lib/inference/reference-profiles.ts
        </span>
        .
      </p>

      {/* Hidden canvas used for image processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Results table */}
      <div className="overflow-x-auto mb-6">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-800 text-gray-400">
              <th className="px-3 py-2 text-left">Letter</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">extendedFingerCount</th>
              <th className="px-3 py-2 text-left">thumbUnderCount</th>
              <th className="px-3 py-2 text-left">tipClusterSpread</th>
              <th className="px-3 py-2 text-left">meanTipToThumb</th>
              <th className="px-3 py-2 text-left">crossMetric</th>
              <th className="px-3 py-2 text-left">tipSeparation</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const meanTip =
                r.features
                  ? (
                      (r.features["thumbToIndexTip"] ?? 0) +
                      (r.features["thumbToMiddleTip"] ?? 0) +
                      (r.features["thumbToRingTip"] ?? 0) +
                      (r.features["thumbToPinkyTip"] ?? 0)
                    ) / 4
                  : null;
              return (
                <tr
                  key={r.letter}
                  className="border-t border-gray-700 hover:bg-gray-800"
                >
                  <td className="px-3 py-2 font-bold text-white text-lg">
                    {r.letter}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} error={r.error} />
                  </td>
                  <td className="px-3 py-2 text-blue-300">
                    {r.features?.["extendedFingerCount"] ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-purple-300">
                    {r.features?.["thumbUnderCount"] ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-yellow-300">
                    {r.features?.["tipClusterSpread"]?.toFixed(4) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-green-300">
                    {meanTip !== null ? meanTip.toFixed(4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-red-300">
                    {r.features?.["indexMiddleCrossMetric"]?.toFixed(4) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-orange-300">
                    {r.features?.["indexMiddleTipSeparation"]?.toFixed(4) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Full JSON output */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-semibold text-gray-300">
          Full Feature JSON
        </h2>
        <button
          onClick={handleCopy}
          disabled={okResults.length === 0}
          className="px-3 py-1 rounded text-xs bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 transition-colors"
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
        <span className="text-gray-500 text-xs">
          {okResults.length}/{TARGET_LETTERS.length} letters processed
        </span>
      </div>
      <pre className="bg-gray-900 border border-gray-700 rounded p-4 text-xs overflow-auto max-h-96 text-green-300">
        {okResults.length > 0 ? exportJson : "Waiting for results..."}
      </pre>

      {/* Reference images */}
      <h2 className="text-lg font-semibold text-gray-300 mt-8 mb-3">
        Reference Images
      </h2>
      <div className="flex gap-4 flex-wrap">
        {TARGET_LETTERS.map((letter) => (
          <div key={letter} className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/references/${letter}.png`}
              alt={`ASL ${letter}`}
              className="w-24 h-24 object-contain bg-gray-800 rounded border border-gray-600"
            />
            <div className="text-sm font-bold mt-1">{letter}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function StatusBadge({
  status,
  error,
}: {
  status: ExtractionResult["status"];
  error?: string;
}) {
  if (status === "pending")
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
    );
  if (status === "ok")
    return (
      <span className="text-green-400 font-semibold">✓ ok</span>
    );
  if (status === "no-hand")
    return (
      <span className="text-amber-400">⚠ no hand detected</span>
    );
  return (
    <span className="text-red-400" title={error}>
      ✗ error
    </span>
  );
}
