-- Daily log: one row per user per day.
-- Holds the self-reported energy level now; the upcoming Focus feature will add
-- focus_minutes to the same per-day row so energy can be correlated with focus.
create table daily_log (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  log_date     date        not null,
  energy_level integer     check (energy_level between 1 and 5),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint daily_log_user_date_unique unique (user_id, log_date)
);

create index daily_log_user_id_idx on daily_log (user_id);

-- RLS: owner-scoped, mirrors the other per-user tables.
alter table daily_log enable row level security;
create policy "own_daily_log" on daily_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep updated_at fresh and force user_id to the authenticated user on insert.
create trigger daily_log_updated_at      before update on daily_log for each row execute function set_updated_at();
create trigger daily_log_enforce_user_id before insert on daily_log for each row execute function enforce_user_id();
