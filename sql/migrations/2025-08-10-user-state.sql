create table if not exists user_state (
  user_id uuid primary key references users(id) on delete cascade,
  flow text,
  step text,
  payload jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create index if not exists idx_user_state_updated on user_state(updated_at desc);

