/**
 * MindPulse — Zustand Stress Store
 * ====================================
 * Centralized state management for real-time stress data.
 * 
 * Replaces scattered useState across components with a single source of truth.
 * Features:
 * - Selective subscriptions (only re-render when needed data changes)
 * - Built-in persistence for dashboard preferences
 * - Time-travel debugging support
 * 
 * Usage:
 *   import { useStressStore } from '@/lib/stress-store';
 *   
 *   // In component:
 *   const score = useStressStore(state => state.score);
 *   const addToHistory = useStressStore(state => state.addToHistory);
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StressHistoryPoint {
  score: number;
  level: string;
  confidence: number;
  timestamp: number;
}

export interface InterventionState {
  isActive: boolean;
  type: string | null;
  startedAt: number | null;
  scoreAtStart: number;
}

interface StressStore {
  // Current state
  score: number;
  level: string;
  confidence: number;
  typingSpeedWpm: number;
  rageClickCount: number;
  errorRate: number;
  clickCount: number;
  mouseSpeedMean: number;
  
  // History (last 200 points = ~16 minutes at 5-sec intervals)
  history: StressHistoryPoint[];
  
  // Intervention state
  intervention: InterventionState;
  
  // Loading/error state
  isLoading: boolean;
  error: string | null;
  
  // WebSocket connection state
  wsConnected: boolean;
  
  // Actions
  updateScore: (data: {
    score: number;
    level: string;
    confidence: number;
    typing_speed_wpm?: number;
    rage_click_count?: number;
    error_rate?: number;
    click_count?: number;
    mouse_speed_mean?: number;
  }) => void;
  
  addToHistory: (point: Omit<StressHistoryPoint, "timestamp">) => void;
  
  setIntervention: (intervention: Partial<InterventionState>) => void;
  
  setLoading: (loading: boolean) => void;
  
  setError: (error: string | null) => void;
  
  setWsConnected: (connected: boolean) => void;
  
  reset: () => void;
  
  clearHistory: () => void;
}

const INITIAL_STATE = {
  score: 0,
  level: "UNKNOWN",
  confidence: 0,
  typingSpeedWpm: 0,
  rageClickCount: 0,
  errorRate: 0,
  clickCount: 0,
  mouseSpeedMean: 0,
  history: [] as StressHistoryPoint[],
  intervention: {
    isActive: false,
    type: null,
    startedAt: null,
    scoreAtStart: 0,
  } as InterventionState,
  isLoading: false,
  error: null as string | null,
  wsConnected: false,
};

export const useStressStore = create<StressStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      
      updateScore: (data) =>
        set((state) => ({
          score: data.score,
          level: data.level,
          confidence: data.confidence,
          typingSpeedWpm: data.typing_speed_wpm ?? state.typingSpeedWpm,
          rageClickCount: data.rage_click_count ?? state.rageClickCount,
          errorRate: data.error_rate ?? state.errorRate,
          clickCount: data.click_count ?? state.clickCount,
          mouseSpeedMean: data.mouse_speed_mean ?? state.mouseSpeedMean,
        })),
      
      addToHistory: (point) =>
        set((state) => ({
          history: [
            ...state.history.slice(-199), // Keep last 200
            { ...point, timestamp: Date.now() },
          ],
        })),
      
      setIntervention: (intervention) =>
        set((state) => ({
          intervention: { ...state.intervention, ...intervention },
        })),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      setWsConnected: (wsConnected) => set({ wsConnected }),
      
      reset: () => set(INITIAL_STATE),
      
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "mindpulse-stress-store",
      partialize: (state) => ({
        // Only persist preferences, not live data
        intervention: state.intervention,
        // Keep last 50 history points for continuity
        history: state.history.slice(-50),
      }),
    }
  )
);

// ─── Selectors for Performance ───
// Use these to avoid unnecessary re-renders

export const selectScore = (state: StressStore) => state.score;
export const selectLevel = (state: StressStore) => state.level;
export const selectConfidence = (state: StressStore) => state.confidence;
export const selectHistory = (state: StressStore) => state.history;
export const selectIsLoading = (state: StressStore) => state.isLoading;
export const selectError = (state: StressStore) => state.error;
export const selectWsConnected = (state: StressStore) => state.wsConnected;
export const selectIntervention = (state: StressStore) => state.intervention;
export const selectTypingSpeed = (state: StressStore) => state.typingSpeedWpm;
export const selectRageClicks = (state: StressStore) => state.rageClickCount;
export const selectErrorRate = (state: StressStore) => state.errorRate;
