# Schema Synchronization Strategy

## Overview

The app has three related schema definitions that must stay in sync:

1. **Postgres schema** (`supabase/migrations/`) — source of truth for production database
2. **PowerSync sync rules** (`powersync/sync-rules.yaml`) — defines which Postgres data syncs to clients
3. **TypeScript schema** (`packages/db/src/schema.ts`) — client-side type definitions (PowerSync AppSchema)

## Source of Truth

**Postgres schema is the source of truth.** All changes originate there.

When you add a column, table, or change constraints:
1. Write a SQL migration in `supabase/migrations/`
2. Update `powersync/sync-rules.yaml` if the new table/column needs to sync to clients
3. Update `packages/db/src/schema.ts` to reflect the new structure

## Why This Order Matters

- **Postgres first:** Schema lives on the server; clients must adapt to it
- **PowerSync second:** Sync rules decide what goes to clients; if you add a table but don't update sync-rules, clients won't see it
- **TypeScript last:** Type definitions follow the reality; they're not enforcement, just DX

## Change Checklist

When adding a new **table**:
- [ ] Create migration in `supabase/migrations/`
- [ ] Add `SELECT * FROM <table> WHERE user_id = ...` to `powersync/sync-rules.yaml`
- [ ] Add table definition to `packages/db/src/schema.ts` using PowerSync `Table` + `column` API
- [ ] Export new type (e.g., `export type NewRecord = Database['new_table']`)

When adding a **column** to an existing synced table:
- [ ] Create migration in `supabase/migrations/`
- [ ] No change needed to `sync-rules.yaml` (it uses `SELECT *`, so new columns auto-sync)
- [ ] Add column to table definition in `packages/db/src/schema.ts`

When **renaming** a column:
- [ ] Create migration in `supabase/migrations/` (rename the column)
- [ ] Update `packages/db/src/schema.ts` to use the new name
- [ ] Verify PowerSync sync rules don't hardcode the old column name (they shouldn't; `SELECT *` is used)
- [ ] Add a data migration to rename values if needed (e.g., status enums)

When **removing** a column:
- [ ] Create migration in `supabase/migrations/`
- [ ] Remove from `packages/db/src/schema.ts`
- [ ] Update any queries in `packages/db/src/queries/` that referenced it

## Detecting Drift

Run the schema check (CI will do this automatically):
```bash
npm run check-versions  # Node version check (already set up)
```

To add a schema drift detector in Phase 3:
- CLI tool that compares column names across the three sources
- Run in CI to fail if they don't match
- Example: `npm run check-schema-sync` could compare Postgres columns vs. TypeScript schema

## Current State (as of 2026-06-24)

| Table | Postgres | Sync Rules | TypeScript |
|-------|----------|-----------|------------|
| tasks | ✅ 16 columns | ✅ in `user_data` stream | ✅ in schema.ts |
| projects | ✅ | ✅ | ✅ |
| labels | ✅ | ✅ | ✅ |
| saved_filters | ✅ | ✅ | ✅ |
| user_settings | ✅ | ✅ | ✗ (not in TypeScript schema; Phase 3) |
| reminders | ✅ | ✅ | ✗ (Phase 3) |
| attachments | ✅ | ✅ | ✗ (Phase 3) |

**Note:** Phase 3 tables exist in Postgres and sync-rules but aren't exposed to the client yet (no TypeScript schema). This is intentional — the schema is added when the feature lands.

## Example: Adding a Column

Say you want to add `color` to `saved_filters`:

**Step 1: Migration**
```sql
-- supabase/migrations/20260625000001_add_color_to_saved_filters.sql
ALTER TABLE saved_filters ADD COLUMN color TEXT NOT NULL DEFAULT '#6366F1';
```

**Step 2: No change to sync-rules.yaml**
```yaml
# Already covers saved_filters via SELECT *
- SELECT * FROM saved_filters WHERE user_id = auth.user_id()
```

**Step 3: Update TypeScript**
```typescript
// packages/db/src/schema.ts
const saved_filters = new Table(
  {
    user_id:    column.text,
    name:       column.text,
    icon:       column.text,
    color:      column.text,  // ← NEW
    query:      column.text,
    sort_order: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  // ...
);
```

Deploy migration → PowerSync syncs new column → TypeScript schema updated → done.

## Phase 2B / 2C Prep

Before implementing the next phase:
1. Confirm all required columns are in the migration
2. Confirm sync-rules covers the tables
3. Add TypeScript schema when feature is ready

This prevents the "forgot to add to sync-rules" bug where a column exists in Postgres but never reaches clients.
