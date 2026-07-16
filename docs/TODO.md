# TODO

Follow-ups deferred from active work, not yet done.

## Deploy `enrich-url` Edge Function update

- **What:** `supabase/functions/enrich-url/index.ts` was extended to also extract
  `og:description`/`meta[name=description]` and backfill the task's description
  (only when currently empty), alongside the existing title enrichment.
- **Why deferred:** no Deno runtime available in the dev environment used to build
  this — the function was written and reviewed but never deployed or run.
- **To do:** `supabase functions deploy enrich-url`, then verify by sharing a real
  URL from the mobile app and confirming both `title` and `description` populate
  on the resulting task within a few seconds.

## Fix jsonb double-encoding in label-filter SQL queries

- **What:** PowerSync mirrors the Postgres `jsonb` `tasks.labels` column into a
  local `text` column. After a round-trip through Postgres, the value comes back
  double-JSON-encoded (e.g. `"[\"guitar\"]"` instead of `["guitar"]`). The
  *display* path (`parseLabelsJson` in `packages/core/src/labels.ts`) was fixed
  to tolerate both encodings.
- **What's still broken:** SQL queries that filter/count by label using
  `json_each(tasks.labels)` (e.g. `useLabelsWithStats`, `useTasksByLabel` in
  `packages/db/src/queries/labels.ts`) operate on the raw column value at the SQL
  level, before any JS-side parsing — so a double-encoded value breaks
  `json_each` there too (a label's task count / task-list-by-label can silently
  under/over-count).
- **Why deferred:** this needs a schema-level decision (e.g., store `labels` as
  a real Postgres `text` column instead of `jsonb`, or normalize on write), which
  per `docs/SCHEMA_SYNC_STRATEGY.md` means touching migrations + sync rules +
  `packages/db` together — not a quick patch.
- **To do:** decide the schema fix, then update migrations → sync rules →
  `packages/db` queries in that order, and add a test that exercises a
  round-tripped (double-encoded) label value through the SQL queries, not just
  the JS parser.

## Recreate a reminder when a recurring task's due date advances

- **What:** `docs/superpowers/specs/2026-07-15-notifications-design.md` and its
  implementation plan originally assumed a recurring task's next occurrence
  "just" gets a new `Reminder` row automatically when recurrence advances — no
  separate mechanism needed. That was never actually built anywhere in this
  codebase; `createReminder` (`packages/db/src/queries/reminders.ts`) has
  exactly one call site, a manual user action in
  `apps/mobile/src/app/task/[id].tsx`.
- **What's still broken:** a fix landed to correctly cancel a task's reminder
  when the task is completed or deleted (`completeTask`/`deleteTask` in
  `packages/db/src/queries/tasks.ts`, both soft-delete via
  `deleteRemindersForTask`). For a recurring task this is correct for the
  just-finished occurrence, but nothing creates a reminder for the *next*
  occurrence. Net effect: a recurring task's reminder currently fires once,
  ever, then silently never again on any later occurrence.
- **Why deferred:** this is a real, separate feature (recreate reminder offset
  relative to the new `due_date`/`due_time` when `completeTask`'s recurring
  branch advances a task), not covered by the notifications spec despite its
  Overview text originally claiming otherwise (now corrected in that doc).
- **To do:** decide whether recurrence should carry forward the *same* offset
  the user originally chose (e.g. "10 min before") and, if so, persist that
  offset somewhere (today only the resolved `remind_at_local`/`remind_at_utc`
  are stored, not the offset itself) so `completeTask`'s recurring branch in
  `packages/db/src/queries/tasks.ts` can call `createReminder` for the new
  occurrence inside the same `writeTransaction` it already cancels the old
  reminder in.
