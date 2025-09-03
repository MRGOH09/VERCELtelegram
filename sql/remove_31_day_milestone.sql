-- 删除31天里程碑奖励配置
DELETE FROM score_milestones WHERE streak_days = 31;

-- 验证删除结果
SELECT * FROM score_milestones ORDER BY streak_days;