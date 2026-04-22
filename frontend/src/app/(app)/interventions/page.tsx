"use client";

import { useEffect, useState } from "react";
import { Activity, TrendingUp, Heart, Sparkles, CheckCircle, PieChart as PieChartIcon, Calendar, Clock, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { InterventionEvent, InterventionSnapshot } from "@/lib/types";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const STATE_LABELS: Record<string, string> = {
  NORMAL: "Stable",
  EARLY_WARNING: "Dipping",
  BREAK_RECOMMENDED: "Low energy",
  RECOVERY: "Recovering",
};

const TREND_LABELS: Record<string, string> = {
  rising: "warming",
  steady: "steady",
  falling: "cooling",
};

const STATE_COLORS: Record<string, string> = {
  NORMAL: "#22c55e",
  EARLY_WARNING: "#d97706",
  BREAK_RECOMMENDED: "#dc2626",
  RECOVERY: "#5b4fc4",
};

const ACTION_EMOJI: Record<string, string> = {
  helped: "✨",
  not_helped: "😐",
  snoozed: "⏰",
  skipped: "→",
  start_break: "🧘",
};

const BREAK_COLORS = ["#5b4fc4", "#22c55e", "#d97706", "#3b82f6"];

// ─── Break Effectiveness Donut ───
function BreakEffectivenessChart({
  data,
}: {
  data: { name: string; helped: number; total: number }[];
}) {
  const totalHelped = data.reduce((sum, d) => sum + d.helped, 0);
  const totalBreaks = data.reduce((sum, d) => sum + d.total, 0);
  const successRate = totalBreaks > 0 ? ((totalHelped / totalBreaks) * 100).toFixed(0) : "0";

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          What works best for you
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: "#857F75" }}>
        <span style={{ color: "#22c55e" }}>{successRate}%</span> of your breaks helped you recover
      </p>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={150} height={150}>
          <PieChart>
            <Pie
              data={data.map((d) => ({ name: d.name, value: d.helped }))}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={BREAK_COLORS[index % BREAK_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#141420",
                border: "1px solid #1c1c2e",
                borderRadius: "8px",
                color: "#F2EFE9",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: BREAK_COLORS[i % BREAK_COLORS.length] }}
              />
              <span style={{ color: "#857F75" }}>
                {d.name}: {d.helped}/{d.total} helped
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Recovery Pattern Chart ───
function RecoveryPatternChart({ events }: { events: InterventionEvent[] }) {
  const recoveryData = events
    .filter((e) => e.action === "helped" && e.recovery_score)
    .slice(-10)
    .map((e) => ({
      time: new Date(e.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      recovery: e.recovery_score || 0,
    }));

  if (recoveryData.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          Your recovery pattern
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: "#857F75" }}>
        How much your energy bounces back after breaks
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={recoveryData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" />
          <XAxis dataKey="time" stroke="#857F75" fontSize={12} />
          <YAxis stroke="#857F75" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: "#141420",
              border: "1px solid #1c1c2e",
              borderRadius: "8px",
              color: "#F2EFE9",
            }}
          />
          <Line
            type="monotone"
            dataKey="recovery"
            stroke="#5b4fc4"
            strokeWidth={2}
            dot={{ fill: "#5b4fc4", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Intervention Streak ───
function InterventionStreak({ events }: { events: InterventionEvent[] }) {
  const totalSuggestions = events.length;
  const helpedCount = events.filter((e) => e.action === "helped").length;
  const helpedRate = totalSuggestions > 0 ? ((helpedCount / totalSuggestions) * 100).toFixed(0) : "0";

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: "#1c1c2e" }}>
      <CheckCircle size={20} style={{ color: "#22c55e" }} />
      <div>
        <div className="text-sm font-medium" style={{ color: "#F2EFE9" }}>
          This week&apos;s guidance
        </div>
        <div className="text-xs" style={{ color: "#857F75" }}>
          {totalSuggestions} suggestions · <span style={{ color: "#22c55e" }}>{helpedRate}%</span> helped
        </div>
      </div>
    </div>
  );
}

export default function InterventionsPage() {
  const { userId } = useAuth();
  const [snapshot, setSnapshot] = useState<InterventionSnapshot | null>(null);
  const [events, setEvents] = useState<InterventionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakEffectiveness, setBreakEffectiveness] = useState<
    { name: string; helped: number; total: number }[]
  >([]);
  const [scheduledBreaks, setScheduledBreaks] = useState<
    { id: string; scheduled_for: string; intervention_type: string; status: string; created_at: string }[]
  >([]);
  const [showScheduler, setShowScheduler] = useState(false);
  const [breakTime, setBreakTime] = useState("");
  const [breakType, setBreakType] = useState("breathing_reset");
  const [scheduleMsg, setScheduleMsg] = useState("");

  useEffect(() => {
    Promise.all([
      api.interventionRecommendation(userId).catch(() => null),
      api.interventionHistory(userId, 168).catch(() => []),
    ]).then(([s, e]) => {
      setSnapshot(s);
      setEvents(e);

      // Calculate break effectiveness by type
      const breakTypeMap: Record<string, string> = {
        breathing_reset: "Breathing",
        posture_eye_break: "Stretch",
        cognitive_reset: "Walk",
        hydrate_walk: "Hydrate",
      };
      const breakTypes = ["Breathing", "Stretch", "Walk", "Hydrate"];
      const typeMap = new Map<string, { helped: number; total: number }>();

      breakTypes.forEach((type) => {
        typeMap.set(type, { helped: 0, total: 0 });
      });

      e.forEach((event) => {
        const rawType = event.intervention_type || "breathing_reset";
        const displayType = breakTypeMap[rawType] || "Breathing";
        const current = typeMap.get(displayType)!;
        current.total += 1;
        if (event.action === "helped") {
          current.helped += 1;
        }
      });

      setBreakEffectiveness(
        breakTypes.map((type) => ({
          name: type,
          helped: typeMap.get(type)!.helped,
          total: typeMap.get(type)!.total,
        }))
      );

      // Fetch scheduled breaks
      api.getScheduledBreaks(userId).then((res) => {
        setScheduledBreaks(res.breaks || []);
      }).catch(() => {});

      setLoading(false);
    });
  }, [userId]);

  const handleScheduleBreak = async () => {
    if (!breakTime) return;
    setScheduleMsg("");
    try {
      const res = await api.scheduleBreak(userId, breakTime, breakType);
      if (res.status === "ok") {
        setScheduleMsg("Break scheduled!");
        setBreakTime("");
        setShowScheduler(false);
        const updated = await api.getScheduledBreaks(userId);
        setScheduledBreaks(updated.breaks || []);
      }
    } catch {
      setScheduleMsg("Failed to schedule break");
    }
  };

  const handleCancelBreak = async (breakId: string) => {
    try {
      await api.cancelBreak(userId, breakId);
      setScheduledBreaks((prev) => prev.filter((b) => b.id !== breakId));
    } catch {}
  };

  const calculateMeanRecovery = (allEvents: InterventionEvent[]) => {
    const helpedEvents = allEvents.filter((e) => e.action === "helped");
    if (helpedEvents.length === 0) return "0.0";
    const avg = helpedEvents.reduce((acc, e) => acc + (e.recovery_score || 0), 0) / helpedEvents.length;
    return avg.toFixed(1);
  };
  const meanRecovery = calculateMeanRecovery(events);

  const alertState = snapshot?.alert_state ?? "NORMAL";
  const trend = snapshot?.trend ?? "steady";
  const stateColor = STATE_COLORS[alertState] ?? "#22c55e";

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto" style={{ background: "#0a0a0f", minHeight: "100vh" }}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "#F2EFE9" }}>Guidance</h1>
        <p className="text-sm mt-1.5" style={{ color: "#857F75" }}>Gentle suggestions, not commands</p>
      </div>

      {/* Intervention Streak */}
      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <InterventionStreak events={events} />
      </div>

      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <h3 className="text-lg font-medium mb-4" style={{ color: "#F2EFE9" }}>Your current state</h3>
        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="text-sm animate-pulse" style={{ color: "#857F75" }}>Reading your rhythm...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg" style={{ background: "#1c1c2e" }}>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} style={{ color: stateColor }} />
                <div className="text-xs font-medium" style={{ color: "#857F75" }}>Rhythm state</div>
              </div>
              <div className="text-lg font-semibold tabular-nums" style={{ color: stateColor }}>
                {STATE_LABELS[alertState] ?? alertState}
              </div>
            </div>
            <div className="p-4 rounded-lg" style={{ background: "#1c1c2e" }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} style={{ color: "#5b4fc4" }} />
                <div className="text-xs font-medium" style={{ color: "#857F75" }}>Trend</div>
              </div>
              <div className="text-lg font-semibold tabular-nums" style={{ color: "#F2EFE9" }}>
                {TREND_LABELS[trend] ?? trend}
              </div>
            </div>
            <div className="p-4 rounded-lg" style={{ background: "#1c1c2e" }}>
              <div className="flex items-center gap-2 mb-2">
                <Heart size={16} style={{ color: "#22c55e" }} />
                <div className="text-xs font-medium" style={{ color: "#857F75" }}>Breaks that helped</div>
              </div>
              <div className="text-lg font-semibold tabular-nums" style={{ color: "#22c55e" }}>
                +{meanRecovery}
              </div>
            </div>
          </div>
        )}
      </div>

      {snapshot?.intervention && (
        <div
          className="rounded-lg p-6"
          style={{
            background: "#141420",
            border: "1px solid #1c1c2e",
            borderLeft: `4px solid #5b4fc4`,
          }}
        >
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2" style={{ color: "#F2EFE9" }}>
            <Sparkles size={18} style={{ color: "#5b4fc4" }} />
            Suggested for you: {snapshot.intervention.title}
          </h3>
          <p className="text-sm mb-4" style={{ color: "#857F75" }}>{snapshot.intervention.expected_benefit}</p>
          <ol className="space-y-1.5 text-sm list-none" style={{ color: "#857F75" }}>
            {snapshot.intervention.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: "#1c1c2e", color: "#5b4fc4" }}>
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Break Effectiveness + Recovery Pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
          <BreakEffectivenessChart data={breakEffectiveness} />
        </div>
        <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
          <RecoveryPatternChart events={events} />
        </div>
      </div>

      {/* Smart Break Scheduler */}
      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} style={{ color: "#5b4fc4" }} />
            <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
              Schedule your breaks
            </h3>
          </div>
          <button
            onClick={() => setShowScheduler(!showScheduler)}
            className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            style={{ borderColor: "#5b4fc44d", color: "#5b4fc4" }}
          >
            {showScheduler ? "Close" : "Schedule new"}
          </button>
        </div>

        {showScheduler && (
          <div className="p-4 rounded-lg mb-4" style={{ background: "#1c1c2e" }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "#857F75" }}>
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={breakTime}
                  onChange={(e) => setBreakTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: "#141420", borderColor: "#1c1c2e", color: "#F2EFE9" }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "#857F75" }}>
                  Break type
                </label>
                <select
                  value={breakType}
                  onChange={(e) => setBreakType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ background: "#141420", borderColor: "#1c1c2e", color: "#F2EFE9" }}
                >
                  <option value="breathing_reset">2-Min Breathing</option>
                  <option value="posture_eye_break">3-Min Posture + Eyes</option>
                  <option value="cognitive_reset">5-Min Focus Reset</option>
                  <option value="hydrate_walk">5-Min Hydrate + Walk</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleScheduleBreak}
                  disabled={!breakTime}
                  className="w-full px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 disabled:opacity-40"
                  style={{
                    borderColor: "#22c55e4d",
                    color: "#22c55e",
                    cursor: breakTime ? "pointer" : "not-allowed",
                  }}
                >
                  Schedule
                </button>
              </div>
            </div>
            {scheduleMsg && (
              <p className="text-xs mt-2" style={{ color: scheduleMsg.includes("Failed") ? "#dc2626" : "#22c55e" }}>
                {scheduleMsg}
              </p>
            )}
          </div>
        )}

        {scheduledBreaks.length > 0 ? (
          <div className="space-y-2">
            {scheduledBreaks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "#1c1c2e" }}
              >
                <div className="flex items-center gap-3">
                  <Clock size={16} style={{ color: "#5b4fc4" }} />
                  <div>
                    <div className="text-sm font-medium" style={{ color: "#F2EFE9" }}>
                      {new Date(b.scheduled_for).toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: "#857F75" }}>
                      {b.intervention_type.replace(/_/g, " ")} · {b.status}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelBreak(b.id)}
                  className="p-1.5 rounded-lg transition-all duration-200 hover:scale-[0.98]"
                  style={{ color: "#dc2626" }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm py-2" style={{ color: "#857F75" }}>
            No scheduled breaks — use the button above to plan ahead
          </p>
        )}
      </div>

      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <h3 className="text-lg font-medium mb-4" style={{ color: "#F2EFE9" }}>Break history</h3>
        <div className="space-y-3 max-h-96 overflow-auto">
          {events.length === 0 && !loading && (
            <p className="text-sm py-4" style={{ color: "#857F75" }}>No breaks yet — your rhythm has been steady! 🎯</p>
          )}
          {events.map((event, i) => {
            const emoji = ACTION_EMOJI[event.action] ?? "";
            const recoveryPositive = (event.recovery_score ?? 0) > 0;
            const recoveryColor = recoveryPositive ? "#22c55e" : "#857F75";

            return (
              <div
                key={i}
                className="rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm"
                style={{ background: "#1c1c2e" }}
              >
                <div>
                  <div className="text-xs font-medium" style={{ color: "#857F75" }}>When</div>
                  <div className="tabular-nums" style={{ color: "#F2EFE9" }}>
                    {new Date(event.timestamp * 1000).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: "#857F75" }}>Action</div>
                  <div style={{ color: "#F2EFE9" }}>
                    {emoji} {event.action}
                  </div>
                  <div style={{ color: "#857F75" }}>{event.intervention_type}</div>
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: "#857F75" }}>Score</div>
                  <div className="tabular-nums" style={{ color: "#F2EFE9" }}>
                    {event.score_before.toFixed(1)} → {event.score_after.toFixed(1)}
                  </div>
                  <div className="tabular-nums font-medium" style={{ color: recoveryColor }}>
                    {event.recovery_score ? `+${event.recovery_score.toFixed(1)}` : "--"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
