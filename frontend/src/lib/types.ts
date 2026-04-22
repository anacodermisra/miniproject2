/** MindPulse — TypeScript Types */

export interface FeatureVector {
  hold_time_mean: number;
  hold_time_std: number;
  hold_time_median: number;
  flight_time_mean: number;
  flight_time_std: number;
  typing_speed_wpm: number;
  error_rate: number;
  pause_frequency: number;
  pause_duration_mean: number;
  burst_length_mean: number;
  rhythm_entropy: number;
  mouse_speed_mean: number;
  mouse_speed_std: number;
  direction_change_rate: number;
  click_count: number;
  rage_click_count: number;
  scroll_velocity_std: number;
  tab_switch_freq: number;
  switch_entropy: number;
  session_fragmentation: number;
  hour_of_day: number;
  day_of_week: number;
  session_duration_min: number;
  mouse_reentry_count?: number;
  mouse_reentry_latency_ms?: number;
}

export interface StressResult {
  score: number;
  model_score?: number;
  equation_score?: number;
  final_score?: number;
  level: "NEUTRAL" | "MILD" | "STRESSED" | "UNKNOWN";
  confidence: number;
  probabilities: Record<string, number>;
  feature_contributions?: Record<string, number>;
  insights: string[];
  timestamp: number;
  // Raw features for live tiles
  typing_speed_wpm?: number;
  rage_click_count?: number;
  error_rate?: number;
  click_count?: number;
  mouse_speed_mean?: number;
  mouse_reentry_count?: number;
  mouse_reentry_latency_ms?: number;
  alert_state?: "NORMAL" | "EARLY_WARNING" | "BREAK_RECOMMENDED" | "RECOVERY";
  intervention?: InterventionRecommendation | null;
  trend?: "rising" | "steady" | "falling";
  recovery_score?: number;
}

export interface HistoryPoint {
  timestamp: number;
  score: number;
  level: string;
  insights: string[];
  typing_speed_wpm?: number;
  error_rate?: number;
  click_count?: number;
}

export interface CalibrationStatus {
  user_id: string;
  is_calibrated: boolean;
  days_collected: number;
  samples_per_hour: Record<number, number>;
  completion_pct: number;
  calibration_quality?: number;
}

export interface UserStats {
  total_samples: number;
  avg_score: number;
  stressed_pct: number;
  current_level: string;
  typing_speed_wpm: number;
  rage_click_count: number;
  error_rate: number;
  click_count: number;
}

export interface HealthStatus {
  status: string;
  model_loaded: boolean;
  version: string;
  active_connections: number;
}

export interface InterventionRecommendation {
  intervention_type: string;
  title: string;
  duration_min: number;
  steps: string[];
  rationale: string[];
  expected_benefit: string;
  coaching_tip: string;
  severity: string;
}

export interface InterventionSnapshot {
  alert_state: "NORMAL" | "EARLY_WARNING" | "BREAK_RECOMMENDED" | "RECOVERY";
  trend: "rising" | "steady" | "falling";
  recovery_score: number;
  intervention: InterventionRecommendation | null;
  active_intervention: string | null;
  active_start_score: number;
}

export interface InterventionEvent {
  timestamp: number;
  action: string;
  intervention_type: string;
  alert_state: string;
  score_before: number;
  score_after: number;
  recovery_score: number;
  notes: string;
}
