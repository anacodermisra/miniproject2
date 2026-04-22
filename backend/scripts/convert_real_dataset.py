"""
MindPulse — Real Dataset Converter
====================================
Converts the Kaggle "Stress Detection by Keystroke, App & Mouse Changes"
dataset into MindPulse's 23-feature format with stress labels.

Dataset structure (2 users):
  keystrokes.tsv      → Key, Press_Time, Release_Time
  mousedata.tsv        → Time, Event_Type (Move/Click/Scroll), X, Y
  activewindows.tsv    → Time, App_Name (context switching)
  inactivity.tsv       → Type, Stopped_Time, Activated_Time, Duration(s)
  usercondition.tsv    → Time, Stress_Val (labels)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

# Add parent directories to path for ml package imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pandas as pd

from app.ml.feature_extractor import FEATURE_NAMES, extract_all_features
from app.ml.data_collector import KeyEvent, MouseEvent, ContextEvent


# ────────────────────────────────────────────────────────────────
# Label mapping
# ────────────────────────────────────────────────────────────────

STRESS_LABEL_MAP = {
    "neutral": 0,
    "s_stressed": 1,  # Somewhat stressed → MILD
    "v_stressed": 2,  # Very stressed → STRESSED
    "f_good": 0,  # Feeling good → NEUTRAL
    "f_great": 0,  # Feeling great → NEUTRAL
    "low": 1,
    "mild": 1,
    "high": 2,
    "stressed": 2,
}

STRESS_NAMES = {0: "NEUTRAL", 1: "MILD", 2: "STRESSED"}


def _parse_stress_label(val) -> int:
    """Map stress self-report to 0/1/2."""
    if pd.isna(val):
        return -1
    s = str(val).strip().lower()
    return STRESS_LABEL_MAP.get(s, -1)


# ────────────────────────────────────────────────────────────────
# Load raw data per user
# ────────────────────────────────────────────────────────────────


def load_user_data(user_dir: str) -> Dict[str, pd.DataFrame]:
    """Load all TSV files for a single user."""
    data = {}
    for fname in [
        "keystrokes.tsv",
        "mousedata.tsv",
        "activewindows.tsv",
        "inactivity.tsv",
        "usercondition.tsv",
        "mouse_mov_speeds.tsv",
    ]:
        path = os.path.join(user_dir, fname)
        if os.path.exists(path):
            df = pd.read_csv(path, sep="\t")
            # Drop unnamed columns
            df = df[[c for c in df.columns if "Unnamed" not in c]]
            data[fname.replace(".tsv", "")] = df
    return data


def _ts_to_ms(ts_str: str) -> float:
    """Convert timestamp string to Unix milliseconds."""
    ts = pd.Timestamp(ts_str)
    return ts.timestamp() * 1000.0


# ────────────────────────────────────────────────────────────────
# Convert to MindPulse event format
# ────────────────────────────────────────────────────────────────


def convert_keystrokes(df: pd.DataFrame) -> List[KeyEvent]:
    """Convert keystrokes.tsv to KeyEvent list."""
    events = []
    for _, row in df.iterrows():
        try:
            t_press = _ts_to_ms(row["Press_Time"])
            t_release = _ts_to_ms(row["Relase_Time"])

            # Categorize key (privacy-safe)
            key_str = str(row["Key"]).strip()
            if key_str.lower() in ("backspace", "\b", "bs"):
                cat = "backspace"
            elif key_str.isdigit():
                cat = "digit"
            elif len(key_str) == 1 and key_str.isalpha():
                cat = "alpha"
            elif key_str in ("space", " ", "enter", "tab", "shift", "ctrl", "alt"):
                cat = "modifier"
            else:
                cat = "special"

            events.append(
                KeyEvent(
                    timestamp_press=t_press,
                    timestamp_release=t_release,
                    key_category=cat,
                )
            )
        except Exception:
            continue

    return events


def convert_mouse(df: pd.DataFrame, speeds_df: pd.DataFrame = None) -> List[MouseEvent]:
    """Convert mouse data. Use mouse_mov_speeds for speed info, clicks/scrolls from mousedata."""
    events = []

    # Process clicks from mousedata (much smaller subset)
    if not df.empty:
        df = df.copy()
        df["Event_Type"] = df["Event_Type"].str.strip().str.lower()

        # Only clicks and scrolls - skip raw moves (too many)
        interactive = df[
            df["Event_Type"].isin(
                ["click", "leftclick", "rightclick", "scroll", "wheel"]
            )
        ]
        for _, row in interactive.iterrows():
            try:
                etype = str(row["Event_Type"]).strip().lower()
                events.append(
                    MouseEvent(
                        timestamp=_ts_to_ms(row["Time"]),
                        x=int(row["X"]) if pd.notna(row.get("X")) else 0,
                        y=int(row["Y"]) if pd.notna(row.get("Y")) else 0,
                        event_type="click" if "click" in etype else "scroll",
                        click_type="left" if "click" in etype else None,
                        scroll_delta=1
                        if "scroll" in etype or "wheel" in etype
                        else None,
                    )
                )
            except Exception:
                pass

    # Use pre-computed mouse speeds as synthetic "move" events (1 per second)
    if speeds_df is not None and not speeds_df.empty:
        for _, row in speeds_df.iterrows():
            try:
                events.append(
                    MouseEvent(
                        timestamp=_ts_to_ms(row["Time"]),
                        x=0,
                        y=0,
                        event_type="move",
                    )
                )
            except Exception:
                pass

    events.sort(key=lambda e: e.timestamp)
    return events


def convert_context(df: pd.DataFrame) -> List[ContextEvent]:
    """Convert activewindows.tsv to ContextEvent list."""
    import hashlib

    events = []
    prev_app = None
    for _, row in df.iterrows():
        try:
            ts = _ts_to_ms(row["Time"])
            app_name = str(row["App_Name"]).strip()

            # Hash the app name for privacy
            app_hash = hashlib.sha256(app_name.encode("utf-8")).hexdigest()[:16]

            # Only emit on actual switches
            if app_hash != prev_app:
                events.append(
                    ContextEvent(
                        timestamp=ts,
                        event_type="app_switch",
                        category_hash=app_hash,
                    )
                )
                prev_app = app_hash
        except Exception:
            continue

    return events


def convert_labels(df: pd.DataFrame) -> List[Tuple[float, int]]:
    """Convert usercondition.tsv to (timestamp_ms, label) pairs."""
    labels = []
    for _, row in df.iterrows():
        try:
            ts = _ts_to_ms(row["Time"])
            label = _parse_stress_label(row["Stress_Val"])
            if label >= 0:
                labels.append((ts, label))
        except Exception:
            continue
    return labels


# ────────────────────────────────────────────────────────────────
# Windowing with label assignment
# ────────────────────────────────────────────────────────────────


def assign_labels_to_windows(
    windows: list,
    labels: List[Tuple[float, int]],
    window_sec: float = 300,
) -> list:
    """
    Assign stress labels to windows based on the closest self-report.

    Strategy: For each window, find the nearest label in time.
    If the nearest label is > 1 hour away, skip the window.
    """
    if not labels:
        return []

    label_times = np.array([l[0] for l in labels])
    label_values = np.array([l[1] for l in labels])

    labeled_windows = []
    for w in windows:
        w_center = (w["start_time"] + w["end_time"]) / 2

        # Find closest label
        distances = np.abs(label_times - w_center)
        closest_idx = np.argmin(distances)
        min_dist = distances[closest_idx]

        # Only accept if label is within 1 hour
        if min_dist <= 3600000:  # 1 hour in ms
            w["stress_label"] = int(label_values[closest_idx])
            labeled_windows.append(w)

    return labeled_windows


# ────────────────────────────────────────────────────────────────
# Full pipeline: user directory → feature DataFrame
# ────────────────────────────────────────────────────────────────


def process_user(user_dir: str, user_id: str) -> pd.DataFrame:
    """
    Process one user's data into a feature DataFrame.

    Returns:
        DataFrame with 23 features + stress_label + user_id
    """
    data = load_user_data(user_dir)

    # Convert to MindPulse events
    key_events = convert_keystrokes(data.get("keystrokes", pd.DataFrame()))
    mouse_events = convert_mouse(
        data.get("mousedata", pd.DataFrame()),
        data.get("mouse_mov_speeds", None),
    )
    context_events = convert_context(data.get("activewindows", pd.DataFrame()))
    labels = convert_labels(data.get("usercondition", pd.DataFrame()))

    print(f"\n[{user_id}] Raw events:")
    print(f"  Keystrokes: {len(key_events)}")
    print(f"  Mouse:      {len(mouse_events)}")
    print(f"  Context:    {len(context_events)}")
    print(f"  Labels:     {len(labels)}")

    # Create sliding windows
    import sys

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app", "ml"))
    from feature_extractor import create_sliding_windows

    windows = create_sliding_windows(
        key_events,
        mouse_events,
        context_events,
        window_sec=300,
        step_sec=60,
        min_keys=10,
    )
    print(f"  Windows:    {len(windows)}")

    # Assign labels
    labeled_windows = assign_labels_to_windows(windows, labels)
    print(f"  Labeled:    {len(labeled_windows)}")

    if not labeled_windows:
        print(f"  [WARN] No labeled windows for {user_id}")
        return pd.DataFrame()

    # Extract features for each window
    rows = []
    all_window_key_events = []  # For CNN training
    for w in labeled_windows:
        try:
            feats, names = extract_all_features(
                w["key_events"],
                w["mouse_events"],
                w["context_events"],
                window_start_time_ms=w["start_time"],
            )
            row = dict(zip(names, feats.tolist()))
            row["stress_label"] = w["stress_label"]
            row["stress_level"] = STRESS_NAMES.get(w["stress_label"], "UNKNOWN")
            row["user_id"] = user_id
            row["window_start"] = w["start_time"]
            rows.append(row)
            # Save raw key events for CNN
            all_window_key_events.append(w["key_events"])
        except Exception as e:
            continue

    df = pd.DataFrame(rows)
    print(f"  Final rows: {len(df)}")

    # Save raw key events for CNN training
    if all_window_key_events:
        import joblib

        ke_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            f"key_events_{user_id.replace(' ', '_')}.joblib",
        )
        joblib.dump(all_window_key_events, ke_path)
        print(f"  Saved key events: {ke_path} ({len(all_window_key_events)} windows)")

    return df


# ────────────────────────────────────────────────────────────────
# Main: process all users and save
# ────────────────────────────────────────────────────────────────


def convert_dataset(
    data_root: str,
    output_path: str = "real_dataset.csv",
    max_users: int = 2,
) -> pd.DataFrame:
    """
    Convert all users in the dataset to a single CSV.
    """
    all_dfs = []

    # Find user directories
    user_dirs = sorted(
        [
            d
            for d in os.listdir(data_root)
            if os.path.isdir(os.path.join(data_root, d)) and d.startswith("user")
        ]
    )[:max_users]

    print(f"Found {len(user_dirs)} users: {user_dirs}")

    for i, user_dir in enumerate(user_dirs):
        print(f"\n--- Processing {user_dir} ({i + 1}/{len(user_dirs)}) ---")
        full_path = os.path.join(data_root, user_dir)
        df = process_user(full_path, user_dir)
        if not df.empty:
            all_dfs.append(df)

    if not all_dfs:
        print("ERROR: No data converted!")
        return pd.DataFrame()

    combined = pd.concat(all_dfs, ignore_index=True)

    # Label distribution
    print(f"\n{'=' * 60}")
    print(f"COMBINED DATASET")
    print(f"{'=' * 60}")
    print(f"Total samples: {len(combined)}")
    print(f"\nLabel distribution:")
    for label, name in STRESS_NAMES.items():
        count = (combined["stress_label"] == label).sum()
        pct = count / len(combined) * 100
        print(f"  {name:>10}: {count:>5} ({pct:.1f}%)")

    print(f"\nPer-user distribution:")
    for uid in combined["user_id"].unique():
        user_df = combined[combined["user_id"] == uid]
        dist = user_df["stress_label"].value_counts().to_dict()
        print(f"  {uid}: {dist}")

    # Save
    combined.to_csv(output_path, index=False)
    print(f"\nSaved to: {output_path}")

    return combined


if __name__ == "__main__":
    data_root = r"C:\Users\ItzP\.cache\kagglehub\datasets\chaminduweerasinghe\stress-detection-by-keystrokeapp-mouse-changes\versions\1\Data"

    df = convert_dataset(
        data_root=data_root,
        output_path="real_dataset.csv",
    )
