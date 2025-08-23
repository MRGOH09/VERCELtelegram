-- 修复月度预算记录缺失问题
-- Created: 2025-08-23  
-- Purpose: 解决进入新月份时缺失user_month_budget记录的问题

-- 这个迁移主要是代码层面的修复，数据库结构无需修改
-- 但我们添加一些注释来记录这个重要的改进

COMMENT ON TABLE user_month_budget IS '用户月度预算快照表 - 2025-08-23更新：添加自动创建逻辑，确保每月都有预算记录';

-- 可选：为了调试，我们可以查看当前有多少用户缺失当前月份的预算记录
-- 运行这个查询可以看到影响范围（仅用于调试，不影响功能）

DO $$
DECLARE
    current_month text := to_char(now(), 'YYYY-MM');
    missing_count integer;
    total_users integer;
BEGIN
    -- 统计总用户数
    SELECT COUNT(*) INTO total_users 
    FROM user_profile 
    WHERE chat_id IS NOT NULL;
    
    -- 统计缺失当前月预算的用户数
    SELECT COUNT(*) INTO missing_count
    FROM user_profile up
    WHERE up.chat_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM user_month_budget umb 
        WHERE umb.user_id = up.user_id 
        AND umb.yyyymm = current_month
    );
    
    RAISE NOTICE '=== 月度预算记录统计 ===';
    RAISE NOTICE '当前月份: %', current_month;
    RAISE NOTICE '活跃用户总数: %', total_users;
    RAISE NOTICE '缺失当前月预算的用户: %', missing_count;
    RAISE NOTICE '覆盖率: %% (%/%)', 
        CASE WHEN total_users > 0 THEN ROUND((total_users - missing_count) * 100.0 / total_users, 1) ELSE 0 END,
        (total_users - missing_count),
        total_users;
    
    IF missing_count > 0 THEN
        RAISE NOTICE '💡 这些用户将在下次访问系统时自动创建预算记录';
    ELSE
        RAISE NOTICE '✅ 所有活跃用户都有当前月份的预算记录';
    END IF;
END $$;

-- 此迁移解决的问题：
-- 1. 用户进入新月份时缺失user_month_budget记录
-- 2. 早晨推送报告查找不到预算数据
-- 3. /my命令显示不准确的预算信息
-- 4. 历史数据和当前数据不一致

-- 实现的解决方案：
-- 1. 在user-system.js中添加ensureMonthlyBudget调用
-- 2. 在cron-utils.js早晨推送中批量创建缺失的预算记录
-- 3. 添加monthly-budget.js模块统一管理预算记录创建逻辑