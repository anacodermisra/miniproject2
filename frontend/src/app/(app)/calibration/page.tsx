"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { CalibrationStatus } from "@/lib/types";

export default function CalibrationPage() {
  const { userId } = useAuth();
  const [status, setStatus] = useState<CalibrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.calibration().then((s) => {
      setStatus(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Calibration</h1>
        <p className="text-sm text-muted mt-1.5">Build your personal stress baseline for accurate detection</p>
      </div>

      {/* Why Calibration */}
      <div className="rounded-lg border border-accent/20 bg-accent/[0.04] p-6">
        <h3 className="text-lg font-medium mb-3 text-white">Why calibration matters</h3>
        <p className="text-sm text-muted">
          Stress is highly individual. A "universal" model achieves only 25-40% accuracy because
          each person types differently. By building your personal baseline over 7 days, MindPulse
          learns your normal patterns and detects deviations — pushing accuracy to 55-70%.
        </p>
        <p className="text-xs text-muted mt-3">
          Source: ETH Zurich 2025 — "One does not fit all: personalised approaches show encouraging potential"
        </p>
      </div>

      {/* Calibration Progress */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-medium mb-5 text-white">Calibration progress</h3>
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="text-sm text-muted animate-pulse">Loading...</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
                const collected = i < (status?.days_collected ?? 0);
                return (
                  <div
                    key={day}
                    className={`p-3 rounded-md text-center text-sm transition-all duration-200 ${
                      collected ? "bg-neutral/15 text-neutral border border-neutral/25" : "bg-surface-hover text-muted border border-border"
                    }`}
                  >
                    <div className="text-xs font-medium">{day}</div>
                    <div className="text-lg mt-1.5">{collected ? "✓" : "○"}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-xs text-muted mb-1.5">
                <span className="font-medium">Progress</span>
                <span className="tabular-nums">{status?.completion_pct ?? 0}%</span>
              </div>
              <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-accent/80 rounded-full transition-all duration-500" style={{ width: `${status?.completion_pct ?? 0}%` }} />
              </div>
              <div className="text-xs text-muted mt-2.5 tabular-nums">
                Quality index: {(((status?.calibration_quality ?? 0) * 100)).toFixed(1)}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hourly Coverage */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-medium mb-4 text-white">Hourly coverage</h3>
        <p className="text-xs text-muted mb-4">
          MindPulse needs samples across different hours to build your circadian profile.
          Aim for at least 20 samples per hour you typically work.
        </p>
        <div className="grid grid-cols-12 gap-1.5">
          {Array.from({ length: 24 }, (_, h) => {
            const samples = status?.samples_per_hour?.[h] ?? 0;
            const opacity = Math.min(samples / 50, 1);
            return (
              <div
                key={h}
                className="p-2.5 rounded-md text-center text-xs tabular-nums font-medium transition-all duration-200 hover:scale-105"
                style={{ background: `rgba(91, 79, 196, ${opacity * 0.5})` }}
                title={`${h}:00 — ${samples} samples`}
              >
                {h}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-4 text-xs text-muted">
          <div className="w-3 h-3 rounded" style={{ background: "rgba(91,79,196,0.1)" }} />
          Few samples
          <div className="w-3 h-3 rounded" style={{ background: "rgba(91,79,196,0.5)" }} />
          Good coverage
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-medium mb-5 text-white">How to calibrate</h3>
        <ol className="space-y-4 text-sm text-muted">
          <li className="flex gap-3">
            <span className="text-accent font-bold tabular-nums">1.</span>
            <span>Use MindPulse during your normal work hours for 7 days</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold tabular-nums">2.</span>
            <span>Self-report your stress level every 30 minutes (builds ground truth)</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold tabular-nums">3.</span>
            <span>Work at least 2 hours per day with tracking enabled</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold tabular-nums">4.</span>
            <span>After 7 days, your personal model activates automatically</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
