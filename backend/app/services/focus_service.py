"""Focus service for flow state tracking and energy forecasting."""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict
from app.core.supabase import get_supabase_admin
from app.services.history import get_history


class FocusService:
    """Service for managing focus state, distraction shield, and energy forecasts."""
    
    @staticmethod
    async def get_current_flow_state(user_id: str) -> Dict[str, Any]:
        """Calculate current flow state from recent stress data."""
        # Get last 30 minutes of data from SQLite (convert to hours)
        history = get_history(user_id, hours=0.5)
        
        if not history:
            return {
                "flow_score": 50,
                "deep_work_minutes": 0,
                "context_switches": 0,
                "is_in_flow": False,
                "suggestion": "Start working to see your flow state."
            }
        
        # Calculate metrics
        scores = [h["score"] for h in history]
        avg_score = sum(scores) / len(scores)
        flow_score = 100 - avg_score  # Invert: lower stress = higher flow
        
        # Count context switches from app switches
        app_switches = sum(1 for i in range(1, len(history)) 
                          if history[i].get("active_app_hash") != history[i-1].get("active_app_hash"))
        
        # Estimate deep work minutes (consecutive low-stress periods)
        deep_work_minutes = sum(1 for h in history 
                               if h["score"] < 40) * 5  # 5 min per sample
        
        is_in_flow = flow_score > 70 and app_switches < 3
        
        suggestion = None
        if is_in_flow:
            suggestion = "You're in flow! Your rhythm is steady. Keep going or take a micro-break?"
        elif flow_score < 50:
            suggestion = "Your rhythm shows scattered attention. Consider a breathing reset."
        
        # Save snapshot
        try:
            client = get_supabase_admin()
            client.table("focus_snapshots").insert({
                "user_id": user_id,
                "flow_score": flow_score,
                "deep_work_minutes": deep_work_minutes,
                "context_switches": app_switches
            }).execute()
        except Exception:
            pass  # Don't fail if Supabase unavailable
        
        return {
            "flow_score": flow_score,
            "deep_work_minutes": deep_work_minutes,
            "context_switches": app_switches,
            "is_in_flow": is_in_flow,
            "suggestion": suggestion
        }
    
    @staticmethod
    async def get_distraction_shield(user_id: str) -> Dict[str, Any]:
        """Get distraction shield status and recent distraction metrics."""
        client = get_supabase_admin()
        
        # Get shield setting
        result = client.table("user_shield_settings")\
            .select("*")\
            .eq("user_id", user_id)\
            .maybe_single()\
            .execute()
        
        shield_enabled = False
        if result and result.data:
            shield_enabled = result.data.get("enabled", False)
        
        # Get recent context switch data from SQLite history
        history = get_history(user_id, hours=0.5)
        
        app_switches = sum(1 for i in range(1, len(history)) 
                          if history[i].get("active_app_hash") != history[i-1].get("active_app_hash"))
        
        # Estimate tab switches from mouse patterns
        # (rapid movements + clicks = tab switching)
        tab_hops = sum(1 for h in history 
                      if h.get("mouse_speed_mean", 0) > 500 and h.get("click_count", 0) > 5)
        
        # Agitation from error rate spikes
        agitation = "high" if any(h.get("error_rate", 0) > 0.2 for h in history[-5:]) else "low"
        
        return {
            "enabled": shield_enabled,
            "context_switches": app_switches,
            "tab_hopping": tab_hops,
            "mouse_agitation": agitation,
            "notifications_last_30min": app_switches + tab_hops,  # Proxy
            "suggestion": "Many context switches detected. Enable focus mode?" if app_switches > 5 else None
        }
    
    @staticmethod
    async def toggle_shield(user_id: str, enabled: bool) -> bool:
        """Toggle distraction shield on/off."""
        client = get_supabase_admin()
        
        client.table("user_shield_settings").upsert({
            "user_id": user_id,
            "enabled": enabled,
            "updated_at": datetime.utcnow().isoformat()
        }, on_conflict="user_id").execute()
        
        return enabled
    
    @staticmethod
    async def get_energy_forecast(user_id: str) -> Dict[str, Any]:
        """Generate daily energy forecast based on historical patterns."""
        # Get past 7 days of hourly data
        history = get_history(user_id, hours=168)  # 7 days
        
        if not history or len(history) < 20:
            return {
                "peak_hour": "10 AM",  # Default assumption
                "energy_curve": [],
                "suggested_schedule": FocusService._get_default_schedule(),
                "confidence": "low"
            }
        
        # Group by hour and calculate average energy
        hourly_energy = defaultdict(list)
        for h in history:
            hour = datetime.fromtimestamp(h["timestamp"]).hour
            energy = 100 - h["score"]
            hourly_energy[hour].append(energy)
        
        # Build curve
        curve = []
        for hour in range(24):
            values = hourly_energy.get(hour, [50])  # Default to neutral
            avg = sum(values) / len(values)
            curve.append({
                "hour": hour,
                "hour_label": f"{hour % 12 or 12} {'AM' if hour < 12 else 'PM'}",
                "energy": round(avg)
            })
        
        # Find peak
        peak = max(curve, key=lambda x: x["energy"])
        peak_hour = peak["hour_label"]
        
        # Build suggested schedule
        schedule = FocusService._build_schedule(curve)
        
        return {
            "peak_hour": peak_hour,
            "peak_energy": peak["energy"],
            "energy_curve": curve,
            "suggested_schedule": schedule,
            "confidence": "high" if len(history) > 100 else "medium"
        }
    
    @staticmethod
    def _get_default_schedule() -> List[Dict[str, str]]:
        """Default schedule when no data."""
        return [
            {"time": "9-10 AM", "activity": "Light tasks, email", "energy": "warming up"},
            {"time": "10 AM-12 PM", "activity": "Deep work", "energy": "peak"},
            {"time": "12-1 PM", "activity": "Lunch break", "energy": "natural dip"},
            {"time": "2-4 PM", "activity": "Meetings, collaboration", "energy": "second wind"},
            {"time": "4-6 PM", "activity": "Wrap up, plan tomorrow", "energy": "declining"},
        ]
    
    @staticmethod
    def _build_schedule(curve: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Build personalized schedule from energy curve."""
        # Find peak window (2-3 hours around max)
        peak_idx = max(range(len(curve)), key=lambda i: curve[i]["energy"])
        peak_start = max(0, peak_idx - 1)
        peak_end = min(23, peak_idx + 1)
        
        # Find dip after peak
        dip_candidates = [i for i in range(peak_end + 1, 20) if curve[i]["energy"] < 50]
        dip_start = dip_candidates[0] if dip_candidates else 12
        
        schedule = []
        
        # Morning warmup
        if peak_start > 0:
            schedule.append({
                "time": f"9-{peak_start % 12 or 12} AM",
                "activity": "Light tasks, email catch-up",
                "energy": "warming up"
            })
        
        # Peak window
        peak_label = f"{peak_start % 12 or 12}-{peak_end % 12 or 12} {'AM' if peak_end < 12 else 'PM'}"
        schedule.append({
            "time": peak_label,
            "activity": "Deep work — your peak window",
            "energy": "peak"
        })
        
        # Afternoon
        schedule.append({
            "time": f"{dip_start % 12 or 12}-1 PM",
            "activity": "Lunch break, step outside",
            "energy": "natural dip"
        })
        
        schedule.append({
            "time": "2-4 PM",
            "activity": "Collaborative work, meetings",
            "energy": "second wind"
        })
        
        schedule.append({
            "time": "4-6 PM",
            "activity": "Wrap up, plan tomorrow",
            "energy": "gradual decline"
        })
        
        return schedule


# Singleton
focus_service = FocusService()
