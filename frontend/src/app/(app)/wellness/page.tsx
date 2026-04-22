"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Battery, BatteryCharging, BatteryMedium, Calendar, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Minus, Sparkles, ChevronRight, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

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

const MOCK_CHECKINS: DailyCheckIn[] = [
  { date: "Mon", energy: "high", sleep: "good" },
  { date: "Tue", energy: "medium", sleep: "fair" },
  { date: "Wed", energy: "high", sleep: "great" },
  { date: "Thu", energy: "low", sleep: "poor" },
  { date: "Fri", energy: "medium", sleep: "good" },
  { date: "Sat", energy: "high", sleep: "great" },
  { date: "Sun", energy: "medium", sleep: "good" },
];

const MOCK_JOURNAL: JournalEntry[] = [
  { id: "1", date: "Today", insight: "You tend to be most focused 10-12 AM. Want me to protect those hours?", type: "pattern" },
  { id: "2", date: "Yesterday", insight: "Your energy dipped after 3 PM on 3 of the last 5 days. Consider a 15-min walk around 2:30.", type: "suggestion" },
  { id: "3", date: "2 days ago", insight: "You took 12 breaks this week — that's 15% more than last week! Great improvement.", type: "milestone" },
  { id: "4", date: "3 days ago", insight: "Your typing rhythm is most consistent on Tuesdays and Wednesdays. These might be your best days for deep work.", type: "pattern" },
  { id: "5", date: "Last week", insight: "You've maintained steady energy for 5 consecutive days. That's your longest streak this month.", type: "milestone" },
];

export default function WellnessPage() {
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"checkin" | "journal" | "weekly">("checkin");
  const [checkInDone, setCheckInDone] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel | null>(null);
  const [selectedSleep, setSelectedSleep] = useState<SleepQuality | null>(null);

  const { userId } = useAuth();
  const [history, setHistory] = useState<DailyCheckIn[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getWellnessHistory().catch(() => []),
      api.getJournalEntries().catch(() => []),
    ]).then(([h, j]) => {
      // Map API response to Component types
      setHistory(h.map(item => ({
        date: new Date(item.timestamp * 1000).toLocaleDateString([], { weekday: 'short' }),
        energy: item.energy as EnergyLevel,
        sleep: item.sleep as SleepQuality,
        note: item.note
      })));
      setJournal(j.map(item => ({
        id: item.id,
        date: new Date(item.timestamp * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        insight: item.content,
        type: item.entry_type as any
      })));
      setLoading(false);
    });
  }, [userId]);

  const handleCheckIn = async () => {
    if (selectedEnergy && selectedSleep) {
      try {
        await api.saveWellnessCheckin(selectedEnergy, selectedSleep);
        setCheckInDone(true);
        // Refresh history
        const h = await api.getWellnessHistory();
        setHistory(h.map(item => ({
          date: new Date(item.timestamp * 1000).toLocaleDateString([], { weekday: 'short' }),
          energy: item.energy as EnergyLevel,
          sleep: item.sleep as SleepQuality,
          note: item.note
        })));
      } catch (err) {
        console.error("Failed to save check-in", err);
      }
    }
  };

  const tabs = [
    { key: "checkin" as const, label: "Daily Pulse", icon: Sun },
    { key: "journal" as const, label: "Pattern Journal", icon: BarChart3 },
    { key: "weekly" as const, label: "Weekly Reflection", icon: Sparkles },
  ];

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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                  active ? "bg-[#5b4fc4]/15 text-[#5b4fc4] font-medium" : "text-[#857F75] hover:bg-[#141420] hover:text-[#F2EFE9]"
                }`}
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
        <AnimatePresence mode="wait">
          {activeTab === "checkin" && (
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
                  <button onClick={() => { setCheckInDone(false); setSelectedEnergy(null); setSelectedSleep(null); }} className="mt-6 text-xs text-[#5b4fc4] hover:text-[#8b7fd4] transition-colors">
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
                            className={`p-4 rounded-xl border transition-all text-center ${
                              selected ? "border-opacity-60" : "border-[#1c1c2e] hover:border-[#1c1c2e]"
                            }`}
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
                            className={`p-3 rounded-xl border transition-all text-center ${
                              selected ? "border-opacity-60" : "border-[#1c1c2e] hover:border-[#1c1c2e]"
                            }`}
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
                    disabled={!selectedEnergy || !selectedSleep}
                    className="w-full py-3 rounded-xl bg-[#5b4fc4] text-[#F2EFE9] text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                    whileHover={selectedEnergy && selectedSleep ? { scale: 1.01 } : {}}
                    whileTap={selectedEnergy && selectedSleep ? { scale: 0.98 } : {}}
                  >
                    Save check-in
                  </motion.button>

                   {/* Weekly Overview */}
                   <div className="pt-4 border-t border-[#1c1c2e]">
                     <h3 className="text-xs font-medium text-[#857F75] mb-3 uppercase tracking-wider">Recent rhythm history</h3>
                     <div className="flex gap-2 min-h-[60px] items-center">
                       {loading ? (
                         <div className="flex-1 text-center py-4 text-xs text-[#857F75] animate-pulse">Loading patterns...</div>
                       ) : history.length === 0 ? (
                         <div className="flex-1 text-center py-4 text-xs text-[#857F75]">No check-ins yet. Start your first one above!</div>
                       ) : (
                         history.slice(0, 7).reverse().map((day, i) => {
                           const energyConfig = ENERGY_MAP[day.energy];
                           return (
                             <div key={i} className="flex-1 text-center">
                               <div className="text-[10px] text-[#857F75]/60 mb-2">{day.date}</div>
                               <motion.div
                                 className="w-8 h-8 rounded-full mx-auto flex items-center justify-center mb-1"
                                 style={{ backgroundColor: `${energyConfig.color}15` }}
                                 initial={{ scale: 0 }}
                                 animate={{ scale: 1 }}
                                 transition={{ delay: i * 0.08, type: "spring" }}
                               >
                                 <span className="text-sm">{energyConfig.emoji}</span>
                               </motion.div>
                             </div>
                           );
                         })
                       )}
                     </div>
                   </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "journal" && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="space-y-4"
            >
              {MOCK_JOURNAL.map((entry, i) => {
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
              })}
            </motion.div>
          )}

          {activeTab === "weekly" && (
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
                    <div className="text-2xl font-light text-[#F2EFE9]">72<span className="text-sm text-[#857F75]/40">/100</span></div>
                    <div className="flex items-center gap-1 mt-1">
                      <ArrowUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">+8% vs last week</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60 mb-1">Breaks Taken</div>
                    <div className="text-2xl font-light text-[#F2EFE9]">12</div>
                    <div className="flex items-center gap-1 mt-1">
                      <ArrowUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">+15% vs last week</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60 mb-1">Focus Sessions</div>
                    <div className="text-2xl font-light text-[#F2EFE9]">8</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Minus className="w-3 h-3 text-[#857F75]" />
                      <span className="text-[10px] text-[#857F75]">Same as last week</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#857F75]/60 mb-1">Best Day</div>
                    <div className="text-2xl font-light text-[#F2EFE9]">Wed</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-[#5b4fc4]">Peak energy: 89</span>
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
                  {[
                    { text: "Your energy is consistently higher in the morning. Consider scheduling important work before noon.", color: "#5b4fc4" },
                    { text: "You took more breaks this week — great job listening to your rhythm!", color: "#22c55e" },
                    { text: "Thursday showed a significant energy dip. That was also your lowest sleep quality day.", color: "#d97706" },
                  ].map((insight, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: insight.color }} />
                      <p className="text-sm text-[#F2EFE9]/80 leading-relaxed">{insight.text}</p>
                    </div>
                  ))}
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
                  Based on your patterns, try scheduling deep work blocks between 10 AM - 12 PM on Tue/Wed/Thu.
                  These are your most consistent focus days. Keep the break habit going — it&apos;s working!
                </p>
                <button className="flex items-center gap-1 text-xs text-[#5b4fc4] hover:text-[#8b7fd4] transition-colors">
                  Apply this schedule <ChevronRight className="w-3 h-3" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
