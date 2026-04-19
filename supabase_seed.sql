-- MindPulse Seed Data - Indian Origin Users
-- Run this in Supabase SQL Editor after supabase_schema.sql

-- Note: User IDs are text-based demo accounts

-- Seed chat sessions for Indian demo users
INSERT INTO chat_sessions (user_id, title, is_active) VALUES
('demo_user', 'Wellness Check-in', true),
('demo_user', 'Focus Strategies', true),
('rahul_sharma', 'Daily Standup', true),
('priya_patel', 'Work-Life Balance', true),
('amit_kumar', 'Stress Management', true),
('neha_singh', 'Energy Tracking', true),
('raj_malhotra', 'Productivity Tips', true),
('anita_desai', 'Morning Routine', true)
ON CONFLICT DO NOTHING;

-- Seed wellness check-ins for Indian users (last 7 days)
-- Using Indian context: IT professionals, traditional routines
INSERT INTO wellness_checkins (user_id, check_date, energy_level, sleep_quality, note) VALUES
('rahul_sharma', CURRENT_DATE - 6, 'high', 'good', 'Morning yoga session'),
('rahul_sharma', CURRENT_DATE - 5, 'medium', 'fair', 'Late night coding'),
('rahul_sharma', CURRENT_DATE - 4, 'high', 'great', 'Meditation + workout'),
('rahul_sharma', CURRENT_DATE - 3, 'medium', 'good', 'Team meeting day'),
('rahul_sharma', CURRENT_DATE - 2, 'low', 'fair', 'Tight deadline'),
('rahul_sharma', CURRENT_DATE - 1, 'high', 'good', 'Sprint completed'),
('rahul_sharma', CURRENT_DATE, 'medium', 'good', 'Starting new project'),

('priya_patel', CURRENT_DATE - 6, 'high', 'great', '5AM club routine'),
('priya_patel', CURRENT_DATE - 5, 'medium', 'good', 'Client presentation'),
('priya_patel', CURRENT_DATE - 4, 'high', 'great', 'Yoga + pranayama'),
('priya_patel', CURRENT_DATE - 3, 'medium', 'fair', 'Less sleep'),
('priya_patel', CURRENT_DATE - 2, 'high', 'good', 'Workshop facilitation'),
('priya_patel', CURRENT_DATE - 1, 'medium', 'good', 'Mentoring session'),
('priya_patel', CURRENT_DATE, 'high', 'great', 'Q1 targets achieved'),

('amit_kumar', CURRENT_DATE - 5, 'low', 'poor', 'Late night debugging'),
('amit_kumar', CURRENT_DATE - 4, 'medium', 'fair', 'Code review'),
('amit_kumar', CURRENT_DATE - 3, 'medium', 'good', 'Standup done'),
('amit_kumar', CURRENT_DATE - 2, 'high', 'good', 'Feature shipped'),
('amit_kumar', CURRENT_DATE - 1, 'medium', 'fair', 'Hotfix release'),
('amit_kumar', CURRENT_DATE, 'medium', 'good', 'Planning sprint')
ON CONFLICT DO NOTHING;

-- Seed wellness insights (AI-generated for Indian context)
INSERT INTO wellness_insights (user_id, insight_type, content, relevant_date) VALUES
('rahul_sharma', 'pattern', 'Your energy peaks on days after morning yoga. Consider maintaining this routine.', CURRENT_DATE - 2),
('rahul_sharma', 'suggestion', 'Sleep before midnight to align with your natural rhythm. Research shows 10PM-6AM sleep improves cognitive performance by 15%.', CURRENT_DATE - 1),
('rahul_sharma', 'milestone', 'You completed 14 wellness check-ins this month! Consistency is key.', CURRENT_DATE),

('priya_patel', 'pattern', 'Your best energy days correlate with morning meditation sessions.', CURRENT_DATE - 3),
('priya_patel', 'suggestion', 'Your 5AM routine is working well. The traditional wake-up time (Brahmamuhurt) shows benefits - keep it up!', CURRENT_DATE - 2),
('priya_patel', 'milestone', 'You have maintained check-ins for 21 consecutive days!', CURRENT_DATE),

('amit_kumar', 'pattern', 'High typing speed correlates with lower stress scores. Your flow states are productive.', CURRENT_DATE - 2),
('amit_kumar', 'suggestion', 'Take micro-breaks every 45 minutes. Try the 20-20-20 rule: 20 sec look 20 ft away every 20 min.', CURRENT_DATE - 1),
('amit_kumar', 'milestone', 'You achieved your lowest stress score yet yesterday!', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Seed focus snapshots for Indian developers
INSERT INTO focus_snapshots (user_id, flow_score, deep_work_minutes, context_switches, created_at) VALUES
('rahul_sharma', 85, 120, 3, NOW() - INTERVAL '6 hours'),
('rahul_sharma', 72, 90, 5, NOW() - INTERVAL '5 hours'),
('rahul_sharma', 90, 150, 2, NOW() - INTERVAL '4 hours'),
('rahul_sharma', 68, 60, 8, NOW() - INTERVAL '3 hours'),
('rahul_sharma', 78, 100, 4, NOW() - INTERVAL '2 hours'),
('rahul_sharma', 82, 110, 3, NOW() - INTERVAL '1 hour'),

('priya_patel', 92, 180, 1, NOW() - INTERVAL '7 hours'),
('priya_patel', 88, 150, 2, NOW() - INTERVAL '6 hours'),
('priya_patel', 95, 200, 0, NOW() - INTERVAL '5 hours'),
('priya_patel', 80, 120, 3, NOW() - INTERVAL '4 hours'),
('priya_patel', 85, 140, 2, NOW() - INTERVAL '3 hours'),
('priya_patel', 90, 160, 1, NOW() - INTERVAL '2 hours'),

('amit_kumar', 65, 45, 10, NOW() - INTERVAL '5 hours'),
('amit_kumar', 70, 60, 8, NOW() - INTERVAL '4 hours'),
('amit_kumar', 75, 90, 6, NOW() - INTERVAL '3 hours'),
('amit_kumar', 80, 100, 5, NOW() - INTERVAL '2 hours'),
('amit_kumar', 72, 75, 7, NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- Seed user shield settings
INSERT INTO user_shield_settings (user_id, enabled) VALUES
('rahul_sharma', true),
('priya_patel', true),
('amit_kumar', false),
('neha_singh', false),
('raj_malhotra', true)
ON CONFLICT DO NOTHING;

-- Sample chat messages for context
INSERT INTO chat_messages (session_id, user_id, role, content, agent_type) VALUES
((SELECT id FROM chat_sessions WHERE user_id = 'rahul_sharma' LIMIT 1), 'rahul_sharma', 'user', 'How can I improve my focus during work?', 'focus'),
((SELECT id FROM chat_sessions WHERE user_id = 'rahul_sharma' LIMIT 1), 'rahul_sharma', 'assistant', 'Based on your patterns, you focus best in the morning. Schedule deep work before noon. Also, enable your distraction shield to block social media during focus hours.', 'focus'),
((SELECT id FROM chat_sessions WHERE user_id = 'priya_patel' LIMIT 1), 'priya_patel', 'user', 'I feel exhausted by 3PM every day.', 'energy'),
((SELECT id FROM chat_sessions WHERE user_id = 'priya_patel' LIMIT 1), 'priya_patel', 'assistant', 'Your data shows a post-lunch dip. Try a 10-minute walk or pranayama breathing at 2:30PM. Avoid heavy lunch - opt for lighter meals.', 'break')
ON CONFLICT DO NOTHING;