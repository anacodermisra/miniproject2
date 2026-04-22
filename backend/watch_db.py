import sqlite3
import time
import os
from datetime import datetime

DB_PATH = os.path.join("app", "ml", "artifacts", "user_baselines_demo_user.db")

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def watch_db():
    if not os.path.exists(DB_PATH):
        print(f"Waiting for database {DB_PATH} to be created...")
        while not os.path.exists(DB_PATH):
            time.sleep(2)

    last_id = -1
    print("Connected to MindPulse SQLite Database. Watching for real-time updates...")

    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            
            # 1. Check how many personalized baselines exist
            # The 'baselines' table tracks 23 features × 24 hours of the day
            c.execute("SELECT COUNT(*), SUM(sample_count) FROM baselines")
            baseline_result = c.fetchone()
            baseline_rows = baseline_result[0] or 0
            total_baseline_samples = baseline_result[1] or 0

            # 2. Grab the 5 most recent live score insertions
            c.execute("SELECT id, timestamp_ms, score, label FROM session_history ORDER BY id DESC LIMIT 5")
            history_rows = c.fetchall()
            
            # If the newest row ID changes, we draw a new table!
            if history_rows and history_rows[0][0] != last_id:
                clear_screen()
                last_id = history_rows[0][0]

                print("=" * 65)
                print(" 🧠 MINDPULSE LOCAL SQLITE DATABASE MONITOR 🧠")
                print("=" * 65)

                print(f"[TABLE: baselines]   Active Personalizations: {baseline_rows}/552 capacity")
                print(f"[TABLE: baselines]   Total Telemetry Packets Learned: {total_baseline_samples}")
                print("\n[TABLE: session_history] Live Score Feed (Last 5 Entries):")
                
                print(f"{'Row ID':<8} | {'Local Time':<12} | {'Score':<8} | {'Predicted Label'}")
                print("-" * 65)

                # Print oldest to newest inside our 5-item slice
                for r in reversed(history_rows):
                    dt = datetime.fromtimestamp(r[1] / 1000.0).strftime('%H:%M:%S')
                    print(f"{r[0]:<8} | {dt:<12} | {r[2]:<8.1f} | {r[3]}")
                
            conn.close()
        except sqlite3.OperationalError:
            pass # DB locked or being written to, wait for next tick
            
        time.sleep(1.5) # Poll database every 1.5 seconds

if __name__ == "__main__":
    try:
        watch_db()
    except KeyboardInterrupt:
        print("\nExiting Database Monitor.")
