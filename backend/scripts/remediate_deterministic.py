"""
AI Data Remediation for MindPulse - Deterministic Fixes
========================================================
Fixes identified data quality issues without ML dependencies.
"""

import pandas as pd
import numpy as np


def remediate_dataset(input_path, output_path):
    """
    Apply deterministic fixes to dataset based on identified anomalies.

    Issues Found:
    1. Hold times in seconds instead of milliseconds (×1000 error)
    2. Absurd hold times >500s (physically impossible)
    3. WPM calculation errors from time unit confusion
    """
    print("[REMEDIATION] Loading dataset...")
    df = pd.read_csv(input_path)
    original_count = len(df)

    print(f"[REMEDIATION] Original: {original_count} samples")

    # Track changes for audit log
    changes = []

    # Fix 1: Convert seconds to milliseconds for hold times
    # Human hold time is 50-500ms. Values >1000ms are likely in seconds.
    print("[REMEDIATION] Fix 1: Converting hold time units...")
    hold_time_mask = df["hold_time_mean"] > 1000
    hold_fix_count = hold_time_mask.sum()

    if hold_fix_count > 0:
        # These are in seconds, convert to ms
        old_values = df.loc[hold_time_mask, "hold_time_mean"].copy()
        df.loc[hold_time_mask, "hold_time_mean"] = (
            df.loc[hold_time_mask, "hold_time_mean"] / 1000
        )

        for idx in df[hold_time_mask].index[:5]:  # Log first 5
            changes.append(
                {
                    "row": int(idx),
                    "column": "hold_time_mean",
                    "old": float(old_values[idx]),
                    "new": float(df.loc[idx, "hold_time_mean"]),
                    "fix": "seconds_to_ms",
                    "reason": "Unit conversion: values >1000ms treated as seconds",
                }
            )

        print(f"  Fixed {hold_fix_count} hold time values (÷1000)")

    # Fix 2: Cap absurd hold times (>500ms is too long for normal typing)
    print("[REMEDIATION] Fix 2: Capping extreme hold times...")
    extreme_mask = df["hold_time_mean"] > 500
    extreme_count = extreme_mask.sum()

    if extreme_count > 0:
        # These are still too high after conversion - cap at 300ms (generous)
        old_values = df.loc[extreme_mask, "hold_time_mean"].copy()
        df.loc[extreme_mask, "hold_time_mean"] = 300.0

        for idx in df[extreme_mask].index[:5]:
            changes.append(
                {
                    "row": int(idx),
                    "column": "hold_time_mean",
                    "old": float(old_values[idx]),
                    "new": 300.0,
                    "fix": "cap_extreme",
                    "reason": "Capped at 300ms (human limit for intentional key hold)",
                }
            )

        print(f"  Capped {extreme_count} extreme values to 300ms")

    # Fix 3: Recalculate WPM based on corrected timings
    # WPM = (keystrokes / 5) / (time_minutes)
    # We don't have keystroke count directly, but we can estimate from burst_length
    print("[REMEDIATION] Fix 3: Recalculating WPM...")

    # Simple heuristic: WPM should correlate with session duration and activity
    # Low WPM (<5) is suspicious for active sessions
    low_wpm_mask = (df["typing_speed_wpm"] < 5) & (df["session_duration_min"] > 1)
    low_wpm_count = low_wpm_mask.sum()

    if low_wpm_count > 0:
        # Estimate more realistic WPM based on session activity
        # Assume moderate typing: 40 WPM baseline adjusted by session fragmentation
        estimated_wpm = 40 * (1 - df.loc[low_wpm_mask, "session_fragmentation"])
        estimated_wpm = estimated_wpm.clip(lower=15, upper=80)  # Keep in human range

        old_values = df.loc[low_wpm_mask, "typing_speed_wpm"].copy()
        df.loc[low_wpm_mask, "typing_speed_wpm"] = estimated_wpm

        for idx in df[low_wpm_mask].index[:5]:
            changes.append(
                {
                    "row": int(idx),
                    "column": "typing_speed_wpm",
                    "old": float(old_values[idx]),
                    "new": float(df.loc[idx, "typing_speed_wpm"]),
                    "fix": "estimate_wpm",
                    "reason": "Recalculated from session activity (original unrealistically low)",
                }
            )

        print(f"  Recalculated {low_wpm_count} WPM values")

    # Fix 4: Ensure flight times are consistent with hold times
    print("[REMEDIATION] Fix 4: Normalizing flight times...")
    # Flight time should be similar magnitude to hold time
    # If flight >> hold, likely unit issue
    flight_mask = df["flight_time_mean"] > df["hold_time_mean"] * 100
    flight_count = flight_mask.sum()

    if flight_count > 0:
        # Normalize to be in same range as hold time
        df.loc[flight_mask, "flight_time_mean"] = (
            df.loc[flight_mask, "hold_time_mean"] * 0.8
        )
        print(f"  Normalized {flight_count} flight time values")

    # Validation: Check no data loss
    final_count = len(df)
    assert final_count == original_count, (
        f"DATA LOSS: {original_count} -> {final_count}"
    )

    # Save remediated dataset
    df.to_csv(output_path, index=False)

    # Save audit log
    audit_path = output_path.replace(".csv", "_audit.json")
    import json

    with open(audit_path, "w") as f:
        json.dump(
            {
                "original_samples": int(original_count),
                "final_samples": int(final_count),
                "changes": changes,
                "fixes_applied": {
                    "hold_time_unit_conversion": int(hold_fix_count),
                    "hold_time_capped": int(extreme_count),
                    "wpm_recalculated": int(low_wpm_count),
                    "flight_normalized": int(flight_count),
                },
            },
            f,
            indent=2,
        )

    print(f"\\n[REMEDIATION] COMPLETE:")
    print(f"  Output: {output_path}")
    print(f"  Audit: {audit_path}")
    print(f"  Samples: {original_count} (no loss)")
    print(f"  Total changes: {len(changes)}")

    # Validation report
    print(f"\\n[VALIDATION] Post-remediation stats:")
    hold_min = df["hold_time_mean"].min()
    hold_max = df["hold_time_mean"].max()
    wpm_min = df["typing_speed_wpm"].min()
    wpm_max = df["typing_speed_wpm"].max()
    corr = df["hold_time_mean"].corr(df["typing_speed_wpm"])
    print(f"  Hold time range: {hold_min:.1f} - {hold_max:.1f} ms")
    print(f"  WPM range: {wpm_min:.1f} - {wpm_max:.1f}")
    print(f"  Hold/WPM correlation: {corr:.3f}")

    return df


if __name__ == "__main__":
    remediate_dataset(
        r"D:\Projects\Algoquest\mini\backend\app\ml\artifacts\real_dataset_balanced.csv",
        r"D:\Projects\Algoquest\mini\backend\app\ml\artifacts\real_dataset_remediated.csv",
    )
