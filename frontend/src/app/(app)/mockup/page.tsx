"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageCircle, Calendar, Moon, Zap, Coffee, Brain, 
  Activity, ChevronRight, X, Minimize2, Send,
  Sun, Battery, BatteryMedium, BatteryLow,
  Bell, Shield, Clock, TrendingUp
} from "lucide-react";

// =============================================
// MINDPULSE COMPLETE UX MOCKUP
// All 4 pillars visualized in one scrollable page
// =============================================

const NAV_ITEMS = [
  { id: "rhythm", label: "Rhythm", icon: Activity },
  { id: "chat", label: "Ask MindPulse", icon: MessageCircle },
  { id: "journal", label: "Journal", icon: Brain },
  { id: "insights", label: "Insights", icon: TrendingUp },
];

export default function MockupPage() {
  const [activeView, setActiveView] = useState("overview");
  const [alertLevel, setAlertLevel] = useState<"none" | "glow" | "card" | "overlay">("none");
  const [chatOpen, setChatOpen] = useState(false);
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [checkinDone, setCheckinDone] = useState(false);
  const [energyScore, setEnergyScore] = useState(72);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#F2EFE9]">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-12 bg-[#0a0a0f]/90 backdrop-blur border-b border-[#1c1c2e] flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#5b4fc4] flex items-center justify-center text-xs font-bold">M</div>
          <span className="text-sm font-medium">MindPulse</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            className="text-xs px-3 py-1 rounded-full bg-[#5b4fc4]/20 text-[#5b4fc4] hover:bg-[#5b4fc4]/30 transition"
            onClick={() => setAlertLevel("glow")}
          >
            Demo: Glow Alert
          </button>
          <button 
            className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition"
            onClick={() => setAlertLevel("card")}
          >
            Demo: Card Alert
          </button>
          <button 
            className="text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
            onClick={() => setAlertLevel("overlay")}
          >
            Demo: Critical Overlay
          </button>
          <button 
            className="text-xs px-3 py-1 rounded-full border border-[#1c1c2e] text-[#857F75] hover:text-[#F2EFE9] transition"
            onClick={() => setAlertLevel("none")}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="pt-12 flex">
        {/* Sidebar */}
        <div className="fixed left-0 top-12 bottom-0 w-16 bg-[#0a0a0f] border-r border-[#1c1c2e] flex flex-col items-center py-6 gap-6">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeView === item.id 
                  ? "bg-[#5b4fc4]/20 text-[#5b4fc4]" 
                  : "text-[#857F75] hover:text-[#F2EFE9] hover:bg-[#1c1c2e]"
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </button>
          ))}
          <div className="flex-1" />
          <button
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#857F75] hover:text-[#F2EFE9] transition"
            onClick={() => setMoodPickerOpen(true)}
            title="Quick Mood"
          >
            <Sun className="w-5 h-5" />
          </button>
        </div>

        {/* Main content */}
        <div className="ml-16 flex-1 p-8">
          <AnimatePresence mode="wait">
            {activeView === "overview" && <OverviewScreen />}
            {activeView === "rhythm" && (
              <RhythmView 
                alertLevel={alertLevel} 
                energyScore={energyScore}
                onMoodPick={() => setMoodPickerOpen(true)}
              />
            )}
            {activeView === "chat" && <ChatView />}
            {activeView === "journal" && (
              <JournalView 
                checkinDone={checkinDone} 
                onCheckin={() => setCheckinDone(true)}
                selectedMood={selectedMood}
              />
            )}
            {activeView === "insights" && <InsightsView />}
          </AnimatePresence>
        </div>
      </div>

      {/* ============ GRADUATED ALERTS ============ */}
      
      {/* Level 1: Ambient glow on gauge */}
      <AnimatePresence>
        {alertLevel === "glow" && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(217,119,6,0.08)_0%,_transparent_50%)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level 2: Slide-in card */}
      <AnimatePresence>
        {alertLevel === "card" && (
          <motion.div
            className="fixed bottom-6 right-6 z-50 w-80"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className="bg-[#141420] border border-amber-500/30 rounded-xl p-4 shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs uppercase tracking-wider text-amber-400">Energy dip</span>
                </div>
                <button onClick={() => setAlertLevel("none")} className="text-[#857F75] hover:text-[#F2EFE9]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-[#F2EFE9] mb-3">
                Your typing rhythm suggests a stretch break might help
              </p>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-[#5b4fc4] text-white text-xs hover:bg-[#6c5dd4] transition">
                  Take a 2-min break
                </button>
                <button 
                  className="px-3 py-1.5 rounded-lg border border-[#1c1c2e] text-[#857F75] text-xs hover:text-[#F2EFE9] transition"
                  onClick={() => setAlertLevel("none")}
                >
                  I&apos;m okay
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level 3: Full overlay */}
      <AnimatePresence>
        {alertLevel === "overlay" && (
          <motion.div
            className="fixed inset-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-sm flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="max-w-md w-full mx-8 bg-[#141420] border border-red-500/30 rounded-2xl p-8"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              {/* Pulsing ring */}
              <div className="flex justify-center mb-6">
                <motion.div
                  className="w-20 h-20 rounded-full border-2 border-red-400/40 flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <BatteryLow className="w-8 h-8 text-red-400" />
                </motion.div>
              </div>

              <h3 className="text-xl font-light text-[#F2EFE9] text-center mb-2">
                Your rhythm needs attention
              </h3>
              <p className="text-sm text-[#857F75] text-center mb-6">
                Multiple signals suggest your energy is very low. A break now could prevent the afternoon slump.
              </p>

              <div className="space-y-3">
                <button className="w-full px-4 py-3 rounded-xl bg-[#5b4fc4] text-white text-sm hover:bg-[#6c5dd4] transition flex items-center justify-between">
                  <span className="flex items-center gap-2"><Coffee className="w-4 h-4" /> Hydrate + walk (5 min)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button className="w-full px-4 py-3 rounded-xl bg-[#1c1c2e] border border-[#2a2a3d] text-[#F2EFE9] text-sm hover:bg-[#2a2a3d] transition flex items-center justify-between">
                  <span className="flex items-center gap-2"><Brain className="w-4 h-4" /> Box breathing (2 min)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button className="w-full px-4 py-3 rounded-xl bg-[#1c1c2e] border border-[#2a2a3d] text-[#857F75] text-sm hover:text-[#F2EFE9] transition flex items-center justify-between">
                  <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Ask MindPulse for help</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex justify-center mt-4">
                <button 
                  className="text-xs text-[#857F75] hover:text-[#F2EFE9] transition underline"
                  onClick={() => setAlertLevel("none")}
                >
                  I&apos;m okay, dismiss for 30 min
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ MOOD PICKER OVERLAY ============ */}
      <AnimatePresence>
        {moodPickerOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-[#0a0a0f]/60 backdrop-blur-sm flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoodPickerOpen(false)}
          >
            <motion.div
              className="bg-[#141420] rounded-2xl p-6 border border-[#1c1c2e]"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-[#857F75] text-center mb-4">How are you feeling right now?</p>
              <div className="flex gap-3">
                {[
                  { emoji: "😤", label: "Frustrated", id: "frustrated" },
                  { emoji: "😰", label: "Anxious", id: "anxious" },
                  { emoji: "😐", label: "Neutral", id: "neutral" },
                  { emoji: "😌", label: "Calm", id: "calm" },
                  { emoji: "😄", label: "Focused", id: "focused" },
                ].map((mood) => (
                  <button
                    key={mood.id}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                      selectedMood === mood.id 
                        ? "bg-[#5b4fc4]/20 border border-[#5b4fc4]/50 scale-110" 
                        : "bg-[#1c1c2e] border border-transparent hover:bg-[#2a2a3d]"
                    }`}
                    onClick={() => {
                      setSelectedMood(mood.id);
                      setTimeout(() => setMoodPickerOpen(false), 500);
                    }}
                  >
                    <span className="text-2xl">{mood.emoji}</span>
                    <span className="text-[10px] text-[#857F75]">{mood.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ CHAT FLOATING BUTTON ============ */}
      <motion.button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#5b4fc4] flex items-center justify-center shadow-lg z-40 hover:bg-[#6c5dd4] transition"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setChatOpen(!chatOpen)}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            className="fixed bottom-24 right-6 w-96 h-[500px] z-40 bg-[#141420] border border-[#1c1c2e] rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <div className="p-4 border-b border-[#1c1c2e] flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Ask MindPulse</h4>
                <p className="text-[10px] text-[#857F75]">Your personal rhythm assistant</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-[#857F75] hover:text-[#F2EFE9]">
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
            
            {/* Intent chips */}
            <div className="p-3 border-b border-[#1c1c2e] flex gap-2 overflow-x-auto">
              {[
                { label: "Focus help", icon: Zap },
                { label: "Break plan", icon: Coffee },
                { label: "Energy check", icon: Battery },
              ].map((intent) => (
                <button
                  key={intent.label}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#5b4fc4]/10 border border-[#5b4fc4]/20 text-xs text-[#5b4fc4] hover:bg-[#5b4fc4]/20 transition"
                >
                  <intent.icon className="w-3 h-3" />
                  {intent.label}
                </button>
              ))}
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-[#5b4fc4] flex items-center justify-center shrink-0">
                  <span className="text-xs">M</span>
                </div>
                <div className="bg-[#1c1c2e] rounded-xl rounded-tl-sm p-3 max-w-[80%]">
                  <p className="text-sm text-[#F2EFE9]">
                    Hey! 👋 I noticed your typing speed dropped about 15% in the last hour. Want me to help you refocus?
                  </p>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <div className="bg-[#5b4fc4]/20 rounded-xl rounded-tr-sm p-3 max-w-[80%]">
                  <p className="text-sm text-[#F2EFE9]">Help me concentrate</p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-[#5b4fc4] flex items-center justify-center shrink-0">
                  <span className="text-xs">M</span>
                </div>
                <div className="bg-[#1c1c2e] rounded-xl rounded-tl-sm p-3 max-w-[80%]">
                  <p className="text-sm text-[#F2EFE9]">
                    Based on your patterns, you focus best in 25-min blocks. I recommend:
                  </p>
                  <div className="mt-2 p-2 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e]">
                    <p className="text-xs text-[#857F75]">🎯 25-min focus sprint</p>
                    <p className="text-xs text-[#857F75]">☕ Then 5-min stretch break</p>
                    <p className="text-xs text-[#5b4fc4] mt-1">This worked 4/5 times for you</p>
                  </div>
                  <button className="mt-2 px-3 py-1.5 rounded-lg bg-[#5b4fc4] text-white text-xs hover:bg-[#6c5dd4] transition">
                    Start focus timer
                  </button>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[#1c1c2e] flex gap-2">
              <input 
                className="flex-1 bg-[#0a0a0f] border border-[#1c1c2e] rounded-lg px-3 py-2 text-sm text-[#F2EFE9] placeholder-[#857F75]/50 outline-none focus:border-[#5b4fc4]/50 transition"
                placeholder="Ask about your rhythm..."
              />
              <button className="w-9 h-9 rounded-lg bg-[#5b4fc4] flex items-center justify-center hover:bg-[#6c5dd4] transition">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ SUB-VIEWS ============

function OverviewScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto"
    >
      <h1 className="text-3xl font-light mb-2">MindPulse Complete UX</h1>
      <p className="text-[#857F75] mb-8">4-pillar design mockup — click sidebar icons to explore each view</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          {
            icon: Activity,
            title: "Pillar 1: Live Rhythm View",
            desc: "Energy gauge (inverted), graduated alerts, soft language, mood picker",
            color: "#5b4fc4"
          },
          {
            icon: MessageCircle,
            title: "Pillar 2: Ask MindPulse Chat",
            desc: "3-intent classifier (Focus, Break, Energy), Ollama local, SSE streaming",
            color: "#6c5dd4"
          },
          {
            icon: Calendar,
            title: "Pillar 3: Smart Integrations",
            desc: "Calendar sync, focus protector, evening wind-down — soft framing only",
            color: "#7b6de4"
          },
          {
            icon: Brain,
            title: "Pillar 4: Wellness Journal",
            desc: "Daily check-in, mood-behavior correlation, weekly reflection, pattern journal",
            color: "#8b7fd4"
          }
        ].map((pillar) => (
          <div
            key={pillar.title}
            className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e] hover:border-[#5b4fc4]/30 transition"
          >
            <pillar.icon className="w-6 h-6 mb-3" style={{ color: pillar.color }} />
            <h3 className="text-base font-medium text-[#F2EFE9] mb-2">{pillar.title}</h3>
            <p className="text-sm text-[#857F75]">{pillar.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <h3 className="text-sm font-medium text-[#F2EFE9] mb-4">Demo: Graduated Alert Escalation</h3>
        <p className="text-xs text-[#857F75] mb-4">
          Use the top-right buttons to trigger each alert level. Watch how the system escalates from ambient to assertive.
        </p>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400/30" />
            <span className="text-[#857F75]">Glow: ambient border</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-[#857F75]">Card: slide-in suggestion</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-[#857F75]">Overlay: full attention</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RhythmView({ alertLevel, energyScore, onMoodPick }: { 
  alertLevel: string; 
  energyScore: number;
  onMoodPick: () => void;
}) {
  const gaugeColor = energyScore > 60 ? "#22c55e" : energyScore > 35 ? "#d97706" : "#dc2626";
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-light">Your Rhythm</h2>
          <p className="text-xs text-[#857F75]">Live behavioral signals</p>
        </div>
        <button 
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1c1c2e] text-xs text-[#857F75] hover:text-[#F2EFE9] transition"
          onClick={onMoodPick}
        >
          <Sun className="w-3 h-3" /> Quick mood check
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Energy gauge */}
        <div className={`lg:col-span-1 p-8 rounded-xl bg-[#141420] border transition-colors ${
          alertLevel === "glow" ? "border-amber-500/30 shadow-[0_0_30px_rgba(217,119,6,0.1)]" : "border-[#1c1c2e]"
        }`}>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-[#857F75] mb-4">Energy Score</p>
            <div className="relative w-40 h-20 mx-auto mb-4">
              <svg viewBox="0 0 160 80" className="w-full">
                <path
                  d="M 10 75 A 70 70 0 0 1 150 75"
                  fill="none"
                  stroke="#1c1c2e"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M 10 75 A 70 70 0 0 1 150 75"
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="220"
                  strokeDashoffset={220 * (1 - energyScore / 100)}
                  style={{ filter: `drop-shadow(0 0 6px ${gaugeColor}40)` }}
                />
              </svg>
              <div className="absolute inset-0 flex items-end justify-center pb-1">
                <span className="text-4xl font-light tabular-nums" style={{ color: gaugeColor }}>
                  {energyScore}
                </span>
              </div>
            </div>
            <p className="text-xs text-[#857F75]">
              {energyScore > 70 ? "Good energy" : energyScore > 40 ? "Dipping slightly" : "Low energy — consider a break"}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: "Typing Speed", value: "62 wpm", icon: Activity, delta: "-8% from avg" },
            { label: "Click Speed", value: "1.2/s", icon: Zap, delta: "+15% from avg" },
            { label: "Context Switches", value: "12/hr", icon: Shield, delta: "Normal" },
            { label: "Focus Time", value: "23 min", icon: Clock, delta: "Best: 10-12 AM" },
          ].map((metric) => (
            <div key={metric.label} className="p-4 rounded-xl bg-[#141420] border border-[#1c1c2e]">
              <div className="flex items-center gap-2 mb-2">
                <metric.icon className="w-3.5 h-3.5 text-[#5b4fc4]" />
                <span className="text-[10px] uppercase tracking-wider text-[#857F75]">{metric.label}</span>
              </div>
              <p className="text-xl font-light tabular-nums">{metric.value}</p>
              <p className="text-[10px] text-[#857F75]/60 mt-1">{metric.delta}</p>
            </div>
          ))}

          {/* Insight card */}
          <div className="col-span-2 p-4 rounded-xl bg-[#5b4fc4]/10 border border-[#5b4fc4]/20">
            <p className="text-xs text-[#5b4fc4] mb-1">💡 Pattern insight</p>
            <p className="text-sm text-[#F2EFE9]">
              Your typing rhythm suggests it&apos;s time for a quick stretch. This usually helps your afternoon focus.
            </p>
          </div>
        </div>
      </div>

      {/* Smart integrations preview */}
      <div className="mt-6 p-4 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <p className="text-[10px] uppercase tracking-wider text-[#857F75] mb-3">Smart Suggestions</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1c1c2e] transition cursor-pointer">
            <Calendar className="w-4 h-4 text-[#5b4fc4]" />
            <span className="text-sm text-[#F2EFE9]">4 hours of meetings today — want buffer windows?</span>
            <ChevronRight className="w-4 h-4 text-[#857F75] ml-auto" />
          </div>
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1c1c2e] transition cursor-pointer">
            <Moon className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-[#F2EFE9]">It&apos;s getting late — your rhythm suggests wrapping up soon</span>
            <ChevronRight className="w-4 h-4 text-[#857F75] ml-auto" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChatView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-light mb-2">Ask MindPulse</h2>
      <p className="text-xs text-[#857F75] mb-8">Your personal rhythm assistant — runs locally, your data stays private</p>

      {/* Intent cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          {
            icon: Zap,
            title: "Focus Assistant",
            desc: "Help me concentrate",
            example: "Your best focus window is 10-12 AM. Start a 25-min sprint?",
            color: "#5b4fc4"
          },
          {
            icon: Coffee,
            title: "Break Planner",
            desc: "Schedule my breaks",
            example: "Based on your pattern, a break at 2:30 PM would prevent the usual energy dip.",
            color: "#22c55e"
          },
          {
            icon: Battery,
            title: "Energy Insights",
            desc: "How's my energy today?",
            example: "Your rhythm suggests a stretch break might help right now.",
            color: "#d97706"
          }
        ].map((intent) => (
          <div
            key={intent.title}
            className="p-4 rounded-xl bg-[#141420] border border-[#1c1c2e] hover:border-[#5b4fc4]/30 transition cursor-pointer"
          >
            <intent.icon className="w-5 h-5 mb-3" style={{ color: intent.color }} />
            <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">{intent.title}</h3>
            <p className="text-xs text-[#857F75] mb-3">{intent.desc}</p>
            <div className="p-2 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e]">
              <p className="text-[10px] text-[#857F75] italic">{intent.example}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <p className="text-xs text-[#857F75] text-center">
          Chat uses Ollama locally — no data leaves your machine. Open the floating chat button (bottom-right) to try it.
        </p>
      </div>
    </motion.div>
  );
}

function JournalView({ checkinDone, onCheckin, selectedMood }: { 
  checkinDone: boolean; 
  onCheckin: () => void;
  selectedMood: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-3xl mx-auto"
    >
      <h2 className="text-2xl font-light mb-2">Your Journal</h2>
      <p className="text-xs text-[#857F75] mb-8">Private reflections and pattern discoveries</p>

      {/* Daily check-in */}
      <div className="mb-8 p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-[#F2EFE9]">Morning Check-in</h3>
            <p className="text-xs text-[#857F75]">2 quick questions to start your day</p>
          </div>
          {checkinDone && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Done
            </span>
          )}
        </div>

        {!checkinDone ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#857F75] mb-2">How&apos;s your energy this morning?</p>
              <div className="flex gap-2">
                {[
                  { icon: BatteryLow, label: "Low", color: "text-red-400" },
                  { icon: BatteryMedium, label: "Medium", color: "text-amber-400" },
                  { icon: Battery, label: "High", color: "text-emerald-400" },
                ].map((option) => (
                  <button
                    key={option.label}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e] hover:border-[#5b4fc4]/30 transition text-sm"
                    onClick={onCheckin}
                  >
                    <option.icon className={`w-4 h-4 ${option.color}`} />
                    <span className="text-[#857F75]">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#857F75] mb-2">How did you sleep?</p>
              <div className="flex gap-2">
                {["Poorly", "Okay", "Well"].map((option) => (
                  <button
                    key={option}
                    className="px-4 py-2 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e] hover:border-[#5b4fc4]/30 transition text-sm text-[#857F75]"
                    onClick={onCheckin}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-emerald-400/80">Check-in complete! I&apos;ll use this to better understand your patterns today.</p>
        )}
      </div>

      {/* Mood-Behavior Correlation */}
      <div className="mb-8 p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">Mood-Behavior Correlation</h3>
        <p className="text-xs text-[#857F75] mb-4">What your behavioral data reveals about your mood patterns</p>
        
        {selectedMood && (
          <div className="mb-4 p-3 rounded-lg bg-[#5b4fc4]/10 border border-[#5b4fc4]/20">
            <p className="text-xs text-[#5b4fc4]">
              🏷️ Last mood tag: <span className="capitalize font-medium">{selectedMood}</span> — this has been recorded and will appear in correlations
            </p>
          </div>
        )}

        <div className="space-y-3">
          {[
            { mood: "😤 Frustrated", pattern: "Click speed +340%, context switches +180%", confidence: "12 samples" },
            { mood: "😰 Anxious", pattern: "Typing speed -25%, pause frequency +200%", confidence: "8 samples" },
            { mood: "😌 Calm", pattern: "Steady rhythm, low error rate, long focus blocks", confidence: "23 samples" },
          ].map((corr) => (
            <div key={corr.mood} className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e]">
              <span className="text-lg">{corr.mood.split(" ")[0]}</span>
              <div className="flex-1">
                <p className="text-sm text-[#F2EFE9]">{corr.mood}</p>
                <p className="text-xs text-[#857F75]">{corr.pattern}</p>
              </div>
              <span className="text-[10px] text-[#857F75]/60">{corr.confidence}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pattern Journal */}
      <div className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">Pattern Journal</h3>
        <p className="text-xs text-[#857F75] mb-4">Discovered patterns from your behavioral data</p>
        
        <div className="space-y-3">
          {[
            { pattern: "You tend to be most focused 10-12 AM", action: "Protect those hours?", icon: Clock },
            { pattern: "Energy dips every Wed at 2:30 PM", action: "Pre-schedule a break?", icon: Calendar },
            { pattern: "12 breaks this week — 15% more than last week", action: "Is this helping?", icon: TrendingUp },
          ].map((entry, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e]">
              <entry.icon className="w-4 h-4 text-[#5b4fc4]" />
              <div className="flex-1">
                <p className="text-sm text-[#F2EFE9]">{entry.pattern}</p>
              </div>
              <button className="text-xs text-[#5b4fc4] hover:text-[#6c5dd4] transition">
                {entry.action}
              </button>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function InsightsView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-3xl mx-auto"
    >
      <h2 className="text-2xl font-light mb-2">Insights</h2>
      <p className="text-xs text-[#857F75] mb-8">What MindPulse has learned about you</p>

      {/* Weekly reflection */}
      <div className="mb-8 p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">This Week&apos;s Reflection</h3>
        <p className="text-xs text-[#857F75] mb-4">Private, never shared</p>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: "Avg Energy", value: "68", unit: "/100" },
            { label: "Breaks Taken", value: "12", unit: "this week" },
            { label: "Focus Streak", value: "3", unit: "days" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-light tabular-nums">{stat.value}<span className="text-sm text-[#857F75]">{stat.unit}</span></div>
              <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-[#5b4fc4]/10 border border-[#5b4fc4]/20">
          <p className="text-xs text-[#5b4fc4]">
            📊 Your energy was 15% higher this week compared to last week. The extra breaks seem to be helping!
          </p>
        </div>
      </div>

      {/* Personalization status */}
      <div className="mb-8 p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">Personalization</h3>
        <p className="text-xs text-[#857F75] mb-4">How well MindPulse knows your rhythm</p>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#857F75]">Threshold accuracy</span>
              <span className="text-[#F2EFE9]">78%</span>
            </div>
            <div className="h-2 rounded-full bg-[#1c1c2e] overflow-hidden">
              <div className="h-full bg-[#5b4fc4] rounded-full" style={{ width: "78%" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#857F75]">Score calibration</span>
              <span className="text-[#F2EFE9]">62%</span>
            </div>
            <div className="h-2 rounded-full bg-[#1c1c2e] overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: "62%" }} />
            </div>
          </div>
          <p className="text-xs text-[#857F75]/60">
            Based on 12 feedback corrections — keep correcting to improve accuracy
          </p>
        </div>
      </div>

      {/* Predictive timing */}
      <div className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]">
        <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">Predictive Timing</h3>
        <p className="text-xs text-[#857F75] mb-4">Upcoming patterns based on your history</p>
        
        <div className="space-y-3">
          {[
            { time: "2:30 PM today", prediction: "Energy usually dips — consider a walk beforehand", confidence: 85 },
            { time: "Wednesday", prediction: "Your highest-switch day — protect focus time", confidence: 72 },
            { time: "Friday 4 PM", prediction: "You typically start winding down — lean into it", confidence: 65 },
          ].map((pred) => (
            <div key={pred.time} className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e]">
              <div className="w-10 text-right">
                <span className="text-xs text-[#5b4fc4]">{pred.time}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#F2EFE9]">{pred.prediction}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 rounded-full bg-[#1c1c2e] flex-1 overflow-hidden">
                    <div className="h-full bg-[#5b4fc4] rounded-full" style={{ width: `${pred.confidence}%` }} />
                  </div>
                  <span className="text-[10px] text-[#857F75]/60">{pred.confidence}% confidence</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
