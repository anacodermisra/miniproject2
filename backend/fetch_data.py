import sqlite3
import pandas as pd
from datetime import datetime
import os

db_path = os.path.join('app','ml','artifacts','user_baselines_demo_user.db')
conn = sqlite3.connect(db_path)

c = conn.cursor()
b = c.execute("SELECT * FROM baselines LIMIT 15").fetchall()
h = c.execute("SELECT id, timestamp_ms, score, label FROM session_history ORDER BY id DESC LIMIT 15").fetchall()

artifact_path = r"C:\Users\Anand\.gemini\antigravity\brain\6070ff89-4edb-40c6-8eb1-701daa6579be\db_dump.md"
with open(artifact_path, "w", encoding="utf-8") as f:
    f.write("# 🧠 Live SQLite Database Dump\n\n")
    f.write("## Table 1: `baselines`\nTracks your personal average behaviors mapped to specific **hours of the day**.\n\n")
    f.write("| Feature ID | Hour | Your Average (Mean) | Deviation (Std) | Samples Learned |\n")
    f.write("|---|---|---|---|---|\n")
    for r in b:
        f.write(f"| {r[0]} | {r[1]}:00 | {r[2]:.2f} | {r[3]:.2f} | {r[4]} |\n")
        
    f.write("\n## Table 2: `session_history`\nThe raw timeline of the AI's real-time predictions.\n\n")
    f.write("| ID | Local Time | AI Score | Predicted Label |\n")
    f.write("|---|---|---|---|\n")
    for r in h:
        dt = datetime.fromtimestamp(r[1]/1000).strftime("%H:%M:%S")
        f.write(f"| {r[0]} | {dt} | {r[2]:.1f} | {r[3]} |\n")

print("Created markdown artifact.")
