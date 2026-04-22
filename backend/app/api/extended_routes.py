"""Extended API routes for chat, wellness, and focus features."""

import asyncio
from fastapi import APIRouter, HTTPException, Query, Depends, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from app.core.auth import get_current_user
from app.services.chat_service import chat_service
from app.services.chat_llm import (
    classify_intent, generate_response, intent_classifier, response_generator,
    AGENT_FOCUS, AGENT_BREAK, AGENT_ENERGY, AGENT_GENERAL
)
from app.services.wellness_service import wellness_service
from app.services.focus_service import focus_service
from app.ml.real_data_collector import collector as data_collector

router = APIRouter(prefix="/api/v1")


class ChatMessageRequest(BaseModel):
    message: str


class WellnessCheckinRequest(BaseModel):
    energy_level: str
    sleep_quality: str
    note: Optional[str] = None


class ShieldToggleRequest(BaseModel):
    enabled: bool

# ─── Chat Endpoints ───

@router.post("/chat/sessions")
async def create_chat_session(
    title: Optional[str] = "New Chat",
    current_user: dict = Depends(get_current_user)
):
    """Create a new chat session."""
    try:
        session = await chat_service.create_session(
            user_id=current_user["id"],
            title=title
        )
        return {"success": True, "session": session}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/sessions")
async def get_chat_sessions(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get user's chat sessions."""
    try:
        sessions = await chat_service.get_user_sessions(
            user_id=current_user["id"],
            limit=limit
        )
        return {"success": True, "sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/sessions/{session_id}/messages")
async def get_chat_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get messages for a chat session."""
    try:
        messages = await chat_service.get_session_history(
            user_id=current_user["id"],
            session_id=session_id
        )
        return {"success": True, "messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(
    req: ChatMessageRequest,
    session_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Stream chat response with 3-agent routing.
    
    Returns SSE stream with:
    - classification event (which agent)
    - token events (streaming response)
    - done event (completion)
    """
    user_id = current_user["id"]
    message = req.message
    
    # Classify intent
    agent_type, confidence = classify_intent(message)
    
    # Create session if needed
    if not session_id:
        session = await chat_service.create_session(user_id)
        session_id = session["id"]
    
    # Save user message
    await chat_service.save_message(
        user_id=user_id,
        session_id=session_id,
        role="user",
        content=message
    )
    
    # Auto-update session title on first message
    if message and len(message) > 5:
        # Generate 5-7 word title
        words = message.split()[:7]
        title = " ".join(words)
        await chat_service.update_session_title(user_id, session_id, title)
    
    async def event_stream():
        # Send classification event
        yield f'data: {{"type": "classification", "agent": "{agent_type}", "confidence": {confidence}}}\n\n'
        
        # Get session history for context
        history = await chat_service.get_session_history(user_id, session_id)
        
        # Stream response
        full_response = []
        async for event in generate_response(user_id, message, agent_type, history):
            yield event
            # Extract content for saving
            try:
                import json
                data = json.loads(event.replace('data: ', '').strip())
                if data.get("type") == "token":
                    full_response.append(data.get("content", ""))
            except:
                pass
        
        # Save assistant response
        response_text = "".join(full_response)
        if response_text:
            await chat_service.save_message(
                user_id=user_id,
                session_id=session_id,
                role="assistant",
                content=response_text,
                agent_type=agent_type
            )
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# ─── Wellness Endpoints ───

@router.post("/wellness/checkin")
async def save_wellness_checkin(
    req: WellnessCheckinRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save daily wellness check-in."""
    valid_energy = ["low", "medium", "high"]
    valid_sleep = ["poor", "fair", "good", "great"]
    
    if req.energy_level not in valid_energy:
        raise HTTPException(status_code=400, detail=f"energy_level must be one of {valid_energy}")
    if req.sleep_quality not in valid_sleep:
        raise HTTPException(status_code=400, detail=f"sleep_quality must be one of {valid_sleep}")
    
    try:
        checkin = await wellness_service.save_checkin(
            user_id=current_user["id"],
            energy_level=req.energy_level,
            sleep_quality=req.sleep_quality,
            note=req.note
        )
        return {"success": True, "checkin": checkin}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wellness/checkins")
async def get_wellness_checkins(
    days: int = Query(7, ge=1, le=30),
    current_user: dict = Depends(get_current_user)
):
    """Get wellness check-in history."""
    try:
        checkins = await wellness_service.get_checkin_history(
            user_id=current_user["id"],
            days=days
        )
        return {"success": True, "checkins": checkins}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wellness/today")
async def get_today_checkin(
    current_user: dict = Depends(get_current_user)
):
    """Get today's check-in if it exists."""
    try:
        checkin = await wellness_service.get_today_checkin(current_user["id"])
        return {"success": True, "checkin": checkin}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wellness/journal")
async def get_wellness_journal(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get AI-generated wellness insights/journal entries."""
    try:
        insights = await wellness_service.get_journal_insights(
            user_id=current_user["id"],
            limit=limit
        )
        return {"success": True, "insights": insights}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wellness/weekly")
async def get_weekly_reflection(
    current_user: dict = Depends(get_current_user)
):
    """Get weekly wellness reflection with stats."""
    try:
        reflection = await wellness_service.get_weekly_reflection(current_user["id"])
        return {"success": True, "reflection": reflection}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Focus Endpoints ───

@router.get("/focus/state")
async def get_focus_state(
    current_user: dict = Depends(get_current_user)
):
    """Get current flow state and metrics."""
    try:
        state = await focus_service.get_current_flow_state(current_user["id"])
        return {"success": True, "state": state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/focus/shield")
async def get_distraction_shield(
    current_user: dict = Depends(get_current_user)
):
    """Get distraction shield status and metrics."""
    try:
        shield = await focus_service.get_distraction_shield(current_user["id"])
        return {"success": True, "shield": shield}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/focus/shield")
async def toggle_shield(
    req: ShieldToggleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Toggle distraction shield on/off."""
    try:
        result = await focus_service.toggle_shield(current_user["id"], req.enabled)
        return {"success": True, "enabled": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/focus/forecast")
async def get_energy_forecast(
    current_user: dict = Depends(get_current_user)
):
    """Get personalized energy forecast for today."""
    try:
        forecast = await focus_service.get_energy_forecast(current_user["id"])
        return {"success": True, "forecast": forecast}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Data Collection & Active Learning Endpoints (Week 3-4) ───

class SelfReportRequest(BaseModel):
    label: str  # NEUTRAL, MILD, STRESSED
    features: dict
    model_prediction: Optional[str] = None
    model_confidence: Optional[float] = None


class FeedbackCorrectionRequest(BaseModel):
    features: dict
    model_prediction: str
    actual_label: str
    model_confidence: Optional[float] = None


@router.post("/ml/self-report")
async def save_self_report(
    req: SelfReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save user's self-reported stress level."""
    try:
        row_id = data_collector.save_self_report(
            user_id=current_user["id"],
            features=req.features,
            label=req.label,
            model_prediction=req.model_prediction,
            model_confidence=req.model_confidence,
        )
        return {"success": True, "id": row_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ml/feedback")
async def save_feedback_correction(
    req: FeedbackCorrectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save user's correction of model prediction."""
    try:
        row_id = data_collector.save_feedback_correction(
            user_id=current_user["id"],
            features=req.features,
            model_prediction=req.model_prediction,
            actual_label=req.actual_label,
            model_confidence=req.model_confidence,
        )
        return {"success": True, "id": row_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ml/intervention-outcome")
async def save_intervention_outcome(
    intervention_type: str,
    accepted: bool,
    score_before: float,
    score_after: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    """Record intervention outcome for inferred labeling."""
    try:
        row_id = data_collector.save_intervention_outcome(
            user_id=current_user["id"],
            intervention_type=intervention_type,
            accepted=accepted,
            score_before=score_before,
            score_after=score_after,
        )
        return {"success": True, "id": row_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FeedbackCheckRequest(BaseModel):
    score: float
    confidence: float
    model_score: float
    heuristic_score: float


@router.post("/ml/should-ask-feedback")
async def should_ask_feedback(
    req: FeedbackCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """Check if model should request feedback from user (active learning)."""
    try:
        should_ask, reason = data_collector.should_request_feedback(
            score=req.score,
            confidence=req.confidence,
            model_score=req.model_score,
            heuristic_score=req.heuristic_score,
            user_id=current_user["id"],
        )
        return {"should_ask": should_ask, "reason": reason}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ml/dataset-stats")
async def get_dataset_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get statistics about collected labeled data."""
    try:
        stats = data_collector.get_dataset_stats(user_id=current_user["id"])
        return {"success": True, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
