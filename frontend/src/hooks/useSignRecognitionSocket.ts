"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ConnectionStatus, RecognitionResult } from "@/lib/sign-recognition/types";

function toWebSocketUrl(baseUrl: string) {
  if (baseUrl.startsWith("https://")) {
    return `wss://${baseUrl.slice("https://".length)}`;
  }

  if (baseUrl.startsWith("http://")) {
    return `ws://${baseUrl.slice("http://".length)}`;
  }

  return baseUrl;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_SIGN_RECOGNITION_WS_URL || `${toWebSocketUrl(API_BASE_URL)}/ws/sign-recognition`;

interface UseSignRecognitionSocketReturn {
  connectionStatus: ConnectionStatus;
  latestResult: RecognitionResult | null;
  isPredicting: boolean;
  error: string | null;
  sendFrame: (frameIndex: number, jpeg: string) => void;
  requestPrediction: () => void;
  clearRemoteBuffer: () => void;
  clearPrediction: () => void;
}

export function useSignRecognitionSocket(): UseSignRecognitionSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [latestResult, setLatestResult] = useState<RecognitionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          type: string;
          message?: string;
          predictions?: { label: string; confidence: number }[];
          preprocess_ms?: number;
          inference_ms?: number;
          total_ms?: number;
          frames_received?: number;
          is_confident?: boolean;
        };

        if (message.type === "prediction" && message.predictions) {
          setLatestResult({
            predictions: message.predictions,
            preprocessMs: message.preprocess_ms ?? 0,
            inferenceMs: message.inference_ms ?? 0,
            totalMs: message.total_ms ?? 0,
            framesReceived: message.frames_received ?? 0,
            isConfident: Boolean(message.is_confident),
          });
          setIsPredicting(false);
          setError(null);
          return;
        }

        if (message.type === "error") {
          setError(message.message ?? "Recognition request failed");
          setIsPredicting(false);
        }
      } catch {
        setError("Received malformed recognition response");
        setIsPredicting(false);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      setIsPredicting(false);
      reconnectTimerRef.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const sendFrame = useCallback((frameIndex: number, jpeg: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "frame",
        frame_index: frameIndex,
        jpeg,
      }),
    );
  }, []);

  const requestPrediction = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setError("Recognition socket is not connected");
      return;
    }

    setIsPredicting(true);
    wsRef.current.send(JSON.stringify({ type: "predict" }));
  }, []);

  const clearRemoteBuffer = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({ type: "clear" }));
  }, []);

  const clearPrediction = useCallback(() => {
    setLatestResult(null);
    setError(null);
    setIsPredicting(false);
  }, []);

  return {
    connectionStatus,
    latestResult,
    isPredicting,
    error,
    sendFrame,
    requestPrediction,
    clearRemoteBuffer,
    clearPrediction,
  };
}