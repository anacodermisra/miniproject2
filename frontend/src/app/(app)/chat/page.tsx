"use client";

import { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Zap, Coffee, Brain, Bot, Loader2, Smile, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { ChatSession, ChatMessage } from "@/lib/types";

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];

type AgentType = "focus" | "break" | "energy" | "general";
type MessageRole = "user" | "assistant";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  agent?: AgentType;
  timestamp: Date;
  isStreaming?: boolean;
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

function detectAgent(message: string): AgentType {
  const lower = message.toLowerCase();
  if (lower.includes("focus") || lower.includes("concentrat") || lower.includes("distract") || lower.includes("flow")) return "focus";
  if (lower.includes("break") || lower.includes("rest") || lower.includes("stretch") || lower.includes("schedule")) return "break";
  if (lower.includes("energy") || lower.includes("burnout") || lower.includes("pattern") || lower.includes("rhythm") || lower.includes("tired")) return "energy";
  return "general";
}

function toAgentType(agentType: string): AgentType {
  if (["focus", "break", "energy", "general"].includes(agentType)) {
    return agentType as AgentType;
  }
  return "general";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentType>("general");
  const [isReady, setIsReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortStreamRef = useRef<(() => void) | null>(null);
  const streamContentRef = useRef("");

  // Load sessions on mount
  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 200);
    loadSessions();
    return () => {
      clearTimeout(t);
      if (abortStreamRef.current) {
        abortStreamRef.current();
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
        const res = await api.getChatSessions(20);
        if (res.success) {
          const mappedSessions: ChatSession[] = res.sessions.map((s) => ({
            id: s.id,
            user_id: "",
            title: s.title,
            is_active: true,
            created_at: s.created_at,
            updated_at: s.created_at,
          }));
          setSessions(mappedSessions);
          // If there are sessions, load the most recent one
          if (mappedSessions.length > 0) {
            await loadSession(mappedSessions[0].id);
          }
        }
    } catch (err) {
      setError("Failed to load chat sessions");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSession = async (sid: string) => {
    try {
      setSessionId(sid);
      setMessages([]);
      setIsLoading(true);
      
      const res = await api.getChatMessages(sid);
      if (res.success) {
        const loadedMessages: Message[] = res.messages.map((m) => ({
          id: m.id,
          role: m.role as MessageRole,
          content: m.content,
          agent: m.agent_type ? toAgentType(m.agent_type) : undefined,
          timestamp: new Date(m.created_at),
        }));
        setMessages(loadedMessages);
        
        // Set active agent based on last message
        const lastMsg = loadedMessages[loadedMessages.length - 1];
        if (lastMsg?.agent) {
          setActiveAgent(lastMsg.agent);
        }
      }
    } catch (err) {
      setError("Failed to load messages");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      setIsLoading(true);
      const res = await api.createChatSession("New Chat");
      if (res.success) {
        setSessionId(res.session.id);
        setMessages([]);
          setSessions((prev) => [{
            id: res.session.id,
            user_id: "",
            title: res.session.title,
            is_active: true,
            created_at: res.session.created_at,
            updated_at: res.session.created_at,
          }, ...prev]);
        setActiveAgent("general");
      }
    } catch (err) {
      setError("Failed to create session");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e?: FormEvent, text?: string) => {
    if (e) e.preventDefault();
    const msg = text || input.trim();
    if (!msg || isTyping) return;

    // Create session if none exists
    let sid = sessionId;
    if (!sid) {
      try {
        const res = await api.createChatSession("New Chat");
        if (res.success) {
          sid = res.session.id;
          setSessionId(sid);
          setSessions((prev) => [{
            id: res.session.id,
            user_id: "",
            title: res.session.title,
            is_active: true,
            created_at: res.session.created_at,
            updated_at: res.session.created_at,
          }, ...prev]);
        }
      } catch (err) {
        setError("Failed to create session");
        console.error(err);
        return;
      }
    }

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
    streamContentRef.current = "";

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Add streaming placeholder
    const streamingMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      agent,
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMsg]);

    // Start streaming
    abortStreamRef.current = api.chatStream(
      sid!,
      msg,
      {
        onToken: (token) => {
          streamContentRef.current += token;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              return [...prev.slice(0, -1), { ...last, content: streamContentRef.current }];
            }
            return prev;
          });
        },
        onClassification: (agentType) => {
          setActiveAgent(toAgentType(agentType));
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              return [...prev.slice(0, -1), { ...last, agent: toAgentType(agentType) }];
            }
            return prev;
          });
        },
        onDone: () => {
          setIsTyping(false);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            }
            return prev;
          });
        },
        onError: (err) => {
          setIsTyping(false);
          setError(err.message);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              return [...prev.slice(0, -1), { ...last, content: "Sorry, I couldn't process that request. Please try again.", isStreaming: false }];
            }
            return prev;
          });
        },
      }
    ) || null;
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
          <div className="ml-auto flex items-center gap-2">
            <motion.button
              onClick={createNewSession}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141420] border border-[#1c1c2e] text-[#857F75] hover:text-[#F2EFE9] text-xs transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-3.5 h-3.5" />
              New chat
            </motion.button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${agentConfig.color}10` }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: agentConfig.color }} />
              <span className="text-[10px] font-medium" style={{ color: agentConfig.color }}>
                {activeAgent === "general" ? "Ready" : `${agentConfig.name} active`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400"
        >
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">Dismiss</button>
        </motion.div>
      )}

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
                      <div className="text-sm text-[#F2EFE9]/90 leading-relaxed whitespace-pre-wrap">
                        {msg.content || (msg.isStreaming ? <span className="inline-flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#857F75]/40 animate-bounce" /><span className="w-1.5 h-1.5 rounded-full bg-[#857F75]/40 animate-bounce" style={{ animationDelay: "150ms" }} /><span className="w-1.5 h-1.5 rounded-full bg-[#857F75]/40 animate-bounce" style={{ animationDelay: "300ms" }} /></span> : null)}
                      </div>
                      {/* Follow-up suggestions */}
                      {!msg.isStreaming && (
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
                      )}
                    </div>
                  </motion.div>
                );
              })}

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
              disabled={isLoading || isTyping}
              className="flex-1 bg-transparent text-[#F2EFE9] text-sm px-3 py-2 resize-none focus:outline-none placeholder:text-[#857F75]/40 max-h-[120px] disabled:opacity-50"
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isTyping || isLoading}
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: input.trim() && !isTyping && !isLoading ? "#5b4fc4" : "#1c1c2e" }}
              whileHover={input.trim() && !isTyping && !isLoading ? { scale: 1.05 } : {}}
              whileTap={input.trim() && !isTyping && !isLoading ? { scale: 0.95 } : {}}
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
