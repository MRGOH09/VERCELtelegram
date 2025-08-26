create extension if not exists pgcrypto;
-- Core tables
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique,
  name text,
  branch_code text,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists user_profile (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  chat_id bigint,
  language text default 'zh',
  phone_e164 text,
  email text,
  wa_opt_in boolean default false,
  monthly_income numeric(12,2) default 0 check (monthly_income >= 0),
  a_pct numeric(5,2) default 0 check (a_pct >= 0 AND a_pct <= 100),
  b_pct numeric(5,2) default 0,
  travel_budget_annual numeric(12,2) default 0,
  prev_month_spend numeric(12,2) default 0,
  current_streak int default 0,
  max_streak int default 0,
  last_record date,
  total_records int default 0
);

create table if not exists user_month_budget (
  user_id uuid not null references users(id) on delete cascade,
  yyyymm char(7) not null,
  income numeric(12,2) not null default 0 check (income >= 0),
  a_pct numeric(5,2) not null default 0 check (a_pct >= 0 AND a_pct <= 100),
  b_pct numeric(5,2) not null default 0,
  c_pct numeric generated always as (greatest(0, 100 - a_pct - b_pct)) stored,
  cap_a_amount numeric generated always as (income * a_pct / 100) stored,
  cap_b_amount numeric generated always as (income * b_pct / 100) stored,
  cap_c_amount numeric generated always as (income * (greatest(0, 100 - a_pct - b_pct)) / 100) stored,
  epf_amount numeric generated always as (income * 24 / 100) stored,
  primary key (user_id, yyyymm)
);

create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category_group text not null check (category_group in ('A','B','C')),
  category_code text not null,
  amount numeric(12,2) not null,
  note text,
  ymd date not null,
  created_at timestamptz default now(),
  is_voided boolean default false,
  parent_id uuid
);

create table if not exists daily_summary (
  user_id uuid not null references users(id) on delete cascade,
  ymd date not null,
  sum_a numeric(12,2) default 0,
  sum_b numeric(12,2) default 0,
  sum_c numeric(12,2) default 0,
  total_count int default 0,
  primary key (user_id, ymd)
);

create table if not exists branch_daily (
  branch_code text not null,
  ymd date not null,
  done int default 0,
  total int default 0,
  rate numeric(5,2),
  primary key (branch_code, ymd)
);

create table if not exists leaderboard_daily (
  ymd date primary key,
  top_json jsonb,
  branch_top_json jsonb
);

create table if not exists event_audit (
  id bigserial primary key,
  event_id uuid,
  user_id uuid,
  action text,
  old jsonb,
  new jsonb,
  ts timestamptz default now()
);

create table if not exists branch_leads (
  branch_code text primary key,
  leader_chat_ids bigint[] not null
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  device_info jsonb,
  last_used timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

-- Indexes
create index if not exists idx_records_user_ymd on records(user_id, ymd);
create index if not exists idx_daily_summary_user_ymd on daily_summary(user_id, ymd);
create index if not exists idx_branch_daily_code_ymd on branch_daily(branch_code, ymd);
create index if not exists idx_leaderboard_daily_ymd on leaderboard_daily(ymd);
create index if not exists idx_user_month_budget_user_yyyymm on user_month_budget(user_id, yyyymm);
create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);

