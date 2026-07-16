# Notifications — Design Spec

**Date:** 2026-07-15
**Status:** Draft (pending review)
**Scope:** Backend (new Supabase Edge Function) + Mobile (`apps/mobile`). Web Push client wiring is explicitly out of scope (see Out of Scope) — the Edge Function is written generically so adding it later doesn't require touching this design.

---

## Overview

`docs/design/specs/2026-06-20-todoapp-design.md` already specs a `Reminder` table and a server-poll delivery model (Edge Function polls every minute, fires Expo Push / Web Push, tracks `notified_mobile`/`notified_web`). That schema is committed (`supabase/migrations/`, `powersync/sync-rules.yaml`, `packages/db/src/schema.ts`), but nothing consumes it yet: no Edge Function exists (only `enrich-url` does), no reminder-setting UI exists anywhere, and `apps/mobile` has no `expo-notifications` dependency.

This spec keeps the server-primary model as-is and adds everything needed to make it real, plus a second, independent, purely local notification: a daily inbox-triage nudge. It does not change the delivery model — it fills it in.

Two independent notification types ship here:

1. **Due-time reminders**. Server-primary: existing Edge-Function-polls-and-pushes model. The mobile client additionally schedules a **local fallback** notification for the same reminder, so the user is still notified if the push never arrives (device offline at fire time). The fallback is cancelled once the push is confirmed delivered, or the reminder changes, or the underlying task is completed/deleted (both soft-delete the `Reminder` row). **Correction (post-implementation):** this section originally claimed a recurring task's next occurrence "just" gets a new `Reminder` row automatically when recurrence advances — that was never actually implemented anywhere in this codebase, and completing a recurring task now correctly cancels that occurrence's reminder (see the reminder-cancellation fix), meaning **a recurring task's reminder currently fires once, ever, then goes silent on every subsequent occurrence.** Recreating a reminder on recurrence advance is a real, separate, not-yet-built feature — tracked as a follow-up, not covered by this spec.
2. **Daily inbox nudge**. Purely local — computed from the on-device task count, no server round-trip, no `Reminder` row. Silent when the inbox is empty.

Both surface through the same deep-link and Android-channel infrastructure, but their delivery paths don't share code beyond that.

---

## New dependency

`expo-notifications`, added via `npx expo install expo-notifications` (Expo-managed version pin, same reasoning as the `datetimepicker` precedent in `2026-07-08-mobile-due-date-editing-design.md`). Requires an `expo-notifications` config plugin entry in `apps/mobile/app.json`'s `plugins` array (default icon/color, no extra config needed for local + Expo Push).

---

## Data model changes

`user_settings` gains two columns (new migration, e.g. `supabase/migrations/20260716000001_notification_settings.sql`):

| Column | Type | Notes |
|---|---|---|
| `nudge_enabled` | boolean, default `false` | Off until the user turns it on — no notifications fire uninvited. |
| `nudge_time` | text (local `HH:mm`), nullable | Interpreted in `user_settings.timezone`, which already exists. |

No `Reminder` table changes — `notified_mobile`/`notified_web` already give the Edge Function and the mobile client everything needed to coordinate delivery and cancel the local fallback. `powersync/sync-rules.yaml` needs no edit: the existing rule is `SELECT * FROM user_settings WHERE id = auth.user_id()`, so new columns sync automatically.

---

## Backend: `supabase/functions/dispatch-reminders`

New Edge Function, structured like `enrich-url` (check its `deno.json`/entrypoint shape for the project's established pattern). Invoked every minute via `pg_cron` scheduling a `net.http_post` call to the function's URL (the standard Supabase pattern for cron-triggered Edge Functions) — added as part of the same migration that adds the `user_settings` columns, per `CLAUDE.md`'s rule to keep schema-adjacent changes together.

Per run:
1. `SELECT * FROM reminders WHERE remind_at_utc <= now() AND deleted_at IS NULL AND (notified_mobile = false OR notified_web = false)`.
2. For each row, join `user_settings` for `expo_push_token` / `web_push_subscription`.
3. If `notified_mobile = false` and an `expo_push_token` exists: send via Expo Push API with `data: { url: '/task/<task_id>', taskId, type: 'reminder', reminderId }` and `categoryId: 'reminder'`. On success, `UPDATE reminders SET notified_mobile = true`.
4. Web push: same shape, deferred (see Out of Scope) — the column and branch exist in the query but the send call is a stub until web is built.
5. Failures (expired push token, API error) are logged, not retried within the same run — the next minute's poll picks the row up again since the flag wasn't set.

---

## Mobile: reminder-setting UI (prerequisite)

Task detail screen (`apps/mobile/src/app/task/[id].tsx`) gains a "Remind me" row, same visual slot as the existing `DueDateField` pattern. Options match the existing design doc: **at due time, 10 min before, 30 min before, 1 hour before, custom**. Custom opens the same native date/time pickers already used for due date/time.

New file `packages/db/src/queries/reminders.ts`:
```ts
export async function createReminder(db, taskId, userId, remindAtLocal, remindAtUtc): Promise<void>
export async function updateReminderTime(db, reminderId, remindAtLocal, remindAtUtc): Promise<void>
export async function deleteReminder(db, reminderId): Promise<void>
export async function snoozeReminder(db, reminderId, minutes): Promise<void>
```
`snoozeReminder` advances `remind_at_local`/`remind_at_utc` by `minutes` and resets `notified_mobile`/`notified_web` to `false`, re-entering both delivery paths (Edge Function poll and local reconciliation) exactly like a fresh reminder — no separate snooze-specific delivery code needed.

This UI only needs a due time set on the task to compute "10 min before" etc. — if `due_time` is null, only "custom" is offered.

---

## Mobile: notification infrastructure

### Permission + registration
Requested in-context the first time either applies: user sets a reminder, or enables the nudge in settings — whichever comes first. `expo-notifications` category registration (`Notifications.setNotificationCategoryAsync`) and Android channel creation happen once at app startup (in `_layout.tsx`, alongside the existing provider stack), independent of permission — registering channels/categories is safe pre-permission.

### Android channels
Two channels: **"Reminders"** and **"Triage"** (not three — recurrence surfacing rides the Reminders pipeline, no separate channel needed). Created at startup via `Notifications.setNotificationChannelAsync`.

### Categories / actions
- `reminder` category: **Complete** action → `completeTask(db, taskId)` (already exists in `packages/db/src/queries/tasks.ts`). **Snooze 1h** action → `snoozeReminder(db, reminderId, 60)`.
- `nudge` category: no actions, tap-only.

Both action handlers run inside the same warm/cold-start response listener (below) and write through the existing local-first PowerSync path — no direct Supabase calls, consistent with `CLAUDE.md`.

### Deep link (new `apps/mobile/src/notifications/deepLink.ts`)
- `Notifications.addNotificationResponseReceivedListener` for warm taps/actions.
- `Notifications.getLastNotificationResponseAsync()` checked once at startup for cold start (the case that's easy to forget).
- Both route through one shared handler: action buttons mutate the DB and stop there (no navigation); a plain tap navigates via `router.push(data.url)`.

### Reconciliation (new `apps/mobile/src/notifications/reconciliation.ts` + `apps/mobile/src/hooks/useNotificationReconciliation.ts`)
Split the same way `dueDateFormat.ts` / `DueDateField.tsx` are split in the due-date-editing precedent: the reconciliation logic itself is a plain, RN-import-free async function (testable), and a thin hook wires it to triggers (not independently testable, verified on-device).

Triggers, mirroring the `useOfflineAttachmentSync` pattern already in the codebase:
- **PowerSync `statusChanged` listener** (`db.registerListener`, same as `useOfflineAttachmentSync.ts`) — reconcile whenever a sync completes.
- **`AppState` foreground transition** — new pattern, no precedent in this codebase yet; reconcile on `active`.
- **`AppState` background transition** — nudge-freshness only (see below); reconcile on `background`.

Reminder reconciliation: query local `reminders` table for `notified_mobile = 0 AND deleted_at IS NULL AND remind_at_utc > now()`; diff against an in-memory map of `reminderId → scheduledNotificationId`; schedule new ones (`Notifications.scheduleNotificationAsync`, best-effort/inexact trigger — no `SCHEDULE_EXACT_ALARM`, per the earlier trade-off: this is a fallback path, not the primary delivery path); cancel ones no longer in the query result (reminder deleted, completed — which soft-deletes via existing task completion flow, rescheduled to a different time, or `notified_mobile` flipped `true` because the push already arrived).

Nudge reconciliation: if `nudge_enabled`, compute inbox count via a new plain query function in `packages/db` (e.g. `getInboxCount(db, userId)` reusing the existing `INBOX_QUERY` SQL — the existing `useInboxTasks()` is a React hook and can't be called from this non-component context), cancel any previously scheduled nudge notification, and schedule one fresh instance for the next occurrence of `nudge_time` with the current count baked into the body. Staleness between this reschedule and the actual fire time is accepted (see the earlier trade-off) — not something later work needs to "fix."

---

## Error handling

| Scenario | Behavior |
|---|---|
| Notification permission denied | Scheduling calls no-op silently (checked via `Notifications.getPermissionsAsync()` before scheduling); settings UI reflects "Notifications off," not a crash or retry loop. |
| Push delivery fails (Edge Function) | Flag stays `false`; next minute's poll retries. Local fallback still fires on-device regardless. |
| Reminder deleted/completed after local fallback already scheduled | Reconciliation cancels the stale scheduled notification on next foreground/sync/background tick. |
| Task completed on device A while device B holds a stale scheduled local fallback | **This is the offline-first conflict case worth an actual test**, not just the happy path: device B's next reconciliation pass must observe the synced completion and cancel its local schedule. |

---

## Testing

- `reconciliation.ts`: unit tests (Vitest, RN-import-free) — schedule-diffing logic given a set of DB rows vs. a set of already-scheduled IDs; the stale-schedule-after-remote-completion case above; nudge count-staleness behavior (reschedule replaces, doesn't stack).
- `reminders.ts` (packages/db): unit tests for `snoozeReminder`'s flag-reset behavior, following the existing `tasks.test.ts` pattern.
- Deep link / categories / permission flow / on-device notification firing: typecheck + on-device verification only, same established constraint as the rest of the RN UI in this app.
- Edge Function: verify against the live Supabase instance per `docs/SCHEMA_SYNC_STRATEGY.md`'s schema-first discipline — don't trust that the migration file matches deployed state without checking.

---

## Out of Scope

- Web Push client wiring (service worker, VAPID subscription capture, `web_push_subscription` population) — the Edge Function's web branch is stubbed but not implemented; a follow-up spec.
- Recurring-task reminder carry-forward — recreating a reminder when a recurring task's due date advances to its next occurrence is NOT implemented (see the Overview correction above); today a recurring task's reminder fires exactly once, ever. A real follow-up feature, not covered here.
- Exact-alarm scheduling — local fallback is intentionally best-effort.
- Nudge day-of-week configuration (e.g. skip weekends) — daily-only for v1.
- Quiet hours / do-not-disturb windows beyond what the OS/channel settings already provide.
- Any UI for viewing/managing all reminders in one place (e.g. an "upcoming reminders" list) — reminders are only ever set/edited from the task detail screen in this spec.
