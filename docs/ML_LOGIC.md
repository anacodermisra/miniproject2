# MindPulse — ML Decision Logic

## How Stress Detection Works

### The Pipeline

```
[Raw Events] → [23 Features] → [XGBoost Model] + [Equation Scoring] → [Hybrid Score] → [Level]
```

### 1. Feature Extraction (23 Features)

Every 5-second window, we extract:

| Category | Features | What It Measures |
|----------|----------|------------------|
| **Keyboard (11)** | hold_time_mean, hold_time_std, hold_time_median | How long keys are pressed |
| | flight_time_mean, flight_time_std | Time between key releases and next press |
| | typing_speed_wpm | Words per minute |
| | error_rate | Backspace ratio (mistakes) |
| | pause_frequency, pause_duration_mean | How often typing stops |
| | burst_length_mean | Length of continuous typing segments |
| | rhythm_entropy | Chaos in typing rhythm (high = erratic) |
| **Mouse (6)** | mouse_speed_mean, mouse_speed_std | Cursor movement speed and consistency |
| | direction_change_rate | How often cursor direction changes |
| | click_count, rage_click_count | Normal vs frustrated rapid clicking |
| | scroll_velocity_std | Scroll speed inconsistency |
| **Context (3)** | tab_switch_freq | App switching frequency |
| | switch_entropy | Randomness of app switches |
| | session_fragmentation | How scattered work sessions are |
| **Temporal (3)** | hour_of_day, day_of_week, session_duration_min | Time-based context |

### 2. Dual Normalization

Features are normalized two ways:

```python
z_global = (value - global_mean) / global_std  # How you compare to everyone
z_user = (value - your_baseline) / your_std     # How you compare to yourself
```

**Why dual?** What's "fast typing" for you might be slow for others. Personal baseline adapts over 7 days.

### 3. Hybrid Scoring (70% ML + 30% Rules)

**ML Component (XGBoost):**
- Trained on 3,000 synthetic samples with realistic stress patterns
- Predicts 3-class probabilities: NEUTRAL / MILD / STRESSED
- Model score = 5×P(NEUTRAL) + 55×P(MILD) + 100×P(STRESSED)

**Equation Component (Heuristic):**
```python
equation_score = (
    0.30 × keyboard_risk +
    0.15 × typing_speed_risk +
    0.25 × context_switching_risk +
    0.20 × mouse_risk +
    0.10 × reentry_risk
)
```

Each component uses sigmoid transforms on z-scores to map to 0-100 range.

**Final Score:**
```python
final_score = 0.7 × model_score + 0.3 × equation_score
```

### 4. Level Classification

| Score Range | Level | Color | Meaning |
|-------------|-------|-------|---------|
| 0-39 | **NEUTRAL** | 🟢 Green | Calm, focused, productive |
| 40-69 | **MILD** | 🟡 Orange | Some tension, consider a break |
| 70-100 | **STRESSED** | 🔴 Red | Elevated stress, intervention recommended |

### 5. Alert State Machine

```
NORMAL → EARLY_WARNING → BREAK_RECOMMENDED → RECOVERY
```

- **NORMAL**: Score < 40, stable
- **EARLY_WARNING**: Score 40-69 for 2+ consecutive readings
- **BREAK_RECOMMENDED**: Score ≥ 70 or rising trend detected
- **RECOVERY**: Score dropped after intervention

## What's "Correct" vs "Incorrect"

### Correct Detection

| Scenario | Expected Level | Key Indicators |
|----------|---------------|----------------|
| Smooth typing, few errors, consistent rhythm | NEUTRAL | Low hold_time_std, low error_rate, low rhythm_entropy |
| Slow typing, many pauses, frequent backspaces | MILD | High pause_frequency, high error_rate |
| Rage clicking, rapid app switching, erratic mouse | STRESSED | High rage_click_count, high session_fragmentation |
| Fast typing but many corrections | MILD/STRESSED | High wpm + high error_rate = cognitive load |

### Common False Positives (Incorrect)

| False Signal | Why It Happens | Mitigation |
|--------------|----------------|------------|
| High stress during video calls | Mouse jitter from gesturing, not stress | Contextual: ignore high mouse_std when video apps active |
| Low stress while gaming | Fast typing + high clicks = "productive" | App category detection (gaming = ignore) |
| High stress while learning | Slow typing + many errors = fatigue | User calibration learns "learning mode" baseline |
| Context switching for research | Multiple apps ≠ stress | Time-decay weighting (old switches matter less) |

### Accuracy Expectations

| Stage | Expected F1 | Expected Accuracy | Notes |
|-------|-------------|-------------------|-------|
| Universal (no calibration) | 0.25-0.40 | 30-45% | From ETH Zurich 2025 field study |
| After 7 days calibration | 0.55-0.70 | 60-72% | With 50+ samples per hour |
| Fully calibrated (100+ samples/hour) | 0.65-0.75 | 68-78% | Lab study extrapolation |
| **Current synthetic model** | **0.99** | **99.5%** | **Overfitted — needs real data** |

## User Calibration (7-Day Baseline)

### How It Works

1. **Days 1-7**: Universal model only (25-40% accuracy)
2. **Hourly tracking**: Collects samples per hour of day
3. **EMA updates**: Exponential moving average updates baseline every sample
4. **Activation**: After 4+ hours covered with 5+ samples each
5. **Switch**: Personal model kicks in (55-70% accuracy expected)

### Why Personalization Matters

| Feature | Universal Threshold | Personal Threshold |
|---------|--------------------|--------------------|
| Typing speed | 50 WPM = "normal" | Your 90th percentile = "fast for you" |
| Error rate | 5% = "high" | Your baseline + 2σ = "high for you" |
| Pause frequency | 3/min = "frequent" | Your 75th percentile = "frequent for you" |

**Example**: If you normally type 30 WPM (slow but steady), 45 WPM might mean stress. Universal model would say 45 WPM is slow (not stressed). Personal model recognizes it's fast for YOU (stressed).

## SHAP Explainability

Every prediction includes SHAP values showing which features drove the score:

```json
{
  "shap_values": {
    "session_fragmentation": 0.35,
    "rage_click_count": 0.28,
    "rhythm_entropy": 0.15
  }
}
```

Positive = increased stress likelihood
Negative = decreased stress likelihood

This appears in the dashboard as: "Why this score: Session fragmentation increasing stress likelihood"

## Feedback Loop

Users can correct predictions:

- **"Accurate"** → Reinforces model confidence
- **"Actually relaxed"** → Downgrades this pattern in future
- **"Actually stressed"** → Upgrades this pattern in future

Feedback updates the personal baseline, not the global model (privacy-first).

## Privacy Guarantees

**We NEVER capture:**
- Actual keystrokes (what you type)
- Screen content
- URLs or page titles
- File names or document content
- Email/chat message content
- Passwords or credentials

**We ONLY capture:**
- Key press/release timing
- Key category (alpha/digit/special) — not which key
- Mouse movement speed/direction
- App switch timestamps (not app content)
- Session duration and context

All processing happens locally. Raw events are discarded after feature extraction.
