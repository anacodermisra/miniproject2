"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { Clock, Calendar, TrendingUp, Award, Zap, Coffee } from "lucide-react";

// ─── Soft Labels ───
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ENERGY_COLORS = {
  high: "#22c55e",
  medium: "#d97706",
  low: "#dc2626",
};
const BREAK_COLORS = ["#5b4fc4", "#22c55e", "#d97706", "#3b82f6"];

// ─── Hourly Energy Bar ───
function BestHoursChart({ data }: { data: { hour: string; calm: number }[] }) {
  const hasData = data.some((d) => d.calm > 0);
  const bestHour = data.filter((d) => d.calm > 0).reduce((a, b) => (a.calm > b.calm ? a : b), data[0]);

  if (!hasData) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} style={{ color: "#5b4fc4" }} />
          <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
            Your calmest hours
          </h3>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm" style={{ color: "#857F75" }}>
            Keep using MindPulse — your focus patterns will appear here after a day or two.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Clock size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          Your calmest hours
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: "#857F75" }}>
        You&apos;re typically most calm{" "}
        <span style={{ color: "#22c55e" }}>{bestHour?.hour}</span>
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" />
          <XAxis dataKey="hour" stroke="#857F75" fontSize={12} />
          <YAxis stroke="#857F75" fontSize={12} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "#141420",
              border: "1px solid #1c1c2e",
              borderRadius: "8px",
              color: "#F2EFE9",
            }}
          />
          <Bar dataKey="calm" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.calm > 60 ? "#22c55e" : entry.calm > 40 ? "#d97706" : "#dc2626"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Day of Week Pattern ───
function DayOfWeekChart({ data }: { data: { day: string; calm: number }[] }) {
  const hasData = data.some((d) => d.calm > 0);
  const worstDay = data.filter((d) => d.calm > 0).reduce((a, b) => (a.calm < b.calm ? a : b), data[0]);
  const bestDay = data.filter((d) => d.calm > 0).reduce((a, b) => (a.calm > b.calm ? a : b), data[0]);

  if (!hasData) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} style={{ color: "#5b4fc4" }} />
          <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
            Your week pattern
          </h3>
        </div>
        <div className="h-[180px] flex items-center justify-center">
          <p className="text-sm" style={{ color: "#857F75" }}>
            More data needed — your weekly rhythm will emerge after a few days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          Your week pattern
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: "#857F75" }}>
        <span style={{ color: "#22c55e" }}>{bestDay?.day}s</span> are your calmest days ·{" "}
        <span style={{ color: "#dc2626" }}>{worstDay?.day}s</span> tend to be more stressful
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" />
          <XAxis dataKey="day" stroke="#857F75" fontSize={12} />
          <YAxis stroke="#857F75" fontSize={12} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: "#141420",
              border: "1px solid #1c1c2e",
              borderRadius: "8px",
              color: "#F2EFE9",
            }}
          />
          <Bar dataKey="calm" fill="#5b4fc4" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Break Effectiveness Donut ───
function BreakEffectivenessChart({
  data,
}: {
  data: { name: string; helped: number; total: number }[];
}) {
  const totalHelped = data.reduce((sum, d) => sum + d.helped, 0);
  const totalBreaks = data.reduce((sum, d) => sum + d.total, 0);
  const successRate = totalBreaks > 0 ? ((totalHelped / totalBreaks) * 100).toFixed(0) : "0";
  const hasData = totalBreaks > 0;

  if (!hasData) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Coffee size={18} style={{ color: "#5b4fc4" }} />
          <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
            What works for you
          </h3>
        </div>
        <div className="h-[150px] flex items-center justify-center">
          <p className="text-sm" style={{ color: "#857F75" }}>
            Take a break suggestion when it appears — we&apos;ll track what helps you recover.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Coffee size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          What works for you
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

// ─── Energy Distribution ───
function EnergyDistributionChart({
  data,
}: {
  data: { bucket: string; count: number; percentage: number }[];
}) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} style={{ color: "#5b4fc4" }} />
          <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
            Energy distribution
          </h3>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm" style={{ color: "#857F75" }}>
            Keep using MindPulse — your energy breakdown will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Zap size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          Energy distribution
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: "#857F75" }}>
        How often you land in each energy bucket
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" />
          <XAxis dataKey="bucket" stroke="#857F75" fontSize={12} />
          <YAxis stroke="#857F75" fontSize={12} />
          <Tooltip
            contentStyle={{
              background: "#141420",
              border: "1px solid #1c1c2e",
              borderRadius: "8px",
              color: "#F2EFE9",
            }}
            formatter={(value: number) => `${value}%`}
          />
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.bucket === "High"
                    ? "#22c55e"
                    : entry.bucket === "Medium"
                      ? "#d97706"
                      : "#dc2626"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-3">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{
                background:
                  d.bucket === "High"
                    ? "#22c55e"
                    : d.bucket === "Medium"
                      ? "#d97706"
                      : "#dc2626",
              }}
            />
            <span style={{ color: "#857F75" }}>
              {d.bucket}: {d.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Correlation Matrix Heatmap ───
function CorrelationMatrixHeatmap({
  metrics,
  correlations,
}: {
  metrics: string[];
  correlations: number[][];
}) {
  const hasData = correlations.some((row) => row.some((v) => !isNaN(v) && v !== 0));

  function getCellColor(value: number | null) {
    if (value === null || isNaN(value)) return "#2a2a3d";
    if (value > 0) {
      const intensity = Math.min(Math.round(value * 120), 200);
      return `rgb(34, ${100 + intensity}, 94)`;
    }
    if (value < 0) {
      const intensity = Math.min(Math.round(Math.abs(value) * 120), 200);
      return `rgb(${180 + intensity}, 60, 60)`;
    }
    return "#2a2a3d";
  }

  function getTextColor(value: number | null) {
    if (value === null || isNaN(value)) return "#857F75";
    return "#F2EFE9";
  }

  if (!hasData) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} style={{ color: "#5b4fc4" }} />
          <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
            Metric correlations
          </h3>
        </div>
        <div className="h-[250px] flex items-center justify-center">
          <p className="text-sm" style={{ color: "#857F75" }}>
            More data needed — correlations will appear after a few days of tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          Metric correlations
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: "#857F75" }}>
        How your metrics move together
      </p>
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `auto repeat(${metrics.length}, 1fr)` }}
        >
          {/* Header row */}
          <div />
          {metrics.map((m, i) => (
            <div
              key={`h-${i}`}
              className="text-xs text-center px-2 py-1"
              style={{ color: "#857F75", fontWeight: 500 }}
            >
              {m}
            </div>
          ))}
          {/* Data rows */}
          {metrics.map((rowLabel, ri) => (
            <div key={`row-${ri}`} className="contents">
              <div
                className="text-xs px-2 py-2 flex items-center"
                style={{ color: "#857F75", fontWeight: 500 }}
              >
                {rowLabel}
              </div>
              {correlations[ri].map((val, ci) => (
                <div
                  key={`c-${ri}-${ci}`}
                  className="text-xs text-center px-2 py-2 rounded"
                  style={{
                    background: getCellColor(val),
                    color: getTextColor(val),
                    minWidth: "64px",
                  }}
                >
                  {val !== null && !isNaN(val) ? val.toFixed(2) : "—"}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <span className="text-xs" style={{ color: "#857F75" }}>
          Negative
        </span>
        <div className="flex-1 h-2 rounded" style={{ background: "linear-gradient(to right, rgb(255, 60, 60), #2a2a3d, rgb(34, 220, 94))" }} />
        <span className="text-xs" style={{ color: "#857F75" }}>
          Positive
        </span>
      </div>
    </div>
  );
}

// ─── Weekly Wins ───
function WeeklyWins({ stats }: { stats: { goodDays: number; breaksHelped: number; streak: number } }) {
  const badges = [
    { icon: <Award size={20} style={{ color: "#22c55e" }} />, label: `${stats.goodDays} calm days` },
    { icon: <Zap size={20} style={{ color: "#d97706" }} />, label: `${stats.breaksHelped} breaks that helped` },
    { icon: <TrendingUp size={20} style={{ color: "#5b4fc4" }} />, label: `${stats.streak}-day streak` },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Award size={18} style={{ color: "#5b4fc4" }} />
        <h3 className="text-lg font-medium" style={{ color: "#F2EFE9" }}>
          This week&apos;s wins
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {badges.map((b, i) => (
          <div
            key={i}
            className="p-4 rounded-lg flex items-center gap-3"
            style={{ background: "#1c1c2e" }}
          >
            {b.icon}
            <span className="text-sm font-medium" style={{ color: "#F2EFE9" }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Insights Page ───
export default function InsightsPage() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hourlyData, setHourlyData] = useState<{ hour: string; calm: number }[]>([]);
  const [dayOfWeekData, setDayOfWeekData] = useState<{ day: string; calm: number }[]>([]);
  const [breakEffectiveness, setBreakEffectiveness] = useState<
    { name: string; helped: number; total: number }[]
  >([]);
  const [weeklyStats, setWeeklyStats] = useState({
    goodDays: 0,
    breaksHelped: 0,
    streak: 0,
  });
  const [energyDistribution, setEnergyDistribution] = useState<
    { bucket: string; count: number; percentage: number }[]
  >([]);
  const [correlationData, setCorrelationData] = useState<{
    metrics: string[];
    correlations: number[][];
  }>({ metrics: [], correlations: [] });

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        // Fetch history for pattern analysis
        const history = await api.history(userId, 168); // 7 days

        // Calculate hourly energy patterns
        const hourMap = new Map<number, number[]>();
        const dayMap = new Map<number, number[]>();

        history.forEach((entry) => {
          const date = new Date(entry.timestamp * 1000);
          const hour = date.getHours();
          const day = date.getDay();
          const calmIdx = 100 - entry.score;

          if (!hourMap.has(hour)) hourMap.set(hour, []);
          hourMap.get(hour)!.push(calmIdx);

          if (!dayMap.has(day)) dayMap.set(day, []);
          dayMap.get(day)!.push(calmIdx);
        });

        // Build hourly data
        const hourly = Array.from({ length: 24 }, (_, h) => {
          const values = hourMap.get(h) || [];
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
          return {
            hour: `${h}:00`,
            calm: avg !== null ? Math.round(avg) : 0,
          };
        });
        setHourlyData(hourly);

        // Build day-of-week data
        const dayOfWeek = DAY_LABELS.map((day, idx) => {
          const values = dayMap.get(idx) || [];
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
          return { day, calm: avg !== null ? Math.round(avg) : 0 };
        });
        setDayOfWeekData(dayOfWeek);

        // Fetch intervention history for break effectiveness
        const interventions = await api.interventionHistory(userId, 168).catch(() => []);

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

        interventions.forEach((event) => {
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

        // Calculate weekly stats
        const goodDays = new Set(
          history
            .filter((e) => e.score < 40)
            .map((e) => {
              const d = new Date(e.timestamp * 1000);
              return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            })
        ).size;

        const breaksHelped = interventions.filter((e) => e.action === "helped").length;

        // Simple streak calculation (consecutive days with good energy)
        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 7; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() - i);
          const dateStr = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
          const hasGoodDay = history.some((e) => {
            const d = new Date(e.timestamp * 1000);
            return (
              `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === dateStr &&
              e.score < 40
            );
          });
          if (hasGoodDay) streak++;
          else break;
        }

        setWeeklyStats({ goodDays, breaksHelped, streak });

        // Calculate energy distribution
        const totalEntries = history.length;
        let lowCount = 0;
        let medCount = 0;
        let highCount = 0;
        history.forEach((entry) => {
          const energy = 100 - entry.score;
          if (energy <= 33) lowCount++;
          else if (energy <= 66) medCount++;
          else highCount++;
        });
        setEnergyDistribution([
          { bucket: "Low", count: lowCount, percentage: totalEntries > 0 ? Math.round((lowCount / totalEntries) * 100) : 0 },
          { bucket: "Medium", count: medCount, percentage: totalEntries > 0 ? Math.round((medCount / totalEntries) * 100) : 0 },
          { bucket: "High", count: highCount, percentage: totalEntries > 0 ? Math.round((highCount / totalEntries) * 100) : 0 },
        ]);

        // Calculate correlation matrix
        const metricKeys = [
          { label: "Energy", getValue: (e: any) => 100 - e.score },
          { label: "WPM", getValue: (e: any) => e.typing_speed_wpm },
          { label: "Error Rate", getValue: (e: any) => e.error_rate },
          { label: "Rage Clicks", getValue: (e: any) => e.rage_click_count },
          { label: "Mouse Speed", getValue: (e: any) => e.mouse_speed_mean },
        ];

        function pearson(x: number[], y: number[]): number | null {
          const n = x.length;
          if (n < 2) return null;
          const meanX = x.reduce((a, b) => a + b, 0) / n;
          const meanY = y.reduce((a, b) => a + b, 0) / n;
          let num = 0, denX = 0, denY = 0;
          for (let i = 0; i < n; i++) {
            const dx = x[i] - meanX;
            const dy = y[i] - meanY;
            num += dx * dy;
            denX += dx * dx;
            denY += dy * dy;
          }
          const den = Math.sqrt(denX * denY);
          if (den === 0) return null;
          return num / den;
        }

        const series = metricKeys.map((m) =>
          history.map((e) => m.getValue(e)).filter((v) => v !== null && !isNaN(v))
        );

        // Align lengths by using minimum length
        const minLen = Math.min(...series.map((s) => s.length));
        const aligned = series.map((s) => s.slice(0, minLen));

        const corrMatrix: number[][] = [];
        for (let i = 0; i < aligned.length; i++) {
          const row: number[] = [];
          for (let j = 0; j < aligned.length; j++) {
            row.push(i === j ? 1 : pearson(aligned[i], aligned[j]) ?? 0);
          }
          corrMatrix.push(row);
        }

        setCorrelationData({
          metrics: metricKeys.map((m) => m.label),
          correlations: corrMatrix,
        });
      } catch (error) {
        console.error("Failed to fetch insights:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [userId]);

  if (loading) {
    return (
      <div className="p-8 space-y-8 max-w-6xl mx-auto" style={{ background: "#0a0a0f", minHeight: "100vh" }}>
        <div className="h-40 flex items-center justify-center">
          <div className="text-sm animate-pulse" style={{ color: "#857F75" }}>
            Analyzing your patterns...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto" style={{ background: "#0a0a0f", minHeight: "100vh" }}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "#F2EFE9" }}>
          Your Patterns
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "#857F75" }}>
          Personal insights based on your unique rhythm
        </p>
      </div>

      {/* Weekly Wins */}
      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <WeeklyWins stats={weeklyStats} />
      </div>

      {/* Best Hours + Day Pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
          <BestHoursChart data={hourlyData} />
        </div>
        <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
          <DayOfWeekChart data={dayOfWeekData} />
        </div>
      </div>

      {/* Break Effectiveness */}
      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <BreakEffectivenessChart data={breakEffectiveness} />
      </div>

      {/* Energy Distribution */}
      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <EnergyDistributionChart data={energyDistribution} />
      </div>

      {/* Correlation Matrix */}
      <div className="rounded-lg p-6" style={{ background: "#141420", border: "1px solid #1c1c2e" }}>
        <CorrelationMatrixHeatmap metrics={correlationData.metrics} correlations={correlationData.correlations} />
      </div>
    </div>
  );
}
