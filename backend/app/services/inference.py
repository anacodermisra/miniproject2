"""MindPulse Backend — Inference Service (v3 — Stateful Temporal Engine)."""

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

logger = logging.getLogger("mindpulse.inference")


class InferenceEngine:
    """
    Stateful stress inference engine with:
    - Idle grounding (Fix 1)
    - Z-score clamping (Fix 2)
    - Dual-signal smoothing with spike persistence (Fix 3, 5, 6)
    - Gradual decay for recovery (Fix 4, 11)
    - Weighted feature aggregation (Fix 7)
    - Adaptive per-user sensitivity (Fix 8)
    - User-specific weights (Fix 9)
    - Session baseline (Fix 10)
    """

    def __init__(self):
        self._model = None
        self._stats = None
        self._normalizer = None
        self._baselines: Dict[str, object] = {}
        self._ready = False
        self._shap_explainer = None

        # ── Temporal state (Fix 3, 4, 11) ──────────────────────────────────
        self._prev_scores: Dict[str, float] = {}

        # ── Dual-signal channels (Fix 5, 6) ────────────────────────────────
        self._fast_scores: Dict[str, float] = {}
        self._slow_scores: Dict[str, float] = {}
        self._spike_counter: Dict[str, int] = {}

        # ── Personalization state (Fix 8, 9, 10) ───────────────────────────
        self._user_variance: Dict[str, float] = {}
        self._user_weights: Dict[str, dict] = {}
        self._session_mean: Dict[str, np.ndarray] = {}

    # ── Static helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _sigmoid(x: float) -> float:
        x = max(min(x, 8.0), -8.0)
        return 1.0 / (1.0 + np.exp(-x))

    @staticmethod
    def _clamp_score(x: float) -> float:
        return float(max(0.0, min(100.0, x)))

    # ── Fix 2 + Fix 8: Z-clamp + adaptive sensitivity ──────────────────────

    def _feature_risk(
        self,
        z_values: dict,
        name: str,
        invert: bool = False,
        default: float = 0.0,
        sensitivity: float = 1.0,
    ) -> float:
        z = float(z_values.get(name, default))
        z = -z if invert else z
        # Clamp to prevent sigmoid explosion (Fix 2)
        z = max(min(z, 3.0), -3.0)
        # Scale by per-user sensitivity (Fix 8)
        return float(self._sigmoid(z * sensitivity))

    # ── Fix 3: EMA smoothing helper ─────────────────────────────────────────

    def _smooth_score(self, user_id: str, current: float) -> float:
        prev = self._prev_scores.get(user_id, current)
        smoothed = 0.8 * prev + 0.2 * current
        self._prev_scores[user_id] = smoothed
        return smoothed

    # ── Fix 5 + Fix 6: Dual-signal with spike persistence ───────────────────

    def _dual_signal(self, user_id: str, current: float) -> float:
        fast_prev = self._fast_scores.get(user_id, current)
        slow_prev = self._slow_scores.get(user_id, current)

        fast = 0.5 * fast_prev + 0.5 * current   # reacts quickly
        slow = 0.9 * slow_prev + 0.1 * current   # reacts slowly

        self._fast_scores[user_id] = fast
        self._slow_scores[user_id] = slow

        # Spike persistence: only let a spike through after 2 consecutive frames (Fix 6)
        if fast - slow > 10:
            count = self._spike_counter.get(user_id, 0) + 1
            self._spike_counter[user_id] = count
            if count >= 2:
                return slow + 0.5 * (fast - slow)
            else:
                return slow  # suppress single-frame spike
        else:
            self._spike_counter[user_id] = 0
            return slow

    # ── Compute equation score ───────────────────────────────────────────────

    def _compute_equation_score(
        self,
        features: dict,
        raw: np.ndarray,
        baseline,
        hour: int,
        user_id: str = "default",
        is_idle: bool = False,
    ) -> tuple[float, dict]:

        # ── Fix 8: Update and compute adaptive sensitivity ──────────────────
        variance = float(np.std(raw))
        prev_var = self._user_variance.get(user_id, variance)
        updated_var = 0.9 * prev_var + 0.1 * variance
        self._user_variance[user_id] = updated_var
        sensitivity = 1.0 / (1.0 + updated_var)

        # ── Fix 10: Update session baseline ────────────────────────────────
        prev_session = self._session_mean.get(user_id, raw)
        self._session_mean[user_id] = 0.9 * prev_session + 0.1 * raw

        # ── Compute z-values ────────────────────────────────────────────────
        z_values: dict = {}
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

        # ── Fix 1: Idle grounding — force all signals to neutral ─────────────
        if is_idle:
            z_values = {k: 0.0 for k in FEATURE_NAMES}
            logger.debug("Idle detected: Neutralizing all z-score deviations")

        # ── Fix 9: Per-user weight config (fallback to defaults) ─────────────
        weights = self._user_weights.get(user_id, {
            "keyboard":  0.30,
            "speed":     0.15,
            "switching": 0.25,
            "mouse":     0.20,
            "reentry":   0.10,
        })

        # ── Fix 7: Weighted keyboard aggregation ─────────────────────────────
        keyboard = (
            0.30 * self._feature_risk(z_values, "error_rate",       sensitivity=sensitivity) +
            0.20 * self._feature_risk(z_values, "pause_frequency",  sensitivity=sensitivity) +
            0.20 * self._feature_risk(z_values, "rhythm_entropy",   sensitivity=sensitivity) +
            0.15 * self._feature_risk(z_values, "hold_time_std",    sensitivity=sensitivity) +
            0.15 * self._feature_risk(z_values, "flight_time_std",  sensitivity=sensitivity)
        )
        speed = self._feature_risk(z_values, "typing_speed_wpm", invert=True, sensitivity=sensitivity)
        switching = (
            0.50 * self._feature_risk(z_values, "tab_switch_freq",          sensitivity=sensitivity) +
            0.20 * self._feature_risk(z_values, "switch_entropy",            sensitivity=sensitivity) +
            0.30 * self._feature_risk(z_values, "session_fragmentation",     sensitivity=sensitivity)
        )
        mouse = (
            0.50 * self._feature_risk(z_values, "rage_click_count",          sensitivity=sensitivity) +
            0.25 * self._feature_risk(z_values, "mouse_speed_std",           sensitivity=sensitivity) +
            0.25 * self._feature_risk(z_values, "direction_change_rate",     sensitivity=sensitivity)
        )

        reentry_count   = float(features.get("mouse_reentry_count", 0.0))
        reentry_latency = float(features.get("mouse_reentry_latency_ms", 0.0))
        reentry = float(np.mean([
            self._sigmoid((reentry_count   - 1.0)    / 2.0),
            self._sigmoid((reentry_latency - 3000.0) / 1500.0),
        ]))

        contributions = {
            "S_keyboard":  round(float(keyboard)  * 100.0, 1),
            "S_speed":     round(float(speed)      * 100.0, 1),
            "S_switching": round(float(switching)  * 100.0, 1),
            "S_mouse":     round(float(mouse)      * 100.0, 1),
            "S_reentry":   round(float(reentry)    * 100.0, 1),
        }

        equation_score = (
            weights["keyboard"]  * contributions["S_keyboard"]
            + weights["speed"]   * contributions["S_speed"]
            + weights["switching"] * contributions["S_switching"]
            + weights["mouse"]   * contributions["S_mouse"]
            + weights["reentry"] * contributions["S_reentry"]
        )

        return self._clamp_score(float(equation_score)), contributions

    # ── Utilities ────────────────────────────────────────────────────────────

    @staticmethod
    def _level_from_score(score: float) -> str:
        if score >= STRESS_SCORE_THRESHOLD_HIGH:
            return "STRESSED"
        if score >= STRESS_SCORE_THRESHOLD_MILD:
            return "MILD"
        return "NEUTRAL"

    def load(self):
        """Lazy-load model from ml package."""
        if self._ready:
            return
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

    def _get_baseline(self, user_id: str):
        """Get or create a PersonalBaseline for a user."""
        if user_id not in self._baselines:
            try:
                from app.ml.model import PersonalBaseline, BASELINE_DB
                db_path = BASELINE_DB.replace(".db", f"_{user_id}.db")
                self._baselines[user_id] = PersonalBaseline(db_path=db_path)
            except Exception:
                self._baselines[user_id] = None
        return self._baselines[user_id]

    @property
    def is_ready(self) -> bool:
        return self._ready and self._model is not None

    def _compute_shap_values(self, z: np.ndarray) -> Optional[dict]:
        """Compute SHAP values for feature-level explainability."""
        if self._shap_explainer is None:
            return None
        try:
            shap_values = self._shap_explainer.shap_values(z.reshape(1, -1))
            if isinstance(shap_values, list):
                shap_values = (
                    shap_values[2] if len(shap_values) > 2 else shap_values[-1]
                )
            if shap_values.ndim == 1:
                shap_values = shap_values.reshape(1, -1)

            shap_dict = {}
            num_features = len(FEATURE_NAMES)
            for i, name in enumerate(FEATURE_NAMES):
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

    # ── Main predict loop ────────────────────────────────────────────────────

    def predict(self, features_dict: dict, user_id: str = "default") -> dict:
        """Run inference and return structured result."""
        missing = [f for f in FEATURE_NAMES if f not in features_dict]
        if missing:
            preview = ", ".join(missing[:3])
            if len(missing) > 3:
                preview = f"{preview}, ... (+{len(missing) - 3} more)"
            return self._fallback_result(message=f"Missing required features: {preview}")

        raw  = np.array([features_dict[f] for f in FEATURE_NAMES], dtype=np.float32)
        hour = int(features_dict.get("hour_of_day", 12))
        baseline = self._get_baseline(user_id)

        # Detect idle early — used in multiple stages below
        typing_wpm = float(features_dict.get("typing_speed_wpm", 0.0))
        clicks     = float(features_dict.get("click_count", 0))
        is_idle    = (typing_wpm == 0.0) and (clicks == 0.0)

        equation_score, contributions = self._compute_equation_score(
            features_dict, raw, baseline, hour,
            user_id=user_id, is_idle=is_idle,
        )

        shap_values = None
        model_score = 0.0
        confidence  = 0.45
        probs       = np.array([0.33, 0.33, 0.34], dtype=np.float32)

        if not self.is_ready:
            final_score = equation_score
        else:
            z = self._normalizer.transform(raw, hour, baseline)
            probs       = self._model.predict_proba(z.reshape(1, -1))[0]
            confidence  = float(np.max(probs))
            model_score = float(probs[0] * 5.0 + probs[1] * 55.0 + probs[2] * 100.0)
            final_score = (
                MODEL_SCORE_WEIGHT * model_score
                + (1.0 - MODEL_SCORE_WEIGHT) * equation_score
            )
            shap_values = self._compute_shap_values(z)

        # ── Fix 4: Idle fast-decay instead of hard drop ─────────────────────
        if is_idle:
            final_score = 0.7 * self._prev_scores.get(user_id, final_score)
            logger.debug(f"Idle decay → {final_score:.1f}")

        # ── Step 1: Base score already computed above ────────────────────────

        # ── Step 2 (Fix 11): Gradual decay for recovery ──────────────────────
        prev = self._prev_scores.get(user_id, final_score)
        if final_score < prev:
            final_score = 0.85 * prev + 0.15 * final_score

        # ── Step 3 (Fix 5+6): Dual-signal smoothing ──────────────────────────
        final_score = self._dual_signal(user_id, final_score)

        # Update prev_scores with the post-dual value for next frame
        self._prev_scores[user_id] = final_score

        # ── Apply personal feedback bias ──────────────────────────────────────
        if baseline:
            bias = baseline.get_feedback_bias()
            final_score += (bias * 1.5)
            logger.debug(f"Feedback bias adjust: {bias * 1.5:+.1f}")

        # ── Step 4: Clamp ─────────────────────────────────────────────────────
        final_score = self._clamp_score(final_score)
        level = self._level_from_score(final_score)

        # ── Save session data ─────────────────────────────────────────────────
        timestamp = time.time()
        if baseline:
            baseline.update(raw, hour)
            baseline.save_session_score(timestamp * 1000.0, final_score, level)

        insights = self._generate_insights(features_dict, level, shap_values)

        return {
            "score":                    round(final_score, 1),
            "model_score":              round(model_score, 1),
            "equation_score":           round(equation_score, 1),
            "final_score":              round(final_score, 1),
            "level":                    level,
            "confidence":               round(confidence, 3),
            "probabilities":            {l: round(float(p), 3) for l, p in zip(LABELS, probs)},
            "feature_contributions":    contributions,
            "shap_values":              shap_values,
            "insights":                 insights,
            "timestamp":                timestamp,
            "typing_speed_wpm":         round(float(features_dict.get("typing_speed_wpm", 0)), 1),
            "rage_click_count":         int(features_dict.get("rage_click_count", 0)),
            "error_rate":               round(float(features_dict.get("error_rate", 0)), 3),
            "click_count":              int(features_dict.get("click_count", 0)),
            "mouse_speed_mean":         round(float(features_dict.get("mouse_speed_mean", 0)), 1),
            "mouse_reentry_count":      round(float(features_dict.get("mouse_reentry_count", 0)), 1),
            "mouse_reentry_latency_ms": round(float(features_dict.get("mouse_reentry_latency_ms", 0)), 1),
        }

    def _generate_insights(
        self, features: dict, level: str, shap_values: Optional[dict] = None
    ) -> List[str]:
        """Generate human-readable stress insights from feature values and SHAP."""
        insights = []

        if shap_values:
            for feat_name, impact in list(shap_values.items())[:3]:
                direction = "increasing" if impact > 0 else "decreasing"
                readable  = feat_name.replace("_", " ").capitalize()
                insights.append(f"{readable} is {direction} stress likelihood")

        if features.get("rage_click_count", 0) > 2:
            insights.append("Frustrated clicking detected — consider taking a short break")
        if features.get("error_rate", 0) > 0.1:
            insights.append("Higher than usual error rate — possible cognitive fatigue")
        if features.get("rhythm_entropy", 0) > 3.5:
            insights.append("Typing rhythm is erratic — stress may be affecting focus")
        if features.get("session_fragmentation", 0) > 0.7:
            insights.append("Highly fragmented session — frequent context switching detected")
        if features.get("tab_switch_freq", 0) > 10:
            insights.append("Rapid app switching — may indicate difficulty focusing")
        if features.get("typing_speed_wpm", 50) < 30:
            insights.append("Typing speed is lower than typical — possible fatigue")
        if features.get("mouse_speed_std", 0) > 150:
            insights.append("Inconsistent mouse movements — possible restlessness")
        if features.get("mouse_reentry_count", 0) > 2:
            insights.append("Frequent mouse re-entry after switches — possible task thrashing")

        if not insights and level == "STRESSED":
            insights.append("Multiple behavioral signals indicate elevated stress")

        seen: set = set()
        unique: List[str] = []
        for i in insights:
            if i not in seen:
                seen.add(i)
                unique.append(i)
        return unique[:3]

    def _fallback_result(self, message: str = "Model not loaded — check server logs") -> dict:
        return {
            "score":                    0.0,
            "model_score":              0.0,
            "equation_score":           0.0,
            "final_score":              0.0,
            "level":                    "UNKNOWN",
            "confidence":               0.0,
            "probabilities":            {"NEUTRAL": 0.33, "MILD": 0.33, "STRESSED": 0.34},
            "feature_contributions":    {},
            "shap_values":              None,
            "insights":                 [message],
            "timestamp":                time.time(),
            "typing_speed_wpm":         0.0,
            "rage_click_count":         0,
            "error_rate":               0.0,
            "click_count":              0,
            "mouse_speed_mean":         0.0,
            "mouse_reentry_count":      0.0,
            "mouse_reentry_latency_ms": 0.0,
        }

    def reset_user_state(self, user_id: str):
        """Clear all temporal and personalization state for a user."""
        for store in (
            self._prev_scores,
            self._fast_scores,
            self._slow_scores,
            self._spike_counter,
            self._user_variance,
            self._user_weights,
            self._session_mean,
            self._baselines,
        ):
            store.pop(user_id, None)
        logger.info(f"Full state reset for user: {user_id}")


engine = InferenceEngine()
