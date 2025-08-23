-- 简化EPF计算为固定24%
-- Created: 2025-08-23
-- Purpose: Fix EPF calculation inconsistency identified in bug detection

-- 步骤1: 首先需要删除依赖epf_pct的generated column
ALTER TABLE user_month_budget DROP COLUMN IF EXISTS epf_amount;

-- 步骤2: 删除user_profile中的epf_pct列 (如果存在)
ALTER TABLE user_profile DROP COLUMN IF EXISTS epf_pct;

-- 步骤3: 删除user_month_budget中的epf_pct列 (如果存在) 
ALTER TABLE user_month_budget DROP COLUMN IF EXISTS epf_pct;

-- 步骤4: 重新创建固定24%的epf_amount column
ALTER TABLE user_month_budget 
ADD COLUMN epf_amount numeric GENERATED ALWAYS AS (income * 24 / 100) STORED;

-- 此迁移将EPF计算统一为固定24%，消除了计算不一致的问题