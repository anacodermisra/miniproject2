# MINI PROJECT - DASHBOARD REALITY ASSESSMENT & IMPROVEMENT PLAN

**Date**: 2026-04-17  
**Status**: Approved for Implementation  
**Scope**: Individual user tool (not team/organizational)  
**Target Market**: India (cultural sensitivity required)

---

## EXECUTIVE SUMMARY

MindPulse Mini dashboard suffers from critical usability issues where engineering implementation details are exposed to end users, and pages designed for researchers (Insights) are shown to regular users. This document outlines the reality assessment and concrete fixes needed.

---

## REALITY CHECK FINDINGS

### Current State: Critical Issues by Page

| Page | Problem | Severity | User Impact |
|------|---------|----------|-------------|
| **Tracking** | Shows "Model Score: 42" and raw feature values (4.2, 3.8) | 🔴 Critical | Users see meaningless numbers |
| **Insights** | Shows F1 scores, confusion matrix, accuracy metrics | 🔴 Critical | **Completely wrong audience** - researchers not users |
| **History** | Raw list of 20 signal entries | 🟡 Major | Noise, not actionable insight |
| **Interventions** | No data on what works for THIS user | 🟡 Major | Can't learn what helps them personally |
| **Calibration** | "Quality index 67%" - meaningless metric | 🟡 Major | No motivation to complete |

### Cultural Issues for Indian Market

| Issue | Current | Should Be |
|-------|---------|-----------|
| Terminology | "Stress baseline", "Rage clicks" | "Energy baseline", "Quick clicks" |
| Tone | Academic ("ETH Zurich study") | Friendly, personal |
| Framing | Clinical assessment | Wellness companion |

---

## PROPOSED FIXES

### 1. TRACKING PAGE - Actionable Energy Dashboard

#### Remove (Engineering Noise)
- ❌ Model score / Equation score
- ❌ Raw feature values (4.2, 3.8)
- ❌ "Confidence: 73%"
- ❌ "Total Samples" metric
- ❌ "Start over" button → "Recalibrate my baseline"

#### Add (User-Valuable Visualizations)

| Visualization | Implementation | Value |
|---------------|----------------|-------|
| **Energy Sparkline** | 30-min line chart | See trend, not just point-in-time |
| **Top 3 Factors** | Horizontal bar chart | "What's affecting your energy most" |
| **Today's Pattern** | Mini 24h heatmap | "Your energy by hour today" |

---

### 2. INSIGHTS PAGE - Complete Rebuild ("Your Patterns")

#### Remove (Academic Content)
- ❌ Accuracy, Precision, Recall, F1 scores
- ❌ Confusion matrix
- ❌ Research benchmarks ("compared to ETH Zurich")
- ❌ "How the model works" section
- ❌ Static feature importance percentages

#### Add (Personal Pattern Analysis)

| Feature | Visualization | User Value |
|---------|--------------|------------|
| **Your Best Hours** | Vertical bar chart | "You're most focused 9-11am" |
| **Day-of-week Pattern** | Bar chart | "Tuesdays are typically hardest" |
| **Meeting Impact** | Before/after dots | "Energy drops 30% after calls >30min" |
| **Break Effectiveness** | Donut chart | "Walking breaks work better for you" |
| **Weekly Wins** | Badge display | "4 days of good energy this week!" |

---

### 3. HISTORY PAGE - Pattern Detection (Not Raw Lists)

#### Add

| Visualization | Purpose |
|---------------|---------|
| **Weekly Heatmap** | Grid showing energy by hour/day |
| **Week-over-week** | Side-by-side comparison bars |
| **Key Moments** | 3-5 significant events (not 20 raw entries) |
| **Break Success Rate** | "8 of 10 breaks helped" |

---

### 4. INTERVENTIONS PAGE - Personal Effectiveness

#### Add

| Feature | Visualization |
|---------|--------------|
| **Break Effectiveness by Type** | Donut chart (breathing/walk/stretch) |
| **Personal Recovery Pattern** | Line chart comparison |
| **Intervention Streak** | "5 suggestions this week, 4 helped" |

---

### 5. CALIBRATION PAGE - Gamified Progress

#### Add

| Feature | Implementation |
|---------|----------------|
| **Training Progress** | 7-day fillable visual blocks with % |
| **Accuracy Preview** | "Current: ~45% → Complete: ~70%" |
| **Completion Celebration** | Animation + "Your insights are ready!" |

#### Fix Language
- "Build your personal **energy** baseline"
- Remove "ETH Zurich" citation
- "Understanding your unique patterns"

---

## CODE TO BORROW FROM ALGOQUEST

| Mini Feature | AlgoQuest Source | Modifications |
|--------------|------------------|---------------|
| **Charts** | `recharts` usage in dashboard components | Simplify, remove multi-series |
| **Heatmaps** | D3 calendar heatmap in analytics | Personal patterns only |
| **Chat Interface** | `chat-interface.tsx` | Single "Focus Assistant" instead of 3 agents |
| **SSE Streaming** | Event streaming in chat | Real-time energy insights |
| **Session Management** | Chat session URLs (`?session=xxx`) | Persistent coaching sessions |

**Key Files to Reference:**
- `AlgoQuest-frontend/components/chat/chat-interface.tsx`
- `AlgoQuest-frontend/components/dashboard/engines/safety-valve.tsx` (chart patterns)
- `algoquest-backend/app/services/agents/` (agent architecture)
- `AlgoQuest-frontend/app/ask-sentinel/page.tsx` (session management)

---

## TOP 3 PRIORITY FIXES

1. **Insights Page** - Complete rebuild (currently useless to users)
2. **Tracking Page** - Remove engineering metrics, add sparkline
3. **Interventions Page** - Add personal effectiveness stats

---

## FEATURES DISCUSSED BUT NOT IMPLEMENTED

### From Previous Conversations:

| Feature | Status | Notes |
|---------|--------|-------|
| **Chat System ("Ask MindPulse")** | ❌ Not implemented | Single Focus Assistant agent for personal coaching |
| **Smart Calendar Integration** | ❌ Not implemented | Detect meeting overload, correlate with energy |
| **Focus Mode / Distraction Shield** | ❌ Not implemented | Block notifications during deep work |
| **Evening Wind-down Detection** | ❌ Not implemented | Detect late-night work patterns |
| **Personalized Break Scheduler** | ❌ Not implemented | Auto-schedule breaks based on patterns |
| **Energy Forecasting** | ❌ Not implemented | "You'll likely need a break at 3pm" |
| **Habit/Routine Builder** | ❌ Not implemented | Micro-habits with streak tracking |
| **Focus Flow Detection** | ❌ Not implemented | "You've been in flow 90min, take a micro-break?" |

### Recommended Next Features (After Dashboard Fixes):

1. **Chat System** - "Ask MindPulse" for personal coaching
2. **Calendar Integration** - Optional Google Calendar for meeting correlation
3. **Smart Break Scheduler** - Auto-schedule based on detected patterns

---

## IMPLEMENTATION APPROACH

### Phase 1: Fix Critical Pages (Week 1)
- Insights page rebuild
- Tracking page simplification
- Interventions effectiveness stats

### Phase 2: New Features (Week 2-3)
- Chat interface (adapted from AlgoQuest)
- Optional calendar integration
- Smart break suggestions

---

## CULTURAL GUIDELINES FOR INDIAN MARKET

### Language Preferences
- ✅ "Energy" instead of "Stress"
- ✅ "Quick clicks" instead of "Rage clicks"
- ✅ "Focus session" instead of "Deep work"
- ✅ "Recharge" instead of "Break"
- ✅ "Wellness companion" instead of "Stress monitor"

### What to Avoid
- ❌ Clinical/medical terminology
- ❌ Academic citations
- ❌ Performance report framing
- ❌ Direct stress labeling
- ❌ Technical implementation details

---

**Document Status**: Approved  
**Next Step**: Implementation planning and execution
