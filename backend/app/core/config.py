"""MindPulse Backend — Configuration."""

APP_NAME = "MindPulse API"
VERSION = "1.0.0"
DESCRIPTION = "Privacy-first behavioral stress detection"

# Stress label mapping
LABELS = ["NEUTRAL", "MILD", "STRESSED"]
LABEL_COLORS = {"NEUTRAL": "#2ecc71", "MILD": "#f39c12", "STRESSED": "#e74c3c"}

# Feature names (order matters)
FEATURE_NAMES = [
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
    "mouse_speed_mean",
    "mouse_speed_std",
    "direction_change_rate",
    "click_count",
    "rage_click_count",
    "scroll_velocity_std",
    "tab_switch_freq",
    "switch_entropy",
    "session_fragmentation",
    "hour_of_day",
    "day_of_week",
    "session_duration_min",
]

# Thresholds
STRESS_SCORE_THRESHOLD_MILD = 40
STRESS_SCORE_THRESHOLD_HIGH = 70

# Hybrid scoring config
MODEL_SCORE_WEIGHT = 0.7

# Calibration targets
CALIBRATION_TARGET_SAMPLES_PER_HOUR = 20
CALIBRATION_MIN_HOURS_COVERED = 4

# WebSocket reliability
WS_HEARTBEAT_TIMEOUT_SEC = 30.0

# Realistic performance expectations (from research)
EXPECTED_PERFORMANCE = {
    "universal_model": {
        "f1_macro": (0.25, 0.40),  # Range from ETH Zurich 2025
        "accuracy": (0.30, 0.45),
        "source": "Naegelin et al. 2025, 36 employees, 8-week field study",
    },
    "with_calibration_50": {
        "f1_macro": (0.55, 0.70),
        "accuracy": (0.60, 0.72),
        "source": "Estimated from Pepa et al. 2021 + per-user adaptation",
    },
    "with_calibration_100": {
        "f1_macro": (0.65, 0.75),
        "accuracy": (0.68, 0.78),
        "source": "Extrapolated from ETH Zurich 2023 lab study",
    },
    "sota_lab": {
        "f1_macro": (0.60, 0.65),
        "accuracy": (0.65, 0.76),
        "source": "Pepa et al. 2021 (62 users, in-the-wild, keyboard only)",
    },
}
