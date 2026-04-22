"""
MindPulse — Integrated Desktop Client
======================================
WakaTime-style activity tracker + stress detection in one.

Tracks:
- Active window title + app name
- App categories (coding, communication, browsing, social, etc.)
- Focus time vs distracted time
- Keyboard/mouse behavioral patterns
- Stress score from ML model

Sends data to backend for real-time dashboard updates and system notifications.
"""

import time
import json
import threading
import subprocess
import urllib.request
import os
import sys
from collections import deque

# ─── Configuration ───
API_BASE_URL = os.getenv("MINDPULSE_API_URL", "http://localhost:5000/api/v1")
WINDOW_SECONDS = 10
NOTIF_COOLDOWN = 120 # 2-minute pause between alerts to avoid distraction

# Attempt to import dependencies
try:
    from backend.app.ml.data_collector import BehavioralCollector
    from backend.app.ml.feature_extractor import extract_feature_dict
except ImportError:
    # If run from root, we might need to add current dir to path or use backend prefix
    sys.path.append(os.getcwd())
    try:
        from backend.app.ml.data_collector import BehavioralCollector
        from backend.app.ml.feature_extractor import extract_feature_dict
    except ImportError:
        print("❌ Error: Could not load MindPulse data collector components.")
        print("Ensure you are running this from the project root directory.")
        sys.exit(1)

# ─── App Category Mapping ───

APP_CATEGORIES = {
    "code": ["vscode", "visual studio", "pycharm", "intellij", "cursor", "sublime", "vim", "zed", "antigravity", "python", "github"],
    "communication": ["slack", "discord", "teams", "zoom", "whatsapp", "telegram", "outlook", "gmail", "meet"],
    "browser": ["chrome", "firefox", "edge", "brave", "safari"],
    "social": ["twitter", "x.com", "instagram", "facebook", "reddit", "tiktok", "linkedin"],
    "terminal": ["terminal", "powershell", "cmd", "windows terminal", "iterm", "bash", "zsh"],
    "media": ["spotify", "youtube", "netflix", "vlc"],
    "docs": ["word", "excel", "pptx", "docs", "notion", "obsidian", "google docs"],
    "design": ["figma", "photoshop", "illustrator", "canva"],
}

def _get_category(app_name: str) -> str:
    app_lower = app_name.lower()
    for category, keywords in APP_CATEGORIES.items():
        if any(kw in app_lower for kw in keywords):
            return category
    return "other"

def _get_active_window() -> dict:
    """Get the currently active window info (Windows specific)."""
    try:
        if sys.platform != "win32":
            return {"app_name": "unknown", "window_title": "", "category": "other", "timestamp": time.time()}
            
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
    return {"app_name": "unknown", "window_title": "", "category": "other", "timestamp": time.time()}

class ActivityTracker:
    def __init__(self):
        self.session_start = time.time()
        self.current_app = None
        self.app_durations = {}
        self.category_durations = {}
        self.context_switches = 0
        self._last_switch_time = time.time()
        self._lock = threading.Lock()

    def update(self, window_info: dict):
        app = window_info["app_name"]
        cat = window_info["category"]
        now = time.time()

        with self._lock:
            # First run setup
            if self.current_app is None:
                self.current_app = app
                self._last_switch_time = now
                return

            duration = now - self._last_switch_time
            if duration > 0:
                self.app_durations[self.current_app] = self.app_durations.get(self.current_app, 0) + duration
                self.category_durations[cat] = self.category_durations.get(cat, 0) + duration
            
            if self.current_app != app:
                self.context_switches += 1
                self.current_app = app
            
            self._last_switch_time = now

    def get_summary(self) -> dict:
        with self._lock:
            total_time = time.time() - self.session_start
            focus_apps = [a for a in self.app_durations if _get_category(a) in ("code", "docs", "terminal")]
            focus_time = sum(self.app_durations.get(a, 0) for a in focus_apps)
            
            return {
                "duration_min": round(total_time / 60, 1),
                "switches": self.context_switches,
                "focus_pct": round(focus_time / max(total_time, 1) * 100, 1),
                "current_app": self.current_app
            }

# ─── Notifications ───
_last_notif_time = 0

def _send_notification(title: str, body: str):
    global _last_notif_time
    now = time.time()
    if now - _last_notif_time < NOTIF_COOLDOWN:
        return
    _last_notif_time = now
    
    url = "http://localhost:3000"
    print(f"🔔 [ALERT] Sending system notification: {title}...")

    def _fire():
        try:
            # Enhanced PowerShell Toast with Protocol Activation (opens browser on click)
            ps_cmd = f"""
            $ErrorActionPreference = 'Stop'
            [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
            [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
            
            $xml = [Windows.Data.Xml.Dom.XmlDocument]::new()
            $template = "<toast launch='{url}' activationType='protocol'><visual><binding template='ToastGeneric'><text>{title}</text><text>{body}</text><text>Click to open MindPulse Dashboard</text></binding></visual></toast>"
            $xml.LoadXml($template)
            
            $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
            [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('MindPulse').Show($toast)
            """
            result = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True)
            if result.returncode != 0:
                print(f"⚠️ PowerShell notification failed: {result.stderr}")
                # Fallback to simple alert box
                fallback_cmd = f"mshta javascript:alert('{title}\\n\\n{body}');close()"
                subprocess.run(fallback_cmd, shell=True)
        except Exception as e:
            print(f"⚠️ Notification Error: {e}")
            
    threading.Thread(target=_fire, daemon=True).start()

def run_monitor():
    print("Enter your MindPulse Username (used on the website):")
    user_id = input("> ").strip() or "default"
    
    collector = BehavioralCollector()
    collector.start()
    tracker = ActivityTracker()
    session_start_ms = time.time() * 1000.0
    
    # Rolling buffers for stability (2 minutes of context)
    BUFFER_SIZE_MIN = 2 
    MAX_EVENTS = (BUFFER_SIZE_MIN * 60) // WINDOW_SECONDS
    key_history = deque(maxlen=2000) # Past keystrokes
    mouse_history = deque(maxlen=5000) # Past mouse events
    context_history = deque(maxlen=100)

    # Reset session on startup to ensure a Neutral start (25%)
    try:
        reset_payload = json.dumps({"user_id": user_id}).encode("utf-8")
        reset_req = urllib.request.Request(
            f"{API_BASE_URL}/reset",
            data=reset_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(reset_req, timeout=2) as _:
            pass
    except Exception:
        pass

    try:
        while True:
            time.sleep(WINDOW_SECONDS)
            
            # 1. Get behavioral events and add to rolling history
            new_keys, new_mice, new_ctx = collector.get_events()
            key_history.extend(new_keys)
            mouse_history.extend(new_mice)
            context_history.extend(new_ctx)
            
            window_info = _get_active_window()
            tracker.update(window_info)
            
            # 2. Extract features using the ROLLING buffer for stability
            if len(key_history) > 5 or len(mouse_history) > 20:
                now_ms = time.time() * 1000.0
                # Use a larger window for the model (e.g. 120s) even if we update every 10s
                inference_window_ms = 120 * 1000 
                cutoff_ms = now_ms - inference_window_ms
                
                # Filter history for current window
                current_keys = [k for k in key_history if k.timestamp_press > cutoff_ms]
                current_mice = [m for m in mouse_history if m.timestamp > cutoff_ms]
                current_ctx = [c for c in context_history if c.timestamp > cutoff_ms]

                features = extract_feature_dict(
                    current_keys, current_mice, current_ctx,
                    window_start_time_ms=cutoff_ms,
                    session_start_time_ms=session_start_ms
                )
                
                # 3. API Call
                try:
                    payload = json.dumps({"features": features, "user_id": user_id}).encode("utf-8")
                    req = urllib.request.Request(
                        f"{API_BASE_URL}/inference",
                        data=payload,
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=5) as response:
                        res = json.loads(response.read().decode("utf-8"))
                        level = res["level"]
                        score = res["score"]
                        summary = tracker.get_summary()
                        
                        status_icon = "🟢" if level == "NEUTRAL" else "🟡" if level == "MILD" else "🔴"
                        print(f"{status_icon} [{level:9}] Score: {score:4.1f}% | App: {window_info['app_name'][:15]:15} | Focus: {summary['focus_pct']}%")
                        
                        # 4. Personalized Notifications
                        # We use 55% as the default 'Mild' threshold as requested
                        if score >= 80 or level == "STRESSED":
                            _send_notification(
                                "MindPulse: High Stress Alert",
                                f"Stress score is {score:.0f}%. High tension detected — consider a 2-minute reset."
                            )
                        elif score >= 55 or level == "MILD":
                            _send_notification(
                                "MindPulse: Mild Stress",
                                f"Score: {score:.0f}%. Subtle stress patterns detected. Just a heads up!"
                            )
                except Exception as e:
                    print(f"⚠️ API Error: {e}")
            else:
                summary = tracker.get_summary()
                print(f"😴 [IDLE     ] App: {window_info['app_name'][:15]:15} | Session: {summary['duration_min']}m")

    except KeyboardInterrupt:
        print("\nStopping monitor...")
        collector.stop()
        summary = tracker.get_summary()
        print(f"\nFinal Summary:")
        print(f"  Duration: {summary['duration_min']} minutes")
        print(f"  Focus: {summary['focus_pct']}%")
        print(f"  App Switches: {summary['switches']}")

if __name__ == "__main__":
    run_monitor()
