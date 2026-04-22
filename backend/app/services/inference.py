"""MindPulse Backend — Inference Service."""

from __future__ import annotations
import logging
import numpy as np
import time
from typing import Dict, List, Optional

from app.core.config import (
    FEATURE_NAMES,
    LABELS,
    STRESS_SCORE_THRESHOLD_MILD,
    STRESS_SCORE_THRESHOLD_HIGH,
    MODEL_SCORE_WEIGHT,
)

# ═══════════════════════════════════════════════════════════════
# DYNAMIC HYBRID WEIGHTING (Issue #2 Fix)
# ═══════════════════════════════════════════════════════════════

def compute_adaptive_weight(
    confidence: float,
    is_calibrated: bool,
    model_score: float,
    equation_score: float,
    base_weight: float = MODEL_SCORE_WEIGHT,
) -> float:
    """
    Compute adaptive weight for ML/heuristic blend.
    
    Logic:
    - High confidence (>0.8) → trust ML more (+0.15)
    - Low confidence (<0.5) → trust heuristic more (-0.15)
    - Uncalibrated user → conservative (-0.10)
    - Large ML/heuristic disagreement → reduce ML weight
    
    Returns weight in range [0.5, 0.9]
    """
    weight = base_weight
    
    # Adjust based on confidence
    if confidence > 0.8:
        weight += 0.15  # High confidence → trust ML
    elif confidence < 0.5:
        weight -= 0.15  # Low confidence → trust heuristic
    
    # Safety for new users
    if not is_calibrated:
        weight -= 0.10
    
    # If ML and heuristic strongly disagree, be conservative
    score_diff = abs(model_score - equation_score)
    if score_diff > 30:  # >30 point disagreement
        weight -= 0.05
    
    # Clamp to valid range [0.5, 0.9]
    return float(max(0.5, min(0.9, weight)))

logger = logging.getLogger("mindpulse.inference")


class InferenceEngine:
    """Wraps XGBoost model + DualNormalizer for stress prediction with SHAP explainability."""

    def __init__(self):
        self._model = None
        self._stats = None
        self._normalizer = None
        self._baselines = {}
        self._ready = False
        self._shap_explainer = None
        self._use_ensemble = False
        self._ensemble = None
        self._lstm_model = None
        self._lstm_buffer = {}  # user_id -> list of recent feature vectors

    @staticmethod
    def _sigmoid(x: float) -> float:
        x = max(min(x, 8.0), -8.0)
        return 1.0 / (1.0 + np.exp(-x))

    @staticmethod
    def _clamp_score(x: float) -> float:
        return float(max(0.0, min(100.0, x)))

    def _feature_risk(
        self, z_values: dict, name: str, invert: bool = False, default: float = 0.0
    ) -> float:
        z = float(z_values.get(name, default))
        z = -z if invert else z
        # Clamping Z-scores between -3 and 3 to prevent sigmoid pegging (Root Cause 1)
        z = max(min(z, 3.0), -3.0) 
        return float(self._sigmoid(z))

    def _compute_equation_score(
        self, features: dict, raw: np.ndarray, baseline, hour: int, is_idle: bool = False
    ) -> tuple[float, dict]:
        z_values = {}

        try:
            if baseline is not None and baseline.is_calibrated():
                z_user = baseline.compute_deviations(raw, hour)
                z_values = {
                    name: float(z_user[i]) for i, name in enumerate(FEATURE_NAMES)
                }
            elif self._stats is not None:
                mean = np.asarray(self._stats["mean"], dtype=np.float32)
                std = np.asarray(self._stats["std"], dtype=np.float32) + 1e-8
                z_global = (raw - mean) / std
                z_values = {
                    name: float(z_global[i]) for i, name in enumerate(FEATURE_NAMES)
                }
        except Exception:
            z_values = {}

        # 1. Idle Grounding: If idle, deviations are forced to zero (Root Cause 1 / Fix 1)
        if is_idle:
            z_values = {name: 0.0 for name in FEATURE_NAMES}
            logger.debug("Idle detected: Neutralizing all z-score deviations")

        # 2. Weighted Attribution: Prioritize high-signal features (Root Cause 3)
        keyboard = (
            0.35 * self._feature_risk(z_values, "error_rate") +
            0.20 * self._feature_risk(z_values, "hold_time_std") +
            0.20 * self._feature_risk(z_values, "flight_time_std") +
            0.15 * self._feature_risk(z_values, "pause_frequency") +
            0.10 * self._feature_risk(z_values, "rhythm_entropy")
        )
        speed = self._feature_risk(z_values, "typing_speed_wpm", invert=True)
        switching = (
            0.50 * self._feature_risk(z_values, "tab_switch_freq") +
            0.20 * self._feature_risk(z_values, "switch_entropy") +
            0.30 * self._feature_risk(z_values, "session_fragmentation")
        )
        mouse = (
            0.50 * self._feature_risk(z_values, "rage_click_count") +
            0.25 * self._feature_risk(z_values, "mouse_speed_std") +
            0.25 * self._feature_risk(z_values, "direction_change_rate")
        )

        reentry_count = float(features.get("mouse_reentry_count", 0.0))
        reentry_latency = float(features.get("mouse_reentry_latency_ms", 0.0))
        reentry = np.mean(
            [
                self._sigmoid((reentry_count - 1.0) / 2.0),
                self._sigmoid((reentry_latency - 3000.0) / 1500.0),
            ]
        )

        contributions = {
            "S_keyboard": round(float(keyboard) * 100.0, 1),
            "S_speed": round(float(speed) * 100.0, 1),
            "S_switching": round(float(switching) * 100.0, 1),
            "S_mouse": round(float(mouse) * 100.0, 1),
            "S_reentry": round(float(reentry) * 100.0, 1),
        }

        # Idle sensitivity check: If no activity, keep scores low
        is_idle = float(features.get("typing_speed_wpm", 0.0)) == 0 and float(features.get("click_count", 0)) == 0
        
        equation_score = (
            0.30 * contributions["S_keyboard"]
            + 0.15 * contributions["S_speed"]
            + 0.25 * contributions["S_switching"]
            + 0.20 * contributions["S_mouse"]
            + 0.10 * contributions["S_reentry"]
        )

        if is_idle:
            equation_score *= 0.3  # Aggressive reduction when grounded
            
        return self._clamp_score(float(equation_score)), contributions

    @staticmethod
    def _level_from_score(score: float) -> str:
        if score >= STRESS_SCORE_THRESHOLD_HIGH:
            return "STRESSED"
        if score >= STRESS_SCORE_THRESHOLD_MILD:
            return "MILD"
        return "NEUTRAL"

    def load(self, use_ensemble: bool = False):
        """Lazy-load model from ml package.
        
        Args:
            use_ensemble: If True, load ensemble models instead of single XGBoost
        """
        if self._ready:
            return
        
        self._use_ensemble = use_ensemble
        
        if use_ensemble:
            self._load_ensemble()
        else:
            self._load_single_model()

    def _load_single_model(self):
        """Load single XGBoost model (original behavior)."""
        try:
            from app.ml.model import load_model, DualNormalizer

            self._model, self._stats = load_model(
                allow_download=True, allow_train_fallback=True
            )
            self._normalizer = DualNormalizer(self._stats)
            self._ready = True
            logger.info("Model loaded successfully")

            try:
                import shap

                self._shap_explainer = shap.TreeExplainer(self._model)
                logger.info("SHAP explainer initialized")
            except Exception as e:
                logger.warning(f"SHAP explainer unavailable: {e}")
                self._shap_explainer = None
        except Exception as e:
            logger.error(f"Model load failed: {e}")
            self._ready = False

    def _load_ensemble(self):
        """Load ensemble models."""
        try:
            from app.ml.ensemble import ensemble as ensemble_model
            
            ensemble_model.load(allow_train_fallback=True)
            
            if ensemble_model.is_ready:
                self._ensemble = ensemble_model
                self._ready = True
                logger.info("Ensemble models loaded successfully")
            else:
                logger.warning("Ensemble not ready, falling back to single model")
                self._load_single_model()
        except Exception as e:
            logger.error(f"Ensemble load failed: {e}")
            self._load_single_model()

    def _get_baseline(self, user_id: str):
        """Get or create a PersonalBaseline for a user."""
        if user_id not in self._baselines:
            try:
                from app.ml.model import PersonalBaseline, BASELINE_DB
                import os

                db_path = BASELINE_DB.replace(".db", f"_{user_id}.db")
                self._baselines[user_id] = PersonalBaseline(db_path=db_path)
            except Exception:
                self._baselines[user_id] = None
        return self._baselines[user_id]

    @property
    def is_ready(self) -> bool:
        return self._ready and (self._model is not None or self._ensemble is not None)

    def _compute_shap_values(self, z: np.ndarray) -> Optional[dict]:
        """Compute SHAP values for feature-level explainability."""
        if self._shap_explainer is None:
            return None
        try:
            shap_values = self._shap_explainer.shap_values(z.reshape(1, -1))
            # Handle multi-class output (list of arrays) or single array
            if isinstance(shap_values, list):
                # For multi-class, use STRESSED class (index 2)
                shap_values = (
                    shap_values[2] if len(shap_values) > 2 else shap_values[-1]
                )

            # Ensure shap_values is a 2D array
            if shap_values.ndim == 1:
                shap_values = shap_values.reshape(1, -1)

            shap_dict = {}
            num_features = len(FEATURE_NAMES)

            for i, name in enumerate(FEATURE_NAMES):
                # For dual normalization, we have 2x features (global + user)
                # Take whichever index exists
                idx = i if i < shap_values.shape[1] else i % num_features
                if idx < shap_values.shape[1]:
                    try:
                        val = float(np.atleast_1d(shap_values[0, idx])[0])
                        if abs(val) > 0.001:
                            shap_dict[name] = round(val, 4)
                    except (TypeError, ValueError, IndexError):
                        continue

            return (
                dict(sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True))
                if shap_dict
                else None
            )
        except Exception as e:
            logger.warning(f"SHAP computation failed: {e}")
            return None

    def predict(self, features_dict: dict, user_id: str = "default") -> dict:
        """Run inference and return structured result."""
        missing = [f for f in FEATURE_NAMES if f not in features_dict]
        if missing:
            preview = ", ".join(missing[:3])
            if len(missing) > 3:
                preview = f"{preview}, ... (+{len(missing) - 3} more)"
            return self._fallback_result(
                message=f"Missing required features: {preview}"
            )

        raw = np.array([features_dict[f] for f in FEATURE_NAMES], dtype=np.float32)

        hour = int(features_dict.get("hour_of_day", 12))
        baseline = self._get_baseline(user_id)
        # Determine idle state early for both equation and model grounding
        is_idle = float(features_dict.get("typing_speed_wpm", 0.0)) == 0 and float(features_dict.get("click_count", 0)) == 0

        equation_score, contributions = self._compute_equation_score(
            features_dict, raw, baseline, hour, is_idle=is_idle
        )

        # ═══════════════════════════════════════════════════════
        # LSTM BUFFER: Track recent features for temporal model
        # ═══════════════════════════════════════════════════════
        if user_id not in self._lstm_buffer:
            self._lstm_buffer[user_id] = []
        self._lstm_buffer[user_id].append(raw.tolist())
        # Keep last 30 windows (150 seconds)
        if len(self._lstm_buffer[user_id]) > 30:
            self._lstm_buffer[user_id] = self._lstm_buffer[user_id][-30:]

        shap_values = None

        if not self.is_ready:
            model_score = 0.0
            final_score = equation_score
            level = self._level_from_score(final_score)
            confidence = 0.45
            probs = np.array([0.33, 0.33, 0.34], dtype=np.float32)
            adaptive_weight = MODEL_SCORE_WEIGHT
        else:
            z = self._normalizer.transform(raw, hour, baseline)

            if self._ensemble is not None and self._ensemble.is_ready:
                # ═══════════════════════════════════════════════════════
                # ENSEMBLE PREDICTION (Week 5-6)
                # ═══════════════════════════════════════════════════════
                ensemble_result = self._ensemble.predict(z)
                probs = np.array([
                    ensemble_result["probabilities"]["NEUTRAL"],
                    ensemble_result["probabilities"]["MILD"],
                    ensemble_result["probabilities"]["STRESSED"],
                ], dtype=np.float32)
                confidence = ensemble_result["confidence"]
                model_score = float(
                    probs[0] * 5.0 + probs[1] * 55.0 + probs[2] * 100.0
                )
            else:
                probs = self._model.predict_proba(z.reshape(1, -1))[0]
                confidence = float(np.max(probs))
                model_score = float(probs[0] * 5.0 + probs[1] * 55.0 + probs[2] * 100.0)

                shap_values = self._compute_shap_values(z)

            # ═══════════════════════════════════════════════════════
            # DYNAMIC WEIGHTING (Issue #2)
            # ═══════════════════════════════════════════════════════
            is_calibrated = baseline is not None and baseline.is_calibrated()
            adaptive_weight = compute_adaptive_weight(
                confidence=confidence,
                is_calibrated=is_calibrated,
                model_score=model_score,
                equation_score=equation_score,
            )

            final_score = (
                adaptive_weight * model_score
                + (1.0 - adaptive_weight) * equation_score
            )

            # ═══════════════════════════════════════════════════════
            # LSTM TEMPORAL CHECK (Month 2-3)
            # Second opinion for borderline cases
            # ═══════════════════════════════════════════════════════
            lstm_adjustment = 0.0
            if self._lstm_model and self._lstm_model.is_ready:
                near_boundary = 60 <= final_score <= 80
                if near_boundary and len(self._lstm_buffer.get(user_id, [])) >= 12:
                    sequence = np.array(self._lstm_buffer[user_id][-12:], dtype=np.float32)
                    lstm_result = self._lstm_model.predict_sequence(sequence)
                    lstm_score = float(
                        lstm_result["probabilities"]["NEUTRAL"] * 5.0
                        + lstm_result["probabilities"]["MILD"] * 55.0
                        + lstm_result["probabilities"]["STRESSED"] * 100.0
                    )
                    # Blend LSTM as second opinion (20% weight)
                    lstm_adjustment = (lstm_score - final_score) * 0.2
                    final_score += lstm_adjustment

            # ═══════════════════════════════════════════════════════
            # ONLINE LEARNING ADAPTER (Month 2-3)
            # Per-user adjustments
            # ═══════════════════════════════════════════════════════
            from app.ml.online_learning import online_learner
            try:
                final_score, adjusted_probs_dict = online_learner.apply_adapter(
                    user_id, final_score,
                    {l: round(float(p), 3) for l, p in zip(LABELS, probs)}
                )
                # Update probs from adapter
                probs = np.array([
                    adjusted_probs_dict["NEUTRAL"],
                    adjusted_probs_dict["MILD"],
                    adjusted_probs_dict["STRESSED"],
                ], dtype=np.float32)
            except Exception as e:
                logger.warning(f"Online learning adapter failed: {e}")

            final_score = self._clamp_score(final_score)
            level = self._level_from_score(final_score)

        timestamp = time.time()

        if baseline:
            baseline.update(raw, hour)
            baseline.save_session_score(timestamp * 1000.0, final_score, level)

        insights = self._generate_insights(features_dict, level, shap_values)

        return {
            "score": round(final_score, 1),
            "model_score": round(model_score, 1),
            "equation_score": round(equation_score, 1),
            "final_score": round(final_score, 1),
            "adaptive_weight": round(adaptive_weight, 2) if self.is_ready else MODEL_SCORE_WEIGHT,
            "lstm_adjustment": round(lstm_adjustment, 2) if self.is_ready else 0.0,
            "level": level,
            "confidence": round(confidence, 3),
            "probabilities": {l: round(float(p), 3) for l, p in zip(LABELS, probs)},
            "feature_contributions": contributions,
            "shap_values": shap_values,
            "insights": insights,
            "timestamp": timestamp,
            "typing_speed_wpm": round(
                float(features_dict.get("typing_speed_wpm", 0)), 1
            ),
            "rage_click_count": int(features_dict.get("rage_click_count", 0)),
            "error_rate": round(float(features_dict.get("error_rate", 0)), 3),
            "click_count": int(features_dict.get("click_count", 0)),
            "mouse_speed_mean": round(
                float(features_dict.get("mouse_speed_mean", 0)), 1
            ),
            "mouse_reentry_count": round(
                float(features_dict.get("mouse_reentry_count", 0)), 1
            ),
            "mouse_reentry_latency_ms": round(
                float(features_dict.get("mouse_reentry_latency_ms", 0)), 1
            ),
        }

    def _generate_insights(
        self, features: dict, level: str, shap_values: Optional[dict] = None
    ) -> List[str]:
        """Generate human-readable stress insights from feature values and SHAP."""
        insights = []

        if shap_values:
            top_features = list(shap_values.items())[:3]
            for feat_name, impact in top_features:
                direction = "increasing" if impact > 0 else "decreasing"
                readable = feat_name.replace("_", " ")
                if impact > 0:
                    insights.append(
                        f"{readable.capitalize()} is {direction} stress likelihood"
                    )
                else:
                    insights.append(
                        f"{readable.capitalize()} is {direction} stress likelihood"
                    )

        if features.get("rage_click_count", 0) > 2:
            insights.append(
                "Frustrated clicking detected — consider taking a short break"
            )
        if features.get("error_rate", 0) > 0.1:
            insights.append("Higher than usual error rate — possible cognitive fatigue")
        if features.get("rhythm_entropy", 0) > 3.5:
            insights.append("Typing rhythm is erratic — stress may be affecting focus")
        if features.get("session_fragmentation", 0) > 0.7:
            insights.append(
                "Highly fragmented session — frequent context switching detected"
            )
        if features.get("tab_switch_freq", 0) > 10:
            insights.append("Rapid app switching — may indicate difficulty focusing")
        if features.get("typing_speed_wpm", 50) < 30:
            insights.append("Typing speed is lower than typical — possible fatigue")
        if features.get("mouse_speed_std", 0) > 150:
            insights.append("Inconsistent mouse movements — possible restlessness")
        if features.get("mouse_reentry_count", 0) > 2:
            insights.append(
                "Frequent mouse re-entry after switches — possible task thrashing"
            )

        if not insights and level == "STRESSED":
            insights.append("Multiple behavioral signals indicate elevated stress")

        seen = set()
        unique_insights = []
        for i in insights:
            if i not in seen:
                seen.add(i)
                unique_insights.append(i)

        return unique_insights[:3]

    def _fallback_result(
        self, message: str = "Model not loaded — check server logs"
    ) -> dict:
        """Return when model is not loaded."""
        return {
            "score": 0.0,
            "model_score": 0.0,
            "equation_score": 0.0,
            "final_score": 0.0,
            "level": "UNKNOWN",
            "confidence": 0.0,
            "probabilities": {"NEUTRAL": 0.33, "MILD": 0.33, "STRESSED": 0.34},
            "feature_contributions": {},
            "shap_values": None,
            "insights": [message],
            "timestamp": time.time(),
            "typing_speed_wpm": 0.0,
            "rage_click_count": 0,
            "error_rate": 0.0,
            "click_count": 0,
            "mouse_speed_mean": 0.0,
            "mouse_reentry_count": 0.0,
            "mouse_reentry_latency_ms": 0.0,
        }


    def reset_user_state(self, user_id: str):
        """Clear temporal memory and baseline for a user."""
        if user_id in self._last_scores:
            del self._last_scores[user_id]
        if user_id in self._baselines:
            del self._baselines[user_id]
        logger.info(f"State reset for user: {user_id}")


engine = InferenceEngine()
