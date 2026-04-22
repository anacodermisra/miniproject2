"""MindPulse Backend — API Routes."""

from __future__ import annotations
import time
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from app.api.deps import get_current_user
from app.schemas.stress import (
    InferenceRequest,
    InferenceResponse,
    HistoryPoint,
    FeedbackRequest,
    CalibrationStatus,
    HealthResponse,
    ResetRequest,
    InterventionActionRequest,
    InterventionEvent,
    WellnessCheckinRequest,
    WellnessCheckinResponse,
    JournalEntryRequest,
    JournalEntryResponse,
    UserSettings,
    SettingsRequest,
)
from app.services.inference import engine
from app.services.websocket_manager import manager
from app.services import history
from app.services.interventions import intervention_engine
from app.core.config import (
    CALIBRATION_TARGET_SAMPLES_PER_HOUR,
    CALIBRATION_MIN_HOURS_COVERED,
    WS_HEARTBEAT_TIMEOUT_SEC,
)

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        model_loaded=engine.is_ready,
        version="1.0.0",
        active_connections=manager.count,
    )


@router.post("/inference", response_model=InferenceResponse)
async def run_inference(req: InferenceRequest):
    features_raw = req.features.model_dump()
    result = engine.predict(features_raw, req.user_id)
    intervention_state = intervention_engine.evaluate(req.user_id, result)
    result.update(
        {
            "alert_state": intervention_state["alert_state"],
            "intervention": intervention_state["intervention"],
            "trend": intervention_state["trend"],
            "recovery_score": intervention_state["recovery_score"],
        }
    )
    history.append(req.user_id, result)
    if intervention_state["new_alert_triggered"] and intervention_state["intervention"]:
        history.append_intervention_event(
            user_id=req.user_id,
            action="recommended",
            intervention_type=intervention_state["intervention"]["intervention_type"],
            alert_state=intervention_state["alert_state"],
            score_before=float(result.get("score", 0.0)),
            notes="auto-generated recommendation",
        )
    await manager.send_personal_message({"type": "stress_update", **result, "user_id": req.user_id}, req.user_id)
    return InferenceResponse(**result)


@router.get("/history", response_model=list[HistoryPoint])
async def get_history(hours: int = 24, current_user: dict = Depends(get_current_user)):
    return history.get_history(current_user["username"], hours)


@router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    return history.get_stats(current_user["username"])


@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest, current_user: dict = Depends(get_current_user)):
    # Persist feedback to SQLite via PersonalBaseline
    user_id = current_user["username"]
    baseline = engine._get_baseline(user_id)
    if baseline:
        baseline.save_feedback(
            timestamp_ms=req.timestamp,
            model_label=req.predicted_level,
            user_feedback=req.actual_level,
            score=req.score,
        )
    return {
        "status": "ok",
        "message": f"Feedback saved: predicted {req.predicted_level}, actual {req.actual_level}",
    }


@router.get("/interventions/recommendation")
async def get_recommendation(current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    latest = history.latest_point(user_id)
    eval_result = intervention_engine.evaluate(
        user_id,
        {
            "score": latest["score"],
            "level": latest["level"],
            "confidence": latest["confidence"],
            "insights": [],
            "feature_contributions": {},
        },
    )
    snapshot = intervention_engine.active_snapshot(user_id)
    return {
        "alert_state": eval_result["alert_state"],
        "trend": eval_result["trend"],
        "recovery_score": eval_result["recovery_score"],
        "intervention": eval_result["intervention"]
        or snapshot.get("last_recommendation"),
        "active_intervention": snapshot.get("active_intervention"),
        "active_start_score": snapshot.get("active_start_score"),
    }


@router.post("/interventions/action")
async def intervention_action(req: InterventionActionRequest):
    return intervention_engine.apply_action(
        user_id=req.user_id,
        action=req.action,
        intervention_type=req.intervention_type or "",
        notes=req.notes or "",
    )


@router.get("/interventions/history", response_model=list[InterventionEvent])
async def intervention_history(hours: int = 168, current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    events = history.get_intervention_events(user_id, hours)
    return [InterventionEvent(**event) for event in events]


@router.get("/interventions/wind-down")
async def check_wind_down(current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    latest = history.latest_point(user_id)
    wind_down = intervention_engine.detect_wind_down(user_id, latest)
    return {"wind_down": wind_down}


@router.post("/interventions/schedule-break")
async def schedule_break(
    break_time: str = Query(...),
    intervention_type: str = Query("breathing_reset"),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["username"]
    return intervention_engine.schedule_break(user_id, break_time, intervention_type)


@router.get("/interventions/scheduled-breaks")
async def get_scheduled_breaks(current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    return {"breaks": intervention_engine.get_scheduled_breaks(user_id)}


@router.post("/interventions/cancel-break")
async def cancel_break(
    break_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["username"]
    return intervention_engine.cancel_break(user_id, break_id)


@router.get("/interventions/check-due-breaks")
async def check_due_breaks(current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    due = intervention_engine.check_due_breaks(user_id)
    return {"due_break": due}


@router.get("/calibration", response_model=CalibrationStatus)
async def get_calibration(current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    baseline = engine._get_baseline(user_id)
    if baseline:
        status = baseline.get_calibration_status(
            target_samples_per_hour=CALIBRATION_TARGET_SAMPLES_PER_HOUR,
            min_hours_covered=CALIBRATION_MIN_HOURS_COVERED,
        )
    else:
        status = {
            "is_calibrated": False,
            "days_collected": 0,
            "samples_per_hour": {},
            "completion_pct": 0.0,
            "calibration_quality": 0.0,
        }
    return CalibrationStatus(
        user_id=user_id,
        is_calibrated=status["is_calibrated"],
        days_collected=status["days_collected"],
        samples_per_hour=status["samples_per_hour"],
        completion_pct=status["completion_pct"],
        calibration_quality=status["calibration_quality"],
    )


@router.post("/reset")
async def reset_session(current_user: dict = Depends(get_current_user)):
    """Clear all in-memory session data for a fresh start."""
    user_id = current_user["username"]
    history.reset(user_id)
    engine.reset_user_state(user_id)

    await manager.send_personal_message({"type": "session_reset", "user_id": user_id}, user_id)
    return {"status": "ok", "message": f"Session data cleared for {user_id}"}


@router.get("/model-metrics")
async def model_metrics():
    """Return model accuracy, F1, precision, recall and confusion matrix."""
    import json
    import os
    import numpy as np

    manifest_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "ml",
        "artifacts",
        "artifacts_manifest.json",
    )
    manifest_path = os.path.normpath(manifest_path)

    # Load stored validation metrics
    metrics = {"accuracy": 0, "precision_macro": 0, "recall_macro": 0, "f1_macro": 0}
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        metrics = manifest.get("metrics_validation", metrics)

    # Generate a fresh confusion matrix from the loaded model
    confusion_matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    try:
        from app.ml.synthetic_data import (
            generate_synthetic_dataset,
            compute_global_stats,
        )
        from app.ml.model import DualNormalizer, load_model
        from app.ml.feature_extractor import FEATURE_NAMES
        from sklearn.metrics import confusion_matrix as cm_func

        model, stats = load_model(allow_download=False, allow_train_fallback=False)
        normalizer = DualNormalizer(stats)
        hour_idx = FEATURE_NAMES.index("hour_of_day")

        X_raw, y_true, _ = generate_synthetic_dataset(n_samples=600)
        X_norm = np.array(
            [
                normalizer.transform(
                    X_raw[i], hour=int(X_raw[i, hour_idx]), baseline=None
                )
                for i in range(len(X_raw))
            ],
            dtype=np.float32,
        )

        y_pred = model.predict(X_norm)
        matrix = cm_func(y_true, y_pred, labels=[0, 1, 2])
        confusion_matrix = matrix.tolist()
    except Exception as e:
        print(f"[WARN] Could not compute confusion matrix: {e}")

    return {
        "accuracy": round(metrics.get("accuracy", 0) * 100, 1),
        "precision": round(metrics.get("precision_macro", 0) * 100, 1),
        "recall": round(metrics.get("recall_macro", 0) * 100, 1),
        "f1": round(metrics.get("f1_macro", 0) * 100, 1),
        "confusion_matrix": confusion_matrix,
        "labels": ["NEUTRAL", "MILD", "STRESSED"],
    }


@router.post("/wellness/checkin")
async def wellness_checkin(req: WellnessCheckinRequest):
    history.save_wellness_checkin(req.user_id, req.energy, req.sleep, req.note or "")
    return {"status": "ok"}


@router.get("/wellness/history", response_model=list[WellnessCheckinResponse])
async def wellness_history(limit: int = 30, current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    return history.get_wellness_history(user_id, limit)


@router.post("/journal/entry")
async def journal_entry(req: JournalEntryRequest):
    history.save_journal_entry(req.user_id, req.content, req.entry_type or "insight")
    return {"status": "ok"}


@router.get("/journal/entries", response_model=list[JournalEntryResponse])
async def journal_entries(limit: int = 50, current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    return history.get_journal_entries(user_id, limit)


@router.get("/settings/thresholds", response_model=UserSettings)
async def get_user_settings(current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    baseline = engine._get_baseline(user_id)
    if not baseline:
        return UserSettings(user_id=user_id)
    s = baseline.get_settings()
    return UserSettings(
        user_id=user_id,
        mild_threshold=s.get("mild_threshold", 55.0),
        high_threshold=s.get("high_threshold", 75.0),
    )


@router.post("/settings/thresholds")
async def update_user_settings(req: SettingsRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["username"]
    baseline = engine._get_baseline(user_id)
    if baseline:
        baseline.update_settings(mild=req.mild_threshold, high=req.high_threshold)
    return {"status": "ok"}


@router.websocket("/ws/stress")
async def websocket_stress(ws: WebSocket, token: str = Query(...)):
    # Simple verification: get user from token
    try:
        from app.api.deps import get_user_from_token
        user = await get_user_from_token(token)
        user_id = user["username"]
    except Exception:
        await ws.close(code=4001)
        return

    await manager.connect(ws, user_id)
    try:
        while True:
            try:
                data = await asyncio.wait_for(
                    ws.receive_text(), timeout=WS_HEARTBEAT_TIMEOUT_SEC
                )
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping", "timestamp": time.time()})
                continue
            # Client can send feature vectors for real-time prediction
            import json

            try:
                payload = json.loads(data)
                if payload.get("type") == "pong":
                    continue
                if payload.get("type") == "features":
                    from app.schemas.stress import FeatureVector

                    fv = FeatureVector(**payload["features"])
                    result = engine.predict(
                        fv.model_dump(), payload.get("user_id", "default")
                    )
                    uid = payload.get("user_id", "default")
                    intervention_state = intervention_engine.evaluate(uid, result)
                    result.update(
                        {
                            "alert_state": intervention_state["alert_state"],
                            "intervention": intervention_state["intervention"],
                            "trend": intervention_state["trend"],
                            "recovery_score": intervention_state["recovery_score"],
                        }
                    )
                    history.append(uid, result)
                    if (
                        intervention_state["new_alert_triggered"]
                        and intervention_state["intervention"]
                    ):
                        history.append_intervention_event(
                            user_id=uid,
                            action="recommended",
                            intervention_type=intervention_state["intervention"][
                                "intervention_type"
                            ],
                            alert_state=intervention_state["alert_state"],
                            score_before=float(result.get("score", 0.0)),
                            notes="auto-generated recommendation",
                        )
                    await manager.send_personal_message(
                        {"type": "stress_update", **result, "user_id": user_id}, user_id
                    )
            except (json.JSONDecodeError, KeyError):
                pass
    except WebSocketDisconnect:
        manager.disconnect(ws, user_id)
