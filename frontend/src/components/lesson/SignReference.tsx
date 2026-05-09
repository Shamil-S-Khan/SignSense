"use client";
import Image from "next/image";
import { useState } from "react";

interface Props {
  sign: string;
  isHighlighted?: boolean;
  caption?: string;
}

export function SignReference({ sign, isHighlighted = false, caption = "Ref Guide" }: Props) {
  const [error, setError] = useState(false);

  const imagePath = `/references/${sign.toUpperCase()}.png`;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 italic">
        <div className="w-12 h-12 border border-dashed border-[#e5e5e5] rounded-lg flex items-center justify-center text-[#b0b0b0]">
          ?
        </div>
        <span className="text-[10px] text-[#b0b0b0]">No diagram yet</span>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        className={`absolute inset-0 rounded-full blur-xl transition-opacity ${
          isHighlighted ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ background: isHighlighted ? "rgba(88,204,2,0.2)" : "rgba(28,176,246,0.15)" }}
      />
      <div
        className={`relative w-24 h-24 overflow-hidden rounded-2xl border p-2 lg:h-32 lg:w-32 ${
          isHighlighted
            ? "border-[#58cc02] bg-[#edffd6]"
            : "border-[#e5e5e5] bg-[#f5f5f5]"
        }`}
      >
        <Image
          src={imagePath}
          alt={`ASL Sign ${sign}`}
          fill
          className="object-contain p-2"
          onError={() => setError(true)}
        />
      </div>
      <div className="mt-2 text-center">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isHighlighted ? "text-[#45a301]" : "text-[#b0b0b0]"}`}>
          {caption}
        </span>
      </div>
    </div>
  );
}
