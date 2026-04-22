"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import type { HistoryPoint } from "@/lib/types";

interface TimelineChartProps {
  data: HistoryPoint[];
  height?: number;
}

export function TimelineChart({ data, height = 280 }: TimelineChartProps) {
  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    score: d.score,
  }));

  return (
    <div className="w-full rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm text-muted mb-3">Stress Timeline (Live)</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6C5CE7" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6C5CE7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fill: "#a0a0b0", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: "#a0a0b0", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip
            contentStyle={{ background: "#1E1E2E", border: "1px solid #3A3A4A", borderRadius: 8 }}
            labelStyle={{ color: "#a0a0b0" }}
          />
          <ReferenceLine y={40} stroke="#2ecc71" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={70} stroke="#e74c3c" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#6C5CE7"
            fill="url(#stressGrad)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
