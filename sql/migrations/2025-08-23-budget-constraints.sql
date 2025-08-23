-- 添加预算约束：生活开销不能超过100%
-- Created: 2025-08-23
-- Purpose: Fix budget validation issue identified in bug detection

-- 为user_profile表添加约束
ALTER TABLE user_profile 
ADD CONSTRAINT check_a_pct_range 
CHECK (a_pct >= 0 AND a_pct <= 100);

-- 为user_month_budget表添加约束  
ALTER TABLE user_month_budget 
ADD CONSTRAINT check_budget_a_pct_range 
CHECK (a_pct >= 0 AND a_pct <= 100);

-- 添加收入不能为负数的约束
ALTER TABLE user_profile
ADD CONSTRAINT check_monthly_income_positive
CHECK (monthly_income >= 0);

ALTER TABLE user_month_budget
ADD CONSTRAINT check_income_positive  
CHECK (income >= 0);

-- 更新schema.sql的注释提醒
-- 此迁移解决了预算百分比可能超过100%的问题