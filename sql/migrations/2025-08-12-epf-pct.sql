-- 1) 保险：确保可用 UUID
create extension if not exists pgcrypto;

-- 2) user_month_budget 增加 epf_pct 默认 24
alter table if exists user_month_budget
  add column if not exists epf_pct numeric(5,2) not null default 24;

-- 3) 重建 epf_amount 生成列依赖 epf_pct
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='user_month_budget' and column_name='epf_amount'
  ) then
    alter table user_month_budget drop column epf_amount;
  end if;
end$$;

alter table if exists user_month_budget
  add column epf_amount numeric generated always as (income * epf_pct / 100) stored;

