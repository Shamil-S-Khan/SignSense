"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/sessionStore";
import { apiClient } from "@/lib/api/client";
import { WebcamFeed } from "@/components/webcam/WebcamFeed";
import { HeartBar } from "@/components/ui/HeartBar";
import { ScoreBars } from "@/components/lesson/ScoreBars";
import { ResultsScreen } from "@/components/lesson/ResultsScreen";
import { SignReference } from "@/components/lesson/SignReference";
import { CoachBubble } from "@/components/lesson/CoachBubble";
import { useSignWebSocket } from "@/hooks/useWebSocket";

import { toast } from "react-hot-toast";

export default function LessonPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;
  const isPracticeMode = searchParams.get("mode") === "practice";
  
  const { heartsRemaining, loseHeart, setLesson, clearSession } = useSessionStore();
  const { isConnected, prediction, scores: wsScores, coachingTip, sendLandmarks, startDrill, endDrill } = useSignWebSocket();
  
  const [lessonData, setLessonData] = useState<any>(null);
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [scores, setScores] = useState({ handshape: 0, movement: 0, orientation: 0 });
  const [isFinished, setIsFinished] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [drillActive, setDrillActive] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  
  useEffect(() => {
    setLesson(lessonId);
    apiClient.get(`/api/lessons/${lessonId}`)
      .then((data: any) => setLessonData(data))
      .catch(console.error);
      
    return () => clearSession();
  }, [lessonId]);

  // Start a drill when we have data and WS is connected
  useEffect(() => {
    if (lessonData && isConnected && !drillActive && !isFinished) {
      const targetSign = lessonData.signs[currentSignIndex];
      startDrill(targetSign);
      setDrillActive(true);
    }
  }, [lessonData, isConnected, currentSignIndex, drillActive, isFinished]);

  // Consume WebSocket predictions in real-time
  useEffect(() => {
    if (!prediction || !lessonData || isCorrect || isFinished) return;

    const targetSign = lessonData.signs[currentSignIndex];
    
    // Debug: log predictions
    if (Math.random() < 0.05) {
      console.log(`[Lesson] prediction='${prediction.prediction}' conf=${prediction.confidence} target='${targetSign}' match=${prediction.prediction.toUpperCase() === targetSign.toUpperCase()}`);
    }
    
    if (prediction.prediction.toUpperCase() === targetSign.toUpperCase() && prediction.confidence > 0.15) {
      setIsCorrect(true);
      toast.success("Nice job!", { duration: 1000 });
      
      // End the drill on backend
      endDrill();
      setDrillActive(false);
      setCoachLoading(true);

      setTimeout(() => {
        setIsCorrect(false);
        if (currentSignIndex + 1 < lessonData.signs.length) {
          setCurrentSignIndex(prev => prev + 1);
          setScores({ handshape: 0, movement: 0, orientation: 0 });
        } else {
          apiClient.post(`/api/lessons/${lessonId}/complete`, {
            hearts_remaining: heartsRemaining,
            accuracy: 95.0
          }).then(() => setIsFinished(true));
        }
      }, 2000);
    }
  }, [prediction]);

  // Consume WebSocket scoring results
  useEffect(() => {
    if (wsScores) {
      setScores({
        handshape: wsScores.handshape,
        movement: wsScores.movement,
        orientation: wsScores.orientation,
      });
    }
  }, [wsScores]);

  // Coaching tip received
  useEffect(() => {
    if (coachingTip) {
      setCoachLoading(false);
    }
  }, [coachingTip]);

  // Fallback handler for local fingerpose (when WS is disconnected)
  const handleSignDetected = useCallback((
    sign: string, 
    confidence: number, 
    detailScores?: { handshape: number; movement: number; orientation: number }
  ) => {
    if (isFinished || !lessonData || isCorrect || isConnected) return;
    
    if (detailScores) setScores(detailScores);

    const targetSign = lessonData.signs[currentSignIndex];
    
    if (sign.toUpperCase() === targetSign.toUpperCase() && confidence > 0.25) {
      setIsCorrect(true);
      toast.success("Nice job!", { duration: 1000 });
      
      setTimeout(() => {
        setIsCorrect(false);
        if (currentSignIndex + 1 < lessonData.signs.length) {
          setCurrentSignIndex(prev => prev + 1);
          setScores({ handshape: 0, movement: 0, orientation: 0 });
        } else {
          apiClient.post(`/api/lessons/${lessonId}/complete`, {
            hearts_remaining: heartsRemaining,
            accuracy: 95.0
          }).then(() => setIsFinished(true));
        }
      }, 1500);
    }
  }, [isFinished, lessonData, isCorrect, isConnected, currentSignIndex, heartsRemaining, lessonId]);

  if (!lessonData) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">Loading...</div>;

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 relative z-10">
        <button 
          onClick={() => router.push("/skill-tree")} 
          className="group flex items-center gap-2 px-4 py-2 bg-gray-900/50 hover:bg-gray-800 rounded-xl transition-all border border-gray-800"
        >
          <span className="text-gray-400 group-hover:text-white transition-colors">✕</span>
          <span className="text-sm font-medium text-gray-400 group-hover:text-white">
            {isPracticeMode ? "Stop Practice" : "Exit Lesson"}
          </span>
        </button>
        
        <div className="flex-1 max-w-md mx-8">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">
            <span>{isPracticeMode ? "Free Practice" : "Progress"}</span>
            {!isPracticeMode && <span>{Math.round((currentSignIndex / lessonData.signs.length) * 100)}%</span>}
          </div>
          {!isPracticeMode && (
            <div className="bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-800">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: `${(currentSignIndex / lessonData.signs.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="bg-gray-900/50 px-4 py-2 rounded-xl border border-gray-800">
          {isPracticeMode ? (
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
              <span>∞ Lives</span>
            </div>
          ) : (
            <HeartBar hearts={heartsRemaining} />
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* Left Side: Target Sign & Analysis */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className={`relative flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-md border-2 transition-all duration-500 ${isCorrect ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)]' : 'border-gray-800'} rounded-[2.5rem] p-8 aspect-square lg:aspect-auto lg:h-[420px]`}>
            <h2 className="text-xs uppercase tracking-[0.2em] font-black text-gray-500 mb-6">{isCorrect ? "Perfect Match!" : "Target Sign"}</h2>
            
            <div className="flex flex-col items-center gap-8">
              <div className={`text-[10rem] leading-none font-black transition-all duration-500 ${isCorrect ? 'text-green-500 scale-110' : 'text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}>
                {lessonData.signs[currentSignIndex]}
              </div>
              
              {!isCorrect && <SignReference sign={lessonData.signs[currentSignIndex]} />}
            </div>

            {isPracticeMode && !isCorrect && (
               <button 
                onClick={() => setCurrentSignIndex((prev) => (prev + 1) % lessonData.signs.length)}
                className="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors"
               >
                 Skip Sign
               </button>
            )}

            {isCorrect && (
              <div className="absolute bottom-8 animate-bounce text-green-400 font-bold tracking-widest uppercase text-xs">
                Nice Job!
              </div>
            )}
          </div>
          
          <div className="bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-[2.5rem] p-8 flex-1">
            <h3 className="text-xs uppercase tracking-[0.2em] font-black text-gray-500 mb-6 text-center">Live Analysis</h3>
            <ScoreBars 
              handshapeScore={scores.handshape} 
              movementScore={scores.movement} 
              orientationScore={scores.orientation} 
            />
          </div>

          {/* AI Coach Bubble */}
          <CoachBubble tip={coachingTip} isLoading={coachLoading} />
        </div>
        
        {/* Right Side: Webcam Feed (Main centerpiece) */}
        <div className="lg:col-span-8">
          <div className={`relative aspect-[4/3] lg:aspect-auto lg:h-[600px] bg-black rounded-[2.5rem] overflow-hidden border-2 transition-all duration-500 ${isCorrect ? 'border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.3)]' : 'border-blue-900/30 shadow-2xl shadow-blue-900/20'}`}>
             <WebcamFeed 
               onSignDetected={handleSignDetected}
               onLandmarksForWS={sendLandmarks}
               wsConnected={isConnected}
               disablePose={lessonData.title.toLowerCase().includes('alphabet') || lessonData.title.toLowerCase().includes('basics')}
             />
             
             {/* Target Sign Overlay for reference */}
             <div className="absolute bottom-8 right-8 w-24 h-24 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center select-none pointer-events-none">
                <span className="text-4xl font-black text-white/40">{lessonData.signs[currentSignIndex]}</span>
             </div>
          </div>
        </div>
      </div>
      
      {isFinished && <ResultsScreen xpEarned={50} accuracy={95} />}
    </main>
  );
}
