"use client";

interface Props {
  tip: string | null;
  isLoading?: boolean;
}

export function CoachBubble({ tip, isLoading }: Props) {
  if (!tip && !isLoading) return null;

  return (
    <div className="flex items-start gap-4 mt-4 select-none">
      {/* Mascot / Robot Avatar with 3D shadow */}
      <div className="w-12 h-12 rounded-2xl border-2 border-[#22263a] bg-[#1a1d27] flex items-center justify-center flex-shrink-0 shadow-[0_3px_0_#141724]">
        <span className="text-2xl">🤖</span>
      </div>
      
      {/* Speech Bubble Container */}
      <div className="flex-1 relative bg-[#1a1d27] border-2 border-[#22263a] rounded-2xl p-4 shadow-[0_4px_0_#141724]">
        {/* Left pointing arrow tip */}
        <div className="absolute top-4 -left-2 w-3.5 h-3.5 rotate-45 border-l-2 border-b-2 border-[#22263a] bg-[#1a1d27]" />
        
        <div className="relative z-10">
          <h4 className="text-[9px] uppercase tracking-[0.2em] font-black text-[#4f8ef7] mb-1">
            AI Coach
          </h4>
          
          {isLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-2.5 bg-[#22263a] rounded-full w-3/4 animate-pulse" />
              <div className="h-2.5 bg-[#22263a] rounded-full w-1/2 animate-pulse" />
            </div>
          ) : (
            <p className="text-xs text-[#f0f2f8] leading-relaxed">
              {tip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
