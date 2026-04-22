"""
MindPulse — Model Training, Normalization & Personal Calibration
=================================================================
Hardened production-ready module with:

1) Robust model loading with clear validation and fallback
2) Real-data training support from CSV
3) Optional pretrained artifact download support (HTTP URLs)
4) Dual normalization (global + per-user circadian)
5) SQLite-backed personal baseline adaptation (EMA)

Notes:
- This module keeps backward compatibility with the existing app imports:
    from model import load_model, DualNormalizer, PersonalBaseline, BASELINE_DB
- If no model artifacts exist locally, it can:
    a) train on real CSV data (if configured), or
    b) train on synthetic data fallback
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
import urllib.request
from typing import Dict, Optional, Tuple

import joblib
import numpy as np
import xgboost as xgb
from .feature_extractor import FEATURE_NAMES, NUM_RAW_FEATURES
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from .synthetic_data import compute_global_stats, generate_synthetic_dataset

# ────────────────────────────────────────────────────────────────
# Paths & Config
# ────────────────────────────────────────────────────────────────

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "model_xgb.joblib")
STATS_PATH = os.path.join(ARTIFACTS_DIR, "global_stats.joblib")
BASELINE_DB = os.path.join(ARTIFACTS_DIR, "user_baselines.db")

MANIFEST_PATH = os.path.join(ARTIFACTS_DIR, "artifacts_manifest.json")

# Optional environment variables
# If set, load_model() can auto-download these artifacts if missing:
#   MINDPULSE_MODEL_URL
#   MINDPULSE_STATS_URL
# Optional checksum env vars:
#   MINDPULSE_MODEL_SHA256
#   MINDPULSE_STATS_SHA256
# Optional real dataset CSV:
#   MINDPULSE_REAL_DATA_CSV
# Optional label column:
#   MINDPULSE_LABEL_COLUMN (default: "stress_label")


# ────────────────────────────────────────────────────────────────
# Utility helpers
# ────────────────────────────────────────────────────────────────


def _sha256_of_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _download_file(url: str, destination: str, timeout: int = 30) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "MindPulse/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        content = resp.read()
    tmp = destination + ".tmp"
    with open(tmp, "wb") as f:
        f.write(content)
    os.replace(tmp, destination)


def _validate_stats_object(stats: dict) -> None:
    if not isinstance(stats, dict):
        raise ValueError("Global stats must be a dict.")
    if "mean" not in stats or "std" not in stats:
        raise ValueError("Global stats must contain keys: 'mean' and 'std'.")
    mean = np.asarray(stats["mean"], dtype=np.float32)
    std = np.asarray(stats["std"], dtype=np.float32)
    if mean.shape != (NUM_RAW_FEATURES,) or std.shape != (NUM_RAW_FEATURES,):
        raise ValueError(
            f"Stats shape mismatch. Expected {(NUM_RAW_FEATURES,)}, got mean={mean.shape}, std={std.shape}"
        )
    if np.any(~np.isfinite(mean)) or np.any(~np.isfinite(std)):
        raise ValueError("Stats contain non-finite values.")
    if np.any(std < 0):
        raise ValueError("Stats std contains negative values.")


def _validate_model_object(model) -> None:
    if not hasattr(model, "predict_proba"):
        raise ValueError("Model object missing predict_proba().")
    # sanity test on input dimensionality (46)
    x = np.zeros((1, NUM_RAW_FEATURES * 2), dtype=np.float32)
    out = model.predict_proba(x)
    out = np.asarray(out)
    if out.ndim != 2 or out.shape[1] != 3:
        raise ValueError(
            f"Model predict_proba output must be shape [N,3], got {out.shape}"
        )


def _write_manifest(extra: Optional[dict] = None) -> None:
    data = {
        "timestamp_utc_ms": int(time.time() * 1000),
        "model_path": MODEL_PATH,
        "stats_path": STATS_PATH,
        "model_sha256": _sha256_of_file(MODEL_PATH)
        if os.path.exists(MODEL_PATH)
        else None,
        "stats_sha256": _sha256_of_file(STATS_PATH)
        if os.path.exists(STATS_PATH)
        else None,
        "num_raw_features": NUM_RAW_FEATURES,
        "num_model_features": NUM_RAW_FEATURES * 2,
        "feature_names": FEATURE_NAMES,
    }
    if extra:
        data.update(extra)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ────────────────────────────────────────────────────────────────
# 1. Dual Normalizer
# ────────────────────────────────────────────────────────────────


class DualNormalizer:
    """
    Two-stage normalization: Global + Per-User Circadian.
    Returns 46-dim vector: [23 global z-scores, 23 user z-scores]
    """

    def __init__(self, global_stats: dict):
        _validate_stats_object(global_stats)
        self.global_mean = np.asarray(global_stats["mean"], dtype=np.float32)
        self.global_std = np.asarray(global_stats["std"], dtype=np.float32)

    def transform(
        self,
        features: np.ndarray,
        hour: int,
        baseline: Optional["PersonalBaseline"] = None,
    ) -> np.ndarray:
        x = np.asarray(features, dtype=np.float32).reshape(-1)
        if x.shape[0] != NUM_RAW_FEATURES:
            raise ValueError(
                f"Expected {NUM_RAW_FEATURES} raw features, got {x.shape[0]}"
            )

        z_global = (x - self.global_mean) / (self.global_std + 1e-8)

        if baseline is not None and baseline.is_calibrated():
            z_user = baseline.compute_deviations(x, int(hour))
        else:
            z_user = np.zeros_like(x, dtype=np.float32)

        return np.concatenate([z_global, z_user]).astype(np.float32)


# ────────────────────────────────────────────────────────────────
# 2. Personal Baseline (SQLite + EMA)
# ────────────────────────────────────────────────────────────────


class PersonalBaseline:
    """
    Per-user, per-hour baseline tracker with EMA.
    Persists to SQLite across sessions.
    """

    def __init__(self, db_path: str = BASELINE_DB, alpha: float = 0.05):
        self.db_path = db_path
        self.alpha = float(alpha)
        self._init_db()

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        conn = self._connect()
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS baselines (
                    feature_idx INTEGER,
                    hour INTEGER,
                    mean REAL,
                    std REAL,
                    sample_count INTEGER DEFAULT 0,
                    PRIMARY KEY (feature_idx, hour)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS session_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp_ms REAL,
                    score REAL,
                    label TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp_ms REAL,
                    model_label TEXT,
                    user_feedback TEXT,
                    score REAL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value REAL
                )
                """
            )
            conn.commit()
        finally:
            conn.close()

    def update(self, features: np.ndarray, hour: int):
        x = np.asarray(features, dtype=np.float32).reshape(-1)
        if x.shape[0] != NUM_RAW_FEATURES:
            raise ValueError(f"Expected {NUM_RAW_FEATURES} features, got {x.shape[0]}")

        h = int(hour)
        conn = self._connect()
        c = conn.cursor()
        try:
            for idx in range(NUM_RAW_FEATURES):
                val = float(x[idx])
                row = c.execute(
                    "SELECT mean, std, sample_count FROM baselines WHERE feature_idx=? AND hour=?",
                    (idx, h),
                ).fetchone()

                if row is None:
                    c.execute(
                        "INSERT INTO baselines VALUES (?, ?, ?, ?, ?)",
                        (idx, h, val, 0.1, 1),
                    )
                else:
                    old_mean, old_std, count = row
                    count = int(count) + 1
                    eff_alpha = min(self.alpha * 3.0, 0.3) if count < 50 else self.alpha
                    new_mean = (1.0 - eff_alpha) * float(old_mean) + eff_alpha * val
                    new_std = (1.0 - eff_alpha) * float(old_std) + eff_alpha * abs(
                        val - float(old_mean)
                    )
                    c.execute(
                        """
                        UPDATE baselines
                        SET mean=?, std=?, sample_count=?
                        WHERE feature_idx=? AND hour=?
                        """,
                        (new_mean, max(new_std, 1e-6), count, idx, h),
                    )
            conn.commit()
        finally:
            conn.close()

    def compute_deviations(self, features: np.ndarray, hour: int) -> np.ndarray:
        x = np.asarray(features, dtype=np.float32).reshape(-1)
        if x.shape[0] != NUM_RAW_FEATURES:
            raise ValueError(f"Expected {NUM_RAW_FEATURES} features, got {x.shape[0]}")

        h = int(hour)
        dev = np.zeros(NUM_RAW_FEATURES, dtype=np.float32)

        conn = self._connect()
        c = conn.cursor()
        try:
            for idx in range(NUM_RAW_FEATURES):
                row = c.execute(
                    "SELECT mean, std FROM baselines WHERE feature_idx=? AND hour=?",
                    (idx, h),
                ).fetchone()
                if row:
                    mean, std = float(row[0]), max(float(row[1]), 1e-6)
                    dev[idx] = (x[idx] - mean) / std
        finally:
            conn.close()

        return dev

    def is_calibrated(self) -> bool:
        conn = self._connect()
        c = conn.cursor()
        try:
            rows = c.execute(
                "SELECT hour, MIN(sample_count) FROM baselines GROUP BY hour"
            ).fetchall()
        finally:
            conn.close()

        if not rows:
            return False
        hours_covered = len(rows)
        min_samples = min(int(r[1]) for r in rows)
        # relaxed MVP threshold
        return hours_covered >= 4 and min_samples >= 5

    def save_session_score(self, timestamp_ms: float, score: float, label: str):
        conn = self._connect()
        try:
            conn.execute(
                "INSERT INTO session_history (timestamp_ms, score, label) VALUES (?, ?, ?)",
                (float(timestamp_ms), float(score), str(label)),
            )
            conn.commit()
        finally:
            conn.close()

    def get_session_history(self, limit_hours: int = 24) -> list:
        cutoff = (time.time() * 1000.0) - (float(limit_hours) * 3600000.0)
        conn = self._connect()
        try:
            rows = conn.execute(
                """
                SELECT timestamp_ms, score, label
                FROM session_history
                WHERE timestamp_ms >= ?
                ORDER BY timestamp_ms ASC
                """,
                (cutoff,),
            ).fetchall()
        finally:
            conn.close()
        return rows

    def save_feedback(
        self, timestamp_ms: float, model_label: str, user_feedback: str, score: float
    ):
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO feedback_events (timestamp_ms, model_label, user_feedback, score)
                VALUES (?, ?, ?, ?)
                """,
                (
                    float(timestamp_ms),
                    str(model_label),
                    str(user_feedback),
                    float(score),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    def get_calibration_status(
        self, target_samples_per_hour: int = 20, min_hours_covered: int = 4
    ) -> dict:
        conn = self._connect()
        c = conn.cursor()
        try:
            rows = c.execute(
                "SELECT hour, MIN(sample_count) FROM baselines GROUP BY hour"
            ).fetchall()
            session_days = c.execute(
                "SELECT COUNT(DISTINCT date(timestamp_ms/1000, 'unixepoch')) FROM session_history"
            ).fetchone()
        finally:
            conn.close()

        samples_per_hour = {int(hour): int(count or 0) for hour, count in rows}
        hours_covered = len(samples_per_hour)
        if samples_per_hour:
            avg_hour_completion = np.mean(
                [
                    min(float(v) / float(max(target_samples_per_hour, 1)), 1.0)
                    for v in samples_per_hour.values()
                ]
            )
        else:
            avg_hour_completion = 0.0

        hour_coverage_completion = min(hours_covered / 24.0, 1.0)
        completion_pct = round(
            (0.6 * avg_hour_completion + 0.4 * hour_coverage_completion) * 100.0, 1
        )

        min_samples = min(samples_per_hour.values()) if samples_per_hour else 0
        is_calibrated = hours_covered >= int(min_hours_covered) and min_samples >= max(
            5, int(target_samples_per_hour * 0.25)
        )

        return {
            "is_calibrated": bool(is_calibrated),
            "days_collected": int(session_days[0]) if session_days else 0,
            "samples_per_hour": samples_per_hour,
            "completion_pct": completion_pct,
            "calibration_quality": round(completion_pct / 100.0, 3),
        }

    def get_settings(self) -> dict:
        conn = self._connect()
        try:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
            settings = {row[0]: row[1] for row in rows}
            # Default values
            if "mild_threshold" not in settings:
                settings["mild_threshold"] = 55.0
            if "high_threshold" not in settings:
                settings["high_threshold"] = 75.0
            return settings
        finally:
            conn.close()

    def update_settings(self, mild: Optional[float] = None, high: Optional[float] = None):
        conn = self._connect()
        try:
            if mild is not None:
                conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                    ("mild_threshold", float(mild)),
                )
            if high is not None:
                conn.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                    ("high_threshold", float(high)),
                )
            conn.commit()
        finally:
            conn.close()

    def get_feedback_bias(self) -> float:
        """
        Calculates a bias offset based on recent user feedback.
        If user often says 'Actually Calm' (NEUTRAL) when model says 'STRESSED',
        this returns a negative value to lower the score.
        """
        conn = self._connect()
        try:
            # Look at last 5 feedback events
            rows = conn.execute(
                """
                SELECT model_label, user_feedback, score 
                FROM feedback_events 
                ORDER BY timestamp_ms DESC 
                LIMIT 5
                """
            ).fetchall()
        finally:
            conn.close()

        if not rows:
            return 0.0

        offsets = []
        for model_label, user_feedback, score in rows:
            # Basic mapping: NEUTRAL=25, MILD=55, STRESSED=85
            level_map = {"NEUTRAL": 25, "MILD": 55, "STRESSED": 85}
            target = level_map.get(user_feedback, 50)
            
            # If the score was saved as 0.0, we use the model_label as proxy
            current = score if score > 0 else level_map.get(model_label, 50)
            
            # The bias needed to get from 'current' to 'target'
            offsets.append(target - current)

        # Average the offsets, weighted toward most recent (already sorted desc)
        weights = [1.0, 0.8, 0.6, 0.4, 0.2][:len(offsets)]
        weighted_sum = sum(o * w for o, w in zip(offsets, weights))
        return float(weighted_sum / sum(weights))

    def reset(self):
        conn = self._connect()
        try:
            conn.execute("DELETE FROM baselines")
            conn.execute("DELETE FROM session_history")
            conn.execute("DELETE FROM feedback_events")
            conn.commit()
        finally:
            conn.close()


# ────────────────────────────────────────────────────────────────
# 3. Data Loading for Real CSV Training
# ────────────────────────────────────────────────────────────────


def _load_real_dataset_from_csv(
    csv_path: str,
    label_column: str = "stress_label",
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Expected CSV:
      - columns for all FEATURE_NAMES (23 raw features)
      - one label column:
          * int labels: 0/1/2
          * or strings: NEUTRAL/MILD/STRESSED
    """
    import pandas as pd

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Real-data CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)

    missing = [c for c in FEATURE_NAMES if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing required feature columns: {missing}")

    if label_column not in df.columns:
        raise ValueError(f"CSV missing label column '{label_column}'")

    X = df[FEATURE_NAMES].to_numpy(dtype=np.float32)

    raw_y = df[label_column].values
    if np.issubdtype(np.asarray(raw_y).dtype, np.number):
        y = np.asarray(raw_y, dtype=np.int32)
    else:
        mapper = {"NEUTRAL": 0, "MILD": 1, "STRESSED": 2}
        y = np.array(
            [mapper.get(str(v).strip().upper(), -1) for v in raw_y], dtype=np.int32
        )

    valid = np.isin(y, [0, 1, 2])
    X, y = X[valid], y[valid]

    if len(X) < 10:
        raise ValueError("Not enough valid rows in real dataset after filtering (<10).")

    return X, y


# ────────────────────────────────────────────────────────────────
# 4. Training
# ────────────────────────────────────────────────────────────────


def _build_xgb_classifier() -> xgb.XGBClassifier:
    return xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=3,
        max_depth=5,
        learning_rate=0.05,
        n_estimators=500,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=5,
        gamma=0.1,
        reg_alpha=0.05,
        reg_lambda=1.5,
        scale_pos_weight=1.0,
        eval_metric="mlogloss",
        random_state=42,
        tree_method="hist",
        early_stopping_rounds=30,
    )


def _normalize_dataset_for_training(X_raw: np.ndarray, stats: dict) -> np.ndarray:
    normalizer = DualNormalizer(stats)
    hour_idx = FEATURE_NAMES.index("hour_of_day")
    X_norm = np.array(
        [
            normalizer.transform(X_raw[i], hour=int(X_raw[i, hour_idx]), baseline=None)
            for i in range(len(X_raw))
        ],
        dtype=np.float32,
    )
    return X_norm


def train_model(
    n_samples: int = 3000,
    force_retrain: bool = False,
    real_data_csv: Optional[str] = None,
    label_column: str = "stress_label",
) -> Dict[str, object]:
    """
    Train the classifier and persist artifacts.
    Priority:
      1) real_data_csv if provided and valid
      2) env MINDPULSE_REAL_DATA_CSV
      3) synthetic fallback
    """
    if os.path.exists(MODEL_PATH) and os.path.exists(STATS_PATH) and not force_retrain:
        return {"status": "skipped_existing"}

    csv_path = real_data_csv or os.getenv("MINDPULSE_REAL_DATA_CSV")
    label_col = os.getenv("MINDPULSE_LABEL_COLUMN", label_column)

    source = "synthetic"
    if csv_path:
        try:
            X_raw, y = _load_real_dataset_from_csv(csv_path, label_col)
            source = "real_csv"
        except Exception as e:
            print(
                f"[WARN] Real-data CSV training failed ({e}). Falling back to synthetic."
            )
            X_raw, y, _ = generate_synthetic_dataset(n_samples=n_samples)
            source = "synthetic_fallback"
    else:
        X_raw, y, _ = generate_synthetic_dataset(n_samples=n_samples)
        source = "synthetic"

    stats = compute_global_stats(X_raw)
    _validate_stats_object(stats)
    joblib.dump(stats, STATS_PATH)

    X = _normalize_dataset_for_training(X_raw, stats)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    model = _build_xgb_classifier()
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    y_pred = model.predict(X_val)
    metrics = {
        "accuracy": float(accuracy_score(y_val, y_pred)),
        "precision_macro": float(
            precision_score(y_val, y_pred, average="macro", zero_division=0.0)
        ),
        "recall_macro": float(
            recall_score(y_val, y_pred, average="macro", zero_division=0.0)
        ),
        "f1_macro": float(f1_score(y_val, y_pred, average="macro")),
    }

    print("\n[MindPulse] Validation Metrics")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")
    print(
        classification_report(
            y_val, y_pred, target_names=["NEUTRAL", "MILD", "STRESSED"]
        )
    )

    joblib.dump(model, MODEL_PATH)
    _validate_model_object(model)

    _write_manifest(
        {
            "training_source": source,
            "num_samples_raw": int(len(X_raw)),
            "metrics_validation": metrics,
            "label_column": label_col,
        }
    )

    return {"status": "trained", **metrics, "source": source}


# ────────────────────────────────────────────────────────────────
# 5. Pretrained artifact download
# ────────────────────────────────────────────────────────────────


def download_pretrained_artifacts(
    model_url: Optional[str] = None,
    stats_url: Optional[str] = None,
    model_sha256: Optional[str] = None,
    stats_sha256: Optional[str] = None,
    overwrite: bool = False,
) -> Dict[str, str]:
    """
    Download model/stats artifacts from URLs (e.g., Hugging Face, GitHub release assets).
    Validates basic loadability and optional SHA256 if provided.
    """
    m_url = model_url or os.getenv("MINDPULSE_MODEL_URL")
    s_url = stats_url or os.getenv("MINDPULSE_STATS_URL")
    m_sha = model_sha256 or os.getenv("MINDPULSE_MODEL_SHA256")
    s_sha = stats_sha256 or os.getenv("MINDPULSE_STATS_SHA256")

    if not m_url or not s_url:
        raise ValueError("Both model_url and stats_url are required.")

    if (not overwrite) and os.path.exists(MODEL_PATH) and os.path.exists(STATS_PATH):
        # validate existing before early return
        model = joblib.load(MODEL_PATH)
        stats = joblib.load(STATS_PATH)
        _validate_model_object(model)
        _validate_stats_object(stats)
        return {"status": "already_present"}

    _download_file(m_url, MODEL_PATH)
    _download_file(s_url, STATS_PATH)

    if m_sha:
        got = _sha256_of_file(MODEL_PATH)
        if got.lower() != m_sha.lower():
            raise ValueError(f"Model SHA256 mismatch. expected={m_sha}, got={got}")
    if s_sha:
        got = _sha256_of_file(STATS_PATH)
        if got.lower() != s_sha.lower():
            raise ValueError(f"Stats SHA256 mismatch. expected={s_sha}, got={got}")

    # Load and validate
    model = joblib.load(MODEL_PATH)
    stats = joblib.load(STATS_PATH)
    _validate_model_object(model)
    _validate_stats_object(stats)

    _write_manifest(
        {
            "training_source": "downloaded_pretrained",
            "model_url": m_url,
            "stats_url": s_url,
        }
    )
    return {"status": "downloaded_ok"}


# ────────────────────────────────────────────────────────────────
# 6. Hardened load_model()
# ────────────────────────────────────────────────────────────────


def load_model(
    allow_download: bool = True,
    allow_train_fallback: bool = True,
    force_retrain: bool = False,
    real_data_csv: Optional[str] = None,
) -> Tuple[xgb.XGBClassifier, dict]:
    """
    Robust load order:
      1) If force_retrain=True => train now
      2) Try local artifacts
      3) If missing/corrupt and allow_download=True, try download from env URLs
      4) If still unavailable and allow_train_fallback=True, train local fallback
      5) Else raise RuntimeError
    """
    if force_retrain:
        train_model(force_retrain=True, real_data_csv=real_data_csv)

    # Step 1: try local
    if os.path.exists(MODEL_PATH) and os.path.exists(STATS_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            stats = joblib.load(STATS_PATH)
            _validate_model_object(model)
            _validate_stats_object(stats)
            return model, stats
        except Exception as e:
            print(f"[WARN] Local artifacts invalid/corrupt: {e}")

    # Step 2: try download only when URLs are configured
    model_url = os.getenv("MINDPULSE_MODEL_URL")
    stats_url = os.getenv("MINDPULSE_STATS_URL")
    if allow_download and model_url and stats_url:
        try:
            result = download_pretrained_artifacts(overwrite=True)
            print(f"[MindPulse] Pretrained download result: {result}")
            model = joblib.load(MODEL_PATH)
            stats = joblib.load(STATS_PATH)
            _validate_model_object(model)
            _validate_stats_object(stats)
            return model, stats
        except Exception as e:
            print(f"[WARN] Pretrained artifact download failed: {e}")

    # Step 3: train fallback
    if allow_train_fallback:
        train_model(force_retrain=True, real_data_csv=real_data_csv)
        model = joblib.load(MODEL_PATH)
        stats = joblib.load(STATS_PATH)
        _validate_model_object(model)
        _validate_stats_object(stats)
        return model, stats

    raise RuntimeError(
        "Unable to load model artifacts. Provide local artifacts, set pretrained URLs, or enable training fallback."
    )


# ────────────────────────────────────────────────────────────────
# 7. CLI self-test
# ────────────────────────────────────────────────────────────────
#
# Self-test removed — use scripts/evaluate_model.py or run the FastAPI app directly.
# The __main__ block doesn't work with relative imports in a package.
