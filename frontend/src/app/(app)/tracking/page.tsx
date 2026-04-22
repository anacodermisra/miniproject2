"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useStressStream } from "@/hooks/use-stress-stream";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { BreathingReset } from "@/components/breathing-reset";
import type { UserStats, InterventionRecommendation, StressResult } from "@/lib/types";

const SOFT_LEVEL: Record<string, string> = {
  STRESSED: "High Stress",
  MILD: "Dipping",
  NEUTRAL: "Feeling Calm",
  UNKNOWN: "—",
};

function energyFromStress(score: number) {
  return score;
}

// ─── SVG Semi-circle Gauge ───
function StressGauge({ score, level }: { score: number; level: string }) {
  const stress = score;
  const softLevel = SOFT_LEVEL[level] ?? level;

  const gradientId =
    level === "NEUTRAL"
      ? "grad-good"
      : level === "MILD"
        ? "grad-dipping"
        : "grad-low";

  const arcR = 90;
  const cx = 130;
  const cy = 120;
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalArc = Math.PI * arcR;

  const fraction = Math.max(0, Math.min(1, stress / 100));
  const dashOffset = totalArc * (1 - fraction);

  return (
    <div className="flex flex-col items-center">
      <svg width="260" height="155" viewBox="0 0 260 160">
        <defs>
          <filter id="arc-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="grad-good" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#5b4fc4" />
          </linearGradient>
          <linearGradient id="grad-dipping" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#5b4fc4" />
          </linearGradient>
          <linearGradient id="grad-low" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#5b4fc4" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`}
          fill="none"
          stroke="#1c1c2e"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={totalArc}
          strokeDashoffset={dashOffset}
          filter="url(#arc-glow)"
          style={{
            transition:
              "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease",
          }}
        >
          <animate
            attributeName="stroke-dashoffset"
            values={`${dashOffset - 4};${dashOffset + 4};${dashOffset - 4}`}
            dur="3s"
            repeatCount="indefinite"
          />
        </path>
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          fill="#F2EFE9"
          fontSize="44"
          fontWeight="700"
          fontFamily="Geist, system-ui, sans-serif"
        >
          {Math.round(stress)}
        </text>
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          fill="#857F75"
          fontSize="12"
          fontFamily="Geist, system-ui, sans-serif"
        >
          / 100
        </text>
      </svg>
      <span
        className="text-sm font-semibold tracking-wide mt-1"
        style={{
          color:
            level === "NEUTRAL"
              ? "#22c55e"
              : level === "MILD"
                ? "#d97706"
                : "#dc2626",
        }}
      >
        {softLevel}
      </span>
    </div>
  );
}

// ─── Metric Tile ───
function Metric({
  label,
  value,
  unit,
  warn,
}: {
  label: string;
  value: string | number;
  unit?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4 transition-all duration-200 hover:shadow-[0_0_16px_rgba(91,79,196,0.12)] whimsy-glow"
      style={{ background: "#141420", borderColor: "#1c1c2e" }}
    >
      <div
        className="text-[11px] uppercase tracking-wide mb-1.5 font-medium"
        style={{ color: "#857F75" }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-semibold tabular-nums"
          style={{ color: warn ? "#dc2626" : "#F2EFE9" }}
        >
          {value}
        </span>
        {unit && <span style={{ color: "#857F75" }} className="text-sm">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Insights Panel ───
function Insights({ insights, level }: { insights: string[]; level: string }) {
  if (!insights.length) return null;
  const borderColor =
    level === "STRESSED"
      ? "#dc262640"
      : level === "MILD"
        ? "#d9770640"
        : "#22c55e40";
  const bgColor =
    level === "STRESSED"
      ? "#dc262608"
      : level === "MILD"
        ? "#d9770608"
        : "#22c55e08";
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor, background: bgColor }}
    >
      <h3 className="text-sm font-medium mb-2" style={{ color: "#F2EFE9" }}>
        What shaped this score
      </h3>
      <ul className="space-y-1.5">
        {insights.map((insight, i) => (
          <li key={i} className="text-sm flex items-start gap-2" style={{ color: "#857F75" }}>
            <span style={{ color: "#5b4fc4" }} className="mt-0.5 text-xs">•</span>
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Recommendation ───
function Recommendation({ score }: { score: number }) {
  if (score < 40) {
    return (
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "#22c55e40", background: "#22c55e08" }}
      >
        <h3 className="font-medium mb-2" style={{ color: "#22c55e" }}>
          Feeling calm — keep going
        </h3>
        <p className="text-sm" style={{ color: "#857F75" }}>
          Continue at your current pace. Take a preventive 2-min eye break every
          30-40 min.
        </p>
      </div>
    );
  }
  if (score < 70) {
    return (
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "#d9770640", background: "#d9770608" }}
      >
        <h3 className="font-medium mb-2" style={{ color: "#d97706" }}>
          Your rhythm suggests a pause
        </h3>
        <ul className="text-sm space-y-1" style={{ color: "#857F75" }}>
          <li>• 2 minutes of slow breathing</li>
          <li>• Hydrate</li>
          <li>• Reset posture and neck stretch</li>
        </ul>
      </div>
    );
  }
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "#dc262640", background: "#dc262608" }}
    >
      <h3 className="font-medium mb-2" style={{ color: "#dc2626" }}>
        Consider a reset
      </h3>
      <ol className="text-sm space-y-1 list-decimal list-inside" style={{ color: "#857F75" }}>
        <li>4 cycles of box breathing</li>
        <li>5-minute screen break</li>
        <li>Resume with one priority task only</li>
      </ol>
    </div>
  );
}

// ─── Main Page ───
export default function TrackingPage() {
  const MIN_STRESS_STREAK_FOR_ALERT = 2;
  const CRITICAL_STRESS_SCORE = 85;
  const MIN_CONFIDENCE_FOR_CRITICAL_ALERT = 0.7;
  const { userId } = useAuth();
  const { data: wsData, history: wsHistory, status, error: wsError } = useStressStream();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [polledData, setPolledData] = useState<StressResult | null>(null);
  const prevLevelRef = useRef<string>("UNKNOWN");
  const notifPermissionRef = useRef<boolean>(false);
  const stressStreakRef = useRef<number>(0);
  const [alertState, setAlertState] = useState<
    "NORMAL" | "EARLY_WARNING" | "BREAK_RECOMMENDED" | "RECOVERY"
  >("NORMAL");
  const [intervention, setIntervention] =
    useState<InterventionRecommendation | null>(null);
  const [activeIntervention, setActiveIntervention] = useState<string | null>(
    null,
  );
  const [breakSeconds, setBreakSeconds] = useState<number>(0);
  const [showBreathingReset, setShowBreathingReset] = useState(false);
  const [windDown, setWindDown] = useState<{
    type: string;
    title: string;
    message: string;
    severity: string;
    actions: { label: string; action: string }[];
  } | null>(null);
  const [windDownDismissed, setWindDownDismissed] = useState(false);

  const data = wsData || polledData;

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        notifPermissionRef.current = true;
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          notifPermissionRef.current = perm === "granted";
        });
      }
    }
  }, []);

  useEffect(() => {
    const fetchStats = () => api.stats().then(setStats).catch(() => {});
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    const pollLatest = async () => {
      try {
        const h = await api.history(0.1);
        if (h.length > 0) {
          const latest = h[h.length - 1];
          setPolledData((prev) => {
            if (!prev || latest.timestamp > prev.timestamp) {
              return {
                score: latest.score,
                level: latest.level as StressResult["level"],
                confidence: 0.5,
                probabilities: {},
                feature_contributions: {},
                insights: latest.insights,
                timestamp: latest.timestamp,
                typing_speed_wpm: 0,
                rage_click_count: 0,
                error_rate: 0,
                click_count: 0,
                mouse_speed_mean: 0,
                mouse_reentry_count: 0,
                mouse_reentry_latency_ms: 0,
                alert_state: "NORMAL" as const,
                intervention: null,
                trend: "steady" as const,
                recovery_score: 0,
              };
            }
            return prev;
          });
        }
      } catch {}
    };
    pollLatest();
    const interval = setInterval(pollLatest, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    api
      .interventionRecommendation()
      .then((res) => {
        setAlertState(res.alert_state);
        setIntervention(res.intervention);
        setActiveIntervention(res.active_intervention);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!breakSeconds) return;
    const timer = setInterval(
      () => setBreakSeconds((prev) => Math.max(0, prev - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [breakSeconds]);

  useEffect(() => {
    if (!data) return;
    if (data.alert_state) setAlertState(data.alert_state);
    if (data.intervention) setIntervention(data.intervention);

    const currentLevel = data.level;
    if (currentLevel === "STRESSED" && (data.confidence ?? 0) >= 0.7) {
      stressStreakRef.current += 1;
    } else {
      stressStreakRef.current = 0;
    }
    const shouldAlert =
      (data.alert_state === "BREAK_RECOMMENDED" &&
        stressStreakRef.current >= MIN_STRESS_STREAK_FOR_ALERT) ||
      (data.score >= CRITICAL_STRESS_SCORE &&
        data.confidence >= MIN_CONFIDENCE_FOR_CRITICAL_ALERT);
    if (shouldAlert && prevLevelRef.current !== "STRESSED") {
      if (notifPermissionRef.current) {
        new Notification("MindPulse — Stress spiking", {
          body: "A break might help. Start your guided reset in MindPulse.",
          icon: "/favicon.ico",
          tag: "mindpulse-stress",
        });
      }
    }
    prevLevelRef.current = currentLevel;
  }, [data]);

  useEffect(() => {
    const checkWindDown = () => {
      if (windDownDismissed) return;
      api
        .checkWindDown()
        .then((res) => {
          if (res.wind_down) {
            setWindDown(res.wind_down);
          }
        })
        .catch(() => {});
    };
    checkWindDown();
    const interval = setInterval(checkWindDown, 300000);
    return () => clearInterval(interval);
  }, [userId, windDownDismissed]);

  const score = data?.score ?? 0;
  const level = data?.level ?? "UNKNOWN";
  const insights = data?.insights ?? [];

  const liveWpm = data?.typing_speed_wpm ?? 0;
  const liveRageClicks = data?.rage_click_count ?? 0;
  const liveErrorRate = data?.error_rate ?? 0;

  const formatBreakTimer = (total: number) => {
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const alertBannerStyles: Record<string, { border: string; bg: string }> = {
    NORMAL: { border: "#1c1c2e", bg: "#141420" },
    EARLY_WARNING: { border: "rgba(217,119,6,0.3)", bg: "rgba(217,119,6,0.05)" },
    BREAK_RECOMMENDED: { border: "rgba(220,38,38,0.3)", bg: "rgba(220,38,38,0.05)" },
    RECOVERY: { border: "rgba(34,197,94,0.3)", bg: "rgba(34,197,94,0.05)" },
  };

  const bannerStyle = alertBannerStyles[alertState] ?? alertBannerStyles.NORMAL;

  const alertTitle =
    alertState === "BREAK_RECOMMENDED"
      ? "Stress spiking"
      : alertState === "EARLY_WARNING"
        ? "Stress building"
        : alertState === "RECOVERY"
          ? "Stress levels dropping"
          : "Stable rhythm";

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto" style={{ background: "#0a0a0f" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: "#F2EFE9" }}
          >
            Your Pulse
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "#857F75" }}>
            Live behavioral stress signals
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              await api.reset();
              setStats(null);
            }}
            className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            style={{
              borderColor: "#dc26264d",
              color: "#dc2626",
            }}
          >
            Recalibrate my baseline
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{
                background:
                  status === "connected"
                    ? "#22c55e"
                    : status === "error"
                      ? "#dc2626"
                      : "#d97706",
                animation:
                  status === "connected" ? "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" : undefined,
              }}
            />
            <span style={{ color: status === "error" ? "#dc2626" : "#857F75" }}>
              {status}
              {wsError ? `: ${wsError}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <div
        className="rounded-lg border p-5 transition-all duration-300"
        style={{ borderColor: bannerStyle.border, background: bannerStyle.bg }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium" style={{ color: "#F2EFE9" }}>
              {alertTitle}
            </h3>
            <p className="text-xs mt-1" style={{ color: "#857F75" }}>
              {data?.trend ? `Trend: ${data.trend}` : "Trend: steady"} · Confidence:{" "}
              {data ? `${(data.confidence * 100).toFixed(1)}%` : "--"}
              {data?.recovery_score
                ? ` · Recovery +${data.recovery_score.toFixed(1)}`
                : ""}
            </p>
          </div>
          <div className="text-xs" style={{ color: "#857F75" }}>
            {intervention?.expected_benefit || "No intervention needed right now"}
          </div>
        </div>
      </div>

      {/* Wind-Down Banner */}
      {windDown && !windDownDismissed && (
        <div
          className="rounded-lg border p-5 transition-all duration-300"
          style={{
            borderColor: "#5b4fc440",
            background: "linear-gradient(135deg, #141420 0%, #1a1a2e 100%)",
            boxShadow: "0 0 24px rgba(91,79,196,0.08)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">🌙</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium" style={{ color: "#F2EFE9" }}>
                {windDown.title}
              </h3>
              <p className="text-xs mt-1" style={{ color: "#857F75" }}>
                {windDown.message}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {windDown.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (action.action === "acknowledge") {
                        setWindDownDismissed(true);
                        setWindDown(null);
                      } else {
                        setWindDownDismissed(true);
                        setWindDown(null);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                    style={{
                      borderColor: idx === 0 ? "#5b4fc44d" : "#1c1c2e",
                      color: idx === 0 ? "#5b4fc4" : "#857F75",
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Active Intervention Panel */}
      {(alertState === "BREAK_RECOMMENDED" || activeIntervention) &&
        intervention && (
          <div
            className="sticky top-4 z-10 rounded-lg border p-5"
            style={{
              background: "#141420",
              borderColor: "#dc26264d",
              boxShadow: "0 0 24px rgba(220,38,38,0.08)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3
                  className="text-base font-medium"
                  style={{ color: "#dc2626" }}
                >
                  {intervention.title}
                </h3>
                <p className="text-xs mt-1" style={{ color: "#857F75" }}>
                  Duration: {intervention.duration_min} min · Severity:{" "}
                  {intervention.severity}
                </p>
              </div>
              <div
                className="text-lg font-mono tabular-nums"
                style={{ color: "#F2EFE9" }}
              >
                {breakSeconds > 0 ? formatBreakTimer(breakSeconds) : "--:--"}
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm" style={{ color: "#857F75" }}>
              {intervention.steps.map((step, idx) => (
                <li key={idx}>• {step}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await api.interventionAction(
                    "start_break",
                    intervention.intervention_type,
                  );
                  setActiveIntervention(intervention.intervention_type);
                  setBreakSeconds(intervention.duration_min * 60);
                  if (intervention.title.toLowerCase().includes("breath")) {
                    setShowBreathingReset(true);
                  }
                }}
                className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                style={{ borderColor: "#22c55e4d", color: "#22c55e" }}
              >
                Start my break
              </button>
              <button
                onClick={async () => {
                  await api.interventionAction(
                    "snooze",
                    intervention.intervention_type,
                  );
                  setActiveIntervention(null);
                }}
                className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                style={{ borderColor: "#1c1c2e", color: "#857F75" }}
              >
                Remind me later
              </button>
              <button
                onClick={async () => {
                  await api.interventionAction(
                    "im_okay",
                    intervention.intervention_type,
                  );
                  setActiveIntervention(null);
                }}
                className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                style={{ borderColor: "#1c1c2e", color: "#857F75" }}
              >
                I&apos;m okay, thanks
              </button>
              <button
                onClick={() =>
                  api.interventionAction(
                    "need_stronger_help",
                    intervention.intervention_type,
                  )
                }
                className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                style={{ borderColor: "#dc26264d", color: "#dc2626" }}
              >
                Need different help
              </button>
            </div>
            {breakSeconds === 0 && activeIntervention && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    await api.interventionAction(
                      "helped",
                      intervention.intervention_type,
                    );
                    setActiveIntervention(null);
                  }}
                  className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                  style={{ borderColor: "#22c55e4d", color: "#22c55e" }}
                >
                  That helped ✨
                </button>
                <button
                  onClick={async () => {
                    await api.interventionAction(
                      "not_helped",
                      intervention.intervention_type,
                    );
                    setActiveIntervention(null);
                  }}
                  className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                  style={{ borderColor: "#dc26264d", color: "#dc2626" }}
                >
                  Still feeling it
                </button>
                <button
                  onClick={async () => {
                    await api.interventionAction(
                      "skipped",
                      intervention.intervention_type,
                    );
                    setActiveIntervention(null);
                  }}
                  className="px-4 py-2 rounded-lg border text-xs font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
                  style={{ borderColor: "#1c1c2e", color: "#857F75" }}
                >
                  Not right now
                </button>
              </div>
            )}
          </div>
        )}

      {/* Gauge + Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="lg:col-span-1 flex flex-col items-center justify-center rounded-lg border p-6"
          style={{ background: "#141420", borderColor: "#1c1c2e" }}
        >
          <StressGauge score={score} level={level} />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Metric
            label="Typing Speed"
            value={
              liveWpm > 0
                ? liveWpm.toFixed(0)
                : (stats?.typing_speed_wpm?.toFixed(0) ?? "--")
            }
            unit="WPM"
          />
          <Metric
            label="Quick clicks"
            value={liveRageClicks > 0 ? liveRageClicks : (stats?.rage_click_count ?? 0)}
            warn={liveRageClicks > 2}
          />
          <Metric
            label="Error Rate"
            value={
              liveErrorRate > 0
                ? `${(liveErrorRate * 100).toFixed(1)}`
                : stats?.error_rate
                  ? `${(stats.error_rate * 100).toFixed(1)}`
                  : "0"
            }
            unit="%"
            warn={liveErrorRate > 0.15}
          />
          <Metric
            label="Stress spikes"
            value={stats?.stressed_pct ?? 0}
            unit="%"
            warn={(stats?.stressed_pct ?? 0) > 30}
          />
        </div>
      </div>

      {/* Stress Trend Sparkline */}
      <div
        className="rounded-lg border p-5"
        style={{ background: "#141420", borderColor: "#1c1c2e" }}
      >
        <h3 className="text-sm mb-4 font-medium" style={{ color: "#857F75" }}>
          Your stress trend (last 30 min)
        </h3>
        {wsHistory.length > 1 ? (
          <div className="h-24">
            <svg width="100%" height="100%" viewBox="0 0 600 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="stress-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#5b4fc4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#5b4fc4" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const points = wsHistory.slice(-30).map((h, i, arr) => {
                  const x = (i / (arr.length - 1)) * 600;
                  const y = 100 - (h.score / 100) * 100;
                  return { x, y };
                });
                const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                const areaPath = `${linePath} L 600 100 L 0 100 Z`;
                return (
                  <>
                    <path d={areaPath} fill="url(#stress-gradient)" />
                    <path d={linePath} fill="none" stroke="#5b4fc4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {points.length > 0 && (
                      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="#5b4fc4" />
                    )}
                  </>
                );
              })()}
            </svg>
          </div>
        ) : data && data.level !== "UNKNOWN" ? (
          <div className="h-24 flex items-center justify-center">
            <span className="text-xs" style={{ color: "#857F75" }}>
              Building trend line...
            </span>
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <span className="text-xs" style={{ color: "#857F75" }}>
              Collecting data...
            </span>
          </div>
        )}
      </div>

      {/* Insights + Recommendation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Insights insights={insights} level={level} />
        <div className="space-y-4">
          <Recommendation score={score} />
          {intervention && (
            <div
              className="rounded-lg border p-4"
              style={{ borderColor: "#5b4fc433", background: "#5b4fc408" }}
            >
              <h3 className="text-sm font-medium mb-2" style={{ color: "#F2EFE9" }}>
                AI guidance
              </h3>
              <p className="text-xs mb-2" style={{ color: "#857F75" }}>
                {intervention.expected_benefit}
              </p>
              <ul className="text-sm space-y-1" style={{ color: "#857F75" }}>
                {intervention.rationale.map((reason, idx) => (
                  <li key={idx}>• {reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      <div
        className="rounded-lg border p-5"
        style={{ background: "#141420", borderColor: "#1c1c2e" }}
      >
        <h3 className="text-sm mb-3 font-medium" style={{ color: "#857F75" }}>
          Help me learn you better
        </h3>
        <p className="text-xs mb-4" style={{ color: "#857F75" }}>
          Help improve the model by confirming or correcting predictions.
        </p>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              await api.feedback(level, level, score);
              toast.success("Thank you! Model updated.");
            }}
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            style={{ borderColor: "#22c55e4d", color: "#22c55e" }}
          >
            Spot on
          </button>
          <button
            onClick={async () => {
              await api.feedback(level, "NEUTRAL", score);
              toast.success("Got it. We'll adjust your baseline.");
            }}
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            style={{ borderColor: "#d977064d", color: "#d97706" }}
          >
            Actually Calm
          </button>
          <button
            onClick={async () => {
              await api.feedback(level, "STRESSED", score);
              toast.success("Feedback received. Retuning detection thresholds.");
            }}
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            style={{ borderColor: "#dc26264d", color: "#dc2626" }}
          >
            Actually Stressed
          </button>
        </div>
      </div>
    </div>
  );
}