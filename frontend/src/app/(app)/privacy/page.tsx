"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export default function PrivacyPage() {
  const { userId } = useAuth();
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const handlePause = async () => {
    setActionStatus("pause");
    try {
      await api.reset(userId);
      setActionStatus("paused");
    } catch {
      setActionStatus("error");
    }
  };

  const handleExport = async () => {
    setActionStatus("export");
    try {
      const history = await api.history(userId, 168);
      const csv = [
        "timestamp,score,level,typing_speed_wpm,error_rate",
        ...history.map((h) => `${h.timestamp},${h.score},${h.level},${h.typing_speed_wpm},${h.error_rate}`),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mindpulse-data-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setActionStatus("exported");
    } catch {
      setActionStatus("error");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete all your data? This cannot be undone.")) return;
    setActionStatus("delete");
    try {
      await api.reset(userId);
      setActionStatus("deleted");
    } catch {
      setActionStatus("error");
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy and data</h1>
        <p className="text-sm text-muted mt-1.5">What MindPulse captures and what it never does</p>
      </div>

      {/* What We Capture */}
      <div className="rounded-lg border border-neutral/20 bg-neutral/[0.04] p-6">
        <h3 className="text-lg font-medium text-neutral mb-5">What we capture</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Keyboard", items: ["Key press/release timestamps", "Key category (alpha/digit/special)", "Hold time, flight time", "Backspace count (not content)"] },
            { title: "Mouse", items: ["Movement speed and direction", "Click timestamps", "Scroll velocity", "Quick click detection"] },
            { title: "Context", items: ["App switch timestamps", "Hashed app category", "Tab switch frequency", "Session duration"] },
          ].map((cat) => (
            <div key={cat.title} className="p-4 rounded-lg bg-surface border border-border/50">
              <h4 className="font-medium mb-3 text-white">{cat.title}</h4>
              <ul className="space-y-2">
                {cat.items.map((item) => (
                  <li key={item} className="text-xs text-muted flex gap-2 items-start">
                    <span className="text-neutral text-sm leading-none mt-0.5">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* What We Never Capture */}
      <div className="rounded-lg border border-stressed/20 bg-stressed/[0.04] p-6">
        <h3 className="text-lg font-medium text-stressed mb-5">What we never capture</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["Actual keystrokes", "Typed content", "Screen content", "Page URLs", "File names", "Email content", "Chat messages", "Passwords"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-muted">
              <span className="text-stressed text-sm">✗</span> {item}
            </div>
          ))}
        </div>
      </div>

      {/* Processing */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-medium mb-5 text-white">How processing works</h3>
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {["Raw events", "Feature extraction", "Discard raw", "ML inference", "Score → Dashboard"].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="px-4 py-2.5 rounded-md bg-surface-hover text-sm whitespace-nowrap font-medium">{step}</div>
              {i < 4 && <span className="text-accent/60">→</span>}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-4">
          All processing happens locally. Raw keystrokes are never stored or transmitted.
          Only derived behavioral features are used for prediction.
        </p>
        <p className="text-xs text-muted mt-2">
          Intervention feedback stores only action/outcome metadata (helped, not helped, skipped) and score deltas.
        </p>
      </div>

      {/* Data Control */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h3 className="text-lg font-medium mb-5 text-white">Your data controls</h3>
        {actionStatus && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            actionStatus === "error" ? "bg-stressed/10 text-stressed" :
            actionStatus === "deleted" || actionStatus === "paused" || actionStatus === "exported" ? "bg-neutral/10 text-neutral" :
            "bg-accent/10 text-accent"
          }`}>
            {actionStatus === "pause" && "Pausing tracking..."}
            {actionStatus === "paused" && "Tracking paused. All data cleared."}
            {actionStatus === "export" && "Preparing your data..."}
            {actionStatus === "exported" && "Data exported as CSV."}
            {actionStatus === "delete" && "Deleting all data..."}
            {actionStatus === "deleted" && "All data deleted."}
            {actionStatus === "error" && "Something went wrong. Try again."}
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <div className="text-sm font-medium text-white">Pause tracking</div>
              <div className="text-xs text-muted mt-0.5">Temporarily stop all data collection</div>
            </div>
            <button
              onClick={handlePause}
              className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-surface-hover transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            >
              Pause
            </button>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <div className="text-sm font-medium text-white">Export my data</div>
              <div className="text-xs text-muted mt-0.5">Download all your data as CSV</div>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-surface-hover transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            >
              Export
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm font-medium text-white">Delete all data</div>
              <div className="text-xs text-muted mt-0.5">Permanently remove all stored data</div>
            </div>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-md border border-stressed/30 text-stressed text-sm font-medium hover:bg-stressed/10 transition-all duration-200 hover:scale-[0.98] active:scale-[0.96]"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
