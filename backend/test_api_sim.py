import requests
import json
import time

API_URL = "http://localhost:5000/api/v1/inference"

# 23 features matching the expected schema
features = {
    "hold_time_mean": 120.5,
    "hold_time_std": 20.1,
    "hold_time_median": 115.0,
    "flight_time_mean": 200.0,
    "flight_time_std": 50.0,
    "typing_speed_wpm": 65.0,
    "error_rate": 0.05,
    "pause_frequency": 2.5,
    "pause_duration_mean": 1500.0,
    "burst_length_mean": 10.0,
    "rhythm_entropy": 2.1,
    "mouse_speed_mean": 250.0,
    "mouse_speed_std": 80.0,
    "direction_change_rate": 0.3,
    "click_count": 15.0,
    "rage_click_count": 0.0,
    "scroll_velocity_std": 10.0,
    "tab_switch_freq": 2.0,
    "switch_entropy": 1.5,
    "session_fragmentation": 0.2,
    "hour_of_day": 14.0,
    "day_of_week": 2.0,
    "session_duration_min": 45.0
}

payload = {
    "features": features,
    "user_id": "api_test_user_777"
}

try:
    print(f"Sending stress simulation data to {API_URL}...")
    start = time.time()
    response = requests.post(API_URL, json=payload, headers={"Content-Type": "application/json"})
    end = time.time()
    
    print(f"Status Code: {response.status_code}")
    print(f"Latency: {(end-start)*1000:.2f} ms")
    
    if response.status_code == 200:
        data = response.json()
        print("\n--- MODEL SUCCESS: PREDICTION DETAILS ---")
        print(f"Predicted Level: {data.get('level')}")
        print(f"Continuous Score: {data.get('score')} / 100")
        print(f"Confidence: {data.get('confidence')}")
        print("Model Insights:")
        for insight in data.get('insights', []):
            print(f"  - {insight}")
    else:
        print(f"Error Response: {response.text}")
except Exception as e:
    print(f"Connection Error: {e}")
