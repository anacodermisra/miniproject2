"""
Quick converter for Kaggle stress detection dataset to MindPulse format.
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime
import sys

# Add parent path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app", "ml"))


def load_user_data(data_root, user_name):
    """Load all data files for a user."""
    user_path = os.path.join(data_root, user_name)

    # Load labels
    labels_df = pd.read_csv(os.path.join(user_path, "usercondition.tsv"), sep="\t")
    labels_df["Time"] = pd.to_datetime(labels_df["Time"])

    # Load keystrokes
    keys_df = pd.read_csv(os.path.join(user_path, "keystrokes.tsv"), sep="\t")
    keys_df["Press_Time"] = pd.to_datetime(keys_df["Press_Time"])
    keys_df["Relase_Time"] = pd.to_datetime(keys_df["Relase_Time"])
    keys_df["hold_time"] = (
        keys_df["Relase_Time"] - keys_df["Press_Time"]
    ).dt.total_seconds() * 1000

    # Calculate flight times
    keys_df = keys_df.sort_values("Press_Time").reset_index(drop=True)
    keys_df["flight_time"] = keys_df["Press_Time"].diff().dt.total_seconds() * 1000

    # Load mouse data (sample, not all 44M rows)
    mouse_df = pd.read_csv(
        os.path.join(user_path, "mousedata.tsv"), sep="\t", nrows=50000
    )
    mouse_df["Time"] = pd.to_datetime(mouse_df["Time"])

    return labels_df, keys_df, mouse_df


def extract_window_features(keys_df, mouse_df, window_start, window_end):
    """Extract features from a time window."""
    # Filter data in window
    window_keys = keys_df[
        (keys_df["Press_Time"] >= window_start) & (keys_df["Press_Time"] < window_end)
    ]
    window_mouse = mouse_df[
        (mouse_df["Time"] >= window_start) & (mouse_df["Time"] < window_end)
    ]

    if len(window_keys) < 5:
        return None

    # Keyboard features
    hold_times = window_keys["hold_time"].dropna()
    flight_times = window_keys["flight_time"].dropna()

    # Count error keys (backspace, delete)
    error_keys = ["backspace", "delete"]
    error_count = sum(
        1 for k in window_keys["Key"] if any(e in str(k).lower() for e in error_keys)
    )
    error_rate = error_count / len(window_keys) if len(window_keys) > 0 else 0

    # Calculate WPM
    duration_min = (window_end - window_start).total_seconds() / 60
    wpm = (len(window_keys) / 5) / duration_min if duration_min > 0 else 0

    # Pauses (gaps > 2 seconds)
    pauses = flight_times[flight_times > 2000]

    # Rhythm entropy (simplified)
    if len(flight_times) > 0:
        mean_flight = flight_times.mean()
        rhythm_entropy = np.std(flight_times) / mean_flight if mean_flight > 0 else 0
    else:
        rhythm_entropy = 0

    # Mouse features
    if len(window_mouse) > 1:
        mouse_speed_mean = window_mouse.get("Speed", pd.Series([0])).mean()
        mouse_speed_std = window_mouse.get("Speed", pd.Series([0])).std()
    else:
        mouse_speed_mean = 0
        mouse_speed_std = 0

    features = {
        "hold_time_mean": hold_times.mean() if len(hold_times) > 0 else 100,
        "hold_time_std": hold_times.std() if len(hold_times) > 1 else 20,
        "hold_time_median": hold_times.median() if len(hold_times) > 0 else 100,
        "flight_time_mean": flight_times.mean() if len(flight_times) > 0 else 80,
        "flight_time_std": flight_times.std() if len(flight_times) > 1 else 25,
        "typing_speed_wpm": min(wpm, 200),  # Cap at 200
        "error_rate": error_rate,
        "pause_frequency": len(pauses),
        "pause_duration_mean": pauses.mean() if len(pauses) > 0 else 0,
        "burst_length_mean": len(window_keys) / max(len(pauses), 1),
        "rhythm_entropy": rhythm_entropy,
        "mouse_speed_mean": mouse_speed_mean,
        "mouse_speed_std": mouse_speed_std,
        "direction_change_rate": len(window_mouse) / duration_min / 60
        if duration_min > 0
        else 0,
        "click_count": len(window_mouse),
        "rage_click_count": 0,  # Not available in this dataset
        "scroll_velocity_std": 30,  # Default
        "tab_switch_freq": 0,  # Not available
        "switch_entropy": 0,  # Not available
        "session_fragmentation": len(pauses) / len(window_keys)
        if len(window_keys) > 0
        else 0,
        "hour_of_day": window_start.hour,
        "day_of_week": window_start.weekday(),
        "session_duration_min": duration_min,
    }

    return features


def convert_kaggle_dataset(data_root, output_path):
    """Convert Kaggle dataset to MindPulse format."""
    all_samples = []

    for user in os.listdir(data_root):
        user_path = os.path.join(data_root, user)
        if not os.path.isdir(user_path):
            continue

        print(f"\nProcessing {user}...")
        try:
            labels_df, keys_df, mouse_df = load_user_data(data_root, user)
            print(
                f"  Labels: {len(labels_df)}, Keys: {len(keys_df)}, Mouse: {len(mouse_df)}"
            )

            # Create 5-minute windows around each label
            for _, label_row in labels_df.iterrows():
                label_time = label_row["Time"]
                stress_val = label_row.get("Stress_Val", "Avg")

                # Map stress value to 0/1/2
                stress_map = {
                    "Low": 0,
                    "Below_Avg": 0,
                    "Avg": 1,
                    "Above_Avg": 1,
                    "High": 2,
                }
                label = stress_map.get(stress_val, 1)

                # 5-minute window centered on label
                window_start = label_time - pd.Timedelta(minutes=2.5)
                window_end = label_time + pd.Timedelta(minutes=2.5)

                features = extract_window_features(
                    keys_df, mouse_df, window_start, window_end
                )
                if features:
                    features["label"] = label
                    features["user_id"] = user
                    features["timestamp"] = label_time.isoformat()
                    all_samples.append(features)

        except Exception as e:
            print(f"  Error processing {user}: {e}")

    # Save
    df = pd.DataFrame(all_samples)
    df.to_csv(output_path, index=False)
    print(f"\n[SAVED] {len(df)} samples to {output_path}")
    print(f"\nLabel distribution:")
    print(df["label"].value_counts().sort_index())
    return df


if __name__ == "__main__":
    data_root = r"C:\Users\ItzP\.cache\kagglehub\datasets\chaminduweerasinghe\stress-detection-by-keystrokeapp-mouse-changes\versions\1\Data"
    output_path = (
        r"D:\Projects\Algoquest\mini\backend\app\ml\artifacts\real_dataset.csv"
    )

    convert_kaggle_dataset(data_root, output_path)
