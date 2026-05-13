-- ============================================
-- Schema 优化 v2
-- 1. user_behavior_summary 添加 created_at
-- 2. 统一 RLS 策略（合并 schema.sql 和 fix_rls.sql）
-- 3. user_progress 移除硬编码 total_chapters
-- ============================================

-- ============================================
-- Part 1: user_behavior_summary 补充字段
-- ============================================
ALTER TABLE user_behavior_summary
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN user_behavior_summary.created_at IS '记录创建时间';

-- ============================================
-- Part 2: user_progress.total_chapters 改为可配置
-- ============================================
ALTER TABLE user_progress
ALTER COLUMN total_chapters SET DEFAULT NULL;

COMMENT ON COLUMN user_progress.total_chapters IS '章节总数(NULL时自动从chapters表读取, 默认12)';

-- 更新 completion_rate 计算函数
CREATE OR REPLACE FUNCTION calculate_completion_rate()
RETURNS TRIGGER AS $$
DECLARE
    ch_count INTEGER;
BEGIN
    ch_count := COALESCE(NEW.total_chapters, 12);
    NEW.completion_rate := (
        SELECT COUNT(*) * 100.0 / NULLIF(ch_count, 0)
        FROM jsonb_array_elements_text(NEW.completed_chapters)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Part 3: 统一 RLS 策略
-- 删除旧的粗粒度策略（来自 schema.sql v1）
-- ============================================
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can manage own behavior events" ON user_behavior_events;
DROP POLICY IF EXISTS "Users can manage own behavior summary" ON user_behavior_summary;
DROP POLICY IF EXISTS "Users can manage own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Users can manage own ai queries" ON ai_queries;
DROP POLICY IF EXISTS "Users can manage own notes" ON user_notes;

-- ============================================
-- user_profiles（INSERT / SELECT / UPDATE）
-- ============================================
DROP POLICY IF EXISTS "Allow insert for registration" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "profiles_insert" ON user_profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_select" ON user_profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_update" ON user_profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============================================
-- user_progress（INSERT / SELECT / UPDATE）
-- ============================================
DROP POLICY IF EXISTS "Allow insert for registration" ON user_progress;
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;

CREATE POLICY "progress_insert" ON user_progress
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "progress_select" ON user_progress
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "progress_update" ON user_progress
FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============================================
-- user_behavior_events（INSERT / SELECT）
-- ============================================
DROP POLICY IF EXISTS "Allow insert for tracking" ON user_behavior_events;
DROP POLICY IF EXISTS "Users can view own behavior events" ON user_behavior_events;

CREATE POLICY "events_insert" ON user_behavior_events
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_select" ON user_behavior_events
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- user_behavior_summary（INSERT / SELECT / UPDATE）
-- ============================================
DROP POLICY IF EXISTS "Allow insert for registration" ON user_behavior_summary;
DROP POLICY IF EXISTS "Users can view own behavior summary" ON user_behavior_summary;
DROP POLICY IF EXISTS "Users can update own behavior summary" ON user_behavior_summary;

CREATE POLICY "summary_insert" ON user_behavior_summary
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "summary_select" ON user_behavior_summary
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "summary_update" ON user_behavior_summary
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- quiz_answers（INSERT / SELECT / UPDATE）
-- ============================================
DROP POLICY IF EXISTS "Allow insert for quiz" ON quiz_answers;
DROP POLICY IF EXISTS "Users can view own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Users can update own quiz answers" ON quiz_answers;

CREATE POLICY "quiz_insert" ON quiz_answers
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quiz_select" ON quiz_answers
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "quiz_update" ON quiz_answers
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- ai_queries（INSERT / SELECT）
-- ============================================
DROP POLICY IF EXISTS "Allow insert for ai queries" ON ai_queries;
DROP POLICY IF EXISTS "Users can view own ai queries" ON ai_queries;

CREATE POLICY "ai_insert" ON ai_queries
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_select" ON ai_queries
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- user_notes（INSERT / SELECT / UPDATE / DELETE）
-- ============================================
DROP POLICY IF EXISTS "Allow insert for notes" ON user_notes;
DROP POLICY IF EXISTS "Users can view own notes" ON user_notes;
DROP POLICY IF EXISTS "Users can update own notes" ON user_notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON user_notes;

CREATE POLICY "notes_insert" ON user_notes
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_select" ON user_notes
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notes_update" ON user_notes
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notes_delete" ON user_notes
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- 完成
-- ============================================
SELECT 'Schema v2 migration applied successfully!' AS status;
