"""MindPulse Backend — Pydantic Schemas."""

from __future__ import annotations
from typing import Dict, List, Optional
import math
from pydantic import BaseModel, Field, model_validator


class FeatureVector(BaseModel):
    """23 behavioral features extracted from a 5-minute window."""

    hold_time_mean: float = Field(..., description="Average key hold time (ms)")
    hold_time_std: float = Field(..., description="Std of key hold times")
    hold_time_median: float = Field(..., description="Median key hold time")
    flight_time_mean: float = Field(..., description="Average flight time (ms)")
    flight_time_std: float = Field(..., description="Std of flight times")
    typing_speed_wpm: float = Field(..., description="Typing speed (WPM)")
    error_rate: float = Field(..., ge=0, le=1, description="Backspace ratio")
    pause_frequency: float = Field(..., description="Pauses per minute")
    pause_duration_mean: float = Field(..., description="Average pause duration (ms)")
    burst_length_mean: float = Field(..., description="Average burst length")
    rhythm_entropy: float = Field(
        ..., description="Shannon entropy of inter-key intervals"
    )
    mouse_speed_mean: float = Field(..., description="Average mouse speed (px/s)")
    mouse_speed_std: float = Field(..., description="Std of mouse speed")
    direction_change_rate: float = Field(
        ..., ge=0, le=1, description="Cursor direction changes"
    )
    click_count: float = Field(..., description="Clicks per window")
    rage_click_count: float = Field(..., description="Rage click clusters detected")
    scroll_velocity_std: float = Field(..., description="Std of scroll velocity")
    tab_switch_freq: float = Field(..., description="Tab switches per minute")
    switch_entropy: float = Field(..., description="Entropy of switch pattern")
    session_fragmentation: float = Field(..., description="Session fragmentation ratio")
    hour_of_day: float = Field(..., ge=0, le=23)
    day_of_week: float = Field(..., ge=0, le=6)
    session_duration_min: float = Field(..., description="Session length in minutes")
    mouse_reentry_count: float = Field(
        0.0, ge=0, description="Mouse re-entry events after idle/context switch"
    )
    mouse_reentry_latency_ms: float = Field(
        0.0, ge=0, description="Average delay before mouse re-entry (ms)"
    )

    @model_validator(mode="after")
    def validate_finite(self):
        for key, value in self.model_dump().items():
            if isinstance(value, (int, float)) and not math.isfinite(float(value)):
                raise ValueError(f"{key} must be finite")
        return self


class InferenceRequest(BaseModel):
    features: FeatureVector
    user_id: str = "default"


class InferenceResponse(BaseModel):
    score: float = Field(..., description="Stress score 0-100")
    model_score: float = Field(..., description="Model-derived score 0-100")
    equation_score: float = Field(..., description="Equation-derived score 0-100")
    final_score: float = Field(..., description="Final blended score 0-100")
    level: str = Field(..., description="NEUTRAL, MILD, or STRESSED")
    confidence: float = Field(..., ge=0, le=1)
    probabilities: Dict[str, float]
    feature_contributions: Dict[str, float] = Field(
        default_factory=dict, description="Equation sub-score contributions (0-100 scale)"
    )
    insights: List[str] = Field(
        default_factory=list, description="Human-readable explanations"
    )
    timestamp: float
    typing_speed_wpm: Optional[float] = 0.0
    rage_click_count: Optional[int] = 0
    error_rate: Optional[float] = 0.0
    click_count: Optional[int] = 0
    mouse_speed_mean: Optional[float] = 0.0
    mouse_reentry_count: Optional[float] = 0.0
    mouse_reentry_latency_ms: Optional[float] = 0.0
    alert_state: Optional[str] = "NORMAL"
    intervention: Optional[Dict] = None
    trend: Optional[str] = "steady"
    recovery_score: Optional[float] = None


class CalibrationStatus(BaseModel):
    user_id: str
    is_calibrated: bool
    days_collected: int
    samples_per_hour: Dict[int, int]
    completion_pct: float
    calibration_quality: float = 0.0


class HistoryPoint(BaseModel):
    timestamp: float
    score: float
    level: str
    insights: List[str] = []
    # Raw features for multi-chart rendering
    typing_speed_wpm: Optional[float] = 0.0
    error_rate: Optional[float] = 0.0
    click_count: Optional[int] = 0


class FeedbackRequest(BaseModel):
    user_id: str = "default"
    timestamp: float
    predicted_level: str
    actual_level: str
    score: float = 0.0  # The snapshot score when feedback was given


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    version: str
    active_connections: int


class ResetRequest(BaseModel):
    user_id: str = "demo_user"


class InterventionActionRequest(BaseModel):
    user_id: str = "default"
    action: str = Field(
        ...,
        description="start_break, snooze, im_okay, need_stronger_help, helped, not_helped, skipped",
    )
    intervention_type: Optional[str] = None
    notes: Optional[str] = ""


class InterventionEvent(BaseModel):
    timestamp: float
    action: str
    intervention_type: str
    alert_state: str
    score_before: float = 0.0
    score_after: float = 0.0
    recovery_score: float = 0.0
    notes: str = ""


class WellnessCheckinRequest(BaseModel):
    user_id: str = "default"
    energy: str
    sleep: str
    note: Optional[str] = ""


class WellnessCheckinResponse(BaseModel):
    timestamp: float
    energy: str
    sleep: str
    note: Optional[str]


class JournalEntryRequest(BaseModel):
    user_id: str = "default"
    content: str
    entry_type: Optional[str] = "insight"


class JournalEntryResponse(BaseModel):
    id: str
    timestamp: float
    content: str
    entry_type: str


class UserSettings(BaseModel):
    user_id: str
    mild_threshold: float = 55.0
    high_threshold: float = 75.0


class SettingsRequest(BaseModel):
    user_id: str
    mild_threshold: Optional[float] = None
    high_threshold: Optional[float] = None
