"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useStressStream } from "@/hooks/use-stress-stream";
import type { HistoryPoint, UserStats, InterventionEvent } from "@/lib/types";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { Clock, TrendingUp, Activity, Zap, AlertTriangle } from "lucide-react";

const LEVEL_MAP: Record<string, { label: string; color: string }> = {
  NEUTRAL: { label: "Calm", color: "#22c55e" },
  MILD: { label: "Mild", color: "#d97706" },
  STRESSED: { label: "Stressed", color: "#dc2626" },
};

const ACTION_MAP: Record<string, { label: string; emoji: string }> = {
  start_break: { label: "Took a break", emoji: "🧘" },
  helped: { label: "Helped", emoji: "✨" },
  not_helped: { label: "Still feeling it", emoji: "😐" },
  snooze: { label: "Remind later", emoji: "⏰" },
  skipped: { label: "Not right now", emoji: "→" },
  im_okay: { label: "I'm okay", emoji: "👍" },
  need_stronger_help: { label: "Different help", emoji: "🔄" },
};

const TIME_RANGES = [
  { label: "6h", hours: 6 },
  { label: "12h", hours: 12 },
  { label: "1d", hours: 24 },
  { label: "2d", hours: 48 },
  { label: "7d", hours: 168 },
  { label: "21d", hours: 504 },
];

export default function HistoryPage() {
  const { userId } = useAuth();
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [interventions, setInterventions] = useState<InterventionEvent[]>([]);
  const [hours, setHours] = useState(24);
  const [customUserId, setCustomUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const activeUserId = customUserId || userId;
    Promise.all([
      api.history(activeUserId, hours).catch(() => { setError("Couldn't read rhythm — check the username?"); return []; }),
      api.stats(activeUserId).catch(() => null),
      api.interventionHistory(activeUserId, Math.max(24, hours)).catch(() => []),
    ]).then(([h, s, i]) => {
      setHistory(h);
      setStats(s);
      setInterventions(i);
      setLoading(false);
    });
  }, [hours, userId, customUserId]);

  // Chart data: raw for short ranges, daily-aggregated for 21-day
  const chartData = useMemo(() => {
    if (hours <= 168) {
      return history.map((h) => ({
        time: new Date(h.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        score: h.score,
        energy: 100 - h.score,
        wpm: h.typing_speed_wpm || 0,
        errors: parseFloat(((h.error_rate || 0) * 100).toFixed(1)),
        level: h.level,
      }));
    }
    // 21-day: aggregate into daily averages
    const dailyMap = new Map<string, { score: number; count: number; wpm: number; errors: number }>();
    history.forEach((h) => {
      const day = new Date(h.timestamp * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
      const existing = dailyMap.get(day) || { score: 0, count: 0, wpm: 0, errors: 0 };
      dailyMap.set(day, {
        score: existing.score + h.score,
        count: existing.count + 1,
        wpm: existing.wpm + (h.typing_speed_wpm || 0),
        errors: existing.errors + (h.error_rate || 0),
      });
    });
    return Array.from(dailyMap.entries()).map(([day, vals]) => ({
      time: day,
      score: Math.round(vals.score / vals.count),
      energy: Math.round(100 - vals.score / vals.count),
      wpm: Math.round(vals.wpm / vals.count),
      errors: parseFloat((vals.errors / vals.count * 100).toFixed(1)),
    }));
  }, [history, hours]);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-[#F2EFE9]">Pulse History</h1>
          <p className="text-sm text-[#857F75] mt-1.5">Your stress patterns over time</p>
        </div>
        
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] uppercase font-bold text-[#857F75]/60 px-1 tracking-widest">Override Patient ID</label>
          <div className="flex bg-[#141420] border border-[#1c1c2e] rounded-lg overflow-hidden focus-within:border-[#5b4fc4]/50 transition-colors">
            <input 
              type="text" 
              placeholder={userId || "Enter username..."}
              className="bg-transparent text-xs px-4 py-2 border-none outline-none text-[#F2EFE9] w-48 placeholder:text-[#857F75]/30"
              value={customUserId}
              onChange={(e) => setCustomUserId(e.target.value)}
            />
            {customUserId && (
              <button 
                onClick={() => setCustomUserId("")}
                className="px-3 text-[#dc2626] hover:bg-[#dc2626]/10 transition-colors"
                title="Reset to your profile"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[#dc2626]/20 bg-[#dc2626]/5 p-4 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {TIME_RANGES.map((tr) => (
          <button
            key={tr.hours}
            onClick={() => setHours(tr.hours)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              hours === tr.hours
                ? "bg-[#5b4fc4] text-[#F2EFE9]"
                : "bg-[#141420] border border-[#1c1c2e] text-[#857F75] hover:text-[#F2EFE9] hover:bg-[#1c1c2e]"
            }`}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {/* Energy Chart */}
      <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#5b4fc4]" />
          <h3 className="text-sm text-[#857F75] font-medium">Stress timeline</h3>
        </div>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm text-[#857F75] animate-pulse">Reading your rhythm...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm text-[#857F75]">No history yet — start tracking to see your rhythm unfold ✨</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b4fc4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#5b4fc4" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                tick={{ fill: "#857F75", fontSize: 10 }} 
                axisLine={false} 
                tickLine={false}
                minTickGap={30}
              />
              <YAxis domain={[0, 100]} tick={{ fill: "#857F75", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: "#0a0a0f", border: "1px solid #1c1c2e", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
                labelStyle={{ color: "#857F75" }}
                formatter={(val: number) => [val.toFixed(1), "Stress"]}
              />
              <ReferenceLine y={25} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.2} label={{ value: "Calm", fill: "#22c55e", fontSize: 10, opacity: 0.5 }} />
              <ReferenceLine y={65} stroke="#dc2626" strokeDasharray="4 4" strokeOpacity={0.2} label={{ value: "Stressed", fill: "#dc2626", fontSize: 10, opacity: 0.5 }} />
              <Area type="monotone" dataKey="stress" stroke="#5b4fc4" fill="url(#energyGrad)" strokeWidth={2} dot={hours <= 12} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── 21-Day Multi-Metric Trend Chart ─── */}
      {hours >= 504 && chartData.length > 1 && (
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#22c55e]" />
            <h3 className="text-sm text-[#857F75] font-medium">21-day multi-metric trends</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" />
              <XAxis dataKey="time" stroke="#857F75" fontSize={10} tick={{ fill: "#857F75" }} />
              <YAxis yAxisId="left" domain={[0, 100]} stroke="#857F75" fontSize={10} tick={{ fill: "#857F75" }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 120]} stroke="#5b4fc4" fontSize={10} tick={{ fill: "#5b4fc4" }} />
              <Tooltip
                contentStyle={{
                  background: "#0a0a0f",
                  border: "1px solid #1c1c2e",
                  borderRadius: 8,
                  color: "#F2EFE9",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" yAxisId="left" dataKey="energy" stroke="#22c55e" strokeWidth={2} dot={false} name="Energy" />
              <Line type="monotone" yAxisId="left" dataKey="score" stroke="#dc2626" strokeWidth={2} dot={false} name="Stress" />
              <Line type="monotone" yAxisId="right" dataKey="wpm" stroke="#5b4fc4" strokeWidth={2} dot={false} name="WPM" />
              <Line type="monotone" yAxisId="right" dataKey="errors" stroke="#d97706" strokeWidth={2} dot={false} name="Error %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Metric Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#22c55e]" />
            <span className="text-[11px] text-[#857F75] font-medium uppercase tracking-wider">Avg Energy</span>
          </div>
          <div className="text-2xl font-light text-[#F2EFE9] tabular-nums">
            {stats?.avg_score ? stats.avg_score.toFixed(1) : "--"}
          </div>
        </div>
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-[#5b4fc4]" />
            <span className="text-[11px] text-[#857F75] font-medium uppercase tracking-wider">Avg WPM</span>
          </div>
          <div className="text-2xl font-light text-[#F2EFE9] tabular-nums">
            {stats?.typing_speed_wpm?.toFixed(0) ?? "--"}
          </div>
        </div>
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#d97706]" />
            <span className="text-[11px] text-[#857F75] font-medium uppercase tracking-wider">Error Rate</span>
          </div>
          <div className="text-2xl font-light text-[#F2EFE9] tabular-nums">
            {stats?.error_rate ? (stats.error_rate * 100).toFixed(1) : "--"}<span className="text-sm text-[#857F75]/40">%</span>
          </div>
        </div>
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-[#dc2626]" />
            <span className="text-[11px] text-[#857F75] font-medium uppercase tracking-wider">Stressed %</span>
          </div>
          <div className="text-2xl font-light text-[#dc2626] tabular-nums">{stats?.stressed_pct ?? 0}<span className="text-sm text-[#857F75]/40">%</span></div>
        </div>
      </div>

      {/* Recent Signals */}
      <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-6">
        <h3 className="text-sm text-[#857F75] font-medium mb-4">Recent signals</h3>
        <div className="space-y-1 max-h-60 overflow-auto">
          {history.length === 0 && !loading && <p className="text-sm text-[#857F75] py-4">No signals yet — start tracking to collect data.</p>}
          {history.slice(-20).reverse().map((h, i) => {
            const mapped = LEVEL_MAP[h.level] || LEVEL_MAP.NEUTRAL;
            return (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#1c1c2e]/50 last:border-0">
                <span className="text-xs text-[#857F75] tabular-nums">{new Date(h.timestamp * 1000).toLocaleTimeString()}</span>
                <span className="text-sm font-light tabular-nums text-[#F2EFE9]">{h.score.toFixed(1)}</span>
                <span className="text-xs font-medium" style={{ color: mapped.color }}>{mapped.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Break History */}
      <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-6">
        <h3 className="text-sm text-[#857F75] font-medium mb-4">Break history</h3>
        <div className="space-y-2 max-h-60 overflow-auto">
          {interventions.length === 0 && !loading && <p className="text-sm text-[#857F75] py-4">No breaks yet — your rhythm has been steady! 🎯</p>}
          {interventions.slice(0, 25).map((event, i) => {
            const action = ACTION_MAP[event.action] || { label: event.action, emoji: "•" };
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0f] border border-[#1c1c2e]/50">
                <span className="text-lg">{action.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#F2EFE9] font-medium">{action.label}</div>
                  <div className="text-[10px] text-[#857F75]">{new Date(event.timestamp * 1000).toLocaleTimeString()}</div>
                </div>
                <div className="text-xs text-[#857F75] tabular-nums">
                  {event.score_before.toFixed(0)} → {event.score_after.toFixed(0)}
                </div>
                <div className={`text-xs font-medium tabular-nums ${event.recovery_score > 0 ? "text-[#22c55e]" : "text-[#857F75]"}`}>
                  {event.recovery_score > 0 ? `+${event.recovery_score.toFixed(1)}` : "--"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
