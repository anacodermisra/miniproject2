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

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mp_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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
  history: (hours: number = 24) =>
    request<HistoryPoint[]>(`/history?hours=${hours}`),
  stats: () =>
    request<UserStats>(`/stats`),
  calibration: () =>
    request<CalibrationStatus>("/calibration"),
  feedback: (predicted: string, actual: string, score: number = 0) =>
    request("/feedback", {
      method: "POST",
      body: JSON.stringify({
        predicted_level: predicted,
        actual_level: actual,
        timestamp: Date.now(),
        score,
      }),
    }),
  reset: () =>
    request("/reset", {
      method: "POST",
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
  interventionRecommendation: () =>
    request<InterventionSnapshot>(`/interventions/recommendation`),
  interventionAction: (
    action: "start_break" | "snooze" | "im_okay" | "need_stronger_help" | "helped" | "not_helped" | "skipped",
    interventionType?: string,
    notes: string = "",
  ) =>
    request("/interventions/action", {
      method: "POST",
      body: JSON.stringify({
        action,
        intervention_type: interventionType,
        notes,
      }),
    }),
  interventionHistory: (hours: number = 168) =>
    request<InterventionEvent[]>(`/interventions/history?hours=${hours}`),
  checkWindDown: () =>
    request<{ wind_down: { type: string; title: string; message: string; severity: string; actions: { label: string; action: string }[] } | null }>(
      `/interventions/wind-down`
    ),
  scheduleBreak: (breakTime: string, interventionType: string = "breathing_reset") =>
    request<{ status: string; break: { id: string; scheduled_for: string; intervention_type: string; status: string } }>(
      `/interventions/schedule-break?break_time=${encodeURIComponent(breakTime)}&intervention_type=${interventionType}`,
      { method: "POST" }
    ),
  getScheduledBreaks: () =>
    request<{ breaks: { id: string; scheduled_for: string; intervention_type: string; status: string; created_at: string }[] }>(
      `/interventions/scheduled-breaks`
    ),
  cancelBreak: (breakId: string) =>
    request<{ status: string; message: string }>(
      `/interventions/cancel-break?break_id=${breakId}`,
      { method: "POST" }
    ),
  checkDueBreaks: () =>
    request<{ due_break: { type: string; title: string; message: string; break_id: string; intervention_type: string } | null }>(
      `/interventions/check-due-breaks`
    ),
  // Wellness
  saveWellnessCheckin: (energy: string, sleep: string, note?: string) =>
    request("/wellness/checkin", {
      method: "POST",
      body: JSON.stringify({ energy, sleep, note }),
    }),
  getWellnessHistory: (limit: number = 30) =>
    request<{ timestamp: number; energy: string; sleep: string; note: string }[]>(
      `/wellness/history?limit=${limit}`
    ),
  saveJournalEntry: (content: string, entryType: string = "insight") =>
    request("/journal/entry", {
      method: "POST",
      body: JSON.stringify({ content, entry_type: entryType }),
    }),
  getJournalEntries: (limit: number = 50) =>
    request<{ id: string; timestamp: number; content: string; entry_type: string }[]>(
      `/journal/entries?limit=${limit}`
    ),

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
