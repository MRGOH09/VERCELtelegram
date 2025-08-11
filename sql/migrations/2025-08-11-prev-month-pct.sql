-- Add percentage field for previous month spending (0-100)
alter table if exists user_profile
  add column if not exists prev_month_spend_pct numeric(5,2) default null;

-- Optional: keep prev_month_spend legacy numeric(12,2) as amount for backward compatibility
-- You may run a conversion later if needed.

