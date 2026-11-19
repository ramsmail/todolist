# Daily Check-in Alert (Mobile) — Design

**Date:** 2026-11-19
**Status:** Approved
**Scope:** `apps/mobile` only (Expo). Web is out of scope.

## Goal

A Duolingo-style daily alert: at a user-chosen time (default 10:00) the phone plays a distinctive custom chime and shows a friendly notification prompting the user to open the todo app. It fires every day regardless of inbox/task state.

## Relationship to existing notifications

The app already has a daily **Inbox triage nudge** (silent when the inbox is empty) and **P1 cards**, both sharing `nudge_time` and the Android `triage` channel (default sound, DEFAULT importance). The check-in is a **separate, independent** notification with its own toggle, time, channel, and sound. Nudge and P1 cards are unchanged.

## 1. Data model

Order per `docs/SCHEMA_SYNC_STRATEGY.md`: migration → sync rules → `packages/db`.

- **Migration** `supabase/migrations/20261119000001_daily_checkin.sql`:
  - `alter table user_settings add column checkin_enabled boolean not null default false;`
  - `alter table user_settings add column checkin_time text not null default '10:00';`
  - Existing RLS on `user_settings` covers the new columns (no new table).
- **Sync rules:** no edit — `SELECT * FROM user_settings WHERE id = auth.user_id()` already replicates new columns. Verify on-device that the columns actually arrive.
- **`packages/db`:** add `checkin_enabled: column.integer` and `checkin_time: column.text` to the `user_settings` table in `schema.ts`; add both to `WritableFields` and the INSERT/UPSERT in `queries/userSettings.ts`, with tests.
- Apply the migration to the live Supabase DB and verify the columns exist there before building on them.

## 2. Sound

- Generate `apps/mobile/assets/sounds/checkin.wav` via a committed script (`apps/mobile/scripts/generate-checkin-sound.*`): a bright rising three-note chime, ~1 s, 44.1 kHz 16-bit mono PCM WAV (valid on iOS: < 30 s, `.wav`).
- Register it in `apps/mobile/app.json` under the `expo-notifications` plugin's `sounds` array.
- Android: new channel `checkin` (name "Daily check-in"), importance HIGH, `sound: 'checkin.wav'`. Android locks channel sound at creation, which is why this is a new channel rather than a change to `triage`.
- iOS: `content.sound = 'checkin.wav'`.
- **Requires a new native (EAS) build**; OTA updates cannot ship bundled notification sounds.

## 3. Scheduling

- `reconciliation.ts` gains `reconcileCheckin()` with deps `getCheckinSettings()` → `{ enabled, time }` and `scheduleCheckinNotification(time, body)`.
  - Cancel any previously scheduled check-in (fixed identifier `checkin`).
  - If disabled → return. Otherwise schedule a `DAILY` trigger at `checkin_time` on channel `checkin`.
  - No "skip when empty" condition — it always fires.
- `useNotificationReconciliation.ts` wires the deps and calls `reconcileCheckin()` in `reconcileAll()` and on app background (same as nudge).
- Content: title "Daily check-in"; body chosen from ~6 friendly lines in new `apps/mobile/src/notifications/checkinContent.ts` (`pickCheckinLine(date)`, deterministic by day-of-year). Data: `{ url: '/', type: 'checkin' }` so a tap opens Home. A new notification category `checkin` with no actions.
- Known limitation (accepted): content is frozen at schedule time, so the line only rotates when the app reconciles; if the app isn't opened, the same line repeats.

## 4. Settings UI

In `apps/mobile/src/app/settings.tsx`, a "Daily check-in" section: Switch (`checkin_enabled`) + time row/picker (`checkin_time`, default 10:00). Reuses the existing permission-request flow and time-picker pattern from the nudge section. Writes go through `upsertUserSettings` (PowerSync local write path).

## 5. Error handling

- Permission denied → same Alert as the nudge, toggle stays off.
- Scheduling errors are logged (`console.error`) like other reconcilers; they must not break nudge/P1/reminder reconciliation.
- Malformed `checkin_time` → fall back to `10:00`.

## 6. Testing

- Unit: `reconcileCheckin` — disabled schedules nothing; enabled schedules at configured time; re-run cancels previous before rescheduling; time change reschedules.
- Unit: `pickCheckinLine` — deterministic per date, always returns a non-empty line.
- Unit: `upsertUserSettings` writes the new columns.
- Device: set check-in 2 min ahead, kill the app, confirm the notification arrives with the custom chime and tapping opens Home.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and show output.

## Out of scope

Web app, streaks, suppressing the alert if the app was already opened today, multiple check-in times.
