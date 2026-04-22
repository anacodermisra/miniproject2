-- MindPulse Supabase Schema
-- Run this in Supabase SQL Editor

-- Note: JWT secret is handled at application level, not database level
-- The backend validates JWT tokens using the secret in environment variables

-- Chat Sessions
CREATE TABLE chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'New Chat',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    agent_type TEXT DEFAULT 'general' CHECK (agent_type IN ('focus', 'break', 'energy', 'general')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Wellness Check-ins
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

-- AI-Generated Wellness Insights
CREATE TABLE wellness_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern', 'suggestion', 'milestone')),
    content TEXT NOT NULL,
    relevant_date DATE,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- Focus State Snapshots
CREATE TABLE focus_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    flow_score INTEGER CHECK (flow_score >= 0 AND flow_score <= 100),
    deep_work_minutes INTEGER DEFAULT 0,
    context_switches INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User Shield Settings
CREATE TABLE user_shield_settings (
    user_id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- External Tool Connections (for Composio MCP integration)
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

-- Indexes for user_connections
CREATE INDEX idx_user_connections_user ON user_connections(user_id, status);

-- Row Level Security Policies
-- Note: Since MindPulse uses its own JWT auth, we use service role key to bypass RLS
-- RLS is disabled for now - access control happens at API layer
-- If you want RLS in future, implement with auth.uid() using Supabase Auth

-- Disabled RLS (service role key bypasses it anyway)
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wellness_checkins ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wellness_insights ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE focus_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_shield_settings ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, created_at DESC);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX idx_wellness_checkins_user_date ON wellness_checkins(user_id, check_date);
CREATE INDEX idx_wellness_insights_user ON wellness_insights(user_id, generated_at DESC);
CREATE INDEX idx_focus_snapshots_user ON focus_snapshots(user_id, created_at DESC);
