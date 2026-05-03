"use client";
import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

export interface WSPrediction {
  prediction: string;
  confidence: number;
  target?: string;
}

export interface WSScores {
  handshape: number;
  orientation: number;
  movement: number;
  issues: string[];
}

interface UseWebSocketReturn {
  isConnected: boolean;
  prediction: WSPrediction | null;
  scores: WSScores | null;
  coachingTip: string | null;
  sendLandmarks: (landmarks: number[], sessionId?: string) => void;
  startDrill: (sign: string, sessionId?: string) => void;
  endDrill: (sessionId?: string) => void;
}

export function useSignWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [prediction, setPrediction] = useState<WSPrediction | null>(null);
  const [scores, setScores] = useState<WSScores | null>(null);
  const [coachingTip, setCoachingTip] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log("[WS] Connected to", WS_URL);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === "prediction") {
          setPrediction({
            prediction: data.prediction,
            confidence: data.confidence,
            target: data.target,
          });
        } else if (data.type === "scores") {
          setScores({
            handshape: data.handshape,
            orientation: data.orientation,
            movement: data.movement,
            issues: data.issues || [],
          });
        } else if (data.type === "coaching") {
          setCoachingTip(data.tip);
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 2s
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendLandmarks = useCallback((landmarks: number[], sessionId = "default") => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      landmarks,
      session_id: sessionId,
    }));
  }, []);

  const startDrill = useCallback((sign: string, sessionId = "default") => {
    setScores(null);
    setCoachingTip(null);
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      action: "start_drill",
      sign,
      session_id: sessionId,
    }));
  }, []);

  const endDrill = useCallback((sessionId = "default") => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      action: "end_drill",
      session_id: sessionId,
    }));
  }, []);

  return { isConnected, prediction, scores, coachingTip, sendLandmarks, startDrill, endDrill };
}
