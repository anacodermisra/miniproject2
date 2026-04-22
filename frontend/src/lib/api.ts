/** MindPulse — API Client */

import type {
  FeatureVector,
  StressResult,
  HistoryPoint,
  CalibrationStatus,
  UserStats,
  HealthStatus,
  InterventionSnapshot,
  InterventionEvent,
} from "./types";

export const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

// ─── ONNX Browser Inference Integration ───
let _onnxInitialized = false;
let _onnxInitPromise: Promise<boolean> | null = null;

async function ensureOnnxReady(): Promise<boolean> {
  if (_onnxInitialized) return true;
  if (_onnxInitPromise) return _onnxInitPromise;
  
  _onnxInitPromise = (async () => {
    try {
      const { browserInference } = await import("./onnx-inference");
      const ready = await browserInference.init();
      _onnxInitialized = ready;
      return ready;
    } catch {
      return false;
    }
  })();
  
  return _onnxInitPromise;
}

export async function predictInBrowser(features: FeatureVector): Promise<StressResult | null> {
  const ready = await ensureOnnxReady();
  if (!ready) return null;
  
  const { browserInference } = await import("./onnx-inference");
  const result = await browserInference.predictEnsemble(
    Object.values(features).slice(0, 23) as number[]
  );
  
  if (!result) return null;
  
  const score =
    result.probabilities["NEUTRAL"] * 5 +
    result.probabilities["MILD"] * 55 +
    result.probabilities["STRESSED"] * 100;
  
  return {
    score: Math.round(score * 10) / 10,
    level: result.prediction as StressResult["level"],
    confidence: result.confidence,
    probabilities: result.probabilities,
    insights: [],
    timestamp: Date.now(),
    model_score: score,
    equation_score: 0,
    final_score: score,
    feature_contributions: {},
    typing_speed_wpm: features.typing_speed_wpm,
    rage_click_count: features.rage_click_count,
    error_rate: features.error_rate,
    click_count: features.click_count,
    mouse_speed_mean: features.mouse_speed_mean,
    alert_state: "NORMAL",
    intervention: null,
    trend: "steady",
    recovery_score: 0,
  };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mp_token");
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  signup: (email: string, username: string, password: string, displayName?: string) =>
    request<{ user: { id: number; email: string; username: string; display_name: string }; access_token: string; token_type: string }>(
      "/auth/signup",
      { method: "POST", body: JSON.stringify({ email, username, password, display_name: displayName || username }) }
    ),
  login: (emailOrUsername: string, password: string) =>
    request<{ user: { id: number; email: string; username: string; display_name: string }; access_token: string; token_type: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email_or_username: emailOrUsername, password }) }
    ),
  me: () => request<{ id: number; email: string; username: string; display_name: string; created_at: string; last_login: string }>("/auth/me"),

  // Core
  health: () => request<HealthStatus>("/health"),
  inference: (features: FeatureVector, userId: string = "default") =>
    request<StressResult>("/inference", {
      method: "POST",
      body: JSON.stringify({ features, user_id: userId }),
    }),
  inferenceWithFallback: async (features: FeatureVector, userId: string = "default") => {
    // Try browser ONNX inference first (zero server cost, full privacy)
    const browserResult = await predictInBrowser(features);
    if (browserResult) return browserResult;
    // Fallback to server
    return request<StressResult>("/inference", {
      method: "POST",
      body: JSON.stringify({ features, user_id: userId }),
    });
  },
  history: (userId: string = "default", hours: number = 24) =>
    request<HistoryPoint[]>(`/history?user_id=${userId}&hours=${hours}`),
  stats: (userId: string = "default") =>
    request<UserStats>(`/stats?user_id=${userId}`),
  calibration: (userId: string = "default") =>
    request<CalibrationStatus>(`/calibration/${userId}`),
  feedback: (predicted: string, actual: string, userId: string = "default", score: number = 0) =>
    request("/feedback", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        predicted_level: predicted,
        actual_level: actual,
        timestamp: Date.now(),
        score,
      }),
    }),
  reset: (userId: string = "demo_user") =>
    request("/reset", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  modelMetrics: () =>
    request<{
      accuracy: number;
      precision: number;
      recall: number;
      f1: number;
      confusion_matrix: number[][];
      labels: string[];
    }>("/model-metrics"),
  interventionRecommendation: (userId: string = "default") =>
    request<InterventionSnapshot>(`/interventions/recommendation?user_id=${userId}`),
  interventionAction: (
    action: "start_break" | "snooze" | "im_okay" | "need_stronger_help" | "helped" | "not_helped" | "skipped",
    userId: string = "default",
    interventionType?: string,
    notes: string = "",
  ) =>
    request("/interventions/action", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        action,
        intervention_type: interventionType,
        notes,
      }),
    }),
  interventionHistory: (userId: string = "default", hours: number = 168) =>
    request<InterventionEvent[]>(`/interventions/history?user_id=${userId}&hours=${hours}`),
  checkWindDown: (userId: string = "default") =>
    request<{ wind_down: { type: string; title: string; message: string; severity: string; actions: { label: string; action: string }[] } | null }>(
      `/interventions/wind-down?user_id=${userId}`
    ),
  scheduleBreak: (userId: string = "default", breakTime: string, interventionType: string = "breathing_reset") =>
    request<{ status: string; break: { id: string; scheduled_for: string; intervention_type: string; status: string } }>(
      `/interventions/schedule-break?user_id=${userId}&break_time=${encodeURIComponent(breakTime)}&intervention_type=${interventionType}`,
      { method: "POST" }
    ),
  getScheduledBreaks: (userId: string = "default") =>
    request<{ breaks: { id: string; scheduled_for: string; intervention_type: string; status: string; created_at: string }[] }>(
      `/interventions/scheduled-breaks?user_id=${userId}`
    ),
  cancelBreak: (userId: string = "default", breakId: string) =>
    request<{ status: string; message: string }>(
      `/interventions/cancel-break?user_id=${userId}&break_id=${breakId}`,
      { method: "POST" }
    ),
  checkDueBreaks: (userId: string = "default") =>
    request<{ due_break: { type: string; title: string; message: string; break_id: string; intervention_type: string } | null }>(
      `/interventions/check-due-breaks?user_id=${userId}`
    ),
  
  // ─── Chat ───
  createChatSession: (title?: string) =>
    request<{ success: boolean; session: { id: string; title: string; created_at: string } }>(
      `/chat/sessions?title=${encodeURIComponent(title || "New Chat")}`,
      { method: "POST" }
    ),
  getChatSessions: (limit?: number) =>
    request<{ success: boolean; sessions: { id: string; title: string; created_at: string }[] }>(`/chat/sessions?limit=${limit || 20}`),
  getChatMessages: (sessionId: string) =>
    request<{ success: boolean; messages: { id: string; role: string; content: string; agent_type: string; created_at: string }[] }>(`/chat/sessions/${sessionId}/messages`),
  
  // ─── Wellness ───
  saveWellnessCheckin: (energyLevel: string, sleepQuality: string, note?: string) =>
    request<{ success: boolean; checkin: { id: string; check_date: string; energy_level: string; sleep_quality: string; note?: string } }>(
      "/wellness/checkin", { method: "POST", body: JSON.stringify({ energy_level: energyLevel, sleep_quality: sleepQuality, note }) }
    ),
  getWellnessCheckins: (days?: number) =>
    request<{ success: boolean; checkins: { id: string; check_date: string; energy_level: string; sleep_quality: string; note?: string }[] }>(`/wellness/checkins?days=${days || 7}`),
  getTodayCheckin: () =>
    request<{ success: boolean; checkin: { id: string; check_date: string; energy_level: string; sleep_quality: string; note?: string } | null }>("/wellness/today"),
  getWellnessJournal: (limit?: number) =>
    request<{ success: boolean; insights: { id: string; insight_type: string; content: string; generated_at: string }[] }>(`/wellness/journal?limit=${limit || 10}`),
  getWeeklyReflection: () =>
    request<{ success: boolean; reflection: { avg_energy: number | null; avg_sleep: number | null; checkin_count: number; insights: { id: string; insight_type: string; content: string }[] } }>("/wellness/weekly"),
  
  // ─── Focus ───
  getFocusState: () =>
    request<{ success: boolean; state: { flow_score: number; deep_work_minutes: number; context_switches: number; is_in_flow: boolean; suggestion?: string } }>("/focus/state"),
  getDistractionShield: () =>
    request<{ success: boolean; shield: { enabled: boolean; context_switches: number; tab_hopping: number; mouse_agitation: string } }>("/focus/shield"),
  toggleShield: (enabled: boolean) =>
    request<{ success: boolean; enabled: boolean }>("/focus/shield", { method: "POST", body: JSON.stringify({ enabled }) }),
  getEnergyForecast: () =>
    request<{ success: boolean; forecast: { peak_hour: string; peak_energy: number; energy_curve: { hour: number; hour_label: string; energy: number }[]; suggested_schedule: { time: string; activity: string; energy: string }[]; confidence: string } }>("/focus/forecast"),
  
  // ─── Chat Streaming ───
  chatStream: (
    sessionId: string,
    message: string,
    callbacks: {
      onToken?: (token: string) => void;
      onClassification?: (agentType: string) => void;
      onDone?: (fullResponse: string) => void;
      onError?: (error: Error) => void;
      onToolRequest?: (tool: { tool: string; params: any; request_id: string }) => void;
    }
  ) => {
    const token = getToken();
    const url = `${BASE}/chat/stream?session_id=${sessionId}`;
    const abortController = new AbortController();
    
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
      signal: abortController.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        callbacks.onError?.(new Error("Chat stream failed"));
        return;
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                fullResponse += data.content;
                callbacks.onToken?.(data.content);
              } else if (data.type === "classification") {
                callbacks.onClassification?.(data.agent);
              } else if (data.type === "tool_request") {
                callbacks.onToolRequest?.(data);
              } else if (data.type === "done") {
                callbacks.onDone?.(fullResponse);
              } else if (data.type === "error") {
                callbacks.onError?.(new Error(data.message));
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }).catch((err) => {
      if (err.name !== "AbortError") {
        callbacks.onError?.(err);
      }
    });
    
    return () => abortController.abort();
  },
  
  // ─── SSE Inference Stream (Alternative to WebSocket) ───
  inferenceStream: (
    userId: string,
    callbacks: {
      onUpdate?: (data: { score: number; level: string; confidence: number; features: any }) => void;
      onHeartbeat?: () => void;
      onError?: (error: Error) => void;
    },
    durationMinutes?: number
  ) => {
    const token = getToken();
    const url = `${BASE}/inference/stream?user_id=${userId}&duration_minutes=${durationMinutes || 30}`;
    const abortController = new AbortController();
    
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: abortController.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        callbacks.onError?.(new Error("SSE stream failed"));
        return;
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "stress_update") {
                callbacks.onUpdate?.(data);
              } else if (data.type === "heartbeat") {
                callbacks.onHeartbeat?.();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    }).catch((err) => {
      if (err.name !== "AbortError") {
        callbacks.onError?.(err);
      }
    });
    
    return () => abortController.abort();
  },
};

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("mp_token", token);
  }
}

export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("mp_token");
  }
}
