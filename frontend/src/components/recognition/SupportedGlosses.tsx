"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { WLASL100_GLOSSES } from "@/lib/sign-recognition/wlasl100";

interface Props {
  highlighted?: string[];
}

export function SupportedGlosses({ highlighted = [] }: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const highlightedSet = useMemo(
    () => new Set(highlighted.map((label) => label.toUpperCase())),
    [highlighted],
  );

  const filteredGlosses = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toUpperCase();
    if (!normalizedQuery) {
      return WLASL100_GLOSSES;
    }

    return WLASL100_GLOSSES.filter((gloss) => gloss.includes(normalizedQuery));
  }, [deferredQuery]);

  return (
    <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Supported vocabulary</p>
          <h2 className="mt-2 text-2xl font-black text-white">WLASL100 gloss list</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            These are the 100 words your current Siformer checkpoint can predict. Search by gloss to find a word quickly.
          </p>
        </div>

        <div className="min-w-[220px] sm:max-w-[260px]">
          <label htmlFor="wlasl-gloss-search" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            Search words
          </label>
          <input
            id="wlasl-gloss-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. HELP, SCHOOL"
            className="h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-medium text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/60"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
        <span>{filteredGlosses.length} words shown</span>
        <span>100 total classes</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {filteredGlosses.map((gloss) => {
          const isHighlighted = highlightedSet.has(gloss);
          return (
            <div
              key={gloss}
              className={`rounded-2xl border px-3 py-3 text-sm font-black uppercase tracking-[0.14em] transition ${
                isHighlighted
                  ? "border-cyan-300 bg-cyan-300 text-black"
                  : "border-white/10 bg-white/[0.03] text-zinc-200"
              }`}
            >
              {gloss}
            </div>
          );
        })}
      </div>
    </section>
  );
}