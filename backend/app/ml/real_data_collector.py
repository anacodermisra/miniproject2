"""
MindPulse — Real Data Collection & Active Learning Pipeline
============================================================
Collects labeled real user data through:
1. Self-report prompts (user states their stress level)
2. Intervention correlation (break acceptance = stress signal)
3. Feedback loop (user corrections stored for retraining)
4. Active learning (asks for feedback when model uncertain)

Fulfills Fix #3 (Real Data Collection) and Fix #7 (Active Learning)
from ML_ARCHITECTURE_ANALYSIS.md
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("mindpulse.real_data")

# ────────────────────────────────────────────────────────────────
# Database Schema
# ──────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS labeled_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    features_json TEXT NOT NULL,
    label TEXT NOT NULL,
    label_source TEXT NOT NULL,
    confidence REAL,
    model_prediction TEXT,
    model_confidence REAL,
    was_near_boundary INTEGER DEFAULT 0,
    was_low_confidence INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    score REAL NOT NULL,
    confidence REAL NOT NULL,
    model_score REAL,
    heuristic_score REAL,
    was_requested INTEGER DEFAULT 0,
    response TEXT,
    response_timestamp REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS intervention_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    intervention_type TEXT NOT NULL,
    accepted INTEGER NOT NULL,
    score_before REAL,
    score_after REAL,
    inferred_label TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labeled_user ON labeled_samples(user_id);
CREATE INDEX IF NOT EXISTS idx_labeled_timestamp ON labeled_samples(timestamp);
CREATE INDEX IF NOT EXISTS idx_labeled_label ON labeled_samples(label);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_intervention_user ON intervention_labels(user_id);
"""


class RealDataCollector:
    """
    Collects and stores labeled real user data for model retraining.
    
    Three labeling strategies:
    1. Self-report: User explicitly states stress level
    2. Intervention: User accepts/rejects break → inferred label
    3. Feedback: User corrects model prediction
    """

    def __init__(self, db_dir: str = "app/ml/artifacts"):
        os.makedirs(db_dir, exist_ok=True)
        self.db_path = os.path.join(db_dir, "real_data.db")
        self._init_db()
    
    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(SCHEMA)
    
    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ────────────────────────────────────────────────────────────
    # 1. Self-Report Collection
    # ────────────────────────────────────────────────────────────

    def save_self_report(
        self,
        user_id: str,
        features: dict,
        label: str,
        timestamp: Optional[float] = None,
        model_prediction: Optional[str] = None,
        model_confidence: Optional[float] = None,
    ) -> int:
        """
        Save user's explicit self-reported stress level.
        
        Args:
            user_id: User identifier
            features: 23+ feature vector as dict
            label: 'NEUTRAL', 'MILD', or 'STRESSED'
            timestamp: When the report was made (defaults to now)
            model_prediction: What the model predicted at that time
            model_confidence: Model's confidence at that time
        
        Returns:
            Row ID of the saved sample
        """
        if label not in ("NEUTRAL", "MILD", "STRESSED"):
            raise ValueError(f"Invalid label: {label}. Must be NEUTRAL/MILD/STRESSED")
        
        ts = timestamp or time.time()
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """INSERT INTO labeled_samples 
                   (user_id, timestamp, features_json, label, label_source,
                    model_prediction, model_confidence)
                   VALUES (?, ?, ?, ?, 'self_report', ?, ?)""",
                (
                    user_id,
                    ts,
                    json.dumps(features),
                    label,
                    model_prediction,
                    model_confidence,
                ),
            )
            conn.commit()
            row_id = cursor.lastrowid
            logger.info(f"Self-report saved: user={user_id}, label={label}, id={row_id}")
            return row_id
        finally:
            conn.close()

    # ────────────────────────────────────────────────────────────
    # 2. Intervention Correlation
    # ────────────────────────────────────────────────────────────

    def save_intervention_outcome(
        self,
        user_id: str,
        intervention_type: str,
        accepted: bool,
        score_before: float,
        score_after: Optional[float] = None,
        timestamp: Optional[float] = None,
    ) -> int:
        """
        Record intervention outcome and infer stress label.
        
        Logic:
        - If user accepts break → likely was STRESSED or MILD
        - If user rejects break → likely was NEUTRAL
        - If score drops after intervention → intervention worked
        """
        ts = timestamp or time.time()
        
        # Infer label from intervention behavior
        if accepted:
            # User took the break → was likely stressed
            inferred_label = "STRESSED" if score_before >= 70 else "MILD"
        else:
            # User declined → likely fine
            inferred_label = "NEUTRAL"
        
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """INSERT INTO intervention_labels 
                   (user_id, timestamp, intervention_type, accepted,
                    score_before, score_after, inferred_label)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id, ts, intervention_type, int(accepted),
                    score_before, score_after, inferred_label,
                ),
            )
            conn.commit()
            logger.info(
                f"Intervention recorded: user={user_id}, type={intervention_type}, "
                f"accepted={accepted}, inferred={inferred_label}"
            )
            return cursor.lastrowid
        finally:
            conn.close()

    # ────────────────────────────────────────────────────────────
    # 3. Feedback Correction
    # ────────────────────────────────────────────────────────────

    def save_feedback_correction(
        self,
        user_id: str,
        features: dict,
        model_prediction: str,
        actual_label: str,
        timestamp: Optional[float] = None,
        model_confidence: Optional[float] = None,
    ) -> int:
        """
        Save user's correction of model prediction.
        
        This is the highest-quality label — user explicitly says
        "model was wrong, I'm actually X".
        """
        if actual_label not in ("NEUTRAL", "MILD", "STRESSED"):
            raise ValueError(f"Invalid label: {actual_label}")
        
        ts = timestamp or time.time()
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """INSERT INTO labeled_samples 
                   (user_id, timestamp, features_json, label, label_source,
                    model_prediction, model_confidence)
                   VALUES (?, ?, ?, ?, 'feedback_correction', ?, ?)""",
                (
                    user_id,
                    ts,
                    json.dumps(features),
                    actual_label,
                    model_prediction,
                    model_confidence,
                ),
            )
            conn.commit()
            logger.info(
                f"Feedback correction: user={user_id}, predicted={model_prediction}, "
                f"actual={actual_label}"
            )
            return cursor.lastrowid
        finally:
            conn.close()

    # ────────────────────────────────────────────────────────────
    # Active Learning: When to Ask for Feedback
    # ────────────────────────────────────────────────────────────

    def should_request_feedback(
        self,
        score: float,
        confidence: float,
        model_score: float,
        heuristic_score: float,
        user_id: str,
        min_interval_minutes: float = 30.0,
    ) -> Tuple[bool, str]:
        """
        Decide whether to ask user for feedback (active learning).
        
        Ask when model is uncertain:
        1. Near decision boundary (MILD/NEUTRAL or MILD/STRESSED)
        2. Low model confidence (<0.6)
        3. ML and heuristic strongly disagree (>30 points)
        4. User hasn't been asked recently (respect interval)
        
        Returns:
            (should_ask, reason) tuple
        """
        # Check 1: Near boundary
        near_neutral_mild = 35 <= score <= 45
        near_mild_stressed = 65 <= score <= 75
        near_boundary = near_neutral_mild or near_mild_stressed
        
        # Check 2: Low confidence
        low_confidence = confidence < 0.6
        
        # Check 3: Model vs heuristic disagreement
        disagreement = abs(model_score - heuristic_score) > 30
        
        # Check 4: Respect feedback interval
        if not self._can_ask_now(user_id, min_interval_minutes):
            return False, "recently_asked"
        
        # Decision: ask if near boundary AND (low confidence OR disagreement)
        if near_boundary and (low_confidence or disagreement):
            if low_confidence and disagreement:
                return True, "low_confidence_and_disagreement"
            elif low_confidence:
                return True, "low_confidence"
            else:
                return True, "model_disagreement"
        
        if near_boundary:
            return True, "near_boundary"
        
        return False, "not_uncertain"

    def _can_ask_now(self, user_id: str, min_interval_minutes: float) -> bool:
        """Check if enough time has passed since last feedback request."""
        cutoff = time.time() - (min_interval_minutes * 60)
        conn = self._get_conn()
        try:
            row = conn.execute(
                "SELECT MAX(timestamp) as last_ts FROM feedback_requests WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            if row and row["last_ts"]:
                return float(row["last_ts"]) < cutoff
            return True  # Never asked before
        finally:
            conn.close()

    def record_feedback_request(
        self,
        user_id: str,
        score: float,
        confidence: float,
        model_score: Optional[float] = None,
        heuristic_score: Optional[float] = None,
        was_requested: bool = True,
    ) -> int:
        """Log that a feedback request was shown to the user."""
        ts = time.time()
        conn = self._get_conn()
        try:
            cursor = conn.execute(
                """INSERT INTO feedback_requests 
                   (user_id, timestamp, score, confidence, model_score,
                    heuristic_score, was_requested)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id, ts, score, confidence,
                    model_score, heuristic_score, int(was_requested),
                ),
            )
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()

    def record_feedback_response(
        self,
        request_id: int,
        response: str,
    ) -> bool:
        """Record user's response to a feedback request."""
        ts = time.time()
        conn = self._get_conn()
        try:
            conn.execute(
                """UPDATE feedback_requests 
                   SET response = ?, response_timestamp = ?
                   WHERE id = ?""",
                (response, ts, request_id),
            )
            conn.commit()
            return True
        finally:
            conn.close()

    # ────────────────────────────────────────────────────────────
    # Data Retrieval for Retraining
    # ────────────────────────────────────────────────────────────

    def get_labeled_samples(
        self,
        user_id: Optional[str] = None,
        label: Optional[str] = None,
        source: Optional[str] = None,
        since_timestamp: Optional[float] = None,
        limit: int = 1000,
    ) -> List[dict]:
        """
        Retrieve labeled samples for model retraining.
        
        Args:
            user_id: Filter by user (None = all users)
            label: Filter by label (NEUTRAL/MILD/STRESSED)
            source: Filter by source (self_report/feedback_correction)
            since_timestamp: Only samples after this time
            limit: Max samples to return
        
        Returns:
            List of dicts with features, label, metadata
        """
        query = "SELECT * FROM labeled_samples WHERE 1=1"
        params = []
        
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        if label:
            query += " AND label = ?"
            params.append(label)
        if source:
            query += " AND label_source = ?"
            params.append(source)
        if since_timestamp:
            query += " AND timestamp >= ?"
            params.append(since_timestamp)
        
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

    def get_intervention_labels(
        self,
        user_id: Optional[str] = None,
        limit: int = 500,
    ) -> List[dict]:
        """Get intervention-based inferred labels."""
        query = "SELECT * FROM intervention_labels WHERE 1=1"
        params = []
        
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        conn = self._get_conn()
        try:
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]
        finally:
            conn.close()

    def get_dataset_stats(self, user_id: Optional[str] = None) -> dict:
        """Get statistics about collected labeled data."""
        conn = self._get_conn()
        try:
            where = "WHERE user_id = ?" if user_id else ""
            params = [user_id] if user_id else []
            
            total = conn.execute(
                f"SELECT COUNT(*) as cnt FROM labeled_samples {where}", params
            ).fetchone()["cnt"]
            
            by_label = conn.execute(
                f"SELECT label, COUNT(*) as cnt FROM labeled_samples {where} GROUP BY label", params
            ).fetchall()
            
            by_source = conn.execute(
                f"SELECT label_source, COUNT(*) as cnt FROM labeled_samples {where} GROUP BY label_source", params
            ).fetchall()
            
            intervention_total = conn.execute(
                f"SELECT COUNT(*) as cnt FROM intervention_labels {where}", params
            ).fetchone()["cnt"]
            
            return {
                "total_labeled_samples": total,
                "by_label": {row["label"]: row["cnt"] for row in by_label},
                "by_source": {row["label_source"]: row["cnt"] for row in by_source},
                "total_intervention_labels": intervention_total,
            }
        finally:
            conn.close()

    def export_for_training(
        self,
        user_id: Optional[str] = None,
        min_samples: int = 50,
    ) -> Optional[Tuple[List[dict], List[str]]]:
        """
        Export labeled data in format ready for model training.
        
        Returns:
            (samples, labels) tuple or None if not enough data
        """
        samples = self.get_labeled_samples(user_id=user_id, limit=10000)
        
        if len(samples) < min_samples:
            logger.warning(
                f"Not enough samples for training: {len(samples)} < {min_samples}"
            )
            return None
        
        feature_list = []
        label_list = []
        
        for sample in samples:
            feature_list.append(sample["features"])
            label_list.append(sample["label"])
        
        logger.info(
            f"Exported {len(feature_list)} samples for training "
            f"(user={user_id or 'all'})"
        )
        return feature_list, label_list


# Global singleton
collector = RealDataCollector()
