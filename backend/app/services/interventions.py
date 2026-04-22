"""MindPulse Backend — Alert state + intervention recommendation engine."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime

from app.services import history


@dataclass
class UserInterventionState:
    risk_streak: int = 0
    last_alert_at: float = 0.0
    snooze_until: float = 0.0
    active_type: str = ""
    active_start_score: float = 0.0
    active_started_at: float = 0.0
    last_state: str = "NORMAL"
    last_recommendation: dict | None = field(default=None)
    scheduled_breaks: list[dict] = field(default_factory=list)
    wind_down_shown_today: str = ""


class InterventionEngine:
    ALERT_COOLDOWN_SEC = 180
    SNOOZE_SEC = 600
    HIGH_RISK_STREAK_THRESHOLD = 2
    CRITICAL_SCORE_THRESHOLD = 85
    CRITICAL_CONFIDENCE_THRESHOLD = 0.7
    BASELINE_EFFECTIVENESS = {
        "breathing_reset": 0.62,
        "posture_eye_break": 0.58,
        "cognitive_reset": 0.55,
        "hydrate_walk": 0.57,
    }

    def __init__(self):
        self._state: dict[str, UserInterventionState] = {}

    def _user_state(self, user_id: str) -> UserInterventionState:
        if user_id not in self._state:
            self._state[user_id] = UserInterventionState()
        return self._state[user_id]

    @staticmethod
    def _trend_label(user_id: str) -> str:
        scores = history.get_recent_scores(user_id, minutes=60)
        if len(scores) < 6:
            return "steady"
        first = sum(scores[: len(scores) // 2]) / max(1, len(scores) // 2)
        second = sum(scores[len(scores) // 2 :]) / max(
            1, len(scores) - len(scores) // 2
        )
        delta = second - first
        if delta > 6:
            return "rising"
        if delta < -6:
            return "falling"
        return "steady"

    @staticmethod
    def _rationale(result: dict) -> list[str]:
        reasons = []
        contrib = result.get("feature_contributions", {}) or {}
        if contrib.get("S_switching", 0) >= 60:
            reasons.append("High context-switch load detected")
        if contrib.get("S_keyboard", 0) >= 60:
            reasons.append(
                "Keyboard rhythm and error signals indicate cognitive strain"
            )
        if contrib.get("S_mouse", 0) >= 60:
            reasons.append("Mouse activity pattern suggests restlessness")
        if result.get("rage_click_count", 0) >= 3:
            reasons.append("Rage-click pattern suggests frustration")
        if result.get("error_rate", 0) >= 0.12:
            reasons.append("Error rate is elevated")
        for insight in (result.get("insights", []) or [])[:1]:
            reasons.append(insight)
        return reasons[:3] or [
            "Sustained stress signals detected across multiple features"
        ]

    def _recommendation(
        self, user_id: str, result: dict, severity: str, trend: str
    ) -> dict:
        effectiveness = history.intervention_effectiveness(user_id)
        candidates = [
            {
                "intervention_type": "breathing_reset",
                "title": "2-Minute Breathing Reset",
                "duration_min": 2,
                "steps": [
                    "Inhale 4s, hold 4s, exhale 4s, hold 4s",
                    "Repeat 4 cycles",
                    "Relax shoulders and jaw",
                ],
                "base_score": self.BASELINE_EFFECTIVENESS["breathing_reset"],
            },
            {
                "intervention_type": "posture_eye_break",
                "title": "Posture + Eye Break",
                "duration_min": 3,
                "steps": [
                    "Look away 20 feet for 20 seconds",
                    "Neck and shoulder stretch",
                    "Sit back and reset posture",
                ],
                "base_score": self.BASELINE_EFFECTIVENESS["posture_eye_break"],
            },
            {
                "intervention_type": "cognitive_reset",
                "title": "Single-Task Focus Reset",
                "duration_min": 5,
                "steps": [
                    "Close non-essential tabs/apps",
                    "Choose one priority task",
                    "Work in a focused 10-minute sprint",
                ],
                "base_score": self.BASELINE_EFFECTIVENESS["cognitive_reset"],
            },
            {
                "intervention_type": "hydrate_walk",
                "title": "Hydrate + Walk Break",
                "duration_min": 5,
                "steps": [
                    "Drink a glass of water",
                    "Walk away from screen",
                    "Resume with a lighter task first",
                ],
                "base_score": self.BASELINE_EFFECTIVENESS["hydrate_walk"],
            },
        ]

        for c in candidates:
            perf = effectiveness.get(c["intervention_type"], {})
            helped = perf.get("helped", 0)
            not_helped = perf.get("not_helped", 0)
            c["score"] = c["base_score"] + (helped * 0.03) - (not_helped * 0.04)

        if result.get("error_rate", 0) > 0.12:
            for c in candidates:
                if c["intervention_type"] == "breathing_reset":
                    c["score"] += 0.08
        if result.get("rage_click_count", 0) >= 3:
            for c in candidates:
                if c["intervention_type"] in {"hydrate_walk", "posture_eye_break"}:
                    c["score"] += 0.09
        contrib = result.get("feature_contributions", {}) or {}
        if contrib.get("S_switching", 0) > 55:
            for c in candidates:
                if c["intervention_type"] == "cognitive_reset":
                    c["score"] += 0.1

        best = sorted(candidates, key=lambda x: x["score"], reverse=True)[0]
        benefit = "Likely to reduce stress by 8–15 points in the next 10 minutes"
        if severity == "high":
            benefit = "Likely to reduce stress by 10–20 points if started now"
        if trend == "falling":
            benefit = "Should stabilize recovery and prevent rebound stress"

        return {
            "intervention_type": best["intervention_type"],
            "title": best["title"],
            "duration_min": best["duration_min"],
            "steps": best["steps"],
            "rationale": self._rationale(result),
            "expected_benefit": benefit,
            "coaching_tip": "Keep notifications muted for the next focus block after break.",
            "severity": severity,
        }

    def evaluate(self, user_id: str, result: dict) -> dict:
        state = self._user_state(user_id)
        
        # Load personalized thresholds (Default Mild: 55, High: 75)
        # We fetch from PersonalBaseline via the inference engine
        from app.services.inference import engine
        baseline = engine._get_baseline(user_id)
        thresholds = baseline.get_settings() if baseline else {}
        
        mild_thresh = thresholds.get("mild_threshold", 55.0)
        high_thresh = thresholds.get("high_threshold", 75.0)

        now = time.time()
        score = float(result.get("score", 0.0))
        level = str(result.get("level", "UNKNOWN"))
        confidence = float(result.get("confidence", 0.0))
        trend = self._trend_label(user_id)

        is_high_risk = level == "STRESSED" and confidence >= 0.65 and score >= high_thresh
        is_very_high = (
            level == "STRESSED"
            and score >= self.CRITICAL_SCORE_THRESHOLD
            and confidence >= self.CRITICAL_CONFIDENCE_THRESHOLD
        )
        is_moderate_risk = score >= mild_thresh or level == "MILD"
        if is_high_risk:
            state.risk_streak += 1
        elif is_moderate_risk:
            state.risk_streak = max(0, state.risk_streak - 1)
        else:
            state.risk_streak = 0

        alert_state = "NORMAL"
        recommendation = None
        new_alert_triggered = False
        recovery_score = 0.0

        if state.active_type:
            if state.active_start_score > 0:
                recovery_score = max(0.0, state.active_start_score - score)
            if score < 45 or trend == "falling":
                alert_state = "RECOVERY"
            else:
                alert_state = "BREAK_RECOMMENDED"

        if not state.active_type:
            if now < state.snooze_until:
                alert_state = "EARLY_WARNING" if is_moderate_risk else "NORMAL"
            elif (
                is_very_high or state.risk_streak >= self.HIGH_RISK_STREAK_THRESHOLD
            ) and now - state.last_alert_at >= self.ALERT_COOLDOWN_SEC:
                alert_state = "BREAK_RECOMMENDED"
                state.last_alert_at = now
                new_alert_triggered = True
                recommendation = self._recommendation(
                    user_id,
                    result,
                    severity="high" if is_very_high else "medium",
                    trend=trend,
                )
            elif is_moderate_risk:
                alert_state = "EARLY_WARNING"
                recommendation = self._recommendation(
                    user_id,
                    result,
                    severity="low",
                    trend=trend,
                )

        if (
            recommendation is None
            and state.last_recommendation
            and alert_state
            in {
                "EARLY_WARNING",
                "BREAK_RECOMMENDED",
            }
        ):
            recommendation = state.last_recommendation
        if recommendation:
            state.last_recommendation = recommendation
        state.last_state = alert_state

        return {
            "alert_state": alert_state,
            "intervention": recommendation,
            "trend": trend,
            "recovery_score": round(float(recovery_score), 1)
            if recovery_score > 0
            else 0.0,
            "new_alert_triggered": new_alert_triggered,
        }

    def apply_action(
        self, user_id: str, action: str, intervention_type: str = "", notes: str = ""
    ) -> dict:
        state = self._user_state(user_id)
        latest = history.latest_point(user_id)
        score = float(latest.get("score", 0.0))
        intervention_type = intervention_type or state.active_type or "general"
        now = time.time()

        if action == "start_break":
            state.active_type = intervention_type
            state.active_start_score = score
            state.active_started_at = now
            state.last_state = "BREAK_RECOMMENDED"
            history.append_intervention_event(
                user_id=user_id,
                action=action,
                intervention_type=intervention_type,
                alert_state=state.last_state,
                score_before=score,
                notes=notes,
            )
        elif action == "snooze":
            state.snooze_until = now + self.SNOOZE_SEC
            history.append_intervention_event(
                user_id=user_id,
                action=action,
                intervention_type=intervention_type,
                alert_state=state.last_state,
                score_before=score,
                notes=notes,
            )
        elif action in {"im_okay", "need_stronger_help"}:
            history.append_intervention_event(
                user_id=user_id,
                action=action,
                intervention_type=intervention_type,
                alert_state=state.last_state,
                score_before=score,
                notes=notes,
            )
            if action == "im_okay":
                state.snooze_until = now + 300
            if action == "need_stronger_help":
                state.snooze_until = 0
                state.last_alert_at = 0
        elif action in {"helped", "not_helped", "skipped"}:
            recovery = (
                max(0.0, state.active_start_score - score)
                if state.active_start_score
                else 0.0
            )
            history.append_intervention_event(
                user_id=user_id,
                action=action,
                intervention_type=intervention_type,
                alert_state="RECOVERY" if action == "helped" else "BREAK_RECOMMENDED",
                score_before=state.active_start_score or score,
                score_after=score,
                recovery_score=recovery,
                notes=notes,
            )
            state.active_type = ""
            state.active_start_score = 0.0
            state.active_started_at = 0.0
            if action != "helped":
                state.last_alert_at = 0
        else:
            return {"status": "error", "message": "Unsupported action"}

        return {
            "status": "ok",
            "action": action,
            "alert_state": state.last_state,
            "active_intervention": state.active_type or None,
            "snooze_until": state.snooze_until,
            "active_start_score": state.active_start_score,
        }

    def active_snapshot(self, user_id: str) -> dict:
        state = self._user_state(user_id)
        return {
            "active_intervention": state.active_type or None,
            "active_start_score": state.active_start_score,
            "snooze_until": state.snooze_until,
            "last_state": state.last_state,
            "last_recommendation": state.last_recommendation,
        }

    def detect_wind_down(self, user_id: str, result: dict) -> dict | None:
        now = datetime.now()
        hour = now.hour
        today_str = now.strftime("%Y-%m-%d")
        state = self._user_state(user_id)

        if state.wind_down_shown_today == today_str:
            return None

        if hour < 21:
            return None

        score = float(result.get("score", 0.0))
        level = str(result.get("level", "UNKNOWN"))

        if score < 50 and level == "NEUTRAL":
            return None

        scores_last_hour = history.get_recent_scores(user_id, minutes=60)
        if len(scores_last_hour) < 3:
            return None

        recent_avg = sum(scores_last_hour[-5:]) / min(5, len(scores_last_hour))
        if recent_avg < 45:
            return None

        state.wind_down_shown_today = today_str

        return {
            "type": "wind_down",
            "title": "Time to wind down?",
            "message": f"It's {hour:02d}:{now.minute:02d} and your energy has been dipping for a while. "
            f"Consider wrapping up for the day — tomorrow is a fresh start.",
            "severity": "gentle",
            "actions": [
                {"label": "I'll wrap up soon", "action": "acknowledge"},
                {"label": "I'm fine, keep going", "action": "dismiss"},
            ],
        }

    def schedule_break(
        self, user_id: str, break_time: str, intervention_type: str = "breathing_reset"
    ) -> dict:
        state = self._user_state(user_id)
        try:
            bt = datetime.fromisoformat(break_time)
            if bt.timestamp() <= time.time():
                return {
                    "status": "error",
                    "message": "Break time must be in the future",
                }
        except ValueError:
            return {
                "status": "error",
                "message": "Invalid time format. Use ISO format (e.g. 2026-04-17T15:00:00)",
            }

        break_entry = {
            "id": f"break_{int(time.time())}",
            "scheduled_for": break_time,
            "intervention_type": intervention_type,
            "status": "scheduled",
            "created_at": datetime.now().isoformat(),
        }
        state.scheduled_breaks.append(break_entry)

        history.append_intervention_event(
            user_id=user_id,
            action="break_scheduled",
            intervention_type=intervention_type,
            alert_state="NORMAL",
            score_before=0.0,
            notes=f"Scheduled for {break_time}",
        )

        return {
            "status": "ok",
            "break": break_entry,
            "total_scheduled": len(state.scheduled_breaks),
        }

    def get_scheduled_breaks(self, user_id: str) -> list[dict]:
        state = self._user_state(user_id)
        now = time.time()
        active = [
            b
            for b in state.scheduled_breaks
            if datetime.fromisoformat(b["scheduled_for"]).timestamp() > now - 3600
        ]
        state.scheduled_breaks = active
        return active

    def cancel_break(self, user_id: str, break_id: str) -> dict:
        state = self._user_state(user_id)
        before = len(state.scheduled_breaks)
        state.scheduled_breaks = [
            b for b in state.scheduled_breaks if b["id"] != break_id
        ]
        if len(state.scheduled_breaks) == before:
            return {"status": "error", "message": "Break not found"}

        history.append_intervention_event(
            user_id=user_id,
            action="break_cancelled",
            intervention_type="",
            alert_state="NORMAL",
            score_before=0.0,
            notes=f"Cancelled break {break_id}",
        )

        return {"status": "ok", "message": "Break cancelled"}

    def check_due_breaks(self, user_id: str) -> dict | None:
        state = self._user_state(user_id)
        now = time.time()
        for b in state.scheduled_breaks:
            bt = datetime.fromisoformat(b["scheduled_for"]).timestamp()
            if abs(now - bt) < 60 and b["status"] == "scheduled":
                b["status"] = "due"
                return {
                    "type": "scheduled_break_due",
                    "title": "Time for your scheduled break",
                    "message": f"You scheduled a {b['intervention_type']} break now. Ready?",
                    "break_id": b["id"],
                    "intervention_type": b["intervention_type"],
                }
        return None


intervention_engine = InterventionEngine()
