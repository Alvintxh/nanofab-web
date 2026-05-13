-- ============================================
-- 自动创建 user_profiles 行 + 回填缺失数据
-- 解决 auth.users 和 user_profiles 数量不匹配问题
-- ============================================

-- 1. 回填已存在的缺失用户
INSERT INTO public.user_profiles (id, profile_data)
SELECT u.id, '{}'::jsonb
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 2. 回填缺失的 user_progress 行
INSERT INTO public.user_progress (id, completed_chapters)
SELECT u.id, '[]'::jsonb
FROM auth.users u
LEFT JOIN public.user_progress p ON u.id = p.id
WHERE p.id IS NULL;

-- 3. 触发器函数：新用户注册时自动创建 user_profiles 和 user_progress 行
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, profile_data)
    VALUES (NEW.id, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_progress (id, completed_chapters)
    VALUES (NEW.id, '[]'::jsonb)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
