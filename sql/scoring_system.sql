-- 用户每日积分表
create table if not exists user_daily_scores (
  user_id uuid not null references users(id) on delete cascade,
  ymd date not null,
  
  -- 积分明细
  base_score int default 0,           -- 基础分(记录/打卡 = 1分)
  streak_score int default 0,         -- 连续分(连续记录 = 1分)
  bonus_score int default 0,          -- 奖励分(里程碑奖励)
  total_score int generated always as (base_score + streak_score + bonus_score) stored,
  
  -- 连续统计
  current_streak int default 0,       -- 当前连续天数
  
  -- 记录类型
  record_type text not null check (record_type in ('record', 'checkin')), -- 'record'=有开销记录, 'checkin'=纯打卡
  
  -- 奖励明细(JSON格式记录获得的奖励)
  bonus_details jsonb default '[]',   -- [{"milestone": 3, "score": 2}, {"milestone": 10, "score": 5}]
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  primary key (user_id, ymd)
);

-- 分行积分统计表(每日更新)
create table if not exists branch_scores_daily (
  branch_code text not null,
  ymd date not null,
  
  -- 统计数据
  total_members int default 0,        -- 分行总人数
  active_members int default 0,       -- 今日活跃人数
  total_score int default 0,          -- 分行总积分
  avg_score numeric(8,2) default 0,   -- 平均积分
  
  -- 排名相关
  branch_rank int,                    -- 分行排名
  
  created_at timestamptz default now(),
  primary key (branch_code, ymd)
);

-- 积分里程碑配置表
create table if not exists score_milestones (
  streak_days int primary key,
  bonus_score int not null,
  milestone_name text not null,
  description text
);

-- 插入默认里程碑配置
insert into score_milestones (streak_days, bonus_score, milestone_name, description) values
(3, 2, '坚持三天', '连续打卡3天奖励'),
(5, 3, '持续五天', '连续打卡5天奖励'),
(10, 5, '稳定十天', '连续打卡10天奖励'),
(15, 8, '半月坚持', '连续打卡15天奖励'),
(21, 12, '三周习惯', '连续打卡21天奖励')
on conflict (streak_days) do nothing;

-- 创建索引
create index if not exists idx_user_daily_scores_user_ymd on user_daily_scores(user_id, ymd desc);
create index if not exists idx_user_daily_scores_ymd on user_daily_scores(ymd);
create index if not exists idx_branch_scores_daily_ymd_rank on branch_scores_daily(ymd, branch_rank);
create index if not exists idx_user_daily_scores_streak on user_daily_scores(current_streak desc) where current_streak > 0;