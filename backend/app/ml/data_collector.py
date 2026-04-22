"""
MindPulse — Data Collection Layer
=================================
Privacy-first behavioral data collector.

Key improvements in this revision:
1) Correct, robust keystroke press-release pairing (per physical key instance)
2) Thread-safe event buffers and key state map
3) Better listener lifecycle handling (start/stop idempotent + graceful)
4) Optional stale key cleanup to avoid memory growth
5) Cross-platform-safe active window fallback behavior

This module captures ONLY metadata:
- Keyboard timing + key category (never actual typed content)
- Mouse movement/click/scroll metadata
- App-switch category hash (never app names in clear text)
"""

from __future__ import annotations

import ctypes
import hashlib
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, List, Optional, Tuple

import psutil
try:
    from pynput import keyboard, mouse
    _PYNPUT_AVAILABLE = True
except Exception:  # pragma: no cover - platform-dependent import
    keyboard = None  # type: ignore[assignment]
    mouse = None  # type: ignore[assignment]
    _PYNPUT_AVAILABLE = False

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────
# Event Data Classes (Privacy-Safe)
# ────────────────────────────────────────────────────────────────


@dataclass
class KeyEvent:
    timestamp_press: float
    timestamp_release: float
    key_category: str


@dataclass
class MouseEvent:
    timestamp: float
    x: int
    y: int
    event_type: str  # 'move' | 'click' | 'scroll'
    click_type: Optional[str] = None
    scroll_delta: Optional[int] = None
    reentry_after_idle: bool = False
    reentry_after_context_switch: bool = False


@dataclass
class ContextEvent:
    timestamp: float
    event_type: str  # 'app_switch'
    category_hash: str


# ────────────────────────────────────────────────────────────────
# Active Window Tracker (Windows-focused, safe fallback elsewhere)
# ────────────────────────────────────────────────────────────────


def get_active_window_category() -> str:
    """
    Returns a privacy-safe hash derived from foreground process name.
    Never returns raw process names.
    """
    try:
        # Windows API path
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        pid = ctypes.c_ulong()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value > 0:
            proc = psutil.Process(pid.value)
            return hashlib.sha256(proc.name().encode("utf-8")).hexdigest()[:16]
    except Exception:
        # Non-Windows or restricted environment
        pass
    return "unknown"


# ────────────────────────────────────────────────────────────────
# Collector
# ────────────────────────────────────────────────────────────────


class BehavioralCollector:
    """
    Real-time keyboard/mouse/context collector.

    Robust press-release pairing strategy:
    - We use a normalized physical key-id as the dictionary key.
    - Press stores timestamp by key-id.
    - Release looks up same key-id and emits KeyEvent.
    - This avoids incorrect matching when multiple keys share same category.

    Thread-safety:
    - Event buffers and pending key map are guarded by a lock.
    """

    def __init__(
        self,
        buffer_size: int = 10000,
        mouse_move_downsample: int = 5,
        max_key_hold_ms: int = 15000,
    ):
        self.key_buffer: Deque[KeyEvent] = deque(maxlen=buffer_size)
        self.mouse_buffer: Deque[MouseEvent] = deque(maxlen=buffer_size)
        self.context_buffer: Deque[ContextEvent] = deque(maxlen=buffer_size)

        # key_id -> (category, ts_press_ms)
        self._pending_presses: Dict[str, Tuple[str, float]] = {}

        self._last_context: str = ""
        self._mouse_sample_counter: int = 0
        self._mouse_move_downsample = max(1, int(mouse_move_downsample))
        self._max_key_hold_ms = float(max_key_hold_ms)
        self._mouse_idle_reentry_ms = 3000.0
        self._last_mouse_event_ts: Optional[float] = None
        self._last_context_switch_ts: Optional[float] = None
        self._pending_context_mouse_reentry = False

        self._kb_listener = None
        self._mouse_listener = None
        self._running = False
        self._lock = threading.RLock()

        # Optional cleanup thread to avoid stale key entries
        self._cleanup_thread = None
        self._cleanup_stop = threading.Event()

    # ────────────────────────────────────────────────────────────
    # Key helpers
    # ────────────────────────────────────────────────────────────

    def _normalize_key_id(self, key) -> str:
        """
        Build stable identifier for a physical key event source.
        We never store the typed content; this id is only for pairing.
        """
        try:
            # KeyCode (alphanumeric/symbol)
            if hasattr(key, "vk") and key.vk is not None:
                return f"vk:{int(key.vk)}"
        except Exception:
            pass

        try:
            # Special keys (Key.space, Key.enter, etc.)
            if keyboard is not None and isinstance(key, keyboard.Key):
                return f"key:{key.name}"
        except Exception:
            pass

        # Fallback (opaque string from pynput)
        return f"raw:{str(key)}"

    def _categorize_key(self, key) -> str:
        """
        Category only — never save actual key char.
        """
        try:
            if keyboard is not None and key == keyboard.Key.backspace:
                return "backspace"
            if keyboard is not None and key == keyboard.Key.space:
                return "special"

            if hasattr(key, "char") and key.char:
                ch = key.char
                if ch.isalpha():
                    return "alpha"
                if ch.isdigit():
                    return "digit"
                return "special"

            return "modifier"
        except Exception:
            return "modifier"

    # ────────────────────────────────────────────────────────────
    # Keyboard callbacks
    # ────────────────────────────────────────────────────────────

    def _on_key_press(self, key):
        ts = time.time() * 1000.0
        key_id = self._normalize_key_id(key)
        category = self._categorize_key(key)

        with self._lock:
            # Avoid replacing an existing pending press from key auto-repeat.
            # If already pending, keep the original press timestamp.
            if key_id not in self._pending_presses:
                self._pending_presses[key_id] = (category, ts)

        self._check_context_switch()

    def _on_key_release(self, key):
        ts_release = time.time() * 1000.0
        key_id = self._normalize_key_id(key)

        with self._lock:
            pending = self._pending_presses.pop(key_id, None)

            if pending is None:
                # Unmatched release can happen after focus changes or missed press.
                return

            category, ts_press = pending
            hold_ms = ts_release - ts_press

            # Basic sanity filter to reduce artifacts
            if hold_ms < 1 or hold_ms > self._max_key_hold_ms:
                return

            self.key_buffer.append(
                KeyEvent(
                    timestamp_press=ts_press,
                    timestamp_release=ts_release,
                    key_category=category,
                )
            )

    # ────────────────────────────────────────────────────────────
    # Mouse callbacks
    # ────────────────────────────────────────────────────────────

    def _on_mouse_move(self, x: int, y: int):
        ts = time.time() * 1000.0
        is_idle_reentry, is_ctx_reentry = self._consume_mouse_reentry_flags(ts)
        with self._lock:
            self._mouse_sample_counter += 1
            if self._mouse_sample_counter % self._mouse_move_downsample != 0:
                return
            self.mouse_buffer.append(
                MouseEvent(
                    timestamp=ts,
                    x=int(x),
                    y=int(y),
                    event_type="move",
                    reentry_after_idle=is_idle_reentry,
                    reentry_after_context_switch=is_ctx_reentry,
                )
            )

    def _on_mouse_click(self, x: int, y: int, button, pressed: bool):
        if not pressed:
            return

        ts = time.time() * 1000.0
        is_idle_reentry, is_ctx_reentry = self._consume_mouse_reentry_flags(ts)
        click_type = str(button).split(".")[-1] if button is not None else "unknown"
        with self._lock:
            self.mouse_buffer.append(
                MouseEvent(
                    timestamp=ts,
                    x=int(x),
                    y=int(y),
                    event_type="click",
                    click_type=click_type,
                    reentry_after_idle=is_idle_reentry,
                    reentry_after_context_switch=is_ctx_reentry,
                )
            )
        self._check_context_switch()

    def _on_mouse_scroll(self, x: int, y: int, dx: int, dy: int):
        ts = time.time() * 1000.0
        is_idle_reentry, is_ctx_reentry = self._consume_mouse_reentry_flags(ts)
        with self._lock:
            self.mouse_buffer.append(
                MouseEvent(
                    timestamp=ts,
                    x=int(x),
                    y=int(y),
                    event_type="scroll",
                    scroll_delta=int(dy),
                    reentry_after_idle=is_idle_reentry,
                    reentry_after_context_switch=is_ctx_reentry,
                )
            )

    # ────────────────────────────────────────────────────────────
    # Context switching
    # ────────────────────────────────────────────────────────────

    def _check_context_switch(self):
        current = get_active_window_category()
        if current == "unknown":
            return

        with self._lock:
            if current != self._last_context:
                self._last_context_switch_ts = time.time() * 1000.0
                self._pending_context_mouse_reentry = True
                self.context_buffer.append(
                    ContextEvent(
                        timestamp=time.time() * 1000.0,
                        event_type="app_switch",
                        category_hash=current,
                    )
                )
                self._last_context = current

    def _consume_mouse_reentry_flags(self, ts: float) -> Tuple[bool, bool]:
        """
        Return and clear current mouse re-entry flags as:
        (reentry_after_idle, reentry_after_context_switch).
        """
        with self._lock:
            idle_reentry = False
            if self._last_mouse_event_ts is not None:
                idle_reentry = (ts - self._last_mouse_event_ts) >= self._mouse_idle_reentry_ms

            ctx_reentry = bool(self._pending_context_mouse_reentry)
            self._pending_context_mouse_reentry = False
            self._last_mouse_event_ts = ts

        return idle_reentry, ctx_reentry

    # ────────────────────────────────────────────────────────────
    # Cleanup loop (stale pending presses)
    # ────────────────────────────────────────────────────────────

    def _cleanup_stale_keys_loop(self):
        """
        Periodically remove stale press entries that never got release event.
        Prevents growth if OS drops release callbacks.
        """
        while not self._cleanup_stop.is_set():
            now = time.time() * 1000.0
            cutoff = now - self._max_key_hold_ms
            with self._lock:
                stale = [
                    key_id
                    for key_id, (_, ts_press) in self._pending_presses.items()
                    if ts_press < cutoff
                ]
                for key_id in stale:
                    self._pending_presses.pop(key_id, None)
            self._cleanup_stop.wait(1.0)

    # ────────────────────────────────────────────────────────────
    # Lifecycle
    # ────────────────────────────────────────────────────────────

    def start(self):
        with self._lock:
            if self._running:
                return
            if not _PYNPUT_AVAILABLE:
                logger.warning(
                    "Global input listeners unavailable on this platform; running without keyboard/mouse capture."
                )
                return
            self._running = True
            self._cleanup_stop.clear()

        self._kb_listener = keyboard.Listener(
            on_press=self._on_key_press,
            on_release=self._on_key_release,
        )
        self._mouse_listener = mouse.Listener(
            on_move=self._on_mouse_move,
            on_click=self._on_mouse_click,
            on_scroll=self._on_mouse_scroll,
        )

        self._kb_listener.start()
        self._mouse_listener.start()

        self._cleanup_thread = threading.Thread(
            target=self._cleanup_stale_keys_loop,
            daemon=True,
            name="mindpulse-key-cleanup",
        )
        self._cleanup_thread.start()

    def stop(self):
        with self._lock:
            if not self._running:
                return
            self._running = False

        self._cleanup_stop.set()

        # Stop listeners safely
        if self._kb_listener is not None:
            try:
                self._kb_listener.stop()
            except Exception:
                pass
            self._kb_listener = None

        if self._mouse_listener is not None:
            try:
                self._mouse_listener.stop()
            except Exception:
                pass
            self._mouse_listener = None

        # Optional short join for cleanup thread
        if self._cleanup_thread is not None:
            self._cleanup_thread.join(timeout=1.0)
            self._cleanup_thread = None

        # Clear orphan presses on stop
        with self._lock:
            self._pending_presses.clear()

    # ────────────────────────────────────────────────────────────
    # Data retrieval
    # ────────────────────────────────────────────────────────────

    def get_events(self) -> Tuple[List[KeyEvent], List[MouseEvent], List[ContextEvent]]:
        """
        Drain and return buffered events since last call.
        """
        with self._lock:
            keys = list(self.key_buffer)
            mice = list(self.mouse_buffer)
            contexts = list(self.context_buffer)
            self.key_buffer.clear()
            self.mouse_buffer.clear()
            self.context_buffer.clear()
        return keys, mice, contexts

    @property
    def is_running(self) -> bool:
        with self._lock:
            return self._running


# ────────────────────────────────────────────────────────────────
# Quick self-test
# ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 58)
    print("MindPulse Data Collector — Robust Pairing Self Test")
    print("=" * 58)
    print("Recording for 10 seconds... type and move mouse.")
    print("(Only timing metadata is captured, never typed content.)\n")

    collector = BehavioralCollector()
    collector.start()

    time.sleep(10)

    keys, mice, contexts = collector.get_events()
    collector.stop()

    print("Results:")
    print(f"  Key events captured:   {len(keys)}")
    print(f"  Mouse events captured: {len(mice)}")
    print(f"  Context switches:      {len(contexts)}")

    if keys:
        sample = keys[0]
        hold_ms = sample.timestamp_release - sample.timestamp_press
        print("\nSample key event:")
        print(f"  Category:  {sample.key_category}")
        print(f"  Hold time: {hold_ms:.1f} ms")

    print("\n✅ Collector self-test complete.")
