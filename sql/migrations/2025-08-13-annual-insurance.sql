-- Annual allocations for medical and car insurance (direct monthly posting)
alter table if exists user_profile
  add column if not exists annual_medical_insurance numeric(12,2) default 0,
  add column if not exists annual_car_insurance     numeric(12,2) default 0;

-- Optional index to speed up idempotent checks
create index if not exists idx_records_user_ymd_cat on records(user_id, ymd, category_code);

