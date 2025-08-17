-- 2025-08-14: 性能优化修复
-- 1. 为 leaderboard_daily 添加唯一约束确保幂等性
-- 2. 优化索引提升查询性能

-- 确保 leaderboard_daily 表有唯一约束
DO $$ 
BEGIN
    -- 检查是否已存在唯一约束
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'leaderboard_daily_ymd_key' 
        AND conrelid = 'leaderboard_daily'::regclass
    ) THEN
        -- 添加唯一约束
        ALTER TABLE leaderboard_daily ADD CONSTRAINT leaderboard_daily_ymd_key UNIQUE (ymd);
    END IF;
END $$;

-- 为 user_month_budget 添加 epf_pct 字段（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_month_budget' 
        AND column_name = 'epf_pct'
    ) THEN
        ALTER TABLE user_month_budget ADD COLUMN epf_pct numeric(5,2) DEFAULT 24;
    END IF;
END $$;

-- 更新 user_month_budget 的 epf_amount 计算逻辑
-- 如果 epf_pct 字段存在，使用它；否则使用默认值 24
DO $$ 
BEGIN
    -- 更新现有记录的 epf_pct 为默认值（如果为空）
    UPDATE user_month_budget 
    SET epf_pct = 24 
    WHERE epf_pct IS NULL;
    
    -- 重新计算 epf_amount 基于 epf_pct
    UPDATE user_month_budget 
    SET epf_amount = income * COALESCE(epf_pct, 24) / 100;
END $$;

-- 添加复合索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_records_user_ymd_category ON records(user_id, ymd, category_group, category_code);
CREATE INDEX IF NOT EXISTS idx_user_profile_chat_id ON user_profile(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branch_leads_chat_ids ON branch_leads USING GIN(leader_chat_ids);

-- 为 daily_summary 添加复合索引
CREATE INDEX IF NOT EXISTS idx_daily_summary_user_ymd_range ON daily_summary(user_id, ymd) WHERE ymd >= '2024-01-01';

-- 优化 user_month_budget 查询
CREATE INDEX IF NOT EXISTS idx_user_month_budget_yyyymm ON user_month_budget(yyyymm);

-- 添加统计信息收集提示
COMMENT ON TABLE leaderboard_daily IS '每日排行榜缓存，ymd 唯一约束确保幂等性';
COMMENT ON TABLE user_month_budget IS '用户月度预算快照，包含 EPF 百分比和金额';
COMMENT ON COLUMN user_month_budget.epf_pct IS 'EPF 百分比，默认 24%';
COMMENT ON COLUMN user_month_budget.epf_amount IS 'EPF 金额，基于 income * epf_pct / 100 计算'; 