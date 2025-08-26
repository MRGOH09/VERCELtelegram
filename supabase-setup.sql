-- ============================================
-- Supabase完整数据库设置脚本
-- 适用于Learner Club PWA推送功能
-- ============================================

-- 1. 创建推送订阅表
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    device_info jsonb,
    last_used timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, endpoint)
);

-- 2. 添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_used ON push_subscriptions(last_used);

-- 3. 创建RLS策略 (Row Level Security)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 用户只能看到和管理自己的推送订阅
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions" ON push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

-- 4. 创建推送日志表 (可选，用于调试)
CREATE TABLE IF NOT EXISTS push_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    push_type text NOT NULL,
    title text,
    body text,
    success boolean DEFAULT false,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_push_logs_user_id ON push_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_created_at ON push_logs(created_at);

-- 5. 创建函数：获取用户的活跃推送订阅
CREATE OR REPLACE FUNCTION get_user_push_subscriptions(p_user_id uuid)
RETURNS TABLE (
    endpoint text,
    p256dh text,
    auth text,
    last_used timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.endpoint,
        ps.p256dh,
        ps.auth,
        ps.last_used
    FROM push_subscriptions ps
    WHERE ps.user_id = p_user_id
    ORDER BY ps.last_used DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建函数：清理过期的推送订阅（30天未使用）
CREATE OR REPLACE FUNCTION cleanup_old_push_subscriptions()
RETURNS void AS $$
BEGIN
    DELETE FROM push_subscriptions
    WHERE last_used < now() - interval '30 days';
END;
$` LANGUAGE plpgsql;

-- 7. 创建触发器：更新推送订阅的last_used时间
CREATE OR REPLACE FUNCTION update_push_last_used()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_used = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_subscription_update_last_used
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_push_last_used();

-- 8. 授权service role访问权限
GRANT ALL ON push_subscriptions TO service_role;
GRANT ALL ON push_logs TO service_role;

-- ============================================
-- 验证设置
-- ============================================
-- 运行以下查询验证表是否创建成功：
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('push_subscriptions', 'push_logs');

-- 查看推送订阅数量：
-- SELECT COUNT(*) FROM push_subscriptions;

-- 查看最近的推送日志：
-- SELECT * FROM push_logs ORDER BY created_at DESC LIMIT 10;