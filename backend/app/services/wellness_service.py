"""Wellness service for check-ins, journal insights, and weekly reflections."""

import asyncio
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional
from collections import defaultdict
from app.core.supabase import get_supabase_admin


class WellnessService:
    """Service for managing wellness check-ins and generating insights."""
    
    @staticmethod
    async def save_checkin(
        user_id: str,
        energy_level: str,
        sleep_quality: str,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save a daily wellness check-in."""
        client = get_supabase_admin()
        
        # Upsert checkin (update if exists for today)
        result = client.table("wellness_checkins").upsert({
            "user_id": user_id,
            "check_date": date.today().isoformat(),
            "energy_level": energy_level,
            "sleep_quality": sleep_quality,
            "note": note
        }, on_conflict="user_id,check_date").execute()
        
        # Trigger insight generation async
        asyncio.create_task(WellnessService._generate_insights_async(user_id))
        
        return result.data[0] if result.data else None
    
    @staticmethod
    async def get_checkin_history(user_id: str, days: int = 7) -> List[Dict[str, Any]]:
        """Get check-in history for the last N days."""
        client = get_supabase_admin()
        
        since = (date.today() - timedelta(days=days)).isoformat()
        
        result = client.table("wellness_checkins")\
            .select("*")\
            .eq("user_id", user_id)\
            .gte("check_date", since)\
            .order("check_date", desc=True)\
            .execute()
        
        return result.data or []
    
    @staticmethod
    async def get_today_checkin(user_id: str) -> Optional[Dict[str, Any]]:
        """Get today's check-in if it exists."""
        client = get_supabase_admin()
        
        result = client.table("wellness_checkins")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("check_date", date.today().isoformat())\
            .maybe_single()\
            .execute()
        
        return result.data if result and result.data else None
    
    @staticmethod
    async def get_journal_insights(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get AI-generated wellness insights."""
        client = get_supabase_admin()
        
        result = client.table("wellness_insights")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("user_id", user_id)\
            .order("generated_at", desc=True)\
            .limit(limit)\
            .execute()
        
        return result.data or []
    
    @staticmethod
    async def get_weekly_reflection(user_id: str) -> Dict[str, Any]:
        """Generate weekly wellness reflection."""
        # Get check-ins for the past week
        checkins = await WellnessService.get_checkin_history(user_id, days=7)
        
        # Calculate stats
        if not checkins:
            return {
                "avg_energy": None,
                "avg_sleep": None,
                "checkin_count": 0,
                "insights": []
            }
        
        # Energy mapping to numeric
        energy_map = {"low": 33, "medium": 66, "high": 100}
        sleep_map = {"poor": 25, "fair": 50, "good": 75, "great": 100}
        
        energy_values = [energy_map.get(c["energy_level"], 50) for c in checkins]
        sleep_values = [sleep_map.get(c["sleep_quality"], 50) for c in checkins]
        
        avg_energy = sum(energy_values) / len(energy_values)
        avg_sleep = sum(sleep_values) / len(sleep_values)
        
        # Generate insights based on patterns
        insights = []
        
        # Best day detection
        if len(checkins) >= 2:
            best_day = max(checkins, key=lambda c: energy_map.get(c["energy_level"], 0))
            insights.append({
                "type": "pattern",
                "content": f"Your energy was highest on {best_day['check_date']}. Consider what made that day different."
            })
        
        # Sleep correlation
        if len(checkins) >= 3:
            good_sleep_days = [c for c in checkins if c["sleep_quality"] in ["good", "great"]]
            if good_sleep_days:
                good_sleep_energy = sum(energy_map.get(c["energy_level"], 50) for c in good_sleep_days) / len(good_sleep_days)
                if good_sleep_energy > 70:
                    insights.append({
                        "type": "suggestion",
                        "content": "Good sleep correlates with higher energy days. Prioritize your evening routine."
                    })
        
        # Streak detection
        dates_with_checkins = {c["check_date"] for c in checkins}
        insights.append({
            "type": "milestone",
            "content": f"You've checked in {len(checkins)} times this week. Building awareness is the first step."
        })
        
        return {
            "avg_energy": round(avg_energy),
            "avg_sleep": round(avg_sleep),
            "checkin_count": len(checkins),
            "insights": insights
        }
    
    @staticmethod
    async def _generate_insights_async(user_id: str):
        """Generate new insights based on recent data (called after checkin)."""
        try:
            # Get recent checkins
            checkins = await WellnessService.get_checkin_history(user_id, days=14)
            
            if len(checkins) < 2:
                return  # Need more data
            
            client = get_supabase_admin()
            
            # Simple insight generation based on patterns
            energy_map = {"low": 33, "medium": 66, "high": 100}
            recent = checkins[:3]
            recent_energy = [energy_map.get(c["energy_level"], 50) for c in recent]
            avg_recent = sum(recent_energy) / len(recent_energy)
            
            # Generate insight based on trend
            if len(recent) >= 2:
                trend = recent_energy[0] - recent_energy[-1]  # Newest - oldest
                
                if trend > 20:
                    insight = "Your energy has been rising — keep up what's working!"
                    insight_type = "milestone"
                elif trend < -20:
                    insight = "Your energy has dipped. Consider an earlier bedtime tonight."
                    insight_type = "suggestion"
                else:
                    return  # No significant trend
                
                # Save insight
                client.table("wellness_insights").insert({
                    "user_id": user_id,
                    "insight_type": insight_type,
                    "content": insight,
                    "relevant_date": date.today().isoformat()
                }).execute()
        
        except Exception as e:
            print(f"Error generating insights: {e}")




# Singleton
wellness_service = WellnessService()
