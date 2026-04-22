/**
 * MindPulse — WebLLM Browser LLM Integration
 * ==============================================
 * Runs LLM entirely in browser for chat responses.
 * No API key needed, fully private.
 * 
 * Models supported:
 * - Phi-3-mini-4k-instruct (1.3GB, fastest)
 * - Llama-3.2-3B-Instruct (2GB, better quality)
 * - Qwen2.5-1.5B-Instruct (1GB, smallest)
 * 
 * Features:
 * - Zero server cost for chat
 * - Full privacy (no data leaves device)
 * - Works offline after model download
 * - Graceful fallback to server API
 * 
 * Usage:
 *   import { webLLMClient } from '@/lib/webllm-client';
 *   
 *   // Initialize (downloads model ~1-2GB first time)
 *   await webLLMClient.init();
 *   
 *   // Chat with streaming
 *   await webLLMClient.chatStream(
 *     "How's my energy today?",
 *     (token) => console.log(token),
 *     systemPrompt
 *   );
 */

import * as webllm from "@mlc-ai/web-llm";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

class WebLLMClient {
  private engine: webllm.MLCEngineInterface | null = null;
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;

  // Model selection: balance quality vs size
  // Phi-3 is fastest, Llama-3.2 is best quality
  private readonly DEFAULT_MODEL = "Phi-3.5-mini-instruct-q4f16_1-MLC";

  /**
   * Initialize WebLLM engine.
   * Downloads model on first run (~1-2GB), then caches in browser.
   */
  async init(model?: string): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log(`[WebLLM] Initializing ${model || this.DEFAULT_MODEL}...`);
        
        this.engine = await webllm.CreateMLCEngine(model || this.DEFAULT_MODEL, {
          initProgressCallback: (report) => {
            console.log(`[WebLLM] Loading: ${report.text}`);
          },
        });

        this.initialized = true;
        console.log("[WebLLM] Engine ready");
        return true;
      } catch (e) {
        console.error("[WebLLM] Initialization failed:", e);
        return false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Generate chat response with streaming tokens.
   */
  async chatStream(
    message: string,
    onToken: (token: string) => void,
    systemPrompt?: string,
    history: ChatMessage[] = [],
  ): Promise<string> {
    if (!this.engine || !this.initialized) {
      throw new Error("WebLLM not initialized. Call init() first.");
    }

    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // Add recent history (last 10 messages for context)
    messages.push(...history.slice(-10));
    messages.push({ role: "user", content: message });

    let fullResponse = "";

    const chunks = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
      stream_options: {
        include_usage: false,
      },
    });

    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        onToken(delta);
      }
    }

    return fullResponse;
  }

  /**
   * Generate non-streaming response (faster for short answers).
   */
  async chat(
    message: string,
    systemPrompt?: string,
    history: ChatMessage[] = [],
  ): Promise<string> {
    if (!this.engine || !this.initialized) {
      throw new Error("WebLLM not initialized. Call init() first.");
    }

    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push(...history.slice(-10));
    messages.push({ role: "user", content: message });

    const response = await this.engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 512,
    });

    return response.choices[0]?.message?.content || "";
  }

  /**
   * Check if WebLLM is ready.
   */
  get isReady(): boolean {
    return this.initialized && this.engine !== null;
  }

  /**
   * Reset conversation history.
   */
  reset() {
    if (this.engine) {
      this.engine.resetChat();
    }
  }

  /**
   * Get model info.
   */
  get modelInfo() {
    if (!this.engine) return null;
    try {
      return (this.engine as any).runtimeStatsText?.() || null;
    } catch {
      return null;
    }
  }
}

// ─── System Prompts for MindPulse Agents ───

export const MINDPULSE_SYSTEM_PROMPTS = {
  focus: `You are MindPulse's Focus Assistant. You help users concentrate better using their typing rhythm data (not content). You never see what they type, only how they type it. Be concise, empathetic, and practical. Suggest focus techniques, optimal work windows, and gentle nudges.`,
  break: `You are MindPulse's Break Planner. You analyze typing patterns to recommend optimal break times. Suggest 2-5 minute activities like stretches, breathing exercises, or looking away from screen. Be warm and non-intrusive.`,
  energy: `You are MindPulse's Energy Insights agent. You help users understand their daily energy patterns based on typing rhythm. Provide insights about peak hours, energy dips, and sustainable work habits. Be encouraging but honest.`,
  general: `You are MindPulse, a privacy-first behavioral stress detection companion. You read typing rhythm (not content) to detect stress patterns. You help with focus, breaks, and energy insights. Always emphasize privacy: you never see what users type.`,
};

// ─── Singleton Export ───

export const webLLMClient = new WebLLMClient();
