-- Notification settings: nudge preferences on user_settings, plus the cron
-- schedule that drives the dispatch-reminders Edge Function. See
-- docs/superpowers/specs/2026-07-15-notifications-design.md.

alter table user_settings add column nudge_enabled boolean not null default false;
alter table user_settings add column nudge_time text;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- One-time manual setup (NOT run by this migration — these are secrets and
-- don't belong in a file checked into git). Run once in the Supabase SQL
-- editor before this cron job can succeed:
--   select vault.create_secret('https://hqbzlplghdpelxkhsaqi.supabase.co', 'project_url');
--   select vault.create_secret('<a long random string>', 'dispatch_reminders_secret');
-- Then set the same secret as an Edge Function secret and deploy
-- (see Task 4):
--   supabase secrets set DISPATCH_REMINDERS_SECRET=<the same long random string>
--   supabase functions deploy dispatch-reminders --no-verify-jwt

select cron.schedule(
  'dispatch-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/dispatch-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_reminders_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) as request_id;
  $$
);
