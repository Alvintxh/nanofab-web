-- ============================================
-- NanoFab Learning Platform - Database Schema
-- Supabase PostgreSQL
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 用户画像表 (User Profiles)
-- ============================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS '用户画像和个性化设置';
COMMENT ON COLUMN user_profiles.profile_data IS '包含: name, background, level, motivation[], prerequisite[], studyPace, learningStyle[], interestArea[], resume, scores, currentProject, futureProject, learningReason, behaviorProfile';

-- ============================================
-- 2. 学习进度表 (User Progress)
-- ============================================
CREATE TABLE user_progress (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_chapters JSONB NOT NULL DEFAULT '[]',
    total_chapters INTEGER DEFAULT 12,
    completion_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_progress IS '用户章节完成进度';
COMMENT ON COLUMN user_progress.completed_chapters IS '已完成的章节ID数组, e.g., ["ch01", "ch02"]';
COMMENT ON COLUMN user_progress.completion_rate IS '完成百分比, 自动计算';

-- ============================================
-- 3. 学习行为事件表 (Learning Events)
-- 替代原来的 user_behavior JSONB 大字段
-- ============================================
CREATE TABLE user_behavior_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    chapter_id VARCHAR(20),
    section_id VARCHAR(100),
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_behavior_events IS '用户学习行为事件流';
COMMENT ON COLUMN user_behavior_events.event_type IS '事件类型: page_view, click, scroll, quiz_answer, ai_query, time_spent';
COMMENT ON COLUMN user_behavior_events.event_data IS '事件详情, 根据event_type变化结构';

-- ============================================
-- 4. 行为汇总表 (Behavior Summary)
-- 缓存聚合数据, 避免频繁计算
-- ============================================
CREATE TABLE user_behavior_summary (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_study_time INTEGER DEFAULT 0,
    total_interactions INTEGER DEFAULT 0,
    quiz_correct_count INTEGER DEFAULT 0,
    quiz_total_count INTEGER DEFAULT 0,
    avg_scroll_depth DECIMAL(5,2) DEFAULT 0,
    weak_topics JSONB DEFAULT '[]',
    strong_topics JSONB DEFAULT '[]',
    preferred_content_types JSONB DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_behavior_summary IS '用户行为聚合摘要, 用于AI个性化推荐';

-- ============================================
-- 5. Quiz 答题记录表
-- ============================================
CREATE TABLE quiz_answers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    chapter_id VARCHAR(20) NOT NULL,
    question_id VARCHAR(100) NOT NULL,
    question_text TEXT,
    is_correct BOOLEAN NOT NULL,
    selected_answer TEXT,
    correct_answer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, chapter_id, question_id)
);

COMMENT ON TABLE quiz_answers IS '用户Quiz答题记录';

-- ============================================
-- 6. AI 查询记录表
-- ============================================
CREATE TABLE ai_queries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    query_type VARCHAR(20) NOT NULL,
    chapter_id VARCHAR(20),
    selected_text TEXT,
    user_message TEXT,
    ai_response TEXT,
    response_tokens INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE ai_queries IS 'AI助手查询历史';
COMMENT ON COLUMN ai_queries.query_type IS '查询类型: explanation(文本解释), chat(自由对话)';

-- ============================================
-- 7. 用户笔记表 (User Notes)
-- ============================================
CREATE TABLE user_notes (
    id VARCHAR(30) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    context TEXT,
    content TEXT,
    chapter_id VARCHAR(20),
    chapter_title VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_notes IS '用户高亮笔记';
COMMENT ON COLUMN user_notes.context IS '选中的原文';
COMMENT ON COLUMN user_notes.content IS '用户写的笔记内容';

-- ============================================
-- 索引 (Indexes)
-- ============================================

-- user_profiles 索引
CREATE INDEX idx_profiles_created ON user_profiles(created_at);
CREATE INDEX idx_profiles_data ON user_profiles USING GIN(profile_data);

-- user_progress 索引
CREATE INDEX idx_progress_completion ON user_progress(completion_rate);

-- user_behavior_events 索引
CREATE INDEX idx_behavior_events_user ON user_behavior_events(user_id);
CREATE INDEX idx_behavior_events_type ON user_behavior_events(event_type);
CREATE INDEX idx_behavior_events_chapter ON user_behavior_events(chapter_id);
CREATE INDEX idx_behavior_events_created ON user_behavior_events(created_at);
CREATE INDEX idx_behavior_events_user_created ON user_behavior_events(user_id, created_at);

-- quiz_answers 索引
CREATE INDEX idx_quiz_user ON quiz_answers(user_id);
CREATE INDEX idx_quiz_chapter ON quiz_answers(chapter_id);
CREATE INDEX idx_quiz_created ON quiz_answers(created_at);
CREATE INDEX idx_quiz_user_chapter_correct ON quiz_answers(user_id, chapter_id, is_correct);

-- ai_queries 索引
CREATE INDEX idx_ai_queries_user ON ai_queries(user_id);
CREATE INDEX idx_ai_queries_type ON ai_queries(query_type);
CREATE INDEX idx_ai_queries_created ON ai_queries(created_at);

-- user_notes 索引
CREATE INDEX idx_notes_user ON user_notes(user_id);
CREATE INDEX idx_notes_chapter ON user_notes(chapter_id);

-- ============================================
-- Row Level Security (RLS) 策略
-- 注意: 详细的策略定义见 schema_v2.sql
-- ============================================

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 触发器 (Triggers)
-- ============================================

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_behavior_summary_updated_at
    BEFORE UPDATE ON user_behavior_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 自动计算 completion_rate
CREATE OR REPLACE FUNCTION calculate_completion_rate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.completion_rate = (
        SELECT COUNT(*) * 100.0 / NULLIF(NEW.total_chapters, 0)
        FROM jsonb_array_elements_text(NEW.completed_chapters)
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_completion_rate
    BEFORE INSERT OR UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION calculate_completion_rate();

-- ============================================
-- 视图 (Views)
-- ============================================

CREATE VIEW user_learning_stats
WITH (security_invoker = true)
AS
SELECT
    p.id AS user_id,
    p.profile_data->>'name' AS user_name,
    COALESCE(pr.completion_rate, 0) AS completion_rate,
    COALESCE(bs.total_study_time, 0) AS total_study_time,
    COALESCE(bs.total_interactions, 0) AS total_interactions,
    COALESCE(bs.quiz_correct_count, 0) AS quiz_correct_count,
    COALESCE(bs.quiz_total_count, 0) AS quiz_total_count,
    CASE
        WHEN bs.quiz_total_count > 0
        THEN ROUND(bs.quiz_correct_count * 100.0 / bs.quiz_total_count, 2)
        ELSE 0
    END AS quiz_accuracy,
    COALESCE(bs.avg_scroll_depth, 0) AS avg_scroll_depth,
    p.created_at AS joined_at,
    p.updated_at AS last_active
FROM user_profiles p
LEFT JOIN user_progress pr ON p.id = pr.id
LEFT JOIN user_behavior_summary bs ON p.id = bs.user_id;

-- ============================================
-- 示例数据 (可选, 用于测试)
-- ============================================

/*
-- 插入示例用户画像
INSERT INTO user_profiles (id, profile_data) VALUES
('00000000-0000-0000-0000-000000000001', '{
    "name": "测试用户",
    "background": "student",
    "level": "beginner",
    "motivation": ["course", "research"],
    "prerequisite": ["physics", "chemistry"],
    "studyPace": "moderate",
    "learningStyle": ["theory", "visual"],
    "interestArea": ["semiconductor", "photonics"]
}'::jsonb);

-- 插入示例进度
INSERT INTO user_progress (id, completed_chapters) VALUES
('00000000-0000-0000-0000-000000000001', '["ch01", "ch02"]'::jsonb);

-- 插入示例行为事件
INSERT INTO user_behavior_events (user_id, event_type, chapter_id, event_data) VALUES
('00000000-0000-0000-0000-000000000001', 'page_view', 'ch01', '{"duration": 300}'::jsonb),
('00000000-0000-0000-0000-000000000001', 'quiz_answer', 'ch01', '{"correct": true, "question": "q1"}'::jsonb);
*/

-- ============================================
-- 完成
-- ============================================
SELECT 'NanoFab database schema created successfully!' AS status;
