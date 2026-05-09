"use client";

import type { RecognitionResult } from "@/lib/sign-recognition/types";

interface Props {
  result: RecognitionResult | null;
  error: string | null;
}

export function PredictionResults({ result, error }: Props) {
  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Predictions</p>
      <h2 className="mt-2 text-2xl font-black text-white">Top 3 glosses</h2>

      {error ? <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}

      {result ? (
        <div className="mt-5 space-y-3">
          {result.predictions.map((prediction, index) => {
            const percentage = Math.round(prediction.confidence * 100);
            return (
              <div key={`${prediction.label}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Rank {index + 1}</div>
                    <div className="mt-1 text-2xl font-black text-white">{prediction.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Confidence</div>
                    <div className="mt-1 text-xl font-black text-cyan-200">{percentage}%</div>
                  </div>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-[width] duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <p>Total backend time: {result.totalMs.toFixed(2)}ms</p>
            <p>Preprocess: {result.preprocessMs.toFixed(2)}ms</p>
            <p>Inference: {result.inferenceMs.toFixed(2)}ms</p>
            <p>Frames sent: {result.framesReceived}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-zinc-400">Your top three WLASL predictions will appear here after you finish signing.</p>
      )}
    </section>
  );
}