"""
Verification Script: Temporal Stability & Idle Grounding
Simulates high stress followed by idle to verify EMA smoothing and decay.
"""
import sys
import os
import numpy as np
import time

# Ensure imports work
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.services.inference import engine
from app.core.config import FEATURE_NAMES

def get_neutral_features():
    # Realistic "Quiet" baseline - low values for counts
    f = {name: 0.0 for name in FEATURE_NAMES}
    f["typing_speed_wpm"] = 40
    f["click_count"] = 5
    f["hour_of_day"] = 14
    return f

def get_stress_features():
    # Realistic "Chaotic" state - high errors, rage clicks, frequent switching
    f = get_neutral_features()
    f["error_rate"] = 0.4
    f["rage_click_count"] = 8
    f["tab_switch_freq"] = 15
    f["typing_speed_wpm"] = 90
    f["click_count"] = 45
    return f

def get_idle_features():
    f = get_neutral_features()
    f["typing_speed_wpm"] = 0
    f["click_count"] = 0
    return f

def run_test():
    engine.load()
    user_id = "test_user_temporal"
    engine.reset_user_state(user_id)
    
    print("--- Temporal Stability Test ---")
    
    # 1. Neutral Start
    print("\n[PHASE 1] Neutral Baseline (5 frames)")
    for i in range(5):
        res = engine.predict(get_neutral_features(), user_id)
        print(f"Frame {i+1}: Score={res['score']} | Level={res['level']}")

    # 2. Sudden Stress
    print("\n[PHASE 2] Sudden Stress Event (High Signal) (5 frames)")
    for i in range(5):
        res = engine.predict(get_stress_features(), user_id)
        print(f"Frame {i+1}: Score={res['score']} | Level={res['level']}")

    # 3. Immediate Idle
    print("\n[PHASE 3] Immediate Idle (Recovery) (5 frames)")
    for i in range(5):
        res = engine.predict(get_idle_features(), user_id)
        print(f"Frame {i+1}: Score={res['score']} | Level={res['level']}")

if __name__ == "__main__":
    run_test()
