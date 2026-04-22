"""MindPulse Backend — SQLite-backed history store."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from typing import List

from app.schemas.stress import HistoryPoint

MAX_POINTS = 500
_LOCK = threading.RLock()
_DB_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ml", "artifacts", "history.db")
)


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    return sqlite3.connect(_DB_PATH)


def _init_db():
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                score REAL NOT NULL,
                level TEXT NOT NULL,
                confidence REAL NOT NULL,
                insights_json TEXT NOT NULL,
                model_score REAL DEFAULT 0,
                equation_score REAL DEFAULT 0,
                final_score REAL DEFAULT 0,
                typing_speed_wpm REAL DEFAULT 0,
                rage_click_count INTEGER DEFAULT 0,
                error_rate REAL DEFAULT 0,
                click_count INTEGER DEFAULT 0,
                mouse_speed_mean REAL DEFAULT 0,
                mouse_reentry_count REAL DEFAULT 0,
                mouse_reentry_latency_ms REAL DEFAULT 0
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_user_time ON history(user_id, timestamp)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS intervention_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                action TEXT NOT NULL,
                intervention_type TEXT NOT NULL,
                alert_state TEXT NOT NULL,
                score_before REAL DEFAULT 0,
                score_after REAL DEFAULT 0,
                recovery_score REAL DEFAULT 0,
                notes TEXT DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_interventions_user_time
            ON intervention_events(user_id, timestamp)
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS wellness_checkins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                energy_level TEXT NOT NULL,
                sleep_quality TEXT NOT NULL,
                note TEXT DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS journal_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                content TEXT NOT NULL,
                entry_type TEXT DEFAULT 'insight'
            )
            """
        )
        conn.commit()


_init_db()


def reset(user_id: str):
    with _LOCK:
        with _connect() as conn:
            conn.execute("DELETE FROM history WHERE user_id=?", (user_id,))
            conn.execute("DELETE FROM intervention_events WHERE user_id=?", (user_id,))
            conn.commit()


def append(user_id: str, point: dict):
    insights = point.get("insights", [])
    if not isinstance(insights, list):
        insights = []
    with _LOCK:
        with _connect() as conn:
            score = float(point.get("score", 0.0))
            model_score = (
                float(point["model_score"])
                if "model_score" in point
                else score
            )
            equation_score = (
                float(point["equation_score"])
                if "equation_score" in point
                else score
            )
            final_score = (
                float(point["final_score"])
                if "final_score" in point
                else score
            )
            conn.execute(
                """
                INSERT INTO history (
                    user_id, timestamp, score, level, confidence, insights_json,
                    model_score, equation_score, final_score,
                    typing_speed_wpm, rage_click_count, error_rate, click_count, mouse_speed_mean,
                    mouse_reentry_count, mouse_reentry_latency_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    float(point.get("timestamp", time.time())),
                    score,
                    str(point.get("level", "UNKNOWN")),
                    float(point.get("confidence", 0.0)),
                    json.dumps(insights),
                    model_score,
                    equation_score,
                    final_score,
                    float(point.get("typing_speed_wpm", 0.0)),
                    int(point.get("rage_click_count", 0)),
                    float(point.get("error_rate", 0.0)),
                    int(point.get("click_count", 0)),
                    float(point.get("mouse_speed_mean", 0.0)),
                    float(point.get("mouse_reentry_count", 0.0)),
                    float(point.get("mouse_reentry_latency_ms", 0.0)),
                ),
            )

            overflow = conn.execute(
                "SELECT COUNT(*) FROM history WHERE user_id=?", (user_id,)
            ).fetchone()[0] - MAX_POINTS
            if overflow > 0:
                conn.execute(
                    """
                    DELETE FROM history
                    WHERE id IN (
                        SELECT id FROM history
                        WHERE user_id=?
                        ORDER BY timestamp ASC
                        LIMIT ?
                    )
                    """,
                    (user_id, overflow),
                )
            conn.commit()


def get_history(user_id: str, hours: int = 24) -> List[HistoryPoint]:
    cutoff = time.time() - (hours * 3600)
    with _LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT timestamp, score, level, insights_json,
                       typing_speed_wpm, rage_click_count, error_rate, click_count,
                       mouse_speed_mean, mouse_reentry_count, mouse_reentry_latency_ms
                FROM history
                WHERE user_id=? AND timestamp > ?
                ORDER BY timestamp ASC
                """,
                (user_id, cutoff),
            ).fetchall()
    points = []
    for row in rows:
        ts, score, level, insights_json = row[0], row[1], row[2], row[3]
        try:
            insights = json.loads(insights_json) if insights_json else []
        except json.JSONDecodeError:
            insights = []
        points.append(
            HistoryPoint(
                timestamp=float(ts),
                score=float(score),
                level=str(level),
                insights=insights if isinstance(insights, list) else [],
                typing_speed_wpm=float(row[4]) if row[4] else 0.0,
                rage_click_count=int(row[5]) if row[5] else 0,
                error_rate=float(row[6]) if row[6] else 0.0,
                click_count=int(row[7]) if row[7] else 0,
                mouse_speed_mean=float(row[8]) if row[8] else 0.0,
                mouse_reentry_count=float(row[9]) if row[9] else 0.0,
                mouse_reentry_latency_ms=float(row[10]) if row[10] else 0.0,
            )
        )
    return points


def get_stats(user_id: str) -> dict:
    with _LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT score, level, typing_speed_wpm, rage_click_count, error_rate, click_count, mouse_speed_mean
                FROM history
                WHERE user_id=?
                ORDER BY timestamp ASC
                """,
                (user_id,),
            ).fetchall()

    if not rows:
        return {
            "total_samples": 0,
            "avg_score": 0,
            "stressed_pct": 0,
            "current_level": "UNKNOWN",
            "typing_speed_wpm": 0,
            "rage_click_count": 0,
            "error_rate": 0,
            "click_count": 0,
            "mouse_speed_mean": 0,
        }

    total = len(rows)
    stressed = sum(1 for r in rows if r[1] == "STRESSED")
    avg_score = sum(float(r[0]) for r in rows) / total
    avg_wpm = sum(float(r[2]) for r in rows) / total
    total_rage = sum(int(r[3]) for r in rows)
    avg_error = sum(float(r[4]) for r in rows) / total
    total_clicks = sum(int(r[5]) for r in rows)
    avg_mouse = sum(float(r[6]) for r in rows) / total

    return {
        "total_samples": total,
        "avg_score": round(avg_score, 1),
        "stressed_pct": round(stressed / total * 100, 1),
        "current_level": rows[-1][1] if rows else "UNKNOWN",
        "typing_speed_wpm": round(avg_wpm, 1),
        "rage_click_count": int(total_rage),
        "error_rate": round(avg_error, 3),
        "click_count": int(total_clicks),
        "mouse_speed_mean": round(avg_mouse, 1),
    }


def get_recent_scores(user_id: str, minutes: int = 60) -> list[float]:
    cutoff = time.time() - (minutes * 60)
    with _LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT score
                FROM history
                WHERE user_id=? AND timestamp >= ?
                ORDER BY timestamp ASC
                """,
                (user_id, cutoff),
            ).fetchall()
    return [float(r[0]) for r in rows]


def latest_point(user_id: str) -> dict:
    with _LOCK:
        with _connect() as conn:
            row = conn.execute(
                """
                SELECT timestamp, score, level, confidence
                FROM history
                WHERE user_id=?
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()
    if not row:
        return {"timestamp": time.time(), "score": 0.0, "level": "UNKNOWN", "confidence": 0.0}
    return {
        "timestamp": float(row[0]),
        "score": float(row[1]),
        "level": str(row[2]),
        "confidence": float(row[3]),
    }


def append_intervention_event(
    user_id: str,
    action: str,
    intervention_type: str,
    alert_state: str,
    score_before: float = 0.0,
    score_after: float = 0.0,
    recovery_score: float = 0.0,
    notes: str = "",
):
    with _LOCK:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO intervention_events (
                    user_id, timestamp, action, intervention_type, alert_state,
                    score_before, score_after, recovery_score, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    time.time(),
                    action,
                    intervention_type,
                    alert_state,
                    float(score_before),
                    float(score_after),
                    float(recovery_score),
                    notes,
                ),
            )
            conn.commit()


def get_intervention_events(user_id: str, hours: int = 168) -> list[dict]:
    cutoff = time.time() - (hours * 3600)
    with _LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT timestamp, action, intervention_type, alert_state,
                       score_before, score_after, recovery_score, notes
                FROM intervention_events
                WHERE user_id=? AND timestamp >= ?
                ORDER BY timestamp DESC
                LIMIT 400
                """,
                (user_id, cutoff),
            ).fetchall()
    return [
        {
            "timestamp": float(r[0]),
            "action": str(r[1]),
            "intervention_type": str(r[2]),
            "alert_state": str(r[3]),
            "score_before": float(r[4]),
            "score_after": float(r[5]),
            "recovery_score": float(r[6]),
            "notes": str(r[7] or ""),
        }
        for r in rows
    ]


def intervention_effectiveness(user_id: str) -> dict[str, dict]:
    with _LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT intervention_type, action, recovery_score
                FROM intervention_events
                WHERE user_id=?
                """,
                (user_id,),
            ).fetchall()
    summary: dict[str, dict] = {}
    for intervention_type, action, recovery_score in rows:
        key = str(intervention_type or "general")
        if key not in summary:
            summary[key] = {"helped": 0, "not_helped": 0, "skipped": 0, "mean_recovery": 0.0, "n": 0}
        entry = summary[key]
        if action == "helped":
            entry["helped"] += 1
        elif action == "not_helped":
            entry["not_helped"] += 1
        elif action == "skipped":
            entry["skipped"] += 1
        if abs(float(recovery_score)) > 1e-9:
            entry["n"] += 1
            entry["mean_recovery"] += float(recovery_score)
    for key, entry in summary.items():
        if entry["n"] > 0:
            entry["mean_recovery"] = round(entry["mean_recovery"] / entry["n"], 2)
        else:
            entry["mean_recovery"] = 0.0
    return summary


def save_wellness_checkin(user_id: str, energy: str, sleep: str, note: str = ""):
    with _LOCK:
        with _connect() as conn:
            conn.execute(
                """
                INSERT INTO wellness_checkins (user_id, timestamp, energy_level, sleep_quality, note)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, time.time(), energy, sleep, note),
            )
            conn.commit()


def get_wellness_history(user_id: str, limit: int = 30) -> list[dict]:
    with _LOCK:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT timestamp, energy_level, sleep_quality, note
                FROM wellness_checkins
                WHERE user_id=?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (user_id, limit),
            ).fetchall()
    return [
        {"timestamp": r[0], "energy": r[1], "sleep": r[2], "note": r[3]} for r in rows
    ]


def save_journal_entry(user_id: str, content: str, entry_type: str = "insight"):
    with _LOCK:
        with _connect() as conn:
            conn.execute(
                "INSERT INTO journal_entries (user_id, timestamp, content, entry_type) VALUES (?, ?, ?, ?)",
                (user_id, time.time(), content, entry_type),
            )
            conn.commit()


def get_journal_entries(user_id: str, limit: int = 50) -> list[dict]:
    with _LOCK:
        with _connect() as conn:
            rows = conn.execute(
                "SELECT id, timestamp, content, entry_type FROM journal_entries WHERE user_id=? ORDER BY timestamp DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
    return [
        {"id": str(r[0]), "timestamp": r[1], "content": r[2], "entry_type": r[3]}
        for r in rows
    ]
