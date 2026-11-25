-- Daily check-in: a Duolingo-style "open the app" alert that fires every day
-- at checkin_time with a custom sound, independent of the inbox nudge
-- (nudge_enabled/nudge_time) and P1 cards. Existing own_settings RLS policy on
-- user_settings covers these columns; sync rules use SELECT * so they replicate.
-- See docs/superpowers/specs/2026-11-19-daily-checkin-design.md.

alter table user_settings add column checkin_enabled boolean not null default false;
alter table user_settings add column checkin_time text not null default '10:00';
