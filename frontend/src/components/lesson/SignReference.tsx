"use client";
import Image from "next/image";
import { useState } from "react";

interface Props {
  sign: string;
}

export function SignReference({ sign }: Props) {
  const [error, setError] = useState(false);
  
  const imagePath = `/references/${sign.toUpperCase()}.png`;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-gray-500 italic">
        <div className="w-12 h-12 border border-dashed border-gray-700 rounded-lg flex items-center justify-center">
          ?
        </div>
        <span className="text-[10px]">No diagram yet</span>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
      <div className="relative w-24 h-24 lg:w-32 lg:h-32 bg-gray-900/80 rounded-2xl overflow-hidden border border-white/10 p-2">
        <Image
          src={imagePath}
          alt={`ASL Sign ${sign}`}
          fill
          className="object-contain p-2"
          onError={() => setError(true)}
        />
      </div>
      <div className="mt-2 text-center">
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Ref Guide</span>
      </div>
    </div>
  );
}
