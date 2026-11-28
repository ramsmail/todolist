-- High-priority (P1) notification cards: one local notification per urgent P1
-- task, fired alongside the existing daily inbox nudge. Gated by its own column
-- rather than nudge_enabled so a user can keep Inbox triage while silencing P1
-- cards, and vice versa. Both share nudge_time as their fire time.
-- See docs/superpowers/plans/2026-09-01-mobile-p1-notification-cards.md.

alter table user_settings add column p1_cards_enabled boolean not null default false;
