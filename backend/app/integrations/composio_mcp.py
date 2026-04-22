"""Composer MCP Integration for MindPulse.

Adapts AlgoQuest patterns for personal use:
- Calendar integration for focus time planning
- Email/Slack for distraction context
- Graceful degradation if Composio not configured
"""

import os
import asyncio
import time
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime, timedelta

# Try to import Composio, but don't fail if not available
try:
    from composio import ComposioSDK
    _COMPOSIO_AVAILABLE = True
except ImportError:
    _COMPOSIO_AVAILABLE = False
    ComposioSDK = None

from app.core.supabase import get_supabase_admin


@dataclass(frozen=True)
class MCPSession:
    """Immutable snapshot of Tool Router session."""
    url: str
    headers: dict
    created_at: float
    user_id: str


class ComposioMCPManager:
    """Manages MCP sessions for external tool integration.
    
    Adapted from AlgoQuest MCPToolRouter with simplifications:
    - Single user per instance (no multi-tenant)
    - Smaller toolkit set (Gmail, Calendar, Slack)
    - TTL-based caching
    """
    
    def __init__(self, ttl_seconds: int = 1800):
        self._cache: Dict[str, MCPSession] = {}
        self._ttl = ttl_seconds
        self._composio = None
        self._enabled = False
        
        # Initialize if API key available
        api_key = os.environ.get("COMPOSIO_API_KEY")
        if _COMPOSIO_AVAILABLE and api_key:
            try:
                self._composio = ComposioSDK(api_key=api_key)
                self._enabled = True
            except Exception as e:
                print(f"Composio initialization failed: {e}")
    
    @property
    def enabled(self) -> bool:
        """Check if Composio integration is available."""
        return self._enabled and self._composio is not None
    
    async def get_session(self, user_id: str, force_new: bool = False) -> Optional[MCPSession]:
        """Get or create MCP session for user.
        
        Returns None if Composio not enabled.
        """
        if not self.enabled:
            return None
        
        # Check cache
        cached = self._cache.get(user_id)
        if cached and not force_new:
            if (time.time() - cached.created_at) < self._ttl:
                return cached
        
        # Get connected accounts from Supabase
        try:
            supabase = get_supabase_admin()
            if not supabase:
                return None
            
            # Query for user's connected tools
            result = supabase.table("user_connections")\
                .select("tool_name, connected_account_id")\
                .eq("user_id", user_id)\
                .eq("status", "active")\
                .execute()
            
            connections = result.data or []
            if not connections:
                return None  # No connected tools
            
            # Build connected accounts map
            connected_map = {
                conn["tool_name"]: conn["connected_account_id"]
                for conn in connections
            }
            
            # Create Tool Router session
            # Note: In production, you'd use composio.tool_router.create()
            # For now, return a mock session structure
            session = MCPSession(
                url=f"mcp://composio/{user_id}",
                headers={"Authorization": f"Bearer {user_id}"},
                created_at=time.time(),
                user_id=user_id
            )
            
            self._cache[user_id] = session
            return session
            
        except Exception as e:
            print(f"Error creating MCP session: {e}")
            return None
    
    def invalidate(self, user_id: str):
        """Invalidate user's cached session."""
        self._cache.pop(user_id, None)
    
    async def get_calendar_events(self, user_id: str, days_ahead: int = 1) -> Optional[Dict[str, Any]]:
        """Fetch upcoming calendar events for focus planning.
        
        Returns events or None if not connected/failed.
        """
        if not self.enabled:
            return None
        
        try:
            # Check if user has calendar connected
            supabase = get_supabase_admin()
            if not supabase:
                return None
            
            result = supabase.table("user_connections")\
                .select("connected_account_id")\
                .eq("user_id", user_id)\
                .eq("tool_name", "google_calendar")\
                .eq("status", "active")\
                .maybe_single()\
                .execute()
            
            if not result.data:
                return {"connected": False, "reason": "Calendar not connected"}
            
            # In production: Call Composio to fetch events
            # For now, return mock data
            tomorrow = datetime.now() + timedelta(days=1)
            return {
                "connected": True,
                "events": [
                    {
                        "summary": "Team Standup",
                        "start": tomorrow.replace(hour=10, minute=0).isoformat(),
                        "end": tomorrow.replace(hour=10, minute=30).isoformat(),
                        "duration_minutes": 30
                    },
                    {
                        "summary": "Focus Block",
                        "start": tomorrow.replace(hour=14, minute=0).isoformat(),
                        "end": tomorrow.replace(hour=16, minute=0).isoformat(),
                        "duration_minutes": 120
                    }
                ],
                "total_meeting_hours": 2.5,
                "focus_blocks": 1
            }
            
        except Exception as e:
            print(f"Error fetching calendar: {e}")
            return None
    
    async def get_slack_status(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Check Slack message volume for distraction shield context."""
        if not self.enabled:
            return None
        
        # Mock implementation - would check Slack API for unread messages
        return {
            "connected": False,
            "unread_messages": 0,
            "mentions": 0
        }
    
    async def check_email_load(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Check Gmail inbox load for context."""
        if not self.enabled:
            return None
        
        # Mock implementation
        return {
            "connected": False,
            "unread_count": 0,
            "recent_emails": []
        }


# Global instance
mcp_manager = ComposioMCPManager()


async def augment_context_with_tools(
    user_id: str,
    message: str,
    base_context: str
) -> str:
    """Augment LLM context with external tool data.
    
    Checks if query mentions calendar/email/Slack and fetches relevant data.
    Adapted from AlgoQuest ToolAugmentedLLM.
    """
    # Quick keyword check
    msg_lower = message.lower()
    
    additions = []
    
    # Calendar context
    if any(kw in msg_lower for kw in ["calendar", "meeting", "schedule", "busy", "free time"]):
        calendar_data = await mcp_manager.get_calendar_events(user_id, days_ahead=1)
        if calendar_data and calendar_data.get("connected"):
            events = calendar_data.get("events", [])
            if events:
                event_str = "\n".join([
                    f"- {e['summary']}: {e['start'][11:16]}-{e['end'][11:16]}"
                    for e in events[:5]
                ])
                additions.append(f"Upcoming calendar events:\n{event_str}")
            else:
                additions.append("Calendar: No events scheduled for tomorrow.")
    
    # Slack context
    if any(kw in msg_lower for kw in ["slack", "message", "notification", "ping"]):
        slack_data = await mcp_manager.get_slack_status(user_id)
        if slack_data and slack_data.get("connected"):
            additions.append(
                f"Slack status: {slack_data.get('unread_messages', 0)} unread, "
                f"{slack_data.get('mentions', 0)} mentions"
            )
    
    # Email context
    if any(kw in msg_lower for kw in ["email", "mail", "inbox"]):
        email_data = await mcp_manager.check_email_load(user_id)
        if email_data and email_data.get("connected"):
            additions.append(
                f"Email: {email_data.get('unread_count', 0)} unread messages"
            )
    
    # Combine with base context
    if additions:
        return f"{base_context}\n\nCurrent external context:\n" + "\n".join(additions)
    
    return base_context
