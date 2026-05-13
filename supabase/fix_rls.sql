-- ⚠️ 已废弃 / DEPRECATED — 被 schema_v2.sql 取代
-- 新项目请执行 schema.sql（建表）→ schema_v2.sql（迁移）
-- 本文件保留仅供历史参考
-- ============================================
-- Fix RLS Policies for NanoFab Learning Platform
-- 收紧安全策略 + 添加唯一约束
-- ============================================

-- 删除旧的 RLS 策略
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can manage own behavior events" ON user_behavior_events;
DROP POLICY IF EXISTS "Users can manage own behavior summary" ON user_behavior_summary;
DROP POLICY IF EXISTS "Users can manage own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Users can manage own ai queries" ON ai_queries;
DROP POLICY IF EXISTS "Allow insert for registration" ON user_profiles;
DROP POLICY IF EXISTS "Allow insert for registration" ON user_progress;
DROP POLICY IF EXISTS "Allow insert for tracking" ON user_behavior_events;
DROP POLICY IF EXISTS "Allow insert for registration" ON user_behavior_summary;
DROP POLICY IF EXISTS "Allow insert for quiz" ON quiz_answers;
DROP POLICY IF EXISTS "Allow insert for ai queries" ON ai_queries;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can view own behavior events" ON user_behavior_events;
DROP POLICY IF EXISTS "Users can view own behavior summary" ON user_behavior_summary;
DROP POLICY IF EXISTS "Users can update own behavior summary" ON user_behavior_summary;
DROP POLICY IF EXISTS "Users can view own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Users can view own ai queries" ON ai_queries;
DROP POLICY IF EXISTS "Users can manage own notes" ON user_notes;

-- ============================================
-- quiz_answers 唯一约束（防止重复记录）
-- ============================================

-- 先删除可能的重复行（保留最新的一条）
DELETE FROM quiz_answers a
USING quiz_answers b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.chapter_id = b.chapter_id
  AND a.question_id = b.question_id;

-- 添加唯一约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'quiz_answers_user_chapter_question_unique'
    ) THEN
        ALTER TABLE quiz_answers
        ADD CONSTRAINT quiz_answers_user_chapter_question_unique
        UNIQUE (user_id, chapter_id, question_id);
    END IF;
END $$;

-- ============================================
-- user_profiles 表的新 RLS 策略
-- ============================================

-- 只允许插入自己的数据
CREATE POLICY "Allow insert for registration"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 只允许认证用户查看自己的数据
CREATE POLICY "Users can view own profile"
ON user_profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 只允许认证用户更新自己的数据
CREATE POLICY "Users can update own profile"
ON user_profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- ============================================
-- user_progress 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for registration"
ON user_progress FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own progress"
ON user_progress FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own progress"
ON user_progress FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- ============================================
-- user_behavior_events 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for tracking"
ON user_behavior_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own behavior events"
ON user_behavior_events FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- user_behavior_summary 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for registration"
ON user_behavior_summary FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own behavior summary"
ON user_behavior_summary FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own behavior summary"
ON user_behavior_summary FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- quiz_answers 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for quiz"
ON quiz_answers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quiz answers"
ON quiz_answers FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own quiz answers"
ON quiz_answers FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- ai_queries 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for ai queries"
ON ai_queries FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ai queries"
ON ai_queries FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- user_notes 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for notes"
ON user_notes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
ON user_notes FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
ON user_notes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notes"
ON user_notes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 完成
-- ============================================
SELECT 'RLS policies updated successfully! Policies now require authentication.' AS status;
