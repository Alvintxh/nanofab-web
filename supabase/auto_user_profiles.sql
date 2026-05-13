-- ============================================
-- 新用户自动建表 + 回填缺失数据
-- 确保 auth.users / user_profiles / user_progress / user_behavior_summary 一一对应
-- ============================================

-- 1. 回填所有缺失的表
INSERT INTO public.user_profiles (id, profile_data)
SELECT u.id, '{}'::jsonb FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id WHERE p.id IS NULL;

INSERT INTO public.user_progress (id, completed_chapters)
SELECT u.id, '[]'::jsonb FROM auth.users u
LEFT JOIN public.user_progress p ON u.id = p.id WHERE p.id IS NULL;

INSERT INTO public.user_behavior_summary (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.user_behavior_summary s ON u.id = s.user_id WHERE s.user_id IS NULL;

-- 2. 触发器函数：新用户注册时自动创建所有关联行
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, profile_data)
    VALUES (NEW.id, '{}'::jsonb) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_progress (id, completed_chapters)
    VALUES (NEW.id, '[]'::jsonb) ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_behavior_summary (user_id)
    VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
