"""
MindPulse — Online Learning Pipeline
======================================
Updates model weights based on user feedback without full retraining.

Strategy:
- Keep base model frozen (general knowledge)
- Train per-user adapter layers (personalization)
- Use experience replay to prevent catastrophic forgetting

Expected Impact: +1-2% F1 per month per active user
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("mindpulse.online_learning")

# ────────────────────────────────────────────────────────────────
# Database Schema
# ────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS user_adapters (
    user_id TEXT PRIMARY KEY,
    adapter_json TEXT NOT NULL,
    n_updates INTEGER DEFAULT 0,
    last_update REAL,
    accuracy REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS experience_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    features_json TEXT NOT NULL,
    predicted TEXT NOT NULL,
    actual TEXT NOT NULL,
    timestamp REAL NOT NULL,
    used_for_training INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exp_user ON experience_buffer(user_id);
CREATE INDEX IF NOT EXISTS idx_exp_used ON experience_buffer(used_for_training);
"""


class OnlineLearner:
    """
    Online learning system for continuous model improvement.
    
    Components:
    1. Per-user adapters: Lightweight threshold adjustments
    2. Experience replay: Store corrections for periodic retraining
    3. Accuracy tracking: Monitor per-user model performance
    """

    def __init__(self, db_dir: str = "app/ml/artifacts"):
        os.makedirs(db_dir, exist_ok=True)
        self.db_path = os.path.join(db_dir, "online_learning.db")
        self._init_db()
        self._adapters: Dict[str, dict] = {}

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(SCHEMA)

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ────────────────────────────────────────────────────────────
    # 1. Per-User Adapter Management
    # ────────────────────────────────────────────────────────────

    def get_adapter(self, user_id: str) -> dict:
        """Get or create adapter for a user."""
        if user_id in self._adapters:
            return self._adapters[user_id]

        # Try loading from database
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM user_adapters WHERE user_id = ?",
                (user_id,),
            ).fetchone()

            if row:
                adapter = json.loads(row["adapter_json"])
                adapter["n_updates"] = row["n_updates"]
                adapter["last_update"] = row["last_update"]
                adapter["accuracy"] = row["accuracy"]
                self._adapters[user_id] = adapter
                return adapter
        finally:
            conn.close()

        # Create new adapter with defaults
        adapter = {
            "threshold_adjustment": 0.0,  # Score threshold shift
            "weight_multiplier": 1.0,  # Scale model confidence
            "class_bias": {"NEUTRAL": 0.0, "MILD": 0.0, "STRESSED": 0.0},
            "n_updates": 0,
            "last_update": None,
            "accuracy": None,
        }
        self._adapters[user_id] = adapter
        return adapter

    def save_adapter(self, user_id: str, adapter: dict):
        """Persist adapter to database."""
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT OR REPLACE INTO user_adapters 
                   (user_id, adapter_json, n_updates, last_update, accuracy)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    user_id,
                    json.dumps(adapter),
                    adapter.get("n_updates", 0),
                    adapter.get("last_update"),
                    adapter.get("accuracy"),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    # ────────────────────────────────────────────────────────────
    # 2. Update from Feedback
    # ────────────────────────────────────────────────────────────

    def update_from_feedback(
        self,
        user_id: str,
        features: dict,
        predicted: str,
        actual: str,
        score: Optional[float] = None,
    ) -> dict:
        """
        Update user adapter based on feedback.
        
        Logic:
        - False positive (predicted STRESSED, actual NEUTRAL):
          → Decrease threshold, reduce sensitivity
        - False negative (predicted NEUTRAL, actual STRESSED):
          → Increase threshold, increase sensitivity
        - Wrong class (predicted MILD, actual STRESSED):
          → Adjust class bias
        """
        adapter = self.get_adapter(user_id)
        ts = time.time()

        # Store in experience buffer
        self._add_to_experience_buffer(user_id, features, predicted, actual, ts)

        # Update adapter based on error type
        if predicted == "STRESSED" and actual == "NEUTRAL":
            # False positive: model too sensitive
            adapter["threshold_adjustment"] -= 3.0
            adapter["class_bias"]["STRESSED"] -= 0.05

        elif predicted == "NEUTRAL" and actual == "STRESSED":
            # False negative: model not sensitive enough
            adapter["threshold_adjustment"] += 3.0
            adapter["class_bias"]["STRESSED"] += 0.05

        elif predicted != actual:
            # Wrong class: adjust specific class bias
            adapter["class_bias"][predicted] -= 0.03
            adapter["class_bias"][actual] += 0.03

        # Clamp values to prevent extreme adjustments
        adapter["threshold_adjustment"] = max(-15.0, min(15.0, adapter["threshold_adjustment"]))
        for cls in adapter["class_bias"]:
            adapter["class_bias"][cls] = max(-0.3, min(0.3, adapter["class_bias"][cls]))

        adapter["n_updates"] = adapter.get("n_updates", 0) + 1
        adapter["last_update"] = ts

        # Save adapter
        self.save_adapter(user_id, adapter)

        logger.info(
            f"Adapter updated: user={user_id}, predicted={predicted}, "
            f"actual={actual}, threshold_adj={adapter['threshold_adjustment']:.1f}"
        )

        return adapter

    def apply_adapter(self, user_id: str, score: float, probabilities: dict) -> Tuple[float, dict]:
        """
        Apply user adapter adjustments to prediction.
        
        Args:
            user_id: User identifier
            score: Raw stress score (0-100)
            probabilities: Dict of class probabilities
        
        Returns:
            (adjusted_score, adjusted_probabilities)
        """
        adapter = self.get_adapter(user_id)

        # Apply threshold adjustment
        adjusted_score = score + adapter["threshold_adjustment"]
        adjusted_score = float(max(0.0, min(100.0, adjusted_score)))

        # Apply class bias to probabilities
        adjusted_probs = {}
        for cls in probabilities:
            bias = adapter["class_bias"].get(cls, 0.0)
            adjusted_probs[cls] = max(0.01, probabilities[cls] + bias)

        # Re-normalize probabilities
        total = sum(adjusted_probs.values())
        adjusted_probs = {cls: round(p / total, 3) for cls, p in adjusted_probs.items()}

        return adjusted_score, adjusted_probs

    # ────────────────────────────────────────────────────────────
    # 3. Experience Buffer
    # ────────────────────────────────────────────────────────────

    def _add_to_experience_buffer(
        self,
        user_id: str,
        features: dict,
        predicted: str,
        actual: str,
        timestamp: float,
    ):
        """Store feedback sample for periodic retraining."""
        conn = self._get_conn()
        try:
            conn.execute(
                """INSERT INTO experience_buffer 
                   (user_id, features_json, predicted, actual, timestamp)
                   VALUES (?, ?, ?, ?, ?)""",
                (user_id, json.dumps(features), predicted, actual, timestamp),
            )
            conn.commit()
        finally:
            conn.close()

    def get_experience_buffer(
        self,
        user_id: Optional[str] = None,
        used_only: bool = False,
        limit: int = 1000,
    ) -> List[dict]:
        """Retrieve experience buffer samples for retraining."""
        query = "SELECT * FROM experience_buffer WHERE 1=1"
        params = []

        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        if used_only:
            query += " AND used_for_training = 1"
        else:
            query += " AND used_for_training = 0"

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        conn = self._get_conn()
        try:
            rows = conn.execute(query, params).fetchall()
            samples = []
            for row in rows:
                sample = dict(row)
                sample["features"] = json.loads(sample["features_json"])
                del sample["features_json"]
                samples.append(sample)
            return samples
        finally:
            conn.close()

    def mark_experience_used(self, sample_ids: List[int]):
        """Mark experience samples as used for training."""
        if not sample_ids:
            return

        conn = self._get_conn()
        try:
            placeholders = ",".join("?" for _ in sample_ids)
            conn.execute(
                f"UPDATE experience_buffer SET used_for_training = 1 WHERE id IN ({placeholders})",
                sample_ids,
            )
            conn.commit()
        finally:
            conn.close()

    # ────────────────────────────────────────────────────────────
    # 4. Accuracy Tracking
    # ────────────────────────────────────────────────────────────

    def update_accuracy(self, user_id: str, accuracy: float):
        """Update tracked accuracy for a user's adapter."""
        adapter = self.get_adapter(user_id)
        adapter["accuracy"] = accuracy
        self.save_adapter(user_id, adapter)

    def get_user_stats(self, user_id: str) -> dict:
        """Get statistics for a user's online learning."""
        adapter = self.get_adapter(user_id)
        conn = self._get_conn()
        try:
            unused = conn.execute(
                "SELECT COUNT(*) as cnt FROM experience_buffer WHERE user_id = ? AND used_for_training = 0",
                (user_id,),
            ).fetchone()["cnt"]

            total = conn.execute(
                "SELECT COUNT(*) as cnt FROM experience_buffer WHERE user_id = ?",
                (user_id,),
            ).fetchone()["cnt"]

            return {
                "adapter": adapter,
                "experience_buffer_unused": unused,
                "experience_buffer_total": total,
            }
        finally:
            conn.close()

    # ────────────────────────────────────────────────────────────
    # 5. Batch Retraining Preparation
    # ────────────────────────────────────────────────────────────

    def prepare_retraining_data(
        self,
        user_id: Optional[str] = None,
        min_samples: int = 100,
    ) -> Optional[Tuple[List[dict], List[str]]]:
        """
        Prepare experience buffer data for model retraining.
        
        Returns:
            (features, labels) tuple or None if not enough data
        """
        samples = self.get_experience_buffer(user_id=user_id, limit=10000)

        if len(samples) < min_samples:
            logger.warning(
                f"Not enough experience samples: {len(samples)} < {min_samples}"
            )
            return None

        features = [s["features"] for s in samples]
        labels = [s["actual"] for s in samples]

        # Mark as used
        self.mark_experience_used([s["id"] for s in samples])

        logger.info(
            f"Prepared {len(features)} samples for retraining "
            f"(user={user_id or 'all'})"
        )
        return features, labels


# Global singleton
online_learner = OnlineLearner()
