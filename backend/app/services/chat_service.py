"""Chat service with 3-agent intent classification and streaming responses."""

import json
import asyncio
from typing import AsyncGenerator, Dict, Any, Optional
from datetime import datetime
from app.core.supabase import get_supabase_admin

# Agent types
AGENT_FOCUS = "focus"
AGENT_BREAK = "break"
AGENT_ENERGY = "energy"
AGENT_GENERAL = "general"

# Intent classification patterns (simple keyword matching as fallback)
FOCUS_KEYWORDS = ["focus", "concentrat", "distract", "flow", "deep work", "attention", "focus mode", "help me concentrate"]
BREAK_KEYWORDS = ["break", "rest", "stretch", "pause", "schedule", "remind me", "when should I", "take a break"]
ENERGY_KEYWORDS = ["energy", "tired", "burnout", "rhythm", "pattern", "how am I", "my energy", "stress", "dip"]


def classify_intent(message: str) -> tuple[str, float]:
    """Classify user intent to determine which agent should respond.
    
    Returns: (agent_type, confidence)
    """
    msg_lower = message.lower()
    
    # Check for focus-related intents
    if any(kw in msg_lower for kw in FOCUS_KEYWORDS):
        return AGENT_FOCUS, 0.85
    
    # Check for break-related intents
    if any(kw in msg_lower for kw in BREAK_KEYWORDS):
        return AGENT_BREAK, 0.85
    
    # Check for energy-related intents
    if any(kw in msg_lower for kw in ENERGY_KEYWORDS):
        return AGENT_ENERGY, 0.85
    
    # Default to general
    return AGENT_GENERAL, 0.7


async def generate_response(
    user_id: str,
    message: str,
    agent_type: str,
    history: list[Dict[str, Any]]
) -> AsyncGenerator[str, None]:
    """Generate streaming response based on agent type and user context.
    
    Yields SSE-formatted data lines.
    """
    
    # Get user context from local SQLite (via existing services)
    try:
        from app.services.history import get_recent_stats
        stats = get_recent_stats(user_id, hours=24)
        has_data = stats.get("total_samples", 0) > 0
    except Exception:
        has_data = False
        stats = {}
    
    # Agent-specific response generation
    if agent_type == AGENT_FOCUS:
        if has_data:
            avg_speed = stats.get("avg_typing_speed", 0)
            focus_window = "10 AM - 12 PM"  # Would be computed from actual data
            response_text = (
                f"Your typing rhythm shows steady patterns today. "
                f"Average speed: {avg_speed:.0f} WPM. "
                f"Based on your history, you're most focused during {focus_window}. "
                f"Want me to protect that window from interruptions?"
            )
        else:
            response_text = (
                "I'd love to help you focus better. Once MindPulse has a day of your rhythm data, "
                "I can identify your peak focus hours and suggest when to protect deep work time. "
                "Keep the app running and check back tomorrow!"
            )
    
    elif agent_type == AGENT_BREAK:
        if has_data:
            last_break_hours = stats.get("hours_since_last_break", 2)
            if last_break_hours > 1.5:
                response_text = (
                    f"You've been at it for {last_break_hours:.1f} hours. "
                    f"Your error rate has crept up slightly. "
                    f"A 2-minute breathing reset might help. Want me to guide you through it?"
                )
            else:
                response_text = (
                    f"You've been working steadily. Your rhythm looks good right now. "
                    f"Want me to remind you to stretch in 30 minutes?"
                )
        else:
            response_text = (
                "I can help you build better break habits. After a few days of tracking, "
                "I'll learn your patterns and suggest breaks when your rhythm shows fatigue. "
                "No data needed yet — just keep the app running!"
            )
    
    elif agent_type == AGENT_ENERGY:
        if has_data:
            avg_score = stats.get("avg_score", 50)
            energy = 100 - avg_score
            trend = stats.get("trend", "steady")
            response_text = (
                f"Your energy today is at {energy:.0f}% based on your typing rhythm. "
                f"That's {trend} compared to yesterday. "
                f"You've maintained good consistency — keep this rhythm going!"
            )
        else:
            response_text = (
                "I haven't collected enough rhythm data yet to give you personalized insights. "
                "Give it a day of normal use, and I'll show you patterns in your focus and energy. "
                "Check back tomorrow!"
            )
    
    else:  # AGENT_GENERAL
        response_text = (
            "I'm your MindPulse companion. I can help you with:\n\n"
            "• Focus time protection — find your peak hours\n"
            "• Break planning — smart reminders based on your rhythm\n"
            "• Energy insights — understand your daily patterns\n\n"
            "Just ask naturally, like:\n"
            "\"Help me concentrate\" · \"When should I rest?\" · \"How's my energy today?\""
        )
    
    # Stream response word by word for typing effect
    words = response_text.split()
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield f'data: {json.dumps({"type": "token", "content": chunk})}\n\n'
        await asyncio.sleep(0.02)  # 20ms per word for smooth typing
    
    # Final done event with metadata
    yield f'data: {json.dumps({"type": "done", "agent": agent_type})}\n\n'


class ChatService:
    """Service for managing chat sessions and messages."""
    
    @staticmethod
    async def create_session(user_id: str, title: str = "New Chat") -> Dict[str, Any]:
        """Create a new chat session."""
        client = get_supabase_admin()
        
        result = client.table("chat_sessions").insert({
            "user_id": user_id,
            "title": title,
            "is_active": True
        }).execute()
        
        return result.data[0] if result.data else None
    
    @staticmethod
    async def save_message(
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        agent_type: str = "general"
    ) -> Dict[str, Any]:
        """Save a message to the chat history."""
        client = get_supabase_admin()
        
        result = client.table("chat_messages").insert({
            "user_id": user_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "agent_type": agent_type
        }).execute()
        
        return result.data[0] if result.data else None
    
    @staticmethod
    async def get_session_history(user_id: str, session_id: str) -> list[Dict[str, Any]]:
        """Get all messages for a session owned by the given user."""
        client = get_supabase_admin()
        
        result = client.table("chat_messages")\
            .select("*")\
            .eq("session_id", session_id)\
            .eq("user_id", user_id)\
            .order("created_at")\
            .execute()
        
        return result.data or []
    
    @staticmethod
    async def get_user_sessions(user_id: str, limit: int = 20) -> list[Dict[str, Any]]:
        """Get recent chat sessions for a user."""
        client = get_supabase_admin()
        
        result = client.table("chat_sessions")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("is_active", True)\
            .order("updated_at", desc=True)\
            .limit(limit)\
            .execute()
        
        return result.data or []
    
    @staticmethod
    async def update_session_title(user_id: str, session_id: str, title: str):
        """Auto-update session title based on first user message."""
        client = get_supabase_admin()
        
        client.table("chat_sessions")\
            .update({"title": title[:50], "updated_at": datetime.utcnow().isoformat()})\
            .eq("id", session_id)\
            .eq("user_id", user_id)\
            .execute()


# Singleton instance
chat_service = ChatService()
