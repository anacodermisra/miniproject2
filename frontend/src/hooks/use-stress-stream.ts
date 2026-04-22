"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { StressResult } from "@/lib/types";

type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

interface UseStressStreamReturn {
  data: StressResult | null;
  history: StressResult[];
  status: ConnectionStatus;
  error: string | null;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

export function useStressStream(): UseStressStreamReturn {
  const [data, setData] = useState<StressResult | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("mindpulse_last_data");
        return saved ? JSON.parse(saved) : null;
      } catch (e) {}
    }
    return null;
  });
  const [history, setHistory] = useState<StressResult[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("mindpulse_last_history");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }
    return [];
  });
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMounted = useRef(false);

  const connect = useCallback(() => {
    // Only run in browser
    if (typeof window === "undefined") return;
    
    const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000/api/v1/ws/stress";
    
    try {
      setStatus("connecting");
      setError(null);
      
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        if (!isMounted.current) return;
        reconnectAttemptsRef.current = 0;
        setStatus("connected");
        setError(null);
      };
      
      ws.onclose = (event) => {
        if (!isMounted.current) return;
        setStatus("disconnected");
        
        // Don't reconnect if closed cleanly
        if (event.wasClean) return;
        
        reconnectAttemptsRef.current += 1;
        const jitter = Math.floor(Math.random() * 800);
        const backoff = Math.min(10000, 2000 + reconnectAttemptsRef.current * 500 + jitter);
        
        reconnectTimer.current = setTimeout(() => {
          if (isMounted.current) connect();
        }, backoff);
      };
      
      ws.onerror = (err) => {
        if (!isMounted.current) return;
        setStatus("error");
        setError("WebSocket connection failed");
        console.error("[MindPulse WS] Connection error:", err);
      };
      
      ws.onmessage = (e) => {
        if (!isMounted.current) return;
        
        try {
          const msg = JSON.parse(e.data);
          
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            return;
          }
          
          if (msg.type === "stress_update") {
            const result: StressResult = {
              score: msg.score,
              model_score: msg.model_score,
              equation_score: msg.equation_score,
              final_score: msg.final_score,
              level: msg.level,
              confidence: msg.confidence,
              probabilities: msg.probabilities,
              feature_contributions: msg.feature_contributions ?? {},
              insights: msg.insights || [],
              timestamp: msg.timestamp || Date.now(),
              typing_speed_wpm: msg.typing_speed_wpm ?? 0,
              rage_click_count: msg.rage_click_count ?? 0,
              error_rate: msg.error_rate ?? 0,
              click_count: msg.click_count ?? 0,
              mouse_speed_mean: msg.mouse_speed_mean ?? 0,
              mouse_reentry_count: msg.mouse_reentry_count ?? 0,
              mouse_reentry_latency_ms: msg.mouse_reentry_latency_ms ?? 0,
              alert_state: msg.alert_state ?? "NORMAL",
              intervention: msg.intervention ?? null,
              trend: msg.trend ?? "steady",
              recovery_score: msg.recovery_score ?? 0,
            };
            setData(result);
            if (typeof window !== "undefined") {
              sessionStorage.setItem("mindpulse_last_data", JSON.stringify(result));
            }
            setHistory((prev) => {
              const next = [...prev.slice(-120), result];
              if (typeof window !== "undefined") {
                sessionStorage.setItem("mindpulse_last_history", JSON.stringify(next));
              }
              return next;
            });
          } else if (msg.type === "session_reset") {
            setData(null);
            setHistory([]);
          }
        } catch (err) {
          console.error("[MindPulse WS] Message parse error:", err);
        }
      };
      
      wsRef.current = ws;
    } catch (err) {
      setStatus("error");
      setError("Failed to create WebSocket connection");
      console.error("[MindPulse WS] Setup error:", err);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    // Delay connection to avoid SSR issues
    const timer = setTimeout(() => {
      if (isMounted.current) connect();
    }, 100);
    
    return () => {
      isMounted.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, [connect]);

  return { data, history, status, error, wsRef };
}
