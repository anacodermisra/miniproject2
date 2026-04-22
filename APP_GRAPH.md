# MindPulse — Full Application Graph

```mermaid
graph TB
    %% ─── EXTERNAL SERVICES ───
    subgraph EXT["☁️ External Services"]
        SUPA["🛢️ Supabase<br/>PostgreSQL<br/>─────────────<br/>chat_sessions<br/>chat_messages<br/>wellness_checkins<br/>wellness_insights<br/>focus_snapshots<br/>user_shield_settings<br/>user_connections"]
        GEM["🔮 Gemini API<br/>LLM Chat"]
        GOOGLE["🔑 Google OAuth<br/>Identity Provider"]
        PARTY["⚡ PartyKit<br/>Serverless WS"]
    end

    %% ─── BROWSER / CLIENT ───
    subgraph BROWSER["🌐 Browser / Desktop Client"]
        subgraph PAGES["📱 Pages (14 routes)"]
            LAND["/ (Landing)<br/>page.tsx<br/>─────────────<br/>Framer Motion animations<br/>Hero + Features + CTA"]
            LOGIN["/login<br/>login/page.tsx<br/>─────────────<br/>Email/password form<br/>Google OAuth button"]
            SIGNUP["/signup<br/>signup/page.tsx<br/>─────────────<br/>Registration form<br/>Password strength meter"]
            CALLBACK["/auth/callback<br/>auth/callback/page.tsx<br/>─────────────<br/>OAuth redirect handler<br/>Token storage"]
            TRACK["/tracking<br/>(app)/tracking/page.tsx<br/>─────────────<br/>Real-time stress gauge<br/>Live metrics<br/>21-day trend chart<br/>Alert banner<br/>Wind-down banner<br/>977 lines"]
            HIST["/history<br/>(app)/history/page.tsx<br/>─────────────<br/>Stress timeline<br/>Stats cards<br/>Signal list<br/>Break history"]
            INS["/insights<br/>(app)/insights/page.tsx<br/>─────────────<br/>BestHours chart<br/>DayOfWeek chart<br/>Break effectiveness<br/>Correlation matrix"]
            INTERV["/interventions<br/>(app)/interventions/page.tsx<br/>─────────────<br/>Intervention streak<br/>State cards<br/>Scheduler<br/>Recovery patterns"]
            CALIB["/calibration<br/>(app)/calibration/page.tsx<br/>─────────────<br/>7-day calendar<br/>Hourly coverage grid"]
            PRIV["/privacy<br/>(app)/privacy/page.tsx<br/>─────────────<br/>View/Export/Delete data<br/>Privacy info"]
            CHAT["/chat<br/>(app)/chat/page.tsx<br/>─────────────<br/>Multi-agent AI chat<br/>SSE streaming<br/>Intent classification"]
            WELL["/wellness<br/>(app)/wellness/page.tsx<br/>─────────────<br/>Daily check-in form<br/>Pattern journal<br/>Weekly reflection"]
            FOCUS["/focus<br/>(app)/focus/page.tsx<br/>─────────────<br/>Flow state meter<br/>Distraction shield<br/>uPlot energy forecast"]
            MOCK["/mockup<br/>(app)/mockup/page.tsx<br/>─────────────<br/>UX testing page"]
        end

        subgraph LAYOUTS["📐 Layouts"]
            ROOTLAY["Root Layout<br/>layout.tsx<br/>─────────────<br/>SessionProvider<br/>globals.css"]
            APPLAY["App Layout<br/>(app)/layout.tsx<br/>─────────────<br/>AuthGuard<br/>Sidebar"]
        end

        subgraph HOOKS["🪝 Hooks"]
            USEAUTH["useAuth()<br/>─────────────<br/>localStorage.mp_token<br/>GET /auth/me validation<br/>logout → clearToken"]
            USESTREAM["useStressStream()<br/>─────────────<br/>WebSocket connection<br/>ws://localhost:5000/api/v1/ws/stress<br/>Returns: data, history, status, error"]
            USEFEAT["useFeatureCollector()<br/>─────────────<br/>keydown, keyup, mousemove,<br/>click, scroll listeners<br/>30s windows → 23 features<br/>Sends via WebSocket"]
        end

        subgraph STORE["📦 Zustand Store<br/>stress-store.ts"]
            SCORE["score, level, confidence"]
            METRICS["typingSpeedWpm<br/>rageClickCount<br/>errorRate<br/>clickCount<br/>mouseSpeedMean"]
            HISTORY["history: HistoryPoint[]<br/>last 200 readings"]
            INTERVST["intervention<br/>alert_state, type, steps"]
            UISTATE["isLoading, error<br/>wsConnected"]
            PERSIST["persist middleware<br/>localStorage<br/>mindpulse-stress-store<br/>last 50 history points"]
        end

        subgraph APILIB["🔌 API Client<br/>api.ts + api-extended.ts"]
            AUTHAPI["Auth API<br/>─────────────<br/>signup()<br/>login()<br/>getProfile()<br/>clearToken()"]
            COREAPI["Core API<br/>─────────────<br/>inference()<br/>inferenceStream() (SSE)<br/>inferenceWithFallback()<br/>history() / stats()<br/>calibration() / feedback()<br/>modelMetrics() / reset()"]
            INTERVAPI["Intervention API<br/>─────────────<br/>interventionRecommendation()<br/>interventionAction()<br/>interventionHistory()<br/>windDown() / scheduleBreak()<br/>scheduledBreaks() / cancelBreak()<br/>checkDueBreaks()"]
            CHATAPI["Chat API<br/>─────────────<br/>createChatSession()<br/>getChatSessions()<br/>getChatMessages()<br/>chatStream() (SSE)"]
            WELLAPI["Wellness API<br/>─────────────<br/>saveWellnessCheckin()<br/>getWellnessCheckins()<br/>getWellnessToday()<br/>getWellnessJournal()<br/>getWellnessWeekly()"]
            FOCUSAPI["Focus API<br/>─────────────<br/>getFocusState()<br/>getDistractionShield()<br/>toggleDistractionShield()<br/>getEnergyForecast()"]
        end

        subgraph BROWSML["🧠 Browser ML"]
            ONNX["ONNX Runtime Web<br/>onnx-inference.ts<br/>─────────────<br/>Loads xgb_model.json<br/>+ ensemble_metadata.json<br/>WASM backend<br/>Runs XGBoost in browser"]
            WEBLLM["WebLLM Client<br/>webllm-client.ts<br/>─────────────<br/>Phi-3.5-mini (~1.5GB)<br/>WebGPU required<br/>Browser-based LLM chat"]
            PARTYKIT["PartyKit Client<br/>partykit-client.ts<br/>─────────────<br/>Serverless WebSocket<br/>For future team features"]
        end

        subgraph COMPS["🧩 Components"]
            SIDEBAR["Sidebar<br/>─────────────<br/>9 nav items<br/>User menu + sign out"]
            AUTHGUARD["AuthGuard<br/>─────────────<br/>Token check<br/>GET /auth/me validate<br/>Redirect to /login"]
            HEADER["Header<br/>─────────────<br/>Page title<br/>Connection status dot"]
            RISKMETER["RiskMeter<br/>─────────────<br/>SVG arc gauge<br/>0-100 stress score"]
            WSSTATUS["WebSocketStatus<br/>─────────────<br/>Connection indicator"]
            TIMELINE["TimelineChart<br/>─────────────<br/>Recharts AreaChart<br/>Stress over time"]
            RECOMMEND["RecommendationPanel<br/>─────────────<br/>Contextual advice<br/>Based on stress level"]
            METRICCARD["MetricCard<br/>─────────────<br/>WPM / Error / Rage / Speed"]
            UPLT["UPlotEnergyChart<br/>─────────────<br/>uPlot (12KB)<br/>24h energy forecast"]
        end

        subgraph TYPES["📐 TypeScript Types<br/>lib/types.ts"]
            FV["FeatureVector<br/>(23 features)"]
            SR["StressResult<br/>(score, level, confidence,<br/>probabilities, insights,<br/>alert_state, intervention)"]
            HP["HistoryPoint"]
            CS["CalibrationStatus"]
            US["UserStats"]
            IR["InterventionRecommendation"]
            CHTSESSION["ChatSession"]
            CHTMSG["ChatMessage"]
            WI["WellnessCheckin<br/>WellnessInsight"]
            FS["FocusState"]
            EF["EnergyForecast"]
        end
    end

    %% ─── BACKEND ───
    subgraph BACKEND["🖥️ FastAPI Backend (:5000)"]
        subgraph ROUTES["🔀 API Routes (30+ endpoints)"]
            COREROUTES["routes.py<br/>─────────────<br/>GET /health<br/>POST /inference<br/>GET /inference/stream (SSE)<br/>WS /ws/stress<br/>GET /history /stats<br/>GET /calibration/{uid}<br/>POST /feedback /reset<br/>GET /model-metrics<br/>GET /interventions/* (8 endpoints)"]
            AUTHROUTES["auth_routes.py<br/>─────────────<br/>POST /auth/signup<br/>POST /auth/login<br/>GET /auth/me<br/>GET /auth/google/callback"]
            EXTROUTES["extended_routes.py<br/>─────────────<br/>POST /chat/sessions<br/>GET /chat/sessions<br/>GET /chat/sessions/{id}/messages<br/>POST /chat/stream (SSE)<br/>POST /wellness/checkin<br/>GET /wellness/checkins/today/journal/weekly<br/>GET /focus/state/shield/forecast<br/>POST /focus/shield<br/>POST /ml/self-report/feedback<br/>POST /ml/intervention-outcome<br/>GET /ml/dataset-stats"]
        end

        subgraph SERVICES["⚙️ Services"]
            INFSERV["InferenceEngine<br/>services/inference.py<br/>─────────────<br/>predict(features, user_id)<br/>Full ML pipeline:<br/>extract → normalize → ensemble →<br/>lstm → online → hybrid → intervene"]
            AUTHSERV["AuthService<br/>core/auth.py<br/>─────────────<br/>create_access_token()<br/>verify_token()<br/>get_current_user()<br/>bcrypt password hashing"]
            USERSERV["UserService<br/>services/users.py<br/>─────────────<br/>create_user()<br/>login()<br/>get_user()<br/>SQLite users.db"]
            HISTSERV["HistoryService<br/>services/history.py<br/>─────────────<br/>add_point()<br/>get_history(user, limit)<br/>get_stats(user)<br/>SQLite stress_history"]
            INTERVSERV["InterventionEngine<br/>services/interventions.py<br/>─────────────<br/>State machine:<br/>NEUTRAL → EARLY_WARNING →<br/>BREAK_RECOMMENDED → RECOVERY<br/>Recommendation engine"]
            CHATSERV["ChatService<br/>services/chat_service.py<br/>─────────────<br/>Supabase CRUD<br/>create/list sessions<br/>add/get messages"]
            CHATLLMSERV["ChatLLM<br/>services/chat_llm.py<br/>─────────────<br/>classify_intent()<br/>→ focus/break/energy/general<br/>generate_response()<br/>→ Gemini API or templates"]
            WELLSERV["WellnessService<br/>services/wellness_service.py<br/>─────────────<br/>save_checkin()<br/>get_checkins/today/journal/weekly<br/>AI insight generation<br/>Supabase wellness_*"]
            FOCSERV["FocusService<br/>services/focus_service.py<br/>─────────────<br/>get_state() → flow_score<br/>toggle_shield()<br/>get_forecast() → energy curve<br/>Supabase focus_*"]
            WSSERV["WebSocketManager<br/>services/websocket_manager.py<br/>─────────────<br/>Connection pool<br/>broadcast(data)<br/>Real-time push"]
        end

        subgraph MLPIPELINE["🧠 ML Pipeline"]
            MODEL["StressModel<br/>ml/model.py<br/>─────────────<br/>XGBoost (350 trees, depth 5)<br/>train() / predict()<br/>Loaded from model_xgb.joblib"]
            DNORM["DualNormalizer<br/>ml/model.py<br/>─────────────<br/>Global z-scores<br/>(global_stats.joblib)<br/>+ Per-user circadian<br/>(user_baselines_*.db)"]
            PBAS["PersonalBaseline<br/>ml/model.py<br/>─────────────<br/>EMA per-hour adjustment<br/>α=0.1 smoothing<br/>Adapts over time"]
            ENSEMBLE["StressEnsemble<br/>ml/ensemble.py<br/>─────────────<br/>XGBoost weight: 0.40<br/>RF weight: 0.20<br/>LightGBM weight: 0.20<br/>+ LSTM weight: 0.20"]
            LSTM["StressLSTM<br/>ml/temporal_model.py<br/>─────────────<br/>64 hidden units<br/>2 layers, bidirectional<br/>Sequence of 10 readings<br/>Only for borderline 60-80"]
            ONLINE["OnlineLearner<br/>ml/online_learning.py<br/>─────────────<br/>Per-user adapter<br/>Bias/threshold adjustments<br/>Experience buffer"]
            FEATEX["FeatureExtractor<br/>ml/feature_extractor.py<br/>─────────────<br/>23 raw features<br/>+ 5 interaction features<br/>= 28 total features"]
            SYNDATA["SyntheticData<br/>ml/synthetic_data.py<br/>─────────────<br/>Training data generation<br/>Balanced distribution"]
            REALDATA["RealDataCollector<br/>ml/real_data_collector.py<br/>─────────────<br/>Labeled sample collection<br/>Feedback requests<br/>Intervention outcomes"]
        end

        subgraph COREMOD["🔧 Core Modules"]
            CONFIG["config.py<br/>─────────────<br/>FEATURE_NAMES (23)<br/>THRESHOLDS<br/>Model parameters<br/>Server config"]
            SUPAMOD["supabase.py<br/>─────────────<br/>Supabase client<br/>URL + service key<br/>Used by: chat, wellness, focus"]
        end

        subgraph SCHEMAS["📋 Pydantic Schemas<br/>schemas/stress.py"]
            PYD["FeatureVector<br/>InferenceRequest<br/>InferenceResponse<br/>CalibrationStatus<br/>HistoryPoint<br/>FeedbackRequest<br/>HealthResponse<br/>ResetRequest<br/>InterventionActionRequest<br/>InterventionEvent"]
        end
    end

    %% ─── DATABASES ───
    subgraph DATABASES["🗄️ Databases"]
        subgraph SQLITE["SQLite (Local/Private)"]
            HISTDB["history.db<br/>─────────────<br/>stress_history<br/>├── user_id, timestamp, score<br/>├── level, features_json<br/>└── 23 behavioral features as JSON"]
            BASEDB["user_baselines_*.db<br/>─────────────<br/>user_baselines<br/>├── user_id, hour<br/>├── mean (blob), std (blob)<br/>└── ema_count"]
            USERSDB["users.db<br/>─────────────<br/>users table<br/>├── id, email, username<br/>├── name, password_hash<br/>└── created_at"]
            REALDB["real_data.db<br/>─────────────<br/>labeled_samples<br/>feedback_requests<br/>intervention_labels"]
            ONLDB["online_learning.db<br/>─────────────<br/>user_adapters<br/>├── user_id, adapter_json<br/>└── n_updates, accuracy<br/><br/>experience_buffer<br/>├── features_json<br/>└── predicted vs actual"]
        end
    end

    %% ─── DESKTOP APP ───
    subgraph DESKTOP["🖥️ Tauri Desktop App"]
        TAURICONF["tauri.conf.json<br/>─────────────<br/>Window: 1200×800<br/>Transparent, resizable<br/>Wraps Next.js frontend"]
        RUSTMAIN["main.rs<br/>─────────────<br/>Rust entry point<br/>99.6% smaller than Electron"]
    end

    %% ─── CONNECTIONS ───

    %% Landing → Auth
    LAND -->|Get started| LOGIN
    LAND -->|Sign up| SIGNUP
    LOGIN -->|Google| GOOGLE
    SIGNUP -->|Submit| AUTHAPI
    LOGIN -->|Submit| AUTHAPI
    CALLBACK -->|Token storage| USEAUTH

    %% Auth flow
    AUTHAPI -->|POST /auth/signup| AUTHROUTES
    AUTHAPI -->|POST /auth/login| AUTHROUTES
    AUTHAPI -->|GET /auth/me| AUTHROUTES
    AUTHROUTES --> AUTHSERV
    AUTHROUTES --> USERSERV
    USERSERV --> USERSDB
    AUTHSERV -->|JWT| AUTHAPI

    %% Auth Guard
    APPLAY --> AUTHGUARD
    AUTHGUARD --> USEAUTH
    USEAUTH -->|mp_token| AUTHAPI

    %% Layout hierarchy
    ROOTLAY --> APPLAY
    APPLAY --> SIDEBAR
    SIDEBAR --> TRACK
    SIDEBAR --> HIST
    SIDEBAR --> INS
    SIDEBAR --> INTERV
    SIDEBAR --> CALIB
    SIDEBAR --> PRIV
    SIDEBAR --> CHAT
    SIDEBAR --> WELL
    SIDEBAR --> FOCUS

    %% Tracking page connections
    TRACK --> USESTREAM
    TRACK --> USEFEAT
    TRACK --> USEAUTH
    TRACK --> RISKMETER
    TRACK --> METRICCARD
    TRACK --> TIMELINE
    TRACK --> WSSTATUS
    TRACK --> RECOMMEND
    USESTREAM -->|WebSocket| COREROUTES
    USEFEAT -->|30s features| USESTREAM

    %% Store connections
    TRACK --> SCORE
    TRACK --> METRICS
    TRACK --> HISTORY
    TRACK --> INTERVST
    USESTREAM --> STORE

    %% Tracking API calls
    TRACK -->|inference| COREAPI
    TRACK -->|stats| COREAPI
    TRACK -->|history| COREAPI
    TRACK -->|interventionRec| INTERVAPI
    TRACK -->|windDown| INTERVAPI
    TRACK -->|feedback| COREAPI

    %% Core API → Backend
    COREAPI -->|REST| COREROUTES
    INTERVAPI -->|REST| COREROUTES
    COREAPI -->|inferenceWithFallback| ONNX
    ONNX -->|fallback| COREAPI

    %% History page
    HIST -->|history| COREAPI
    HIST -->|interventionHistory| INTERVAPI
    HIST --> TIMELINE

    %% Insights page
    INS -->|history + stats| COREAPI

    %% Interventions page
    INTERV -->|recommendation| INTERVAPI
    INTERV -->|action| INTERVAPI
    INTERV -->|schedule/cancel| INTERVAPI

    %% Calibration page
    CALIB -->|calibration| COREAPI

    %% Privacy page
    PRIV -->|reset| COREAPI

    %% Chat page
    CHAT --> CHATAPI
    CHATAPI -->|SSE stream| EXTROUTES
    CHAT --> WEBLLM

    %% Wellness page
    WELL --> WELLAPI
    WELLAPI -->|REST| EXTROUTES

    %% Focus page
    FOCUS --> FOCUSAPI
    FOCUSAPI -->|REST| EXTROUTES
    FOCUS --> UPLT

    %% Backend service connections
    COREROUTES --> INFSERV
    COREROUTES --> HISTSERV
    COREROUTES --> INTERVSERV
    COREROUTES --> WSSERV

    EXTROUTES --> CHATSERV
    EXTROUTES --> CHATLLMSERV
    EXTROUTES --> WELLSERV
    EXTROUTES --> FOCSERV
    EXTROUTES --> REALDATA

    %% ML Pipeline connections
    INFSERV --> FEATEX
    INFSERV --> DNORM
    INFSERV --> ENSEMBLE
    INFSERV --> LSTM
    INFSERV --> ONLINE
    INFSERV --> MODEL
    INFSERV --> PBAS
    INFSERV --> INTERVSERV
    INFSERV --> HISTSERV

    %% ML model connections
    ENSEMBLE --> MODEL
    MODEL -->|model_xgb.joblib| HISTDB
    DNORM -->|global_stats.joblib| HISTDB
    DNORM -->|user baselines| BASEDB
    ONLINE -->|adapters| ONLDB

    %% Chat LLM → Gemini
    CHATLLMSERV -->|GEMINI_API_KEY| GEM
    CHATLLMSERV -->|fallback| CHATSERV

    %% Supabase connections
    CHATSERV --> SUPA
    WELLSERV --> SUPA
    FOCSERV --> SUPA

    %% History → SQLite
    HISTSERV --> HISTDB
    USERSERV --> USERSDB
    REALDATA --> REALDB
    ONLINE --> ONLDB

    %% PartyKit (future)
    PARTYKIT --> PARTY

    %% Desktop
    TAURICONF --> RUSTMAIN
    RUSTMAIN -->|embeds| BROWSER

    %% Config
    INFSERV --> CONFIG
    CHATSERV --> SUPAMOD
    WELLSERV --> SUPAMOD
    FOCSERV --> SUPAMOD

    %% Types
    PAGES --> TYPES
    APILIB --> TYPES
    STORE --> TYPES

    %% Styling
    LAYOUTS -->|Tailwind CSS +<br/>Framer Motion| PAGES
```

## Data Flow Summary Table

| Flow | Source | Transport | Destination | Protocol |
|------|--------|-----------|-------------|----------|
| Browser events → Features | DOM events | useFeatureCollector | Backend WS | WebSocket |
| Features → Stress score | FeatureVector | inference() | InferenceEngine | REST/WS |
| Stress score → UI | StressResult | Zustand store | React components | State |
| Stress score → History | StressResult | HistoryService | SQLite history.db | DB write |
| Stress score → Focus | score/level | FocusService | Supabase focus_snapshots | REST → Supabase |
| User input → Auth | credentials | JWT | localStorage | REST → JWT |
| Chat message → LLM | text | SSE stream | Gemini API | SSE |
| Chat sessions → DB | ChatMessage | ChatService | Supabase chat_messages | REST → Supabase |
| Wellness check-in → DB | WellnessCheckin | WellnessService | Supabase wellness_checkins | REST → Supabase |
| Model inference → Browser | StressResult | WebSocket | useStressStream | WS |
| Model inference (fallback) | FeatureVector | ONNX Runtime | Browser WASM | Local compute |
| Calibration data | user_id | DualNormalizer | SQLite user_baselines | DB read/write |
| Online learning | predictions | OnlineLearner | SQLite online_learning.db | DB read/write |
| Intervention → User | recommendation | InterventionEngine | TrackingPage UI | REST |
| Break schedule → Cron | scheduled | InterventionEngine | due-break check | REST poll |