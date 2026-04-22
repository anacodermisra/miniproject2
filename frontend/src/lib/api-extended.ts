import { request, BASE, getToken } from "./api";
import type { ChatSession, ChatMessage, WellnessCheckin, WellnessInsight, FocusState, EnergyForecast } from "./types";

// ─── Chat API ───

export async function createChatSession(title?: string): Promise<{ success: boolean; session: ChatSession }> {
  return request(`/chat/sessions?title=${encodeURIComponent(title || "New Chat")}`, {
    method: "POST",
  });
}

export async function getChatSessions(limit?: number): Promise<{ success: boolean; sessions: ChatSession[] }> {
  return request(`/chat/sessions?limit=${limit || 20}`);
}

export async function getChatMessages(sessionId: string): Promise<{ success: boolean; messages: ChatMessage[] }> {
  return request(`/chat/sessions/${sessionId}/messages`);
}

export function chatStream(
  message: string,
  sessionId?: string,
  callbacks: {
    onClassification?: (agent: string, confidence: number) => void;
    onToken?: (token: string) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  } = {}
): () => void {
  const token = getToken();
  
  const params = new URLSearchParams();
  if (sessionId) {
    params.append("session_id", sessionId);
  }
  
  const url = `${BASE}/chat/stream?${params.toString()}`;
  const abortController = new AbortController();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const readerPromise = fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
    signal: abortController.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      callbacks.onError?.(new Error("Stream failed"));
      return;
    }
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    try {
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
              
              if (data.type === "classification") {
                callbacks.onClassification?.(data.agent, data.confidence);
              } else if (data.type === "token") {
                callbacks.onToken?.(data.content);
              } else if (data.type === "done") {
                callbacks.onDone?.();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        callbacks.onError?.(err as Error);
      }
    }
  });
  
  return () => {
    abortController.abort();
  };
}

// ─── Wellness API ───

export async function saveWellnessCheckin(
  energyLevel: "low" | "medium" | "high",
  sleepQuality: "poor" | "fair" | "good" | "great",
  note?: string
): Promise<{ success: boolean; checkin: WellnessCheckin }> {
  return request("/wellness/checkin", {
    method: "POST",
    body: JSON.stringify({ energy_level: energyLevel, sleep_quality: sleepQuality, note }),
  });
}

export async function getWellnessCheckins(days?: number): Promise<{ success: boolean; checkins: WellnessCheckin[] }> {
  return request(`/wellness/checkins?days=${days || 7}`);
}

export async function getTodayCheckin(): Promise<{ success: boolean; checkin: WellnessCheckin | null }> {
  return request("/wellness/today");
}

export async function getWellnessJournal(limit?: number): Promise<{ success: boolean; insights: WellnessInsight[] }> {
  return request(`/wellness/journal?limit=${limit || 10}`);
}

export async function getWeeklyReflection(): Promise<{ 
  success: boolean; 
  reflection: {
    avg_energy: number | null;
    avg_sleep: number | null;
    checkin_count: number;
    insights: WellnessInsight[];
  }
}> {
  return request("/wellness/weekly");
}

// ─── Focus API ───

export async function getFocusState(): Promise<{ success: boolean; state: FocusState }> {
  return request("/focus/state");
}

export async function getDistractionShield(): Promise<{ success: boolean; shield: { enabled: boolean; context_switches: number; tab_hopping: number; mouse_agitation: string } }> {
  return request("/focus/shield");
}

export async function toggleShield(enabled: boolean): Promise<{ success: boolean; enabled: boolean }> {
  return request("/focus/shield", {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export async function getEnergyForecast(): Promise<{ success: boolean; forecast: EnergyForecast }> {
  return request("/focus/forecast");
}
