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
