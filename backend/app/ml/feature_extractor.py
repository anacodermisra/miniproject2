"""
MindPulse — Feature Extraction Engine
=======================================
Transforms raw keyboard/mouse/context events into a 23-dimensional
feature vector per sliding window. After dual normalization (global +
per-user circadian), this becomes a 46-dimensional input to the model.

With feature interactions (Issue #3), adds 5 interaction features:
  - typing_speed_wpm × error_rate (cognitive load)
  - rage_click_count × direction_change_rate (frustration)
  - session_fragmentation × tab_switch_freq (chaos)
  - pause_frequency × rhythm_entropy (break pattern)
  - mouse_speed_std × click_count (agitation)

Plus 2 reentry features = 30 total features for explainability.

Fulfills Objective 2: To collect, preprocess, and structure
stress-related datasets for model training and evaluation.

Feature Breakdown (23 raw features):
  Keyboard (11):  hold_time_mean, hold_time_std, hold_time_median,
                  flight_time_mean, flight_time_std, typing_speed_wpm,
                  error_rate, pause_frequency, pause_duration_mean,
                  burst_length_mean, rhythm_entropy
  Mouse (6):      mouse_speed_mean, mouse_speed_std, direction_change_rate,
                  click_count, rage_click_count, scroll_velocity_std
  Context (3):    tab_switch_freq, switch_entropy, session_fragmentation
  Temporal (3):   hour_of_day, day_of_week, session_duration_min

Interaction Features (5):
  - typing_speed_wpm × error_rate
  - rage_click_count × direction_change_rate
  - session_fragmentation × tab_switch_freq
  - pause_frequency × rhythm_entropy
  - mouse_speed_std × click_count

Reentry Features (2):
  - mouse_reentry_count
  - mouse_reentry_latency_ms
"""

import math
import time
import bisect
from datetime import datetime
from typing import List, Tuple

import numpy as np

# Import our event dataclasses from Phase 1
from .data_collector import ContextEvent, KeyEvent, MouseEvent

# ─── Feature Names (ordered) ──────────────────────────────────
# This order is the contract between the extractor and the model.
# Changing this order will break the trained model.

FEATURE_NAMES = [
    # Keyboard (11)
    "hold_time_mean",
    "hold_time_std",
    "hold_time_median",
    "flight_time_mean",
    "flight_time_std",
    "typing_speed_wpm",
    "error_rate",
    "pause_frequency",
    "pause_duration_mean",
    "burst_length_mean",
    "rhythm_entropy",
    # Mouse (6)
    "mouse_speed_mean",
    "mouse_speed_std",
    "direction_change_rate",
    "click_count",
    "rage_click_count",
    "scroll_velocity_std",
    # Context (3)
    "tab_switch_freq",
    "switch_entropy",
    "session_fragmentation",
    # Temporal (3)
    "hour_of_day",
    "day_of_week",
    "session_duration_min",
]

NUM_RAW_FEATURES = len(FEATURE_NAMES)  # 23

# ═══════════════════════════════════════════════════════════════
# FEATURE INTERACTIONS (Issue #3 Fix)
# Top 5 behavioral signatures that indicate stress
# ═══════════════════════════════════════════════════════════════

INTERACTION_FEATURES = [
    ("typing_speed_wpm", "error_rate"),               # Cognitive load
    ("rage_click_count", "direction_change_rate"),  # Frustration
    ("session_fragmentation", "tab_switch_freq"),     # Chaos
    ("pause_frequency", "rhythm_entropy"),            # Break pattern
    ("mouse_speed_std", "click_count"),               # Agitation
]

NUM_INTERACTION_FEATURES = len(INTERACTION_FEATURES)  # 5


# ═══════════════════════════════════════════════════════════════
# 1. KEYBOARD FEATURES (11 features)
# ═══════════════════════════════════════════════════════════════


def extract_keyboard_features(key_events: List[KeyEvent]) -> dict:
    """
    Extract 11 timing-based features from keyboard events.

    These features capture:
    - How long keys are held (hold time) → stressed users press harder/longer
    - Gaps between keystrokes (flight time) → stressed users show erratic pauses
    - Overall speed (WPM) → decreases under stress
    - Error rate (backspaces) → increases under stress
    - Rhythm entropy → chaotic timing = stress, smooth = relaxed
    """
    empty = {name: 0.0 for name in FEATURE_NAMES[:11]}

    if len(key_events) < 2:
        return empty

    # ── Raw Timings ────────────────────────────────────────
    hold_times = np.array([e.timestamp_release - e.timestamp_press for e in key_events])
    flight_times = np.array(
        [
            key_events[i + 1].timestamp_press - key_events[i].timestamp_release
            for i in range(len(key_events) - 1)
        ]
    )

    # ── Outlier Removal ────────────────────────────────────
    # Hold < 10ms = key bounce (hardware glitch)
    # Hold > 2000ms = user walked away mid-press
    # Flight < 0ms = impossible (overlapping keys are OK but negative isn't)
    # Flight > 5000ms = a pause, not actual typing
    hold_times = hold_times[(hold_times >= 10) & (hold_times <= 2000)]
    flight_times = flight_times[(flight_times >= 0) & (flight_times <= 5000)]

    if len(hold_times) == 0:
        return empty

    # ── Backspace / Error Rate ─────────────────────────────
    total_keys = len(key_events)
    backspace_count = sum(1 for e in key_events if e.key_category == "backspace")

    # ── Pause Detection ────────────────────────────────────
    # A "pause" = flight time > 2 seconds (user stopped typing)
    pauses = (
        flight_times[flight_times > 2000] if len(flight_times) > 0 else np.array([])
    )

    # ── Burst Detection ────────────────────────────────────
    # A "burst" = continuous rapid typing between pauses
    # Shorter bursts under stress (fits and starts pattern — ETH Zurich)
    bursts = []
    current_burst = 0
    for ft in flight_times:
        if ft > 2000:
            if current_burst > 0:
                bursts.append(current_burst)
            current_burst = 0
        else:
            current_burst += 1
    if current_burst > 0:
        bursts.append(current_burst)

    # ── Shannon Entropy of Inter-Key Intervals ─────────────
    # Low entropy = rhythmic, predictable → relaxed
    # High entropy = chaotic, unpredictable → stressed
    entropy = 0.0
    if len(flight_times) > 10:
        counts, _ = np.histogram(flight_times, bins=20, density=False)
        total = np.sum(counts)
        if total > 0:
            probs = counts.astype(np.float64) / float(total)
            probs = probs[probs > 0]
            entropy = float(-np.sum(probs * np.log2(probs + 1e-10)))

    # ── Words Per Minute ───────────────────────────────────
    total_time_ms = (
        float(np.sum(hold_times) + np.sum(flight_times))
        if len(flight_times) > 0
        else 1.0
    )
    wpm = (total_keys / 5.0) / (max(total_time_ms, 1.0) / 60000.0)

    # ── Pause frequency (pauses per minute of typing) ──────
    typing_minutes = max(total_time_ms / 60000.0, 0.1)

    return {
        "hold_time_mean": float(np.mean(hold_times)),
        "hold_time_std": float(np.std(hold_times)),
        "hold_time_median": float(np.median(hold_times)),
        "flight_time_mean": float(np.mean(flight_times))
        if len(flight_times) > 0
        else 0.0,
        "flight_time_std": float(np.std(flight_times))
        if len(flight_times) > 0
        else 0.0,
        "typing_speed_wpm": float(wpm),
        "error_rate": float(backspace_count / max(total_keys, 1)),
        "pause_frequency": float(len(pauses) / typing_minutes),
        "pause_duration_mean": float(np.mean(pauses)) if len(pauses) > 0 else 0.0,
        "burst_length_mean": float(np.mean(bursts)) if bursts else float(total_keys),
        "rhythm_entropy": entropy,
    }


# ═══════════════════════════════════════════════════════════════
# 2. MOUSE FEATURES (6 features)
# ═══════════════════════════════════════════════════════════════


def detect_rage_clicks(
    clicks: List[MouseEvent],
    threshold_ms: float = 2000,
    min_clicks: int = 3,
    radius: int = 50,
) -> int:
    """
    Detect rage clicks: clusters of 3+ rapid clicks in the same area.
    Borrowed from UX analytics (Hotjar/FullStory) — repurposed as a
    frustration biomarker instead of a usability bug indicator.
    """
    rage_count = 0
    i = 0
    while i < len(clicks):
        cluster = [clicks[i]]
        j = i + 1
        while j < len(clicks):
            dt = clicks[j].timestamp - clicks[i].timestamp
            dx = abs(clicks[j].x - clicks[i].x)
            dy = abs(clicks[j].y - clicks[i].y)
            if dt <= threshold_ms and dx <= radius and dy <= radius:
                cluster.append(clicks[j])
                j += 1
            else:
                break
        if len(cluster) >= min_clicks:
            rage_count += 1
        i = j if j > i + 1 else i + 1
    return rage_count


def extract_mouse_features(mouse_events: List[MouseEvent]) -> dict:
    """
    Extract 6 mouse behavioral features.

    These features capture:
    - Pointer speed/variance → stressed users move faster and less precisely
    - Direction reversals → indecision / anxiety
    - Rage clicks → frustration
    - Scroll variance → doom-scrolling behavior
    """
    empty = {name: 0.0 for name in FEATURE_NAMES[11:17]}

    if not mouse_events:
        return empty

    moves = [e for e in mouse_events if e.event_type == "move"]
    clicks = [e for e in mouse_events if e.event_type == "click"]
    scrolls = [e for e in mouse_events if e.event_type == "scroll"]

    # ── Speed & Direction from movement ────────────────────
    speeds = []
    directions = []
    for i in range(1, len(moves)):
        dx = moves[i].x - moves[i - 1].x
        dy = moves[i].y - moves[i - 1].y
        dt = (moves[i].timestamp - moves[i - 1].timestamp) / 1000.0  # seconds
        if dt > 0:
            dist = math.sqrt(dx**2 + dy**2)
            speed = dist / dt
            if speed < 10000:  # Filter out sensor glitches
                speeds.append(speed)
                directions.append(math.atan2(dy, dx))

    # ── Direction change rate (cursor indecision) ──────────
    dir_changes = 0
    if len(directions) > 1:
        dir_changes = sum(
            1
            for i in range(1, len(directions))
            if abs(directions[i] - directions[i - 1]) > math.pi / 4
        )

    # ── Scroll velocity variance ───────────────────────────
    scroll_velocities = []
    for i in range(1, len(scrolls)):
        dt = (scrolls[i].timestamp - scrolls[i - 1].timestamp) / 1000.0
        if dt > 0:
            scroll_velocities.append(abs(scrolls[i].scroll_delta or 0) / dt)

    return {
        "mouse_speed_mean": float(np.mean(speeds)) if speeds else 0.0,
        "mouse_speed_std": float(np.std(speeds)) if speeds else 0.0,
        "direction_change_rate": float(dir_changes / max(len(directions), 1)),
        "click_count": float(len(clicks)),
        "rage_click_count": float(detect_rage_clicks(clicks)),
        "scroll_velocity_std": float(np.std(scroll_velocities))
        if scroll_velocities
        else 0.0,
    }


def extract_mouse_reentry_features(
    mouse_events: List[MouseEvent], context_events: List[ContextEvent]
) -> dict:
    """
    Extract privacy-safe mouse re-entry proxies:
    - mouse_reentry_count: number of mouse re-entry events after idle/context switches
    - mouse_reentry_latency_ms: mean latency from app switch to next mouse activity
    """
    if not mouse_events:
        return {"mouse_reentry_count": 0.0, "mouse_reentry_latency_ms": 0.0}

    reentry_count = 0
    for e in mouse_events:
        if getattr(e, "reentry_after_idle", False) or getattr(
            e, "reentry_after_context_switch", False
        ):
            reentry_count += 1

    latencies = []
    if context_events:
        context_times = sorted(e.timestamp for e in context_events)
        mouse_times = sorted(e.timestamp for e in mouse_events)
        for ctx_ts in context_times:
            j = bisect.bisect_right(mouse_times, ctx_ts)
            if j < len(mouse_times):
                latencies.append(max(mouse_times[j] - ctx_ts, 0.0))

    return {
        "mouse_reentry_count": float(reentry_count),
        "mouse_reentry_latency_ms": float(np.mean(latencies)) if latencies else 0.0,
    }


# ═══════════════════════════════════════════════════════════════
# 3. CONTEXT-SWITCH FEATURES (3 features)
# ═══════════════════════════════════════════════════════════════


def extract_context_features(context_events: List[ContextEvent]) -> dict:
    """
    Extract 3 context-switching features.

    These features capture:
    - Switching frequency → high = cognitive overload
    - Switching entropy → random switching = stress-driven scatter
    - Session fragmentation → micro-sessions indicate inability to focus
    """
    empty = {name: 0.0 for name in FEATURE_NAMES[17:20]}

    if len(context_events) < 2:
        return empty

    duration_min = (
        context_events[-1].timestamp - context_events[0].timestamp
    ) / 60000.0
    duration_min = max(duration_min, 0.1)  # Avoid division by zero

    # Switches per minute
    freq = len(context_events) / duration_min

    # Entropy of switching pattern (how random vs structured)
    categories = [e.category_hash for e in context_events]
    unique, counts = np.unique(categories, return_counts=True)
    probs = counts / counts.sum()
    entropy = float(-np.sum(probs * np.log2(probs + 1e-10)))

    # Fragmentation: ratio of micro-sessions to total time
    fragmentation = len(context_events) / max(duration_min * 2, 1.0)

    return {
        "tab_switch_freq": float(freq),
        "switch_entropy": float(entropy),
        "session_fragmentation": float(fragmentation),
    }


# ═══════════════════════════════════════════════════════════════
# 4. TEMPORAL FEATURES (3 features)
# ═══════════════════════════════════════════════════════════════


def extract_temporal_features(
    window_start_time_ms: float, session_start_time_ms: float | None = None
) -> dict:
    """
    Extract 3 temporal context features.

    These provide the model with time-of-day awareness so it can
    apply circadian-adjusted baselines (a user who's slow at 10 AM
    is more concerning than one who's slow at midnight).
    """
    dt = datetime.fromtimestamp(window_start_time_ms / 1000.0)

    session_dur = 0.0
    if session_start_time_ms:
        session_dur = (window_start_time_ms - session_start_time_ms) / 60000.0
        session_dur = max(0.0, min(session_dur, 24 * 60.0))

    return {
        "hour_of_day": float(dt.hour),
        "day_of_week": float(dt.weekday()),  # 0=Monday, 6=Sunday
        "session_duration_min": float(session_dur),
    }


# ═══════════════════════════════════════════════════════════════
# 5. FEATURE INTERACTIONS (Issue #3)
# ═══════════════════════════════════════════════════════════════

def compute_interaction_features(features: dict) -> dict:
    """
    Compute 5 interaction features that capture behavioral signatures.
    
    Interactions capture combinations that individual features miss:
    - typing_speed_wpm × error_rate: Slow but error-prone = cognitive overload
    - rage_click_count × direction_change_rate: Frustrated + indecisive mouse
    - session_fragmentation × tab_switch_freq: Chaotic context switching
    - pause_frequency × rhythm_entropy: Breaking rhythm erratically
    - mouse_speed_std × click_count: Agitated movement + many clicks
    
    Returns dict with 5 interaction feature names and values.
    """
    interactions = {}
    
    for feat_a, feat_b in INTERACTION_FEATURES:
        val_a = features.get(feat_a, 0.0)
        val_b = features.get(feat_b, 0.0)
        
        # Normalize values to prevent domination by large magnitudes
        # Use log scale for features with wide ranges (WPM, click counts)
        if feat_a in ["typing_speed_wpm", "click_count", "mouse_speed_std"]:
            val_a = np.log1p(val_a)
        if feat_b in ["typing_speed_wpm", "click_count", "mouse_speed_std"]:
            val_b = np.log1p(val_b)
        
        # Compute interaction (multiplicative + small additive for stability)
        interaction_name = f"{feat_a}_x_{feat_b}"
        interaction_value = val_a * val_b + 0.01
        
        interactions[interaction_name] = float(interaction_value)
    
    return interactions


# ═══════════════════════════════════════════════════════════════
# 6. COMBINED EXTRACTION (all 23 + 5 = 28 features)
# ═══════════════════════════════════════════════════════════════


def extract_all_features(
    key_events: List[KeyEvent],
    mouse_events: List[MouseEvent],
    context_events: List[ContextEvent],
    window_start_time_ms: float,
    session_start_time_ms: float | None = None,
) -> Tuple[np.ndarray, list]:
    """
    Extract the complete 23-dimensional feature vector from one window.

    Returns:
        features: np.ndarray of shape [23], dtype float32
        feature_names: list of 23 strings (in fixed order)
    """
    kb = extract_keyboard_features(key_events)
    ms = extract_mouse_features(mouse_events)
    ctx = extract_context_features(context_events)
    tmp = extract_temporal_features(window_start_time_ms, session_start_time_ms)

    # Assemble in the exact order defined by FEATURE_NAMES
    values = []
    for name in FEATURE_NAMES:
        if name in kb:
            values.append(kb[name])
        elif name in ms:
            values.append(ms[name])
        elif name in ctx:
            values.append(ctx[name])
        elif name in tmp:
            values.append(tmp[name])
        else:
            values.append(0.0)

    return np.array(values, dtype=np.float32), FEATURE_NAMES


def extract_feature_dict(
    key_events: List[KeyEvent],
    mouse_events: List[MouseEvent],
    context_events: List[ContextEvent],
    window_start_time_ms: float,
    session_start_time_ms: float | None = None,
) -> dict:
    """
    Extract standard model features + interaction features + extended explainability.
    
    Returns 23 base features + 5 interaction features + 2 reentry features = 30 total
    """
    features_arr, names = extract_all_features(
        key_events=key_events,
        mouse_events=mouse_events,
        context_events=context_events,
        window_start_time_ms=window_start_time_ms,
        session_start_time_ms=session_start_time_ms,
    )
    base = {name: float(val) for name, val in zip(names, features_arr)}
    base.update(extract_mouse_reentry_features(mouse_events, context_events))
    
    # Add interaction features (Issue #3)
    interactions = compute_interaction_features(base)
    base.update(interactions)
    
    return base


# ═══════════════════════════════════════════════════════════════
# 7. SLIDING WINDOW SEGMENTATION
# ═══════════════════════════════════════════════════════════════


def create_sliding_windows(
    key_events: List[KeyEvent],
    mouse_events: List[MouseEvent],
    context_events: List[ContextEvent],
    window_sec: float = 300,
    step_sec: float = 60,
    min_keys: int = 10,
) -> list:
    """
    Segment the event stream into overlapping windows for feature extraction.

    Default configuration:
      - Window size: 300 seconds (5 minutes)
      - Step size: 60 seconds (1 minute) → 80% overlap
      - Minimum events: 10 keystrokes per window (skip sparse ones)

    Why 5-minute windows? ETH Zurich research shows stress patterns
    stabilize within 3-5 minutes. Shorter = too noisy, longer = miss spikes.
    """
    if not key_events:
        return []

    # Find timeline boundaries
    all_timestamps = (
        [e.timestamp_press for e in key_events]
        + [e.timestamp for e in mouse_events]
        + [e.timestamp for e in context_events]
    )
    start_time = min(all_timestamps)
    end_time = max(all_timestamps)

    window_ms = window_sec * 1000
    step_ms = step_sec * 1000

    windows = []
    t = start_time

    while t + window_ms <= end_time:
        t_end = t + window_ms

        # Filter events that fall within this window
        w_keys = [e for e in key_events if t <= e.timestamp_press < t_end]
        w_mice = [e for e in mouse_events if t <= e.timestamp < t_end]
        w_ctx = [e for e in context_events if t <= e.timestamp < t_end]

        # Only keep windows with enough typing activity
        if len(w_keys) >= min_keys:
            windows.append(
                {
                    "start_time": t,
                    "end_time": t_end,
                    "key_events": w_keys,
                    "mouse_events": w_mice,
                    "context_events": w_ctx,
                }
            )

        t += step_ms

    return windows


# ─── Self-Test removed — use scripts/ directory ────────────────
# Relative imports don't work in __main__ blocks.
# Run self-tests via scripts/ or the FastAPI app directly.
