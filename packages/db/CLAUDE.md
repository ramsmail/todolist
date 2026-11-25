# packages/db — Database Schema & Queries

TypeScript schema definitions and queries used by both `apps/web` and `apps/mobile`. Wraps PowerSync's local SQLite client — **this is the only package that should talk to PowerSync or Supabase directly.**

## Before Changing Anything Here

This package is the **third of three places** a schema change must touch, in this order:

1. **`supabase/migrations/`** — Postgres schema (write this first)
2. **`powersync/sync-rules.yaml`** — sync rules (update second — confirm new/changed columns are covered)
3. **`packages/db`** — this package (update last, after the above two are confirmed)

⚠️ **Critical:** If you're asked to add a column or table and only this package gets touched, **stop and check** whether `supabase/migrations/` and `powersync/` also need the change.

A type that doesn't match the actual Postgres schema or isn't covered by sync rules will **compile fine and fail silently at runtime** — the worst kind of bug.

See [`docs/SCHEMA_SYNC_STRATEGY.md`](../../docs/SCHEMA_SYNC_STRATEGY.md) for detailed change workflows.

## Conventions

**Query design:**
- Queries return **typed results** consumed by both apps — don't return platform-specific shapes
- **All reads** in the app layer go through this package's query functions, not raw PowerSync/Supabase calls scattered in components
- **Writes** go through PowerSync's local-first write path. Direct Supabase writes from here should be rare and intentional (e.g., one-time admin operations) — **flag them** when adding, since they likely bypass offline support

**Schema patterns:**
- Don't manually add `deleted_at` filters on top of PowerSync queries — PowerSync already excludes tombstoned rows
- Check existing query functions in this package for established patterns before writing a new one
- Use `column.text`, `column.integer`, etc. from `@powersync/common` for type safety

## Security Notes

- **RLS is the real guard.** Query functions in this package filter by `user_id` for UX, but Postgres Row-Level Security is the actual data boundary. Verify that RLS policies exist and are correct before adding a new table — if RLS is missing, a query bug here becomes a data leak, not a UI bug.
- **Sync rules control what each user's device receives.** Before writing a query function for a new table, confirm its sync rule in `powersync/sync-rules.yaml` has a proper `WHERE user_id = request.user_id()` clause. An overly permissive sync rule ships other users' rows to every client.

## Testing

**Schema/type changes:**
- Verify against an actual migration, not just by editing the TS type — a type can be wrong and still compile
- Run the app and inspect actual data from PowerSync to confirm synced columns exist

**New query functions:**
- Confirm there's a corresponding sync rule in `powersync/sync-rules.yaml` covering the table/columns it reads
- A missing sync rule means the query will run, return nothing, and look like a bug elsewhere
- Add a test case or manual inspection step to the PR

## Architecture Boundaries

**What NOT to do:**

- **Don't** let `packages/core` import from this package — the boundary runs the other way:
  - ✅ `apps/web` imports `packages/db`
  - ✅ `apps/web` imports `packages/core`
  - ❌ `packages/core` should never import `packages/db`
  - (See `packages/core/CLAUDE.md` for why)

- **Don't** add Next.js or Expo-specific code here — this package is shared and platform-neutral
  - No `'use client'` directives
  - No `useEffect()` or platform-specific imports
  - If you need platform-specific behavior, move it to the app layer

## Structure

```
src/
├── schema.ts          # PowerSync AppSchema + type exports
├── index.ts           # Public API (query functions)
└── queries/
    ├── tasks.ts       # Task CRUD + filters
    ├── projects.ts    # Project CRUD
    ├── labels.ts      # Label CRUD
    └── ...            # One file per entity
```

Each query file exports:
- Functions: `getTasks()`, `createTask()`, etc.
- Types: `TaskRecord`, `ProjectRecord`, etc. (re-exported from schema)
