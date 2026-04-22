"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Battery, BatteryCharging, BatteryMedium, Calendar, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Sparkles, ChevronRight, BarChart3, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { WellnessCheckin, WellnessInsight } from "@/lib/types";

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];

type EnergyLevel = "low" | "medium" | "high";
type SleepQuality = "poor" | "fair" | "good" | "great";

interface DailyCheckIn {
  date: string;
  energy: EnergyLevel;
  sleep: SleepQuality;
  note?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  insight: string;
  type: "pattern" | "suggestion" | "milestone";
}

interface WeeklyStats {
  avg_energy: number | null;
  avg_sleep: number | null;
  checkin_count: number;
  insights: WellnessInsight[];
}

const ENERGY_MAP: Record<EnergyLevel, { label: string; icon: typeof Battery; color: string; emoji: string }> = {
  low: { label: "Low energy", icon: Battery, color: "#dc2626", emoji: "🔋" },
  medium: { label: "Moderate", icon: BatteryMedium, color: "#d97706", emoji: "⚡" },
  high: { label: "High energy", icon: BatteryCharging, color: "#22c55e", emoji: "🔥" },
};

const SLEEP_MAP: Record<SleepQuality, { label: string; color: string; emoji: string }> = {
  poor: { label: "Poor", color: "#dc2626", emoji: "😴" },
  fair: { label: "Fair", color: "#d97706", emoji: "😪" },
  good: { label: "Good", color: "#22c55e", emoji: "😊" },
  great: { label: "Great", color: "#5b4fc4", emoji: "🌟" },
};

const SLEEP_VALUE_MAP: Record<SleepQuality, number> = {
  poor: 1,
  fair: 2,
  good: 3,
  great: 4,
};

const ENERGY_VALUE_MAP: Record<EnergyLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short" });
};

const getRelativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function WellnessPage() {
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"checkin" | "journal" | "weekly">("checkin");
  const [checkInDone, setCheckInDone] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel | null>(null);
  const [selectedSleep, setSelectedSleep] = useState<SleepQuality | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [checkins, setCheckins] = useState<DailyCheckIn[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [todayCheckin, setTodayCheckin] = useState<WellnessCheckin | null>(null);

  const { userId } = useAuth();
  const [history, setHistory] = useState<DailyCheckIn[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 200);
    loadData();
    return () => clearTimeout(t);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load check-ins
      const checkinsRes = await api.getWellnessCheckins(7);
      if (checkinsRes.success) {
        const mappedCheckins: DailyCheckIn[] = checkinsRes.checkins.map((c) => ({
          date: formatDate(c.check_date),
          energy: c.energy_level as EnergyLevel,
          sleep: c.sleep_quality as SleepQuality,
          note: c.note,
        }));
        setCheckins(mappedCheckins);
      }
      
      // Load today's check-in
      const todayRes = await api.getTodayCheckin();
      if (todayRes.success && todayRes.checkin) {
        const checkinData = todayRes.checkin;
        setTodayCheckin({
          id: checkinData.id,
          user_id: "",
          check_date: checkinData.check_date,
          energy_level: checkinData.energy_level as "low" | "medium" | "high",
          sleep_quality: checkinData.sleep_quality as "poor" | "fair" | "good" | "great",
          note: checkinData.note,
          created_at: checkinData.check_date,
        });
        setSelectedEnergy(checkinData.energy_level as EnergyLevel);
        setSelectedSleep(checkinData.sleep_quality as SleepQuality);
        setCheckInDone(true);
      }
      
      // Load journal
      const journalRes = await api.getWellnessJournal(10);
      if (journalRes.success) {
        const mappedJournal: JournalEntry[] = journalRes.insights.map((i) => ({
          id: i.id,
          date: getRelativeDate(i.generated_at),
          insight: i.content,
          type: i.insight_type as "pattern" | "suggestion" | "milestone",
        }));
        setJournal(mappedJournal);
      }
      
      // Load weekly reflection
      const weeklyRes = await api.getWeeklyReflection();
      if (weeklyRes.success) {
        const wr = weeklyRes.reflection;
        setWeeklyStats({
          avg_energy: wr.avg_energy,
          avg_sleep: wr.avg_sleep,
          checkin_count: wr.checkin_count,
          insights: wr.insights.map((i) => ({
            id: i.id,
            user_id: "",
            insight_type: i.insight_type as "pattern" | "suggestion" | "milestone",
            content: i.content,
            relevant_date: undefined,
            generated_at: new Date().toISOString(),
          })),
        });
      }
    } catch (err) {
      setError("Failed to load wellness data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedEnergy || !selectedSleep) return;
    
    try {
      setIsLoading(true);
      await api.saveWellnessCheckin(selectedEnergy, selectedSleep);
      setCheckInDone(true);
      
      // Reload data
      await loadData();
    } catch (err) {
      setError("Failed to save check-in");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetCheckIn = () => {
    setCheckInDone(false);
    setSelectedEnergy(null);
    setSelectedSleep(null);
  };

  const tabs = [
    { key: "checkin" as const, label: "Daily Pulse", icon: Sun },
    { key: "journal" as const, label: "Pattern Journal", icon: BarChart3 },
    { key: "weekly" as const, label: "Weekly Reflection", icon: Sparkles },
  ];

  // Calculate weekly display stats
  const avgEnergyDisplay = weeklyStats?.avg_energy ? Math.round(weeklyStats.avg_energy * 33.33) : 72;
  const breaksTaken = weeklyStats?.checkin_count || 12;
  const energyTrend = avgEnergyDisplay > 65 ? "up" : avgEnergyDisplay < 50 ? "down" : "stable";

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0f] min-h-screen overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#1c1c2e]">
        <div className="flex items-center gap-3 mb-1">
          <Sun className="w-5 h-5 text-[#d97706]" />
          <h1 className="text-xl font-light text-[#F2EFE9]">Wellness Companion</h1>
        </div>
        <p className="text-sm text-[#857F75]">Your private rhythm insights — no one else sees this.</p>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-8 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400"
        >
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">Dismiss</button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="px-8 py-4 border-b border-[#1c1c2e]">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                disabled={isLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  active ? "bg-[#5b4fc4]/15 text-[#5b4fc4] font-medium" : "text-[#857F75] hover:bg-[#141420] hover:text-[#F2EFE9]"
                } disabled:opacity-50`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8 max-w-3xl">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#5b4fc4] animate-spin" />
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {activeTab === "checkin" && !isLoading && (
            <motion.div
              key="checkin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            >
              {checkInDone ? (
                <motion.div className="text-center py-12" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring" }}>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-6">
                    <span className="text-2xl">✓</span>
                  </div>
                  <h3 className="text-lg font-light text-[#F2EFE9] mb-2">Check-in complete</h3>
                  <p className="text-sm text-[#857F75]">Your rhythm is noted. I&apos;ll use this to personalize your experience.</p>
                  <button 
                    onClick={resetCheckIn} 
                    disabled={isLoading}
                    className="mt-6 text-xs text-[#5b4fc4] hover:text-[#8b7fd4] transition-colors disabled:opacity-50"
                  >
                    Update check-in
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-8">
                  {/* Energy Level */}
                  <div>
                    <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">How&apos;s your energy right now?</h3>
                    <p className="text-xs text-[#857F75] mb-4">No wrong answers — just your honest rhythm.</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(["low", "medium", "high"] as EnergyLevel[]).map((level) => {
                        const config = ENERGY_MAP[level];
                        const Icon = config.icon;
                        const selected = selectedEnergy === level;
                        return (
                          <motion.button
                            key={level}
                            onClick={() => setSelectedEnergy(level)}
                            disabled={isLoading}
                            className={`p-4 rounded-xl border transition-all text-center ${
                              selected ? "border-opacity-60" : "border-[#1c1c2e] hover:border-[#1c1c2e]"
                            } disabled:opacity-50`}
                            style={{ backgroundColor: selected ? `${config.color}10` : "#141420", borderColor: selected ? config.color : undefined }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <div className="text-2xl mb-2">{config.emoji}</div>
                            <div className="text-xs font-medium text-[#F2EFE9]">{config.label}</div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sleep Quality */}
                  <div>
                    <h3 className="text-sm font-medium text-[#F2EFE9] mb-1">How did you sleep?</h3>
                    <p className="text-xs text-[#857F75] mb-4">This helps me understand your energy patterns.</p>
                    <div className="grid grid-cols-4 gap-3">
                      {(["poor", "fair", "good", "great"] as SleepQuality[]).map((quality) => {
                        const config = SLEEP_MAP[quality];
                        const selected = selectedSleep === quality;
                        return (
                          <motion.button
                            key={quality}
                            onClick={() => setSelectedSleep(quality)}
                            disabled={isLoading}
                            className={`p-3 rounded-xl border transition-all text-center ${
                              selected ? "border-opacity-60" : "border-[#1c1c2e] hover:border-[#1c1c2e]"
                            } disabled:opacity-50`}
                            style={{ backgroundColor: selected ? `${config.color}10` : "#141420", borderColor: selected ? config.color : undefined }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            <div className="text-xl mb-1">{config.emoji}</div>
                            <div className="text-[10px] font-medium text-[#F2EFE9]">{config.label}</div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.button
                    onClick={handleCheckIn}
                    disabled={!selectedEnergy || !selectedSleep || isLoading}
                    className="w-full py-3 rounded-xl bg-[#5b4fc4] text-[#F2EFE9] text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    whileHover={selectedEnergy && selectedSleep && !isLoading ? { scale: 1.01 } : {}}
                    whileTap={selectedEnergy && selectedSleep && !isLoading ? { scale: 0.98 } : {}}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save check-in
                  </motion.button>

                  {/* Weekly Overview */}
                  {checkins.length > 0 && (
                    <div className="pt-4 border-t border-[#1c1c2e]">
                      <h3 className="text-xs font-medium text-[#857F75] mb-3 uppercase tracking-wider">This week&apos;s rhythm</h3>
                      <div className="flex gap-2">
                        {checkins.slice(0, 7).map((day, i) => {
                          const energyConfig = ENERGY_MAP[day.energy];
                          return (
                            <div key={day.date} className="flex-1 text-center">
                              <div className="text-[10px] text-[#857F75]/60 mb-2">{day.date}</div>
                              <motion.div
                                className="w-8 h-8 rounded-full mx-auto flex items-center justify-center mb-1"
                                style={{ backgroundColor: `${energyConfig.color}15` }}
                                initial={{ scale: 0 }}
                                animate={isReady ? { scale: 1 } : {}}
                                transition={{ delay: i * 0.08, type: "spring" }}
                              >
                                <span className="text-sm">{energyConfig.emoji}</span>
                              </motion.div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "journal" && !isLoading && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="space-y-4"
            >
              {journal.length === 0 ? (
                <div className="text-center py-12 text-[#857F75]">
                  <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No insights yet. Check in daily to build your pattern journal.</p>
                </div>
              ) : (
                journal.map((entry, i) => {
                  const typeConfig = {
                    pattern: { color: "#5b4fc4", label: "Pattern", icon: TrendingUp },
                    suggestion: { color: "#d97706", label: "Suggestion", icon: Sparkles },
                    milestone: { color: "#22c55e", label: "Milestone", icon: ArrowUp },
                  };
                  const config = typeConfig[entry.type];
                  const TypeIcon = config.icon;

                  return (
                    <motion.div
                      key={entry.id}
                      className="p-5 rounded-xl bg-[#141420] border border-[#1c1c2e] hover:border-opacity-40 transition-all cursor-default"
                      style={{ borderColor: `${config.color}15` }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ borderColor: `${config.color}30` }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${config.color}15` }}>
                          <TypeIcon className="w-3 h-3" style={{ color: config.color }} />
                        </div>
                        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: config.color }}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-[#857F75]/40 ml-auto">{entry.date}</span>
                      </div>
                      <p className="text-sm text-[#F2EFE9]/90 leading-relaxed">{entry.insight}</p>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeTab === "weekly" && !isLoading && (
            <motion.div
              key="weekly"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="space-y-6"
            >
              {/* Summary Card */}
              <motion.div
                className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-[#5b4fc4]" />
                  <h3 className="text-sm font-medium text-[#F2EFE9]">Your Week in Rhythm</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60 mb-1">Avg Energy</div>
                    <div className="text-2xl font-light text-[#F2EFE9]">{avgEnergyDisplay}<span className="text-sm text-[#857F75]/40">/100</span></div>
                    <div className="flex items-center gap-1 mt-1">
                      {energyTrend === "up" && <ArrowUp className="w-3 h-3 text-emerald-400" />}
                      {energyTrend === "down" && <ArrowDown className="w-3 h-3 text-red-400" />}
                      {energyTrend === "stable" && <Minus className="w-3 h-3 text-[#857F75]" />}
                      <span className={`text-[10px] ${energyTrend === "up" ? "text-emerald-400" : energyTrend === "down" ? "text-red-400" : "text-[#857F75]"}`}>
                        {energyTrend === "up" ? "+8% vs last week" : energyTrend === "down" ? "-5% vs last week" : "Same as last week"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60 mb-1">Check-ins</div>
                    <div className="text-2xl font-light text-[#F2EFE9]">{breaksTaken}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <ArrowUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">This week</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60 mb-1">Sleep Quality</div>
                    <div className="text-2xl font-light text-[#F2EFE9]">
                      {weeklyStats?.avg_sleep ? Math.round(weeklyStats.avg_sleep * 25) : 75}<span className="text-sm text-[#857F75]/40">/100</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Minus className="w-3 h-3 text-[#857F75]" />
                      <span className="text-[10px] text-[#857F75]">Steady</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60 mb-1">Best Day</div>
                    <div className="text-2xl font-light text-[#F2EFE9]">
                      {checkins.length > 0 
                        ? checkins.reduce((best, current) => 
                            ENERGY_VALUE_MAP[current.energy] > ENERGY_VALUE_MAP[best.energy] ? current : best
                          ).date 
                        : "Wed"}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-[#5b4fc4]">Highest energy</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Insights */}
              <motion.div
                className="p-6 rounded-xl bg-[#141420] border border-[#1c1c2e]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-sm font-medium text-[#F2EFE9] mb-4">What I noticed</h3>
                <div className="space-y-3">
                  {weeklyStats?.insights && weeklyStats.insights.length > 0 ? (
                    weeklyStats.insights.slice(0, 3).map((insight, i) => (
                      <div key={insight.id} className="flex gap-3 items-start">
                        <div 
                          className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" 
                          style={{ backgroundColor: insight.insight_type === "pattern" ? "#5b4fc4" : insight.insight_type === "suggestion" ? "#d97706" : "#22c55e" }} 
                        />
                        <p className="text-sm text-[#F2EFE9]/80 leading-relaxed">{insight.content}</p>
                      </div>
                    ))
                  ) : (
                    [
                      { text: "Your energy is consistently higher in the morning. Consider scheduling important work before noon.", color: "#5b4fc4" },
                      { text: "Keep up your check-in habit — it helps me understand your patterns better.", color: "#22c55e" },
                      { text: "Regular sleep patterns correlate with higher energy scores.", color: "#d97706" },
                    ].map((insight, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: insight.color }} />
                        <p className="text-sm text-[#F2EFE9]/80 leading-relaxed">{insight.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Next Week Suggestion */}
              <motion.div
                className="p-6 rounded-xl bg-[#5b4fc4]/5 border border-[#5b4fc4]/20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#5b4fc4]" />
                  <h3 className="text-sm font-medium text-[#F2EFE9]">Suggestion for next week</h3>
                </div>
                <p className="text-sm text-[#F2EFE9]/80 leading-relaxed mb-4">
                  Based on your patterns, try scheduling deep work blocks between 10 AM - 12 PM on your highest energy days.
                  Keep the check-in habit going — it&apos;s the foundation of personalized insights!
                </p>
                <button className="flex items-center gap-1 text-xs text-[#5b4fc4] hover:text-[#8b7fd4] transition-colors">
                  View energy forecast <ChevronRight className="w-3 h-3" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Icon component for stable indicator
function Minus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
