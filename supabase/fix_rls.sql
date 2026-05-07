-- ============================================
-- Fix RLS Policies for NanoFab Learning Platform
-- 允许注册后匿名用户插入数据
-- ============================================

-- 删除旧的 RLS 策略
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can manage own progress" ON user_progress;
DROP POLICY IF EXISTS "Users can manage own behavior events" ON user_behavior_events;
DROP POLICY IF EXISTS "Users can manage own behavior summary" ON user_behavior_summary;
DROP POLICY IF EXISTS "Users can manage own quiz answers" ON quiz_answers;
DROP POLICY IF EXISTS "Users can manage own ai queries" ON ai_queries;

-- ============================================
-- user_profiles 表的新 RLS 策略
-- ============================================

-- 允许匿名和认证用户插入（注册时使用）
CREATE POLICY "Allow insert for registration"
ON user_profiles FOR INSERT TO anon, authenticated
WITH CHECK (true);

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
ON user_progress FOR INSERT TO anon, authenticated
WITH CHECK (true);

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
ON user_behavior_events FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can view own behavior events"
ON user_behavior_events FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- user_behavior_summary 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for registration"
ON user_behavior_summary FOR INSERT TO anon, authenticated
WITH CHECK (true);

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
ON quiz_answers FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can view own quiz answers"
ON quiz_answers FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- ai_queries 表的新 RLS 策略
-- ============================================

CREATE POLICY "Allow insert for ai queries"
ON ai_queries FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Users can view own ai queries"
ON ai_queries FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 完成
-- ============================================
SELECT 'RLS policies updated successfully!' AS status;
