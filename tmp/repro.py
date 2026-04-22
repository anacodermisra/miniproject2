import requests
import json
import time

BASE_URL = "http://localhost:5000/api/v1"

def test_signup():
    print("Testing signup...")
    payload = {
        "email": f"test_{int(time.time())}@example.com",
        "username": f"user_{int(time.time())}",
        "password": "password123",
        "display_name": "Test User"
    }
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
    except Exception as e:
        print(f"ERROR: {e}")

def test_login():
    print("Testing login (non-existent)...")
    payload = {
        "email_or_username": "nonexistent_user_xyz",
        "password": "wrongpassword"
    }
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json=payload)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_login()
    test_signup()
