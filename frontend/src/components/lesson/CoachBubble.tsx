"use client";

interface Props {
  tip: string | null;
  isLoading?: boolean;
}

export function CoachBubble({ tip, isLoading }: Props) {
  if (!tip && !isLoading) return null;

  return (
    <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/30 backdrop-blur-md border border-blue-500/20 rounded-2xl p-6 mt-4 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute -top-4 -left-4 w-16 h-16 bg-blue-500/20 blur-2xl rounded-full" />
      
      <div className="flex items-start gap-3 relative z-10">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/30">
          <span className="text-lg">🤖</span>
        </div>
        
        <div className="flex-1">
          <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-400 mb-2">
            AI Coach
          </h4>
          
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-gray-700/50 rounded-full w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-700/50 rounded-full w-1/2 animate-pulse" />
            </div>
          ) : (
            <p className="text-sm text-gray-300 leading-relaxed">
              {tip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
