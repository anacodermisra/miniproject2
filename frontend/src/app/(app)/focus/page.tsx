"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Focus, Shield, Zap, Clock, Bell, BellOff, Target, Activity, TrendingUp, Waves, Eye, EyeOff, Brain } from "lucide-react";

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function FocusFlowPage() {
  const [isReady, setIsReady] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeSection, setActiveSection] = useState<"flow" | "shield" | "forecast">("flow");

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  const sections = [
    { key: "flow" as const, label: "Flow State", icon: Target },
    { key: "shield" as const, label: "Distraction Shield", icon: Shield },
    { key: "forecast" as const, label: "Energy Forecast", icon: TrendingUp },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0f] min-h-screen overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#1c1c2e]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Focus className="w-5 h-5 text-[#5b4fc4]" />
            <h1 className="text-xl font-light text-[#F2EFE9]">Focus & Flow</h1>
          </div>
          <motion.button
            onClick={() => setFocusMode(!focusMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              focusMode ? "bg-[#5b4fc4] text-[#F2EFE9]" : "bg-[#141420] border border-[#1c1c2e] text-[#857F75]"
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {focusMode ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            {focusMode ? "Focus Mode On" : "Enable Focus Mode"}
          </motion.button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="px-8 py-4 border-b border-[#1c1c2e]">
        <div className="flex gap-1">
          {sections.map((s) => {
            const Icon = s.icon;
            const active = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  active ? "bg-[#5b4fc4]/15 text-[#5b4fc4] font-medium" : "text-[#857F75] hover:bg-[#141420] hover:text-[#F2EFE9]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          {activeSection === "flow" && (
            <motion.div
              key="flow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="space-y-6"
            >
              {/* Current Flow State */}
              <motion.div
                className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]"
                initial={{ opacity: 0, y: 10 }}
                animate={isReady ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#22c55e]/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-[#22c55e]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#F2EFE9]">Current Flow State</h3>
                      <p className="text-[10px] text-[#857F75]">Based on your typing rhythm</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-light text-[#22c55e]">72<span className="text-sm text-[#857F75]/40">%</span></div>
                    <div className="text-[10px] text-[#857F75]/60">Flow score</div>
                  </div>
                </div>

                {/* Flow meter visualization */}
                <div className="relative h-3 rounded-full bg-[#0a0a0f] overflow-hidden mb-4">
                  <motion.div
                    className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#5b4fc4]"
                    initial={{ width: "0%" }}
                    animate={isReady ? { width: "72%" } : {}}
                    transition={{ delay: 0.5, duration: 1.2, ease: EASE_OUT }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#857F75]/40">
                  <span>Distracted</span>
                  <span>In the zone</span>
                </div>
              </motion.div>

              {/* Flow Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Deep Work", value: "90 min", icon: Brain, color: "#5b4fc4", sub: "Current session" },
                  { label: "Focus Sessions", value: "8", icon: Target, color: "#22c55e", sub: "This week" },
                  { label: "Avg Duration", value: "42 min", icon: Clock, color: "#d97706", sub: "Per session" },
                  { label: "Best Time", value: "10 AM", icon: Activity, color: "#8b7fd4", sub: "Peak focus" },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div
                      key={stat.label}
                      className="p-4 rounded-xl bg-[#141420] border border-[#1c1c2e]"
                      initial={{ opacity: 0, y: 10 }}
                      animate={isReady ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.15 + i * 0.08 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="w-4 h-4" style={{ color: stat.color }} />
                        <span className="text-[10px] uppercase tracking-wider text-[#857F75]/60">{stat.label}</span>
                      </div>
                      <div className="text-xl font-light text-[#F2EFE9]">{stat.value}</div>
                      <div className="text-[10px] text-[#857F75]/40 mt-1">{stat.sub}</div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Flow State Insight */}
              <motion.div
                className="p-6 rounded-xl bg-[#5b4fc4]/5 border border-[#5b4fc4]/20"
                initial={{ opacity: 0, y: 10 }}
                animate={isReady ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#5b4fc4]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Waves className="w-4 h-4 text-[#5b4fc4]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[#F2EFE9] mb-1">Flow state detected</h4>
                    <p className="text-sm text-[#F2EFE9]/70 leading-relaxed">
                      You&apos;ve been in deep work for 90 minutes. Your typing rhythm is steady with low error rate — that&apos;s a strong flow signal.
                      Want to save your state and take a micro-break?
                    </p>
                    <div className="flex gap-2 mt-4">
                      <button className="px-4 py-2 rounded-lg bg-[#5b4fc4] text-[#F2EFE9] text-xs font-medium hover:bg-[#6b5fd4] transition-colors">
                        Save & take break
                      </button>
                      <button className="px-4 py-2 rounded-lg bg-[#141420] border border-[#1c1c2e] text-[#857F75] text-xs hover:text-[#F2EFE9] transition-colors">
                        Keep going
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeSection === "shield" && (
            <motion.div
              key="shield"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="space-y-6"
            >
              {/* Shield Status */}
              <motion.div
                className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]"
                initial={{ opacity: 0, y: 10 }}
                animate={isReady ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${focusMode ? "bg-[#22c55e]/10" : "bg-[#857F75]/10"}`}>
                      {focusMode ? <Shield className="w-5 h-5 text-[#22c55e]" /> : <EyeOff className="w-5 h-5 text-[#857F75]" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#F2EFE9]">Distraction Shield</h3>
                      <p className="text-[10px] text-[#857F75]">{focusMode ? "Active — protecting your focus" : "Inactive — all notifications flowing"}</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-0.5 cursor-pointer transition-colors ${focusMode ? "bg-[#22c55e]" : "bg-[#1c1c2e]"}`} onClick={() => setFocusMode(!focusMode)}>
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white"
                      animate={{ x: focusMode ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    />
                  </div>
                </div>

                {/* Distraction indicators */}
                <div className="space-y-3">
                  {[
                    { label: "Context switches", value: "12", trend: "down", detail: "Down 3 from yesterday" },
                    { label: "Tab hopping", value: "28", trend: "up", detail: "Slightly elevated" },
                    { label: "Mouse agitation", value: "Low", trend: "stable", detail: "Steady movement patterns" },
                  ].map((item, i) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-t border-[#1c1c2e]/50">
                      <div>
                        <div className="text-xs text-[#F2EFE9]">{item.label}</div>
                        <div className="text-[10px] text-[#857F75]/60">{item.detail}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#F2EFE9]">{item.value}</span>
                        {item.trend === "down" && <TrendingUp className="w-3 h-3 text-emerald-400 rotate-180" />}
                        {item.trend === "up" && <TrendingUp className="w-3 h-3 text-amber-400" />}
                        {item.trend === "stable" && <Minus className="w-3 h-3 text-[#857F75]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Suggestion */}
              <motion.div
                className="p-6 rounded-xl bg-[#d97706]/5 border border-[#d97706]/20"
                initial={{ opacity: 0, y: 10 }}
                animate={isReady ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#d97706]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bell className="w-4 h-4 text-[#d97706]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[#F2EFE9] mb-1">Notification pattern detected</h4>
                    <p className="text-sm text-[#F2EFE9]/70 leading-relaxed">
                      You&apos;ve received 15 notifications in the last 30 minutes. Your mouse movements suggest context switching.
                      Want to enter focus mode and batch these for later?
                    </p>
                    <div className="flex gap-2 mt-4">
                      <button className="px-4 py-2 rounded-lg bg-[#d97706] text-[#0a0a0f] text-xs font-medium hover:bg-[#e98716] transition-colors">
                        Enter focus mode
                      </button>
                      <button className="px-4 py-2 rounded-lg bg-[#141420] border border-[#1c1c2e] text-[#857F75] text-xs hover:text-[#F2EFE9] transition-colors">
                        Not now
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeSection === "forecast" && (
            <motion.div
              key="forecast"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="space-y-6"
            >
              {/* Energy Forecast Card */}
              <motion.div
                className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]"
                initial={{ opacity: 0, y: 10 }}
                animate={isReady ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#5b4fc4]/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#5b4fc4]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[#F2EFE9]">Energy Forecast</h3>
                    <p className="text-[10px] text-[#857F75]">Based on your patterns, predicted for today</p>
                  </div>
                </div>

                {/* Energy curve visualization */}
                <div className="relative h-40 mb-4">
                  <svg viewBox="0 0 400 160" className="w-full h-full" fill="none">
                    {/* Grid lines */}
                    {[0, 40, 80, 120, 160].map((y) => (
                      <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#1c1c2e" strokeWidth="0.5" />
                    ))}
                    {/* Energy curve */}
                    <motion.path
                      d="M 0 120 Q 30 110, 60 80 T 120 40 T 180 30 T 240 50 T 300 90 T 360 120 L 400 130"
                      stroke="#5b4fc4"
                      strokeWidth="2"
                      fill="none"
                      initial={{ pathLength: 0 }}
                      animate={isReady ? { pathLength: 1 } : {}}
                      transition={{ duration: 2, delay: 0.5, ease: EASE_OUT }}
                    />
                    {/* Fill under curve */}
                    <motion.path
                      d="M 0 120 Q 30 110, 60 80 T 120 40 T 180 30 T 240 50 T 300 90 T 360 120 L 400 130 L 400 160 L 0 160 Z"
                      fill="url(#energyGrad)"
                      initial={{ opacity: 0 }}
                      animate={isReady ? { opacity: 1 } : {}}
                      transition={{ delay: 1.5 }}
                    />
                    <defs>
                      <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5b4fc4" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#5b4fc4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Peak marker */}
                    <circle cx="180" cy="30" r="4" fill="#22c55e" opacity="0.8">
                      <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                    </circle>
                    {/* Time labels */}
                    {["6AM", "10AM", "2PM", "6PM", "10PM"].map((label, i) => (
                      <text key={label} x={i * 100} y="155" fill="#857F75" fontSize="8" textAnchor="middle">{label}</text>
                    ))}
                  </svg>
                </div>

                {/* Peak insight */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/20">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                  <span className="text-xs text-[#F2EFE9]/80">Peak focus predicted: 10 AM - 12 PM (89 energy score)</span>
                </div>
              </motion.div>

              {/* Recommendations */}
              <motion.div
                className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]"
                initial={{ opacity: 0, y: 10 }}
                animate={isReady ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-sm font-medium text-[#F2EFE9] mb-4">Suggested schedule</h3>
                <div className="space-y-3">
                  {[
                    { time: "9-10 AM", activity: "Light tasks, email catch-up", energy: "Warming up", color: "#d97706" },
                    { time: "10 AM-12 PM", activity: "Deep work — your peak window", energy: "Peak energy", color: "#22c55e" },
                    { time: "12-1 PM", activity: "Lunch break, step outside", energy: "Natural dip", color: "#857F75" },
                    { time: "2-4 PM", activity: "Collaborative work, meetings", energy: "Second wind", color: "#5b4fc4" },
                    { time: "4-6 PM", activity: "Wrap up, plan tomorrow", energy: "Gradual decline", color: "#d97706" },
                  ].map((slot, i) => (
                    <motion.div
                      key={slot.time}
                      className="flex items-center gap-4 py-2 border-t border-[#1c1c2e]/50"
                      initial={{ opacity: 0, x: -10 }}
                      animate={isReady ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.3 + i * 0.08 }}
                    >
                      <div className="text-[10px] font-mono text-[#857F75]/60 w-20">{slot.time}</div>
                      <div className="flex-1">
                        <div className="text-xs text-[#F2EFE9]">{slot.activity}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: slot.color }} />
                        <span className="text-[10px] text-[#857F75]/60">{slot.energy}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Minus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
