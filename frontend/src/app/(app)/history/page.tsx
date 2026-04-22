"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useStressStream } from "@/hooks/use-stress-stream";
import type { HistoryPoint, UserStats, InterventionEvent } from "@/lib/types";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Clock, TrendingUp, Activity } from "lucide-react";

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

export default function HistoryPage() {
  const { userId } = useAuth();
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [interventions, setInterventions] = useState<InterventionEvent[]>([]);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.history(hours).catch(() => { setError("Couldn't read rhythm — token expired?"); return []; }),
      api.stats().catch(() => null),
      api.interventionHistory(Math.max(24, hours)).catch(() => []),
    ]).then(([h, s, i]) => {
      setHistory(h);
      setStats(s);
      setInterventions(i);
      setLoading(false);
    });
  }, [hours, userId]);

  // Real-time integration
  const { data: wsData } = useStressStream();
  
  useEffect(() => {
    if (wsData && wsData.timestamp) {
      setHistory(prev => {
        // Dedup: ensure we don't append a result that's older or identical to our last fetched data
        if (prev.length > 0 && prev[prev.length - 1].timestamp >= wsData.timestamp) return prev;
        
        // Convert to history point logic
        const newPoint = {
          timestamp: wsData.timestamp,
          score: wsData.score,
          level: wsData.level,
          insights: wsData.insights || [],
        };
        
        return [...prev, newPoint];
      });
    }
  }, [wsData]);

  // Helper to aggregate data based on time range
  const getAggregatedData = () => {
    if (history.length === 0) return [];

    // Bucket sizes (in seconds)
    // 6h -> 2m bucket
    // 12h -> 5m bucket
    // 24h -> 15m bucket
    // 48h -> 30m bucket
    // 7d -> 2h bucket
    let bucketSize = 120; // Default 2 min
    if (hours === 12) bucketSize = 300;
    if (hours === 24) bucketSize = 900;
    if (hours === 48) bucketSize = 1800;
    if (hours === 168) bucketSize = 7200;

    const buckets: Record<number, { 
      sum: number; 
      count: number; 
      timestamp: number;
      wpm_sum: number;
      err_sum: number;
      clicks_sum: number;
    }> = {};

    history.forEach((h) => {
      const bucketIdx = Math.floor(h.timestamp / bucketSize) * bucketSize;
      if (!buckets[bucketIdx]) {
        buckets[bucketIdx] = { 
          sum: 0, 
          count: 0, 
          timestamp: bucketIdx,
          wpm_sum: 0,
          err_sum: 0,
          clicks_sum: 0 
        };
      }
      buckets[bucketIdx].sum += h.score;
      buckets[bucketIdx].wpm_sum += h.typing_speed_wpm || 0;
      buckets[bucketIdx].err_sum += h.error_rate || 0;
      buckets[bucketIdx].clicks_sum += h.click_count || 0;
      buckets[bucketIdx].count += 1;
    });

    return Object.values(buckets)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((b) => {
        const avgScore = b.sum / b.count;
        const avgWpm = b.wpm_sum / b.count;
        const avgErr = b.err_sum / b.count;
        
        const date = new Date(b.timestamp * 1000);
        
        let timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (hours > 24) {
          timeStr = `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeStr}`;
        }

        return {
          time: timeStr,
          timestamp: b.timestamp,
          score: avgScore,
          stress: avgScore,
          wpm: avgWpm,
          error_rate: avgErr * 100, // percentage for chart
          level: avgScore > 65 ? "STRESSED" : avgScore > 35 ? "MILD" : "NEUTRAL",
        };
      });
  };

  const chartData = getAggregatedData();

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-[#F2EFE9]">Pulse History</h1>
          <p className="text-sm text-[#857F75] mt-1.5">Your stress patterns over time</p>
        </div>
        
        
      </div>

      {error && (
        <div className="rounded-lg border border-[#dc2626]/20 bg-[#dc2626]/5 p-4 text-sm text-[#dc2626]">
          {error}
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex gap-2">
        {[6, 12, 24, 48, 168].map((h) => (
          <button
            key={h}
            onClick={() => setHours(h)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              hours === h
                ? "bg-[#5b4fc4] text-[#F2EFE9]"
                : "bg-[#141420] border border-[#1c1c2e] text-[#857F75] hover:text-[#F2EFE9] hover:bg-[#1c1c2e]"
            }`}
          >
            {h < 24 ? `${h}h` : h === 24 ? "1d" : h === 168 ? "7d" : `${h / 24}d`}
          </button>
        ))}
      </div>

      {/* Secondary Charts: Behavioral Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stress Timeline */}
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
                  <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
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
                <Area type="monotone" dataKey="stress" stroke="#5b4fc4" fill="url(#stressGrad)" strokeWidth={2} dot={hours <= 12} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Behavioral Patterns Chart */}
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm text-[#857F75] font-medium">Behavioral patterns</h3>
          </div>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-sm text-[#857F75] animate-pulse">Analyzing patterns...</div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-sm text-[#857F75]">Insufficient behavioral data</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wpmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#dc2626" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: "#857F75", fontSize: 10 }} 
                  axisLine={false} 
                  tickLine={false}
                  minTickGap={30}
                />
                <YAxis yAxisId="left" domain={[0, 'auto']} hide />
                <YAxis yAxisId="right" orientation="right" domain={[0, 'auto']} hide />
                <Tooltip
                  contentStyle={{ background: "#0a0a0f", border: "1px solid #1c1c2e", borderRadius: 8 }}
                  labelStyle={{ color: "#857F75" }}
                />
                <Area yAxisId="left" type="monotone" dataKey="wpm" stroke="#3b82f6" fill="url(#wpmGrad)" strokeWidth={2} name="WPM" />
                <Area yAxisId="right" type="monotone" dataKey="error_rate" stroke="#dc2626" fill="url(#errGrad)" strokeWidth={2} name="Error %" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#5b4fc4]" />
            <span className="text-[11px] text-[#857F75] font-medium uppercase tracking-wider">Avg stress</span>
          </div>
          <div className="text-2xl font-light text-[#F2EFE9] tabular-nums">
            {stats?.avg_score ? stats.avg_score.toFixed(1) : "--"}
          </div>
        </div>
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-[#dc2626]" />
            <span className="text-[11px] text-[#857F75] font-medium uppercase tracking-wider">High stress %</span>
          </div>
          <div className="text-2xl font-light text-[#dc2626] tabular-nums">{stats?.stressed_pct ?? 0}%</div>
        </div>
        <div className="rounded-xl border border-[#1c1c2e] bg-[#141420] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-3.5 h-3.5 text-[#22c55e]" />
            <span className="text-[11px] text-[#857F75] font-medium uppercase tracking-wider">Samples</span>
          </div>
          <div className="text-2xl font-light text-[#F2EFE9] tabular-nums">{stats?.total_samples ?? 0}</div>
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
