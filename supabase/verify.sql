SELECT
    table_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = t.table_name
    ) as table_exists
FROM (
    VALUES
        ('user_profiles'),
        ('user_progress'),
        ('user_behavior_events'),
        ('user_behavior_summary'),
        ('quiz_answers'),
        ('ai_queries'),
        ('user_notes')
) AS t(table_name);

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

SELECT
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN ('user_profiles', 'user_progress', 'user_behavior_events', 'user_behavior_summary', 'quiz_answers', 'ai_queries', 'user_notes')
AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT COUNT(*) as total_users FROM auth.users;
SELECT COUNT(*) as total_profiles FROM user_profiles;

SELECT
    u.id,
    u.email,
    u.email_confirmed_at,
    p.id as profile_id,
    p.profile_data->>'name' as profile_name,
    CASE WHEN p.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_profile
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;
