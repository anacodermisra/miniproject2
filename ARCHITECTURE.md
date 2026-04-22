# MindPulse — System Architecture Document

**Project:** MindPulse — Privacy-First Behavioral Stress Detection  
**Version:** 1.0.0  
**Last Updated:** April 17, 2026  
**Stack:** Next.js 15 + FastAPI + XGBoost + Supabase + SQLite

---

## 1. System Overview

MindPulse detects user stress levels in real-time by analyzing behavioral patterns — typing rhythm, mouse movement, and context switching — **without ever reading content**. The system uses a hybrid ML pipeline (XGBoost + heuristic equation) with adaptive weighting, ensemble models, temporal LSTM, and online learning.

### Architecture Principles
- **Privacy-first:** Only metadata captured (timing, speed, frequency), never typed content
- **Hybrid storage:** SQLite (local, private) + Supabase (cloud, chat/wellness/focus)
- **Graceful degradation:** Works without LLM API keys, without Supabase, without WebSocket
- **Adaptive:** Dynamic ML/heuristic weighting, per-user calibration, online learning

---

## 2. Application Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER JOURNEY                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  /signup ──→ /login ──→ /tracking (main dashboard)                  │
│                          │                                           │
│                          ├── /history (past stress timeline)         │
│                          ├── /insights (AI behavioral patterns)      │
│                          ├── /interventions (break recommendations)  │
│                          ├── /calibration (personalize model)        │
│                          ├── /privacy (data controls)                │
│                          │                                           │
│                          ├── /chat (Ask MindPulse AI)                │
│                          ├── /wellness (daily check-ins)             │
│                          └── /focus (flow state + energy forecast)   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Complete User Journey

1. **Sign Up** → `POST /api/v1/auth/signup` → JWT token stored in `localStorage`
2. **Login** → `POST /api/v1/auth/login` → JWT + user profile cached
3. **Tracking Page** → WebSocket connects → real-time stress score every 5 seconds
   - Frontend captures keystrokes/mouse via `pynput` (Python desktop) or browser listeners
   - Features sent to `POST /api/v1/inference` → score (0-100) → level (NEUTRAL/MILD/STRESSED)
   - Score saved to SQLite history + Supabase `focus_snapshots`
4. **History** → `GET /api/v1/history` → timeline of past scores, trends
5. **Insights** → AI analyzes patterns from SQLite behavioral history
6. **Interventions** → If score > 70, recommends break → user accepts/rejects
   - Outcome saved to `intervention_labels` for ML retraining
7. **Calibration** → User teaches system their baseline → `PersonalBaseline` DB updated
8. **Privacy** → View/export/delete behavioral data
9. **Chat** → User asks "How's my energy?" → SSE streaming response
   - Intent classified → routed to focus/break/energy/general agent
   - LLM (Gemini/OpenAI) or template response streamed back
10. **Wellness** → Daily check-in (energy + sleep) → saved to Supabase
    - Auto-generates insights → weekly reflection with stats
11. **Focus** → Flow state meter (real-time) + distraction shield toggle
    - Energy forecast (uPlot chart) shows predicted energy curve
    - Suggested schedule based on historical patterns

---

## 3. Frontend Routes (14 Pages)

| Route | File | Auth | Purpose |
|-------|------|------|---------|
| `/` | `page.tsx` | No | Landing page, redirects to /tracking or /login |
| `/login` | `login/page.tsx` | No | Email/password login |
| `/signup` | `signup/page.tsx` | No | Account creation |
| `/tracking` | `(app)/tracking/page.tsx` | **Yes** | Main dashboard — real-time stress score, live chart, current metrics |
| `/history` | `(app)/history/page.tsx` | **Yes** | Historical stress data, timeline view, trends |
| `/insights` | `(app)/insights/page.tsx` | **Yes** | AI-generated patterns, behavioral insights |
| `/interventions` | `(app)/interventions/page.tsx` | **Yes** | Break recommendations, wind-down mode, scheduled breaks |
| `/calibration` | `(app)/calibration/page.tsx` | **Yes** | Model personalization — teaches system your baseline |
| `/privacy` | `(app)/privacy/page.tsx` | **Yes** | Data controls, what's collected, export/delete |
| `/chat` | `(app)/chat/page.tsx` | **Yes** | AI chat — 3-agent routing (focus/break/energy), SSE streaming |
| `/wellness` | `(app)/wellness/page.tsx` | **Yes** | Daily check-ins (energy/sleep), pattern journal, weekly reflection |
| `/focus` | `(app)/focus/page.tsx` | **Yes** | Flow state meter, distraction shield toggle, energy forecast (uPlot) |
| `/mockup` | `(app)/mockup/page.tsx` | **Yes** | Design mockup/testing page |

**Layout:** `(app)/layout.tsx` wraps all protected routes with `AuthGuard` + `Sidebar`

### Sidebar Navigation
```
Core Features:
  ├── Rhythm (/tracking)
  ├── History (/history)
  ├── Insights (/insights)
  ├── Guidance (/interventions)
  ├── Calibration (/calibration)
  └── Privacy (/privacy)

New Features:
  ├── Ask MindPulse (/chat)
  ├── Wellness (/wellness)
  └── Focus & Flow (/focus)
```

---

## 4. Backend API Routes (30+ Endpoints)

### 4.1 Authentication (`/api/v1/auth`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/v1/auth/signup` | No | Create account, returns JWT |
| POST | `/api/v1/auth/login` | No | Login with email/username, returns JWT |
| GET | `/api/v1/auth/me` | Yes | Get current user profile |

### 4.2 Core ML (`/api/v1`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/v1/health` | No | Health check |
| POST | `/api/v1/inference` | No | **Main stress prediction** — 23 features → score/level |
| GET | `/api/v1/history` | No | Get stress history (SQLite) |
| GET | `/api/v1/stats` | No | User statistics |
| POST | `/api/v1/feedback` | No | Submit correction (predicted vs actual) |
| GET | `/api/v1/model-metrics` | No | Model performance stats |
| GET | `/api/v1/calibration/{user_id}` | No | Calibration status |
| POST | `/api/v1/reset` | No | Reset user data |
| GET | `/api/v1/inference/stream` | No | SSE streaming stress updates |
| WS | `/api/v1/ws/stress` | No | WebSocket real-time stress |

### 4.3 Interventions (`/api/v1/interventions`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/v1/interventions/recommendation` | No | Get break suggestion |
| POST | `/api/v1/interventions/action` | No | Accept/reject intervention |
| GET | `/api/v1/interventions/history` | No | Past interventions |
| GET | `/api/v1/interventions/wind-down` | No | Wind-down mode settings |
| POST | `/api/v1/interventions/schedule-break` | No | Schedule a break |
| GET | `/api/v1/interventions/scheduled-breaks` | No | List scheduled breaks |
| POST | `/api/v1/interventions/cancel-break` | No | Cancel scheduled break |
| GET | `/api/v1/interventions/check-due-breaks` | No | Check if any breaks are due |

### 4.4 Chat (`/api/v1/chat`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/v1/chat/sessions` | Yes | Create chat session |
| GET | `/api/v1/chat/sessions` | Yes | List user's sessions |
| GET | `/api/v1/chat/sessions/{id}/messages` | Yes | Get session messages |
| POST | `/api/v1/chat/stream` | Yes | **SSE streaming chat** with 3-agent routing |

### 4.5 Wellness (`/api/v1/wellness`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/v1/wellness/checkin` | Yes | Save daily check-in (energy + sleep) |
| GET | `/api/v1/wellness/checkins` | Yes | Get check-in history |
| GET | `/api/v1/wellness/today` | Yes | Get today's check-in |
| GET | `/api/v1/wellness/journal` | Yes | Get AI-generated insights |
| GET | `/api/v1/wellness/weekly` | Yes | Get weekly reflection with stats |

### 4.6 Focus (`/api/v1/focus`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/v1/focus/state` | Yes | Get current flow state + metrics |
| GET | `/api/v1/focus/shield` | Yes | Get distraction shield status |
| POST | `/api/v1/focus/shield` | Yes | Toggle shield on/off |
| GET | `/api/v1/focus/forecast` | Yes | Get energy forecast for today |

### 4.7 ML Data Collection (`/api/v1/ml`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/v1/ml/self-report` | Yes | User self-reports stress level |
| POST | `/api/v1/ml/feedback` | Yes | User corrects model prediction |
| POST | `/api/v1/ml/intervention-outcome` | Yes | Record if break was accepted |
| POST | `/api/v1/ml/should-ask-feedback` | Yes | Active learning: should we ask user? |
| GET | `/api/v1/ml/dataset-stats` | Yes | Labeled data statistics |

---

## 5. Database Schema

### 5.1 SQLite (Local — Core Behavioral Data)

**Location:** `backend/app/ml/artifacts/history.db`  
**Purpose:** Private, local storage of real-time stress data. Never leaves user's machine.

```sql
-- Stress history (auto-created at runtime)
CREATE TABLE stress_history (
    user_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    score REAL NOT NULL,
    level TEXT NOT NULL,
    features_json TEXT NOT NULL,
    -- 23 behavioral features stored as JSON
    PRIMARY KEY (user_id, timestamp)
);

-- Per-user calibration baselines
CREATE TABLE user_baselines (
    user_id TEXT NOT NULL,
    hour INTEGER NOT NULL,
    mean BLOB NOT NULL,
    std BLOB NOT NULL,
    ema_count INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, hour)
);
```

### 5.2 Supabase (Cloud — Chat/Wellness/Focus)

**URL:** `https://ihaaqumdgdgsvyaiyggs.supabase.co`  
**Access:** Service role key (bypasses RLS, access control at API layer)

#### Chat Sessions
```sql
CREATE TABLE chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Chat',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, created_at DESC);
```

#### Chat Messages
```sql
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    agent_type TEXT DEFAULT 'general' CHECK (agent_type IN ('focus', 'break', 'energy', 'general')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

#### Wellness Check-ins
```sql
CREATE TABLE wellness_checkins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    check_date DATE DEFAULT CURRENT_DATE,
    energy_level TEXT CHECK (energy_level IN ('low', 'medium', 'high')),
    sleep_quality TEXT CHECK (sleep_quality IN ('poor', 'fair', 'good', 'great')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, check_date)
);

CREATE INDEX idx_wellness_checkins_user_date ON wellness_checkins(user_id, check_date);
```

#### Wellness Insights
```sql
CREATE TABLE wellness_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern', 'suggestion', 'milestone')),
    content TEXT NOT NULL,
    relevant_date DATE,
    generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wellness_insights_user ON wellness_insights(user_id, generated_at DESC);
```

#### Focus Snapshots
```sql
CREATE TABLE focus_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    flow_score INTEGER CHECK (flow_score >= 0 AND flow_score <= 100),
    deep_work_minutes INTEGER DEFAULT 0,
    context_switches INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_focus_snapshots_user ON focus_snapshots(user_id, created_at DESC);
```

#### User Shield Settings
```sql
CREATE TABLE user_shield_settings (
    user_id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### External Tool Connections (Composio MCP)
```sql
CREATE TABLE user_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    connected_account_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tool_name)
);

CREATE INDEX idx_user_connections_user ON user_connections(user_id, status);
```

### 5.3 Local SQLite (ML Training Data)

**Location:** `backend/app/ml/artifacts/real_data.db`

```sql
-- Labeled samples from self-reports and feedback corrections
CREATE TABLE labeled_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    features_json TEXT NOT NULL,
    label TEXT NOT NULL,
    label_source TEXT NOT NULL,
    confidence REAL,
    model_prediction TEXT,
    model_confidence REAL,
    was_near_boundary INTEGER DEFAULT 0,
    was_low_confidence INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Feedback request log (active learning)
CREATE TABLE feedback_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    score REAL NOT NULL,
    confidence REAL NOT NULL,
    model_score REAL,
    heuristic_score REAL,
    was_requested INTEGER DEFAULT 0,
    response TEXT,
    response_timestamp REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Intervention outcomes (inferred labels)
CREATE TABLE intervention_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    intervention_type TEXT NOT NULL,
    accepted INTEGER NOT NULL,
    score_before REAL,
    score_after REAL,
    inferred_label TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Location:** `backend/app/ml/artifacts/online_learning.db`

```sql
-- Per-user adapter layers
CREATE TABLE user_adapters (
    user_id TEXT PRIMARY KEY,
    adapter_json TEXT NOT NULL,
    n_updates INTEGER DEFAULT 0,
    last_update REAL,
    accuracy REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Experience buffer for retraining
CREATE TABLE experience_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    features_json TEXT NOT NULL,
    predicted TEXT NOT NULL,
    actual TEXT NOT NULL,
    timestamp REAL NOT NULL,
    used_for_training INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW                                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Browser/Desktop (Behavioral Capture)                                 │
│    │                                                                   │
│    ├── Keyboard: hold times, flight times, error rate, WPM            │
│    ├── Mouse: speed, direction changes, rage clicks, scroll           │
│    └── Context: app switches, session fragmentation                   │
│                                                                        │
│    ▼                                                                   │
│  Feature Extraction (23 features per 5-second window)                  │
│    │                                                                   │
│    ├── Keyboard (11): hold_time_mean/std/median, flight_time_mean/std, │
│    │                  typing_speed_wpm, error_rate, pause_frequency,   │
│    │                  pause_duration_mean, burst_length_mean,           │
│    │                  rhythm_entropy                                    │
│    ├── Mouse (6): mouse_speed_mean/std, direction_change_rate,        │
│    │              click_count, rage_click_count, scroll_velocity_std   │
│    ├── Context (3): tab_switch_freq, switch_entropy,                   │
│    │                session_fragmentation                               │
│    └── Temporal (3): hour_of_day, day_of_week, session_duration_min   │
│                                                                        │
│    ▼                                                                   │
│  Feature Interactions (+5 computed features)                           │
│    ├── typing_speed_wpm × error_rate (cognitive load)                 │
│    ├── rage_click_count × direction_change_rate (frustration)         │
│    ├── session_fragmentation × tab_switch_freq (chaos)                │
│    ├── pause_frequency × rhythm_entropy (break pattern)               │
│    └── mouse_speed_std × click_count (agitation)                      │
│                                                                        │
│    ▼                                                                   │
│  ML Inference Pipeline                                                  │
│    │                                                                   │
│    ├── DualNormalizer (global z-scores + per-user circadian z-scores) │
│    ├── XGBoost (350 trees, max_depth=5)                                │
│    ├── Random Forest (200 trees) [ensemble]                            │
│    ├── LightGBM (300 trees) [ensemble]                                 │
│    ├── LSTM (64 hidden, 2 layers) [temporal, borderline cases]        │
│    ├── Online Learning Adapter [per-user adjustments]                  │
│    └── Dynamic Hybrid Weighting [confidence-aware ML vs heuristic]    │
│                                                                        │
│    ▼                                                                   │
│  Output: score (0-100), level (NEUTRAL/MILD/STRESSED), confidence     │
│    │                                                                   │
│    ├──→ SQLite (stress_history) ← local, private                      │
│    ├──→ Supabase (focus_snapshots) ← cloud                            │
│    ├──→ WebSocket/SSE → Frontend real-time update                     │
│    └──→ Intervention Engine → break recommendations                   │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. ML Pipeline Details

### 7.1 Feature Engineering

| Category | Features | Count | Description |
|----------|----------|-------|-------------|
| Keyboard | hold_time_mean, hold_time_std, hold_time_median | 3 | How long keys are pressed |
| Keyboard | flight_time_mean, flight_time_std | 2 | Gaps between keystrokes |
| Keyboard | typing_speed_wpm, error_rate | 2 | Speed and accuracy |
| Keyboard | pause_frequency, pause_duration_mean | 2 | Break patterns |
| Keyboard | burst_length_mean, rhythm_entropy | 2 | Typing rhythm consistency |
| Mouse | mouse_speed_mean, mouse_speed_std | 2 | Pointer movement |
| Mouse | direction_change_rate, click_count | 2 | Movement patterns |
| Mouse | rage_click_count, scroll_velocity_std | 2 | Frustration indicators |
| Context | tab_switch_freq, switch_entropy | 2 | App switching behavior |
| Context | session_fragmentation | 1 | Focus continuity |
| Temporal | hour_of_day, day_of_week | 2 | Circadian context |
| Temporal | session_duration_min | 1 | Session length |
| **Interactions** | WPM×error, rage×direction, fragmentation×switch, pause×entropy, speed×clicks | 5 | Behavioral signatures |
| **Total** | | **28** | |

### 7.2 Model Architecture

| Component | Type | Parameters | Purpose |
|-----------|------|------------|---------|
| XGBoost | Gradient Boosting | 350 trees, depth 5 | Primary stress classifier |
| Random Forest | Bagging | 200 trees, depth 8 | Ensemble diversity |
| LightGBM | Gradient Boosting | 300 trees, depth 5 | Ensemble diversity |
| LSTM | Temporal Neural Net | 64 hidden, 2 layers | Sequence pattern detection |
| Heuristic Equation | Rule-based | 5 sub-scores | Fallback + hybrid blending |

### 7.3 Inference Pipeline Steps

```
1. Feature extraction (23 raw features from 5s window)
2. Feature interactions (+5 computed features)
3. Dual normalization (global z-scores + per-user z-scores)
4. Ensemble prediction (XGBoost + RF + LightGBM weighted voting)
5. LSTM temporal check (if borderline case, 60-80 score range)
6. Online learning adapter (per-user threshold/bias adjustments)
7. Dynamic hybrid weighting (confidence-aware ML vs heuristic blend)
8. Final score clamping (0-100) and level classification
```

### 7.4 Dynamic Hybrid Weighting

```python
def compute_adaptive_weight(confidence, is_calibrated, model_score, equation_score):
    weight = 0.7  # base
    
    if confidence > 0.8: weight += 0.15    # High confidence → trust ML
    elif confidence < 0.5: weight -= 0.15  # Low confidence → trust heuristic
    
    if not is_calibrated: weight -= 0.10   # New user → conservative
    
    if abs(model_score - equation_score) > 30: weight -= 0.05  # Disagreement
    
    return clamp(weight, 0.5, 0.9)
```

---

## 8. Frontend Architecture

### 8.1 Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion
- **Icons:** Lucide React
- **State:** Zustand (centralized store)
- **Charts:** uPlot (energy forecast, 12KB)
- **ML Inference:** ONNX Runtime Web (browser-based, optional)
- **LLM:** WebLLM (browser-based Phi-3, optional)
- **WebSocket:** PartySocket (serverless, optional)

### 8.2 Key Libraries

| Library | Size | Purpose |
|---------|------|---------|
| `onnxruntime-web` | 800KB | Browser ML inference |
| `uplot` | 12KB | Energy forecast charting |
| `zustand` | 1KB | Centralized state management |
| `@mlc-ai/web-llm` | ~1.5GB (model) | Browser LLM for chat |
| `partysocket` | 5KB | Serverless WebSocket |

### 8.3 State Management

```typescript
// Zustand store: src/lib/stress-store.ts
interface StressStore {
  score: number;
  level: string;
  confidence: number;
  typingSpeedWpm: number;
  rageClickCount: number;
  errorRate: number;
  history: StressHistoryPoint[];  // Last 200 points
  intervention: InterventionState;
  isLoading: boolean;
  error: string | null;
  wsConnected: boolean;
  // Actions: updateScore, addToHistory, setIntervention, etc.
}
```

### 8.4 Browser ML Inference

```typescript
// ONNX Runtime Web: src/lib/onnx-inference.ts
class BrowserInference {
  async init(): Promise<boolean>;           // Load ONNX models
  async predict(features): InferenceResult; // XGBoost inference
  async predictSequence(seq): InferenceResult; // LSTM inference
  async predictEnsemble(features): InferenceResult; // Combined
}

// Usage: api.inferenceWithFallback(features) 
// → tries browser ONNX first, falls back to server
```

---

## 9. Backend Architecture

### 9.1 Tech Stack
- **Framework:** FastAPI (Python 3.11+)
- **ML:** XGBoost, scikit-learn, LightGBM, PyTorch (LSTM)
- **Database:** SQLite (local) + Supabase (cloud)
- **Real-time:** WebSocket + SSE
- **Auth:** JWT (HS256)
- **Explainability:** SHAP

### 9.2 Service Layer

| Service | File | Purpose |
|---------|------|---------|
| InferenceEngine | `services/inference.py` | Main prediction pipeline |
| ChatService | `services/chat_service.py` | Chat session management |
| ChatLLM | `services/chat_llm.py` | LLM integration + intent routing |
| WellnessService | `services/wellness_service.py` | Check-ins + insights |
| FocusService | `services/focus_service.py` | Flow state + shield + forecast |
| RealDataCollector | `ml/real_data_collector.py` | Labeled data collection |
| StressEnsemble | `ml/ensemble.py` | Multi-model voting |
| StressLSTM | `ml/temporal_model.py` | Temporal sequence model |
| OnlineLearner | `ml/online_learning.py` | Per-user adaptation |

### 9.3 File Structure

```
mini/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes.py              # Core ML routes
│   │   │   ├── auth_routes.py         # Auth routes
│   │   │   └── extended_routes.py     # Chat/wellness/focus/ML routes
│   │   ├── core/
│   │   │   ├── config.py              # Configuration constants
│   │   │   ├── auth.py                # JWT auth
│   │   │   └── supabase.py            # Supabase client
│   │   ├── ml/
│   │   │   ├── model.py               # XGBoost + DualNormalizer
│   │   │   ├── feature_extractor.py   # 23 features + 5 interactions
│   │   │   ├── synthetic_data.py      # Training data generation
│   │   │   ├── data_collector.py      # Behavioral capture (pynput)
│   │   │   ├── ensemble.py            # XGBoost + RF + LightGBM
│   │   │   ├── temporal_model.py      # LSTM sequence model
│   │   │   ├── real_data_collector.py # Labeled data pipeline
│   │   │   └── online_learning.py     # Per-user adapters
│   │   ├── services/
│   │   │   ├── inference.py           # Inference engine
│   │   │   ├── chat_service.py        # Chat sessions
│   │   │   ├── chat_llm.py            # LLM + intent routing
│   │   │   ├── wellness_service.py    # Wellness check-ins
│   │   │   ├── focus_service.py       # Flow state + shield
│   │   │   ├── websocket_manager.py   # WS connections
│   │   │   ├── history.py             # SQLite history
│   │   │   └── interventions.py       # Break recommendations
│   │   ├── schemas/
│   │   │   └── stress.py              # Pydantic models
│   │   └── main.py                    # FastAPI app
│   ├── scripts/
│   │   └── export_onnx_models.py      # ONNX export pipeline
│   ├── tests/
│   │   ├── test_dynamic_weighting.py  # 11 tests
│   │   ├── test_week3_6.py            # 19 tests
│   │   ├── test_month2_3.py           # 21 tests
│   │   └── test_reality.py            # 21 endpoint tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/                 # Protected routes
│   │   │   │   ├── layout.tsx         # AuthGuard + Sidebar
│   │   │   │   ├── tracking/page.tsx
│   │   │   │   ├── history/page.tsx
│   │   │   │   ├── insights/page.tsx
│   │   │   │   ├── interventions/page.tsx
│   │   │   │   ├── calibration/page.tsx
│   │   │   │   ├── privacy/page.tsx
│   │   │   │   ├── chat/page.tsx
│   │   │   │   ├── wellness/page.tsx
│   │   │   │   └── focus/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── page.tsx               # Landing
│   │   ├── components/
│   │   │   ├── sidebar.tsx
│   │   │   ├── auth-guard.tsx
│   │   │   └── UPlotEnergyChart.tsx
│   │   └── lib/
│   │       ├── api.ts                 # API client
│   │       ├── types.ts               # TypeScript types
│   │       ├── stress-store.ts        # Zustand store
│   │       ├── onnx-inference.ts      # Browser ML
│   │       ├── webllm-client.ts       # Browser LLM
│   │       └── partykit-client.ts     # Serverless WS
│   └── package.json
├── desktop/
│   └── src-tauri/                     # Tauri v2 (Rust desktop)
│       ├── src/main.rs
│       ├── Cargo.toml
│       └── tauri.conf.json
└── supabase_schema.sql
```

---

## 10. Environment Configuration

```bash
# Database
SUPABASE_URL=https://ihaaqumdgdgsvyaiyggs.supabase.co
SUPABASE_ANON_KEY=sb_publishable_WVhNDQK5BNi8xDGxI-cSXw_HGS-Ztto
SUPABASE_SERVICE_KEY=<service-role-key>

# Authentication
JWT_SECRET_KEY=mindpulse-dev-secret-change-in-production-2024
JWT_ACCESS_TOKEN_EXPIRE=10080

# LLM Integration
GEMINI_API_KEY=<gemini-key>

# Composio MCP Integration
COMPOSIO_API_KEY=<composio-key>

# Application
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
LOG_LEVEL=INFO
```

---

## 11. Performance Metrics

### Build Metrics
| Metric | Value |
|--------|-------|
| Frontend build time | 22-33 seconds |
| Pages generated | 16/16 |
| First Load JS (shared) | 102 KB |
| Largest page (interventions) | 222 KB |
| Smallest page (not-found) | 103 KB |
| TypeScript errors | 0 |

### Backend Metrics
| Metric | Value |
|--------|-------|
| API endpoints | 30+ |
| Reality test pass rate | 21/21 (100%) |
| Unit test pass rate | 51/51 (100%) |
| Inference latency | < 50ms (local), < 200ms (server) |
| Model accuracy (synthetic) | 100% |
| Model accuracy (realistic) | 46.8% F1 |

### Database
| Store | Tables | Purpose |
|-------|--------|---------|
| SQLite (local) | 2 | Behavioral history, user baselines |
| Supabase (cloud) | 7 | Chat, wellness, focus, connections |
| SQLite (ML) | 5 | Labeled data, experience buffer, adapters |

---

## 12. Security Model

### Authentication
- JWT tokens (HS256) with configurable expiry
- Tokens stored in `localStorage` (client-side)
- All protected routes require `Authorization: Bearer <token>`
- Auth validated via `get_current_user` dependency in FastAPI

### Data Privacy
- **No content capture:** Only timing metadata (hold times, flight times, speeds)
- **Local-first:** Behavioral data stored in SQLite on user's machine
- **Cloud separation:** Supabase only stores chat/wellness/focus data (user-provided)
- **Hashed context:** App names hashed via SHA-256, never stored in plaintext
- **RLS bypassed intentionally:** Access control at API layer via JWT, not database RLS

### Secrets Management
- Service role key in environment variable only (never hardcoded)
- API keys loaded from `.env` via `python-dotenv`
- CORS restricted to `localhost:3000` in development

---

## 13. Deployment

### Frontend
```bash
cd mini/frontend
npm run build    # Next.js production build
npm run start    # Serve on port 3000
```

### Backend
```bash
cd mini/backend
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

### Desktop (Tauri v2)
```bash
cd mini/desktop/src-tauri
cargo tauri dev    # Development
cargo tauri build  # Production (requires VS Build Tools on Windows)
```

### ONNX Model Export
```bash
cd mini/backend
python scripts/export_onnx_models.py --output-dir ../frontend/public/models
```

---

## 14. Future Roadmap

| Priority | Feature | Status | Impact |
|----------|---------|--------|--------|
| P1 | ONNX browser inference | Implemented | Zero server ML cost |
| P2 | uPlot charts | Implemented | 10x faster rendering |
| P3 | Zustand state | Implemented | Centralized state |
| P4 | Tauri desktop | Scaffolded | 99.6% size reduction |
| P5 | WebLLM browser LLM | Implemented | No API key needed |
| P6 | Ensemble models | Implemented | +4-6% F1 |
| P7 | PartyKit WebSocket | Implemented | Serverless WS |
| P8 | LSTM temporal model | Implemented | +5-8% F1 for sequences |
| P9 | Online learning | Implemented | +1-2% F1/month |
| P10 | Real data collection | Implemented | Foundation for retraining |
