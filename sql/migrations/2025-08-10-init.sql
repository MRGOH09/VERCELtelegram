-- Migration snapshot (v5.2 init)

alter table if exists user_profile
  add column if not exists phone_e164 text,
  add column if not exists email text,
  add column if not exists wa_opt_in boolean default false,
  add column if not exists monthly_income numeric(12,2) default 0,
  add column if not exists a_pct numeric(5,2) default 0,
  add column if not exists b_pct numeric(5,2) default 0,
  add column if not exists travel_budget_annual numeric(12,2) default 0,
  add column if not exists prev_month_spend numeric(12,2) default 0,
  add column if not exists epf_pct numeric(5,2) default 24;

create table if not exists user_month_budget (
  user_id uuid not null,
  yyyymm char(7) not null,
  income numeric(12,2) not null default 0,
  a_pct numeric(5,2) not null default 0,
  b_pct numeric(5,2) not null default 0,
  c_pct numeric generated always as (greatest(0, 100 - a_pct - b_pct)) stored,
  cap_a_amount numeric generated always as (income * a_pct / 100) stored,
  cap_b_amount numeric generated always as (income * b_pct / 100) stored,
  cap_c_amount numeric generated always as (income * (greatest(0, 100 - a_pct - b_pct)) / 100) stored,
  epf_amount   numeric generated always as (income * 24 / 100) stored,
  primary key (user_id, yyyymm)
);

create table if not exists branch_leads (
  branch_code text primary key,
  leader_chat_ids bigint[] not null
);

