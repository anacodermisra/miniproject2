"""
MindPulse — Integrated Desktop Client
======================================
WakaTime-style activity tracker + stress detection in one.

Tracks:
- Active window title + app name (like WakaTime tracks files/projects)
- App categories (coding, communication, browsing, social, etc.)
- Focus time vs distracted time
- Context switching frequency
- Keyboard/mouse behavioral patterns
- Stress score from ML model

Sends data to backend via WebSocket for real-time dashboard updates.
"""

import time
import json
import threading
import subprocess
import urllib.request
import psutil
from app.ml.data_collector import BehavioralCollector
from app.ml.feature_extractor import extract_feature_dict

# ─── App Category Mapping ───

APP_CATEGORIES = {
    "code": [
        "vscode",
        "visual studio",
        "pycharm",
        "intellij",
        "cursor",
        "sublime",
        "vim",
        "neovim",
        "zed",
        "webstorm",
        "android studio",
        "xcode",
        "eclipse",
        "notepad++",
    ],
    "communication": [
        "slack",
        "discord",
        "teams",
        "zoom",
        "whatsapp",
        "telegram",
        "signal",
        "outlook",
        "gmail",
        "thunderbird",
    ],
    "browser": ["chrome", "firefox", "edge", "brave", "safari", "opera"],
    "social": [
        "twitter",
        "x.com",
        "instagram",
        "facebook",
        "reddit",
        "tiktok",
        "linkedin",
    ],
    "terminal": [
        "terminal",
        "powershell",
        "cmd",
        "windows terminal",
        "iterm",
        "alacritty",
        "wezterm",
    ],
    "media": ["spotify", "youtube", "netflix", "vlc", "itunes", "apple music"],
    "docs": [
        "word",
        "docs",
        "notion",
        "obsidian",
        "evernote",
        "onenote",
        "google docs",
    ],
    "design": ["figma", "photoshop", "illustrator", "canva", "sketch", "after effects"],
}


def _get_category(app_name: str) -> str:
    app_lower = app_name.lower()
    for category, keywords in APP_CATEGORIES.items():
        if any(kw in app_lower for kw in keywords):
            return category
    return "other"


def _get_active_window() -> dict:
    """Get the currently active window info."""
    try:
        result = subprocess.run(
            [
                "powershell",
                "-Command",
                """
                Add-Type @"
                using System;
                using System.Runtime.InteropServices;
                public class Win {
                    [DllImport("user32.dll")]
                    public static extern IntPtr GetForegroundWindow();
                    [DllImport("user32.dll")]
                    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
                    [DllImport("user32.dll")]
                    public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int processId);
                }
"@
                $hwnd = [Win]::GetForegroundWindow()
                $sb = New-Object System.Text.StringBuilder 256
                [Win]::GetWindowText($hwnd, $sb, 256) | Out-Null
                $procId = 0
                [Win]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
                $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
                $appName = if ($proc) { $proc.ProcessName } else { "unknown" }
                $title = $sb.ToString()
                Write-Output "$appName|$title"
            """,
            ],
            capture_output=True,
            text=True,
            timeout=2,
        )
        output = result.stdout.strip()
        if "|" in output:
            app_name, title = output.split("|", 1)
            return {
                "app_name": app_name.strip(),
                "window_title": title.strip()[:200],
                "category": _get_category(app_name),
                "timestamp": time.time(),
            }
    except Exception:
        pass
    return {
        "app_name": "unknown",
        "window_title": "",
        "category": "other",
        "timestamp": time.time(),
    }


class ActivityTracker:
    """Tracks app usage, focus time, and context switching like WakaTime."""

    def __init__(self):
        self.session_start = time.time()
        self.current_app = None
        self.app_durations = {}
        self.category_durations = {}
        self.context_switches = 0
        self.focus_streaks = []
        self._current_streak_start = None
        self._last_switch_time = None
        self._lock = threading.Lock()

    def update(self, window_info: dict):
        app = window_info["app_name"]
        category = window_info["category"]
        now = time.time()

        with self._lock:
            if self.current_app is not None and self.current_app != app:
                self.context_switches += 1
                self._last_switch_time = now

            self.current_app = app

            if self._last_switch_time:
                duration = now - self._last_switch_time
                self.app_durations[self.current_app] = (
                    self.app_durations.get(self.current_app, 0) + duration
                )
                cat = _get_category(self.current_app)
                self.category_durations[cat] = (
                    self.category_durations.get(cat, 0) + duration
                )
            else:
                self._last_switch_time = now

    def get_summary(self) -> dict:
        with self._lock:
            total_time = time.time() - self.session_start
            focus_apps = [
                a
                for a in self.app_durations
                if _get_category(a) in ("code", "docs", "terminal")
            ]
            focus_time = sum(self.app_durations.get(a, 0) for a in focus_apps)
            distracted_apps = [
                a for a in self.app_durations if _get_category(a) in ("social", "media")
            ]
            distracted_time = sum(self.app_durations.get(a, 0) for a in distracted_apps)

            top_apps = sorted(
                self.app_durations.items(), key=lambda x: x[1], reverse=True
            )[:10]
            top_categories = sorted(
                self.category_durations.items(), key=lambda x: x[1], reverse=True
            )

            return {
                "session_duration_sec": round(total_time, 0),
                "context_switches": self.context_switches,
                "switches_per_hour": round(
                    self.context_switches / max(total_time / 3600, 1), 1
                ),
                "focus_time_sec": round(focus_time, 0),
                "distracted_time_sec": round(distracted_time, 0),
                "focus_pct": round(focus_time / max(total_time, 1) * 100, 1),
                "top_apps": [{"app": a, "seconds": round(d, 0)} for a, d in top_apps],
                "top_categories": [
                    {"category": c, "seconds": round(d, 0)} for c, d in top_categories
                ],
                "current_app": self.current_app,
                "unique_apps": len(self.app_durations),
            }


# ─── Windows Native Toast ───

_last_notif_time = 0
NOTIF_COOLDOWN = 120


def _send_notification(title: str, body: str):
    global _last_notif_time
    now = time.time()
    if now - _last_notif_time < NOTIF_COOLDOWN:
        return
    _last_notif_time = now

    def _fire():
        try:
            import tempfile
            import os

            lines = [
                "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
                "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null",
                f"$xmlStr = \"<toast><visual><binding template='ToastGeneric'><text>{title}</text><text>{body}</text></binding></visual></toast>\"",
                "$xml = New-Object Windows.Data.Xml.Dom.XmlDocument",
                "$xml.LoadXml($xmlStr)",
                "$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
                '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("MindPulse").Show($toast)',
            ]
            ps_script = "\n".join(lines)
            tmp = os.path.join(tempfile.gettempdir(), "mindpulse_toast.ps1")
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(ps_script)
            subprocess.run(
                [
                    "powershell",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-WindowStyle",
                    "Hidden",
                    "-File",
                    tmp,
                ],
                capture_output=True,
                timeout=10,
            )
        except Exception:
            pass

    threading.Thread(target=_fire, daemon=True).start()


def run_client():
    collector = BehavioralCollector()
    collector.start()
    tracker = ActivityTracker()

    print("=" * 60)
    print("  MindPulse Desktop Client")
    print("  Tracking: keyboard, mouse, active window, app usage")
    print("  Press Ctrl+C to stop")
    print("=" * 60)

    session_start = time.time() * 1000.0
    all_keys = []
    all_mice = []
    all_ctx = []

    try:
        while True:
            time.sleep(5)

            k, m, c = collector.get_events()
            all_keys.extend(k)
            all_mice.extend(m)
            all_ctx.extend(c)

            now_ms = time.time() * 1000.0
            cutoff = now_ms - 60000

            all_keys = [e for e in all_keys if e.timestamp_press >= cutoff]
            all_mice = [e for e in all_mice if e.timestamp >= cutoff]
            all_ctx = [e for e in all_ctx if e.timestamp >= cutoff]

            window_info = _get_active_window()
            tracker.update(window_info)

            if len(all_keys) > 0 or len(all_mice) > 0:
                features_dict = extract_feature_dict(
                    all_keys,
                    all_mice,
                    all_ctx,
                    window_start_time_ms=cutoff,
                    session_start_time_ms=session_start,
                )

                payload = json.dumps(
                    {"features": features_dict, "user_id": "default"}
                ).encode("utf-8")

                req = urllib.request.Request(
                    "http://localhost:5000/api/v1/inference",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )

                try:
                    with urllib.request.urlopen(req) as response:
                        res_data = json.loads(response.read().decode("utf-8"))
                        level = res_data["level"]
                        score = res_data["score"]
                        wpm = features_dict.get("typing_speed_wpm", 0)
                        summary = tracker.get_summary()

                        print(
                            f"[{level:8s}] Score: {score:5.1f} | WPM: {wpm:5.1f} | "
                            f"App: {window_info['app_name'][:20]:20s} | "
                            f"Switches/hr: {summary['switches_per_hour']:.1f} | "
                            f"Focus: {summary['focus_pct']:.0f}%"
                        )

                        if level == "STRESSED" or score >= 75:
                            _send_notification(
                                "MindPulse — Stress Alert",
                                f"Score: {score}/100 ({level}). Take a 5-min break.",
                            )

                except Exception as e:
                    print(f"API error: {e}")
            else:
                summary = tracker.get_summary()
                print(
                    f"[IDLE    ] App: {window_info['app_name'][:20]:20s} | "
                    f"Session: {summary['session_duration_sec'] / 60:.0f}m | "
                    f"Focus: {summary['focus_pct']:.0f}%"
                )

    except KeyboardInterrupt:
        print("\nStopping client...")
        summary = tracker.get_summary()
        print(f"\nSession Summary:")
        print(f"  Duration: {summary['session_duration_sec'] / 60:.0f} minutes")
        print(
            f"  Context switches: {summary['context_switches']} ({summary['switches_per_hour']}/hr)"
        )
        print(
            f"  Focus time: {summary['focus_time_sec'] / 60:.0f} minutes ({summary['focus_pct']}%)"
        )
        print(f"  Distracted time: {summary['distracted_time_sec'] / 60:.0f} minutes")
        print(f"  Unique apps: {summary['unique_apps']}")
        if summary["top_apps"]:
            print(f"\n  Top apps:")
            for app_info in summary["top_apps"][:5]:
                print(f"    {app_info['app']}: {app_info['seconds'] / 60:.0f}m")
        collector.stop()


if __name__ == "__main__":
    run_client()
