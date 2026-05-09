"use client";

interface Props {
  isReady: boolean;
  isRecording: boolean;
  isPredicting: boolean;
  frameCount: number;
  onStart: () => void | Promise<void>;
  onDone: () => void;
}

export function RecognitionControls({
  isReady,
  isRecording,
  isPredicting,
  frameCount,
  onStart,
  onDone,
}: Props) {
  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Recording controls</p>
          <h2 className="mt-2 text-2xl font-black text-white">Capture one sign</h2>
        </div>
        <div className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.22em] ${isRecording ? "bg-red-500/15 text-red-100" : "bg-zinc-900 text-zinc-300"}`}>
          {isRecording ? "Rec" : "Idle"}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="Frames" value={frameCount} />
        <Metric label="Ready" value={isReady ? "Yes" : "No"} />
        <Metric label="Predicting" value={isPredicting ? "Yes" : "No"} />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            void onStart();
          }}
          disabled={!isReady || isPredicting}
          className={`inline-flex h-12 flex-1 items-center justify-center rounded-2xl border text-sm font-black uppercase tracking-[0.18em] transition ${
            isRecording
              ? "border-red-300 bg-red-500 text-white shadow-[0_0_0_8px_rgba(239,68,68,0.16)]"
              : "border-cyan-300 bg-cyan-300 text-black hover:bg-cyan-200"
          } disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500`}
        >
          {isRecording ? "Recording" : "Start signing"}
        </button>

        <button
          type="button"
          onClick={onDone}
          disabled={!isRecording || isPredicting}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500"
        >
          {isPredicting ? "Recognizing..." : "Done"}
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
    </div>
  );
}