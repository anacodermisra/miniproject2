"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Zap, Coffee, Brain, Bot, Loader2, Smile } from "lucide-react";

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];

type AgentType = "focus" | "break" | "energy" | "general";
type MessageRole = "user" | "assistant";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  agent?: AgentType;
  timestamp: Date;
}

const AGENT_CONFIG: Record<AgentType, { name: string; icon: typeof Bot; color: string; desc: string; suggestions: string[] }> = {
  focus: {
    name: "Focus Assistant",
    icon: Zap,
    color: "#22c55e",
    desc: "Helps you concentrate with personalized recommendations",
    suggestions: ["Help me concentrate", "What's my best focus time?", "Enable focus mode"],
  },
  break: {
    name: "Break Planner",
    icon: Coffee,
    color: "#d97706",
    desc: "Smart break reminders based on your patterns",
    suggestions: ["Schedule my breaks", "When should I rest?", "2-min stretch idea"],
  },
  energy: {
    name: "Energy Insights",
    icon: Brain,
    color: "#5b4fc4",
    desc: "Understand your rhythm and energy levels",
    suggestions: ["How's my energy today?", "Show my weekly pattern", "Am I burning out?"],
  },
  general: {
    name: "MindPulse",
    icon: Sparkles,
    color: "#8b7fd4",
    desc: "Your rhythm companion",
    suggestions: ["What can you do?", "How does this work?", "Tell me about my data"],
  },
};

const MOCK_RESPONSES: Record<AgentType, string[]> = {
  focus: [
    "Your typing rhythm shows you're most focused between 10 AM - 12 PM. Want me to suggest some focus music for that window?",
    "I notice you've been in deep work for 45 minutes. Your rhythm is steady — this is a great flow state. I'll keep nudges quiet for now.",
    "Based on your patterns, lo-fi beats at 60 BPM match your natural typing cadence. Want me to queue something similar?",
  ],
  break: [
    "Your typing rhythm has been dipping for the last 15 minutes. A 2-minute stretch might help reset your energy. Want a gentle reminder in 5 min?",
    "You typically take breaks every 50 minutes. You're at 42 minutes now — your rhythm is suggesting a stretch soon.",
    "Here's a quick one: roll your shoulders back 5 times, look at something 20 feet away for 20 seconds. Your eyes and neck will thank you.",
  ],
  energy: [
    "Your typing rhythm today is steady — 72 energy score. That's 8% higher than your weekly average. You're in a good groove.",
    "Looking at your pattern this week: your energy peaks around 2 PM and dips after 6 PM. Consider scheduling important work in that afternoon window.",
    "Your rhythm suggests you're doing well today. Consistent typing speed, low error rate, and regular pauses. Keep this energy!",
  ],
  general: [
    "I can help with focus, breaks, and energy insights. Just ask naturally — I'll figure out what you need.",
    "MindPulse reads your typing rhythm, not your content. I never see what you type — just how you type it. Your data stays on your machine.",
    "Think of me as a rhythm coach. I notice patterns in how you work and gently suggest ways to stay balanced.",
  ],
};

function detectAgent(message: string): AgentType {
  const lower = message.toLowerCase();
  if (lower.includes("focus") || lower.includes("concentrat") || lower.includes("distract") || lower.includes("flow")) return "focus";
  if (lower.includes("break") || lower.includes("rest") || lower.includes("stretch") || lower.includes("schedule")) return "break";
  if (lower.includes("energy") || lower.includes("burnout") || lower.includes("pattern") || lower.includes("rhythm") || lower.includes("tired")) return "energy";
  return "general";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentType>("general");
  const [isReady, setIsReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (e?: FormEvent, text?: string) => {
    if (e) e.preventDefault();
    const msg = text || input.trim();
    if (!msg || isTyping) return;

    const agent = detectAgent(msg);
    setActiveAgent(agent);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Simulate agent thinking
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    const responses = MOCK_RESPONSES[agent];
    const response = responses[Math.floor(Math.random() * responses.length)];

    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response,
      agent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const agentConfig = AGENT_CONFIG[activeAgent];
  const AgentIcon = agentConfig.icon;

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0f] min-h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1c1c2e] bg-[#0a0a0f]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${agentConfig.color}15` }}>
            <AgentIcon className="w-4 h-4" style={{ color: agentConfig.color }} />
          </div>
          <div>
            <div className="text-sm font-medium text-[#F2EFE9]">{agentConfig.name}</div>
            <div className="text-[10px] text-[#857F75]">{agentConfig.desc}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${agentConfig.color}10` }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: agentConfig.color }} />
            <span className="text-[10px] font-medium" style={{ color: agentConfig.color }}>
              {activeAgent === "general" ? "Ready" : `${agentConfig.name} active`}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div
              className="max-w-2xl mx-auto text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={isReady ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: EASE_OUT }}
            >
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5b4fc4]/10 mb-6">
                  <Sparkles className="w-7 h-7 text-[#5b4fc4]" />
                </div>
                <h2 className="text-2xl font-light text-[#F2EFE9] mb-2">Ask MindPulse</h2>
                <p className="text-sm text-[#857F75] max-w-md mx-auto">
                  I read your typing rhythm — not your content. Ask me anything about your focus, breaks, or energy patterns.
                </p>
              </div>

              {/* Agent Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                {(["focus", "break", "energy"] as AgentType[]).map((agentKey) => {
                  const config = AGENT_CONFIG[agentKey];
                  const Icon = config.icon;
                  return (
                    <motion.button
                      key={agentKey}
                      className="p-4 rounded-xl bg-[#141420] border border-[#1c1c2e] hover:border-opacity-40 transition-all text-left group"
                      style={{ borderColor: `${config.color}20` }}
                      whileHover={{ y: -2, borderColor: `${config.color}40` }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSend(undefined, config.suggestions[0])}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${config.color}15` }}>
                        <Icon className="w-4 h-4" style={{ color: config.color }} />
                      </div>
                      <div className="text-xs font-medium text-[#F2EFE9] mb-1">{config.name}</div>
                      <div className="text-[10px] text-[#857F75] mb-3">{config.desc}</div>
                      <div className="text-[10px] opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: config.color }}>
                        &ldquo;{config.suggestions[0]}&rdquo;
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Quick Suggestions */}
              <div className="flex flex-wrap justify-center gap-2">
                {["How's my energy today?", "Help me concentrate", "Schedule my breaks", "What can you do?"].map((s) => (
                  <motion.button
                    key={s}
                    className="px-3 py-1.5 rounded-full bg-[#141420] border border-[#1c1c2e] text-[11px] text-[#857F75] hover:text-[#F2EFE9] hover:border-[#5b4fc4]/30 transition-all"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSend(undefined, s)}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.map((msg) => {
                if (msg.role === "user") {
                  return (
                    <motion.div
                      key={msg.id}
                      className="flex justify-end"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-md bg-[#5b4fc4]/20 text-[#F2EFE9] text-sm">
                        {msg.content}
                      </div>
                    </motion.div>
                  );
                }

                const msgAgent = msg.agent || "general";
                const msgConfig = AGENT_CONFIG[msgAgent];
                const MsgIcon = msgConfig.icon;

                return (
                  <motion.div
                    key={msg.id}
                    className="flex gap-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: `${msgConfig.color}15` }}>
                      <MsgIcon className="w-3.5 h-3.5" style={{ color: msgConfig.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-medium" style={{ color: msgConfig.color }}>
                          {msgConfig.name}
                        </span>
                        <span className="text-[10px] text-[#857F75]/40">
                          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-sm text-[#F2EFE9]/90 leading-relaxed">{msg.content}</div>
                      {/* Follow-up suggestions */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {msgConfig.suggestions.slice(0, 2).map((s) => (
                          <button
                            key={s}
                            className="px-2.5 py-1 rounded-full bg-[#141420] border border-[#1c1c2e] text-[10px] text-[#857F75] hover:text-[#F2EFE9] hover:border-[#5b4fc4]/30 transition-all"
                            onClick={() => handleSend(undefined, s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <motion.div className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: `${agentConfig.color}15` }}>
                    <AgentIcon className="w-3.5 h-3.5" style={{ color: agentConfig.color }} />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#141420] border border-[#1c1c2e]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#857F75]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#857F75]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#857F75]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-[#1c1c2e] bg-[#0a0a0f]/80 backdrop-blur-sm">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 p-2 rounded-xl bg-[#141420] border border-[#1c1c2e] focus-within:border-[#5b4fc4]/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your rhythm..."
              rows={1}
              className="flex-1 bg-transparent text-[#F2EFE9] text-sm px-3 py-2 resize-none focus:outline-none placeholder:text-[#857F75]/40 max-h-[120px]"
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: input.trim() && !isTyping ? "#5b4fc4" : "#1c1c2e" }}
              whileHover={input.trim() && !isTyping ? { scale: 1.05 } : {}}
              whileTap={input.trim() && !isTyping ? { scale: 0.95 } : {}}
            >
              {isTyping ? <Loader2 className="w-4 h-4 text-[#857F75] animate-spin" /> : <Send className="w-4 h-4 text-[#F2EFE9]" />}
            </motion.button>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-[#857F75]/30">
            <Smile className="w-3 h-3" />
            Your data stays on your machine. No content is read.
          </div>
        </form>
      </div>
    </div>
  );
}
