# Notes Core — Plan 1 of 3: Data Layer & Enrichment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship everything below the UI for Notes Core: the `notes` and `links` tables (with conflict-copy trigger and RLS), sync rules, the PowerSync client schema, query/write functions, pure text helpers, a pending-link enricher, and the `enrich-url` notes branch, all tested.

**Architecture:** Postgres is the enforcement point (RLS + a `BEFORE UPDATE` trigger that turns concurrent body edits into a conflict-copy note). `packages/db` owns all SQL against the local PowerSync SQLite; `packages/core` owns pure text transforms. The `enrich-url` edge function writes link-preview columns only, never `title`/`body`, so it can never trigger a conflict.

**Tech Stack:** Supabase Postgres 17 + Supabase CLI 2.109 (local stack via Docker for SQL tests), PowerSync (`@powersync/common`, `@powersync/react`), TypeScript, Vitest 1.6, Deno edge function.

**Spec:** `docs/superpowers/specs/2026-11-25-notes-core-design.md`

**Plan series:** Plan 1 (this) → Plan 2: Web UI (`2026-11-25-notes-core-2-web.md`) → Plan 3: Mobile UI + share toggle (`2026-11-25-notes-core-3-mobile.md`). Plans 2 and 3 are written after this one lands, so they are built on the real, verified API.

---

## Things the engineer must know first

- **Three representations, one commit.** Schema changes touch `supabase/migrations/` → `powersync/sync-rules.yaml` → `packages/db`, in that order. See `CLAUDE.md` and `packages/db/CLAUDE.md`.
- **Soft-delete filtering in this repo:** the sync rules deliberately ship soft-deleted rows (see the comment at the top of `powersync/sync-rules.yaml`), and every existing query adds `AND deleted_at IS NULL` (e.g. `INBOX_QUERY` in `packages/db/src/queries/tasks.ts`). Follow that existing pattern for `notes`. `links` has no `deleted_at` (hard delete).
- **Booleans** sync as integers (`is_archived` is `column.integer`, compare with `= 0` / `= 1`). **JSON** columns (`labels`) sync as text; filter with `json_each`.
- **The upload connectors turn every local `DELETE` into `UPDATE … SET deleted_at`** (`apps/web/lib/powersync/WebConnector.ts:41-44`, `apps/mobile/src/powersync/SupabaseConnector.ts:52-56`). `links` has no `deleted_at`, so without Task 5 an unlink fails with Postgres `42703`. `42xxx` is not in `FATAL_CODES`, so the transaction retries forever and **blocks the whole upload queue**. Task 5 must land before any code deletes a link.
- **Schema-first:** a migration file is not done until it is applied to the LIVE database and verified (Task 4). Never build on an unapplied column.
- Commit with conventional-commit messages ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File structure

| File | Responsibility |
|---|---|
| `supabase/config.toml` (create via `supabase init`) | Local Supabase stack config, for SQL tests only |
| `supabase/tests/notes_test.sql` (create) | SQL tests: conflict trigger, RLS, links constraints |
| `supabase/migrations/20261125000001_notes_and_links.sql` (create) | `notes`, `links`, indexes, RLS, triggers |
| `powersync/sync-rules.yaml` (modify) | Add `notes` and `links` to `user_data` stream |
| `packages/db/src/schema.ts` (modify) | `notes`, `links` client tables + record types |
| `packages/db/src/queries/syncTables.ts` (+ test) (create) | `HARD_DELETE_TABLES`, `isHardDeleteTable` |
| `apps/web/lib/powersync/WebConnector.ts` (modify) | Real DELETE for hard-delete tables |
| `apps/mobile/src/powersync/SupabaseConnector.ts` (modify) | Real DELETE for hard-delete tables |
| `packages/core/src/notes/noteText.ts` (+ test) (create) | Display title, excerpt, selection→task title, sole-URL detection |
| `packages/core/src/notes/markdownEdit.ts` (+ test) (create) | Toolbar text transforms (pure) |
| `packages/db/src/queries/links.ts` (+ test) (create) | Link/unlink, linked-items queries, delete-links helper |
| `packages/db/src/queries/notes.ts` (+ test) (create) | Note list/search query builders, hooks, writes |
| `packages/db/src/queries/noteEnricher.ts` (+ test) (create) | Retry `pending` link previews |
| `packages/db/src/queries/tasks.ts` (modify) | `deleteTask` also removes the task's links |
| `supabase/functions/enrich-url/urlGuard.ts` (+ test) (create) | SSRF checks (pure; DNS resolver injected) |
| `supabase/functions/enrich-url/meta.ts` (+ test) (create) | HTML meta extraction (pure) |
| `supabase/functions/enrich-url/index.ts` (modify) | Guarded fetch, `noteId` branch |

---

### Task 0: Branch / worktree

**Files:** none

- [ ] **Step 1: Create an isolated worktree off `master`** (`.worktrees/` is git-ignored and excluded by `.vercelignore`)

```bash
cd /home/rameshv/Repos/Projects/todolist
git worktree add .worktrees/notes-core -b feature/notes-core master
cd .worktrees/notes-core
# Bring over the spec and plan commits (made on fix/pomodoro-resume)
git cherry-pick $(git log fix/pomodoro-resume --format=%h --reverse -- \
  docs/superpowers/specs/2026-11-25-notes-core-design.md \
  docs/superpowers/plans/2026-11-25-notes-core-1-data-layer.md)
pnpm install
```

Expected: both `docs/superpowers/specs/2026-11-25-notes-core-design.md` and `docs/superpowers/plans/2026-11-25-notes-core-1-data-layer.md` exist in the worktree; `pnpm install` completes.

- [ ] **Step 2: Baseline tests are green**

Run: `pnpm test`
Expected: all packages pass. If anything fails on `master`, stop and report; don't build on a red baseline.

All remaining tasks run inside `.worktrees/notes-core`.

---

### Task 1: Local Supabase stack for SQL tests

**Files:**
- Create: `supabase/config.toml` (generated)

- [ ] **Step 1: Initialise and start a local stack**

```bash
supabase init            # answer "N" to VS Code / IntelliJ settings prompts
supabase start -x studio,imgproxy,mailpit,inbucket,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta
```

If the CLI rejects a service name in `-x`, remove that name and rerun. Keep `storage-api`: migration `20260630000001_attachments_storage_bucket.sql` writes to `storage.buckets`.

Expected: output includes `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

- [ ] **Step 2: Confirm existing migrations apply cleanly**

```bash
supabase db reset
```

Expected: every file in `supabase/migrations/` applies with no error.

- [ ] **Step 3: Commit**

```bash
git add supabase/config.toml supabase/.gitignore
git commit -m "chore(supabase): add local stack config for SQL tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Failing SQL tests for notes + links

**Files:**
- Create: `supabase/tests/notes_test.sql`

- [ ] **Step 1: Write the test file**

Runs in a transaction that is always rolled back. `ASSERT` failures abort with a message naming the test.

```sql
-- supabase/tests/notes_test.sql
-- Run: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/notes_test.sql
-- Everything is rolled back at the end.
begin;

-- Two users, created as superuser before switching role.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local');

-- Act as user A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into notes (id, user_id, title, body, revision, base_revision)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Plan', 'v0', 0, 0);

-- T1: accepted edit (base matches) keeps incoming body and revision.
update notes set body = 'v1', base_revision = 0, revision = 1
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ declare r notes; begin
  select * into r from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert r.body = 'v1' and r.revision = 1, 'T1 accepted edit: got body=' || r.body || ' rev=' || r.revision;
end $$;

-- T2: chained offline edits (1->2, 2->3) are accepted without conflict copies.
update notes set body = 'v2', base_revision = 1, revision = 2 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update notes set body = 'v3', base_revision = 2, revision = 3 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select body from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'v3', 'T2 chained: body not v3';
  assert (select count(*) from notes where conflict_of = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'T2 chained: unexpected conflict copy';
end $$;

-- T3: stale edit (base 1, server at 3) -> original kept, exactly one conflict copy.
update notes set body = 'stale-device', base_revision = 1, revision = 2
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ declare r notes; c notes; begin
  select * into r from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert r.body = 'v3' and r.revision = 3, 'T3 stale: original overwritten (body=' || r.body || ')';
  assert (select count(*) from notes where conflict_of = r.id) = 1, 'T3 stale: expected exactly one conflict copy';
  select * into c from notes where conflict_of = r.id;
  assert c.body = 'stale-device', 'T3 stale: copy has wrong body';
  assert c.title like 'Plan (conflict, %', 'T3 stale: copy title was ' || c.title;
  assert c.user_id = '11111111-1111-1111-1111-111111111111', 'T3 stale: copy has wrong owner';
end $$;

-- T4: non-body edits are plain last-write-wins (no revision check).
update notes set title = 'Plan v2', base_revision = 0 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select title from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Plan v2', 'T4 title LWW failed';
  assert (select count(*) from notes where conflict_of = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'T4 title edit created a conflict copy';
end $$;

-- T5: body edit to a soft-deleted note -> delete stands, text saved as conflict copy.
update notes set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update notes set body = 'edited-after-delete', base_revision = 3, revision = 4
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select deleted_at is not null and body = 'v3' from notes where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'T5 deleted note was modified';
  assert exists (select 1 from notes where conflict_of = 'aaaaaaaa-0000-0000-0000-000000000001' and body = 'edited-after-delete'), 'T5 text lost';
end $$;

-- T6: link_status check constraint.
do $$ begin
  begin
    insert into notes (user_id, link_status) values ('11111111-1111-1111-1111-111111111111', 'bogus');
    assert false, 'T6 link_status accepted bogus value';
  exception when check_violation then null;
  end;
end $$;

-- T7: links unique + type check.
insert into links (user_id, from_type, from_id, to_type, to_id) values
  ('11111111-1111-1111-1111-111111111111', 'note', 'aaaaaaaa-0000-0000-0000-000000000001', 'task', 'bbbbbbbb-0000-0000-0000-000000000001');
do $$ begin
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id) values
      ('11111111-1111-1111-1111-111111111111', 'note', 'aaaaaaaa-0000-0000-0000-000000000001', 'task', 'bbbbbbbb-0000-0000-0000-000000000001');
    assert false, 'T7 duplicate link accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id) values
      ('11111111-1111-1111-1111-111111111111', 'person', gen_random_uuid(), 'task', gen_random_uuid());
    assert false, 'T7 unknown link type accepted';
  exception when check_violation then null;
  end;
end $$;

-- T8: links are hard-deletable by owner.
delete from links where from_id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select count(*) from links) = 0, 'T8 link not deleted';
end $$;

-- T9: insert forces user_id to the caller (enforce_user_id), even if spoofed.
insert into notes (id, user_id, title) values ('aaaaaaaa-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'spoof');
do $$ begin
  assert (select user_id from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = '11111111-1111-1111-1111-111111111111', 'T9 user_id spoof succeeded';
end $$;
insert into links (id, user_id, from_type, from_id, to_type, to_id) values
  ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'note', gen_random_uuid(), 'task', gen_random_uuid());
do $$ begin
  assert (select user_id from links where id = 'cccccccc-0000-0000-0000-000000000001') = '11111111-1111-1111-1111-111111111111', 'T9 links user_id spoof succeeded';
end $$;

-- T10: RLS: user B sees none of A's notes or links and cannot update them.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from notes) = 0, 'T10 RLS: B can read A''s notes';
  assert (select count(*) from links) = 0, 'T10 RLS: B can read A''s links';
end $$;
update notes set title = 'hijack' where id = 'aaaaaaaa-0000-0000-0000-000000000009';
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$ begin
  assert (select title from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = 'spoof', 'T10 RLS: B updated A''s note';
end $$;

-- T11: is_processed defaults to false and can be toggled.
do $$ begin
  assert (select is_processed from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = false, 'T11 is_processed default not false';
end $$;
update notes set is_processed = true where id = 'aaaaaaaa-0000-0000-0000-000000000009';
do $$ begin
  assert (select is_processed from notes where id = 'aaaaaaaa-0000-0000-0000-000000000009') = true, 'T11 is_processed update failed';
end $$;

-- T12: links origin defaults to 'manual' and rejects unknown values.
insert into links (user_id, from_type, from_id, to_type, to_id) values
  ('11111111-1111-1111-1111-111111111111', 'note', gen_random_uuid(), 'task', gen_random_uuid());
do $$ begin
  assert (select origin from links order by created_at desc limit 1) = 'manual', 'T12 links origin default not manual';
  begin
    insert into links (user_id, from_type, from_id, to_type, to_id, origin) values
      ('11111111-1111-1111-1111-111111111111', 'note', gen_random_uuid(), 'task', gen_random_uuid(), 'auto');
    assert false, 'T12 unknown origin accepted';
  exception when check_violation then null;
  end;
end $$;

-- T13: link types include person and project (future entity types).
do $$ begin
  begin
    -- These types are now valid; they just have no rows yet.
    insert into links (user_id, from_type, from_id, to_type, to_id) values
      ('11111111-1111-1111-1111-111111111111', 'person', gen_random_uuid(), 'note', gen_random_uuid());
    -- clean up
    delete from links where from_type = 'person';
  end;
end $$;

\echo 'ALL NOTES TESTS PASSED'
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/notes_test.sql`
Expected: FAIL with `ERROR:  relation "notes" does not exist`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/notes_test.sql
git commit -m "test(db): add SQL tests for notes conflict trigger, links and RLS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Migration — notes, links, RLS, triggers

**Files:**
- Create: `supabase/migrations/20261125000001_notes_and_links.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Notes Core (second brain phase 1): notes + generic links.
-- Spec: docs/superpowers/specs/2026-11-25-notes-core-design.md

create table notes (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  title          text        not null default '',
  body           text        not null default '',
  project_id     uuid        references projects(id) on delete set null,
  labels         jsonb       not null default '[]',
  is_archived    boolean     not null default false,
  is_processed   boolean     not null default false,  -- capture-inbox flag: false = unprocessed
  source_url     text,
  link_title     text,
  link_excerpt   text,
  link_image_url text,
  link_site_name text,
  link_status    text        check (link_status in ('pending','ok','failed')),
  revision       integer     not null default 0,
  base_revision  integer     not null default 0,
  conflict_of    uuid        references notes(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index notes_user_updated_idx on notes (user_id, updated_at desc);
create index notes_project_idx      on notes (project_id);
create index notes_labels_gin_idx   on notes using gin (labels);

-- Generic links. v1 stores note->task only; phase 2 adds note->note.
-- Hard delete (no deleted_at): a link has no content worth keeping, and soft
-- delete would collide with the unique constraint when re-linking.
create table links (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  from_type  text        not null check (from_type in ('note','task','person','project')),
  from_id    uuid        not null,
  to_type    text        not null check (to_type in ('note','task','person','project')),
  to_id      uuid        not null,
  origin     text        not null default 'manual' check (origin in ('manual','wikilink')),
  created_at timestamptz not null default now(),
  constraint links_unique unique (user_id, from_type, from_id, to_type, to_id)
);

create index links_from_idx on links (from_type, from_id);
create index links_to_idx   on links (to_type, to_id);

-- RLS: owner-scoped, mirrors the other per-user tables.
alter table notes enable row level security;
alter table links enable row level security;
create policy "own_notes" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_links" on links for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger notes_updated_at      before update on notes for each row execute function set_updated_at();
create trigger notes_enforce_user_id before insert on notes for each row execute function enforce_user_id();
create trigger links_enforce_user_id before insert on links for each row execute function enforce_user_id();

-- Conflict copy on concurrent body edits.
-- Clients send base_revision = the revision they edited from, revision = base + 1.
-- If the server has moved on (or the note is deleted), keep the server body and
-- save the incoming body as a new note pointing back via conflict_of.
-- Non-body fields stay last-write-wins.
create or replace function notes_body_conflict()
returns trigger language plpgsql as $$
begin
  if new.body is not distinct from old.body then
    return new;
  end if;

  if old.deleted_at is null and new.base_revision = old.revision then
    return new;
  end if;

  insert into notes (user_id, title, body, project_id, labels, source_url, conflict_of, revision, base_revision)
  values (
    old.user_id,
    coalesce(nullif(new.title, ''), nullif(old.title, ''), 'Untitled')
      || ' (conflict, ' || to_char(now() at time zone 'UTC', 'DD Mon HH24:MI') || ' UTC)',
    new.body,
    new.project_id,
    new.labels,
    new.source_url,
    old.id,
    0,
    0
  );

  new.body          := old.body;
  new.revision      := old.revision;
  new.base_revision := old.base_revision;
  new.deleted_at    := old.deleted_at;
  return new;
end;
$$;

-- Name sorts before notes_updated_at; Postgres fires BEFORE triggers alphabetically.
create trigger notes_body_conflict before update on notes for each row execute function notes_body_conflict();
```

- [ ] **Step 2: Apply locally and run the tests**

```bash
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/notes_test.sql
```

Expected: last line before `ROLLBACK` is `ALL NOTES TESTS PASSED`; exit code 0.

If T9 fails, confirm `enforce_user_id()` exists (it's defined in `20260620000003_triggers.sql`).

- [ ] **Step 3: Commit (migration and sync rules travel together, so stage only; commit happens in Task 4 Step 3)**

```bash
git add supabase/migrations/20261125000001_notes_and_links.sql
```

---

### Task 4: Sync rules + apply LIVE + verify

**Files:**
- Modify: `powersync/sync-rules.yaml`

- [ ] **Step 1: Add the two tables to the `user_data` stream**

In `powersync/sync-rules.yaml`, after the `daily_log` line, add:

```yaml
      - SELECT * FROM notes           WHERE user_id = auth.user_id()
      - SELECT * FROM links           WHERE user_id = auth.user_id()
```

- [ ] **Step 2: Check for remote drift, then push the migration LIVE**

```bash
supabase migration list
```

Expected: every local migration up to `20261119000001` shows in both Local and Remote columns, and `20261125000001` shows Local only. **If any older migration is Local-only, stop and report**; pushing would also apply it.

```bash
supabase db push
```

Expected: applies exactly `20261125000001_notes_and_links.sql`.

- [ ] **Step 3: Commit migration + sync rules together**

```bash
git add powersync/sync-rules.yaml supabase/migrations/20261125000001_notes_and_links.sql
git commit -m "feat(db): add notes and links tables with conflict-copy trigger and RLS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Verify columns exist LIVE**

```bash
set -a; . apps/web/.env.local; set +a
curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/notes?select=id,revision,base_revision,conflict_of,link_status&limit=1"
curl -s -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/links?select=id,from_type,to_type&limit=1"
```

Expected: both return `[]` (empty because RLS + anonymous). A `42P01`/`42703` error means the migration is not live; fix before continuing. If the env var names differ, use the ones in `apps/web/.env.local`.

- [ ] **Step 5: Deploy sync rules (manual, user action)**

Ask the user to paste `powersync/sync-rules.yaml` into the PowerSync dashboard → Sync Rules → Deploy, and confirm it validated. **Do not continue to Plan 2 until confirmed**; without it notes save locally and never reach other devices.

---

### Task 5: Connectors hard-delete `links` rows

**Files:**
- Create: `packages/db/src/queries/syncTables.ts`
- Create: `packages/db/src/queries/syncTables.test.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `apps/web/lib/powersync/WebConnector.ts:41-44`
- Modify: `apps/mobile/src/powersync/SupabaseConnector.ts:52-56`

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/src/queries/syncTables.test.ts
import { describe, it, expect } from 'vitest';
import { HARD_DELETE_TABLES, isHardDeleteTable } from './syncTables';

describe('isHardDeleteTable', () => {
  it('treats links as hard-delete (no deleted_at column)', () => {
    expect(isHardDeleteTable('links')).toBe(true);
  });

  it('keeps soft delete for tables with deleted_at', () => {
    for (const t of ['tasks', 'notes', 'projects', 'labels', 'reminders', 'attachments', 'saved_filters']) {
      expect(isHardDeleteTable(t)).toBe(false);
    }
  });

  it('exposes the list for connectors', () => {
    expect(HARD_DELETE_TABLES).toEqual(['links']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/syncTables.test.ts`
Expected: FAIL, cannot resolve `./syncTables`.

- [ ] **Step 3: Implement**

```ts
// packages/db/src/queries/syncTables.ts
// Tables without a deleted_at column. The upload connectors normally turn a
// local DELETE into a soft delete (UPDATE ... SET deleted_at); for these tables
// that would fail with 42703 and, since 42xxx is not a fatal code, block the
// upload queue forever. Connectors must issue a real DELETE instead.
export const HARD_DELETE_TABLES = ['links'] as const;

export function isHardDeleteTable(table: string): boolean {
  return (HARD_DELETE_TABLES as readonly string[]).includes(table);
}
```

Add to `packages/db/src/index.ts` after the last `export *` line:

```ts
export * from './queries/syncTables';
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/syncTables.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Use it in the web connector**

In `apps/web/lib/powersync/WebConnector.ts`, add to the imports:

```ts
import { isHardDeleteTable } from '@todolist/db';
```

Replace the `UpdateType.DELETE` case with:

```ts
          case UpdateType.DELETE:
            result = isHardDeleteTable(op.table)
              ? await table.delete().eq('id', op.id)
              : await table
                  .update({ deleted_at: new Date().toISOString() })
                  .eq('id', op.id);
            break;
```

- [ ] **Step 6: Same change in the mobile connector**

In `apps/mobile/src/powersync/SupabaseConnector.ts`, add the same import (`import { isHardDeleteTable } from '@todolist/db';`) and replace the `UpdateType.DELETE` case with:

```ts
          case UpdateType.DELETE:
            // Soft delete — deleted_at triggers the DB updated_at trigger; don't pass updated_at client-side.
            // Tables without deleted_at (see HARD_DELETE_TABLES) get a real DELETE.
            result = isHardDeleteTable(op.table)
              ? await table.delete().eq('id', op.id)
              : await table
                  .update({ deleted_at: new Date().toISOString() })
                  .eq('id', op.id);
            break;
```

Confirm both apps already depend on `@todolist/db` (`grep '@todolist/db' apps/web/package.json apps/mobile/package.json`). They do if they import query hooks; if not, stop and report.

- [ ] **Step 7: Build db and typecheck**

Run: `pnpm --filter @todolist/db build && pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/queries/syncTables.ts packages/db/src/queries/syncTables.test.ts packages/db/src/index.ts apps/web/lib/powersync/WebConnector.ts apps/mobile/src/powersync/SupabaseConnector.ts
git commit -m "fix(sync): hard-delete rows of tables without deleted_at in upload connectors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: PowerSync client schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add the tables**

Before the `export const AppSchema` line, add:

```ts
// notes: second-brain notes. body is markdown; revision/base_revision drive the
// server-side conflict-copy trigger (see migration 20261125000001).
const notes = new Table(
  {
    user_id:        column.text,
    title:          column.text,
    body:           column.text,
    project_id:     column.text,
    labels:         column.text,    // JSON array stored as text
    is_archived:    column.integer,
    is_processed:   column.integer,  // boolean: 0 = unprocessed, 1 = processed
    source_url:     column.text,
    link_title:     column.text,
    link_excerpt:   column.text,
    link_image_url: column.text,
    link_site_name: column.text,
    link_status:    column.text,    // 'pending' | 'ok' | 'failed' | null
    revision:       column.integer,
    base_revision:  column.integer,
    conflict_of:    column.text,
    created_at:     column.text,
    updated_at:     column.text,
    deleted_at:     column.text,
  },
  { indexes: { by_updated: ['updated_at'], by_project: ['project_id'], by_link_status: ['link_status'] } }
);

// links: generic note<->task (later note<->note) association. Hard-deleted.
const links = new Table(
  {
    user_id:    column.text,
    from_type:  column.text,
    from_id:    column.text,
    to_type:    column.text,
    to_id:      column.text,
    origin:     column.text,  // 'manual' | 'wikilink'
    created_at: column.text,
  },
  { indexes: { by_from: ['from_type', 'from_id'], by_to: ['to_type', 'to_id'] } }
);
```

Replace the `AppSchema` line and add record types:

```ts
export const AppSchema = new Schema({ tasks, projects, labels, saved_filters, attachments, reminders, user_settings, daily_log, notes, links });
```

```ts
export type NoteRecord             = Database['notes'];
export type LinkRecord             = Database['links'];
```

In `packages/db/src/index.ts`, extend the type export:

```ts
export type { Database, TaskRecord, ProjectRecord, LabelRecord, SavedFilterRecord, DailyLogRecord, UserSettingsRecord, NoteRecord, LinkRecord } from './schema';
```

- [ ] **Step 2: Cross-check against the migration**

Every column in the `notes` and `links` `create table` statements (except `id`) must appear in the client table, and vice versa. Compare by eye now; a mismatch compiles fine and fails silently.

- [ ] **Step 3: Typecheck + test**

Run: `pnpm --filter @todolist/db typecheck && pnpm --filter @todolist/db test`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts
git commit -m "feat(db): add notes and links to PowerSync client schema

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Core — note text helpers

**Files:**
- Create: `packages/core/src/notes/noteText.ts`
- Create: `packages/core/src/notes/noteText.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/notes/noteText.test.ts
import { describe, it, expect } from 'vitest';
import { noteDisplayTitle, noteExcerpt, selectionToTaskTitle, extractSoleUrl } from './noteText';

describe('noteDisplayTitle', () => {
  it('uses the explicit title when present', () => {
    expect(noteDisplayTitle({ title: '  Plan  ', body: 'x', link_title: 'L' })).toBe('Plan');
  });
  it('falls back to link_title', () => {
    expect(noteDisplayTitle({ title: '', body: '', link_title: 'Article' })).toBe('Article');
  });
  it('falls back to the first non-empty body line, stripped of markdown markers', () => {
    expect(noteDisplayTitle({ title: '', body: '\n\n## - [ ] Big idea here\nmore' })).toBe('Big idea here');
  });
  it('truncates long fallback lines to 80 chars with an ellipsis', () => {
    const t = noteDisplayTitle({ title: '', body: 'a'.repeat(200) });
    expect(t.length).toBe(80);
    expect(t.endsWith('…')).toBe(true);
  });
  it('returns Untitled when nothing is available', () => {
    expect(noteDisplayTitle({ title: null, body: null })).toBe('Untitled');
  });
});

describe('noteExcerpt', () => {
  it('skips the body line used as the title when the title is blank', () => {
    expect(noteExcerpt({ title: '', body: 'Idea\nsecond line\nthird' })).toBe('second line third');
  });
  it('uses the whole body when an explicit title exists', () => {
    expect(noteExcerpt({ title: 'T', body: 'first\nsecond' })).toBe('first second');
  });
  it('strips markdown markers and caps length', () => {
    const e = noteExcerpt({ title: 'T', body: '- **bold** item\n' + 'x'.repeat(300) }, 50);
    expect(e.startsWith('bold item')).toBe(true);
    expect(e.length).toBe(50);
  });
  it('falls back to link_excerpt when the body is empty', () => {
    expect(noteExcerpt({ title: 'T', body: '', link_excerpt: 'From the page' })).toBe('From the page');
  });
});

describe('selectionToTaskTitle', () => {
  it('strips list, checkbox and heading markers and collapses whitespace', () => {
    expect(selectionToTaskTitle('  - [ ]   Call   the   bank \n')).toBe('Call the bank');
    expect(selectionToTaskTitle('### Write post')).toBe('Write post');
    expect(selectionToTaskTitle('1. Ship it')).toBe('Ship it');
  });
  it('joins multi-line selections into one line', () => {
    expect(selectionToTaskTitle('- one\n- two')).toBe('one two');
  });
  it('caps at 200 chars', () => {
    expect(selectionToTaskTitle('x'.repeat(500)).length).toBe(200);
  });
});

describe('extractSoleUrl', () => {
  it('returns the URL when the text is exactly one http(s) URL', () => {
    expect(extractSoleUrl('  https://example.com/a?b=1  ')).toBe('https://example.com/a?b=1');
  });
  it('returns null for text with other words', () => {
    expect(extractSoleUrl('see https://example.com')).toBeNull();
  });
  it('returns null for non-http schemes', () => {
    expect(extractSoleUrl('javascript:alert(1)')).toBeNull();
    expect(extractSoleUrl('ftp://x.y')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/core exec vitest run src/notes/noteText.test.ts`
Expected: FAIL, cannot resolve `./noteText`.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/notes/noteText.ts
// Pure text helpers for notes. No DB, no React.

export interface NoteTextFields {
  title?: string | null;
  body?: string | null;
  link_title?: string | null;
  link_excerpt?: string | null;
}

const TITLE_MAX = 80;
const TASK_TITLE_MAX = 200;

// Leading markdown block markers: headings, quotes, bullets, ordered items, checkboxes.
const BLOCK_MARKERS = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)*(?:\[[ xX]\]\s+)?/;
const INLINE_MARKERS = /(\*\*|__|\*|_|~~|`)/g;

function stripLine(line: string): string {
  return line.replace(BLOCK_MARKERS, '').replace(INLINE_MARKERS, '').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function firstContentLineIndex(lines: string[]): number {
  return lines.findIndex((l) => stripLine(l) !== '');
}

export function noteDisplayTitle(note: NoteTextFields): string {
  const explicit = (note.title ?? '').trim();
  if (explicit) return explicit;
  const link = (note.link_title ?? '').trim();
  if (link) return link;
  const lines = (note.body ?? '').split('\n');
  const i = firstContentLineIndex(lines);
  if (i === -1) return 'Untitled';
  return truncate(stripLine(lines[i]), TITLE_MAX);
}

export function noteExcerpt(note: NoteTextFields, max = 120): string {
  let lines = (note.body ?? '').split('\n');
  const usesBodyAsTitle = !(note.title ?? '').trim() && !(note.link_title ?? '').trim();
  if (usesBodyAsTitle) {
    const i = firstContentLineIndex(lines);
    if (i !== -1) lines = lines.slice(i + 1);
  }
  const text = lines.map(stripLine).filter(Boolean).join(' ');
  const source = text || (note.link_excerpt ?? '').trim();
  return source.length <= max ? source : source.slice(0, max);
}

export function selectionToTaskTitle(selection: string): string {
  const joined = selection.split('\n').map(stripLine).filter(Boolean).join(' ');
  return joined.slice(0, TASK_TITLE_MAX);
}

export function extractSoleUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}
```

Note on the excerpt cap test: `'bold item ' + 'x'.repeat(300)` sliced to 50 gives exactly 50 chars, and no ellipsis is added to excerpts (the UI clamps lines visually).

Add to `packages/core/src/index.ts`:

```ts
export * from './notes/noteText';
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/core exec vitest run src/notes/noteText.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/notes/noteText.ts packages/core/src/notes/noteText.test.ts packages/core/src/index.ts
git commit -m "feat(core): add note display title, excerpt and selection helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Core — markdown toolbar transforms

**Files:**
- Create: `packages/core/src/notes/markdownEdit.ts`
- Create: `packages/core/src/notes/markdownEdit.test.ts`
- Modify: `packages/core/src/index.ts`

All transforms take and return `{ text, selStart, selEnd }` so web `<textarea>` and RN `TextInput` (`selection={{start,end}}`) can share them.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/core/src/notes/markdownEdit.test.ts
import { describe, it, expect } from 'vitest';
import { toggleInline, toggleLinePrefix, insertLink, type TextEdit } from './markdownEdit';

const at = (text: string, selStart: number, selEnd = selStart): TextEdit => ({ text, selStart, selEnd });

describe('toggleInline', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(toggleInline(at('say hello now', 4, 9), '**')).toEqual(at('say **hello** now', 6, 11));
  });
  it('unwraps when the selection is already wrapped', () => {
    expect(toggleInline(at('say **hello** now', 6, 11), '**')).toEqual(at('say hello now', 4, 9));
  });
  it('inserts an empty pair with the cursor inside when nothing is selected', () => {
    expect(toggleInline(at('ab', 1), '_')).toEqual(at('a__b', 2, 2));
  });
});

describe('toggleLinePrefix', () => {
  it('adds a prefix to every selected line', () => {
    expect(toggleLinePrefix(at('one\ntwo\nthree', 0, 7), '- ')).toEqual(at('- one\n- two\nthree', 0, 11));
  });
  it('removes the prefix when all selected lines have it', () => {
    expect(toggleLinePrefix(at('- one\n- two', 0, 11), '- ')).toEqual(at('one\ntwo', 0, 7));
  });
  it('works on the cursor line when nothing is selected', () => {
    expect(toggleLinePrefix(at('a\nbuy milk', 4), '- [ ] ')).toEqual(at('a\n- [ ] buy milk', 10, 10));
  });
  it('replaces an existing heading level rather than stacking', () => {
    expect(toggleLinePrefix(at('### Title', 4), '# ')).toEqual(at('# Title', 2, 2));
  });
});

describe('insertLink', () => {
  it('wraps the selection as link text and selects the url placeholder', () => {
    expect(insertLink(at('see docs here', 4, 8))).toEqual(at('see [docs](url) here', 11, 14));
  });
  it('inserts a full template when nothing is selected', () => {
    expect(insertLink(at('x', 1))).toEqual(at('x[text](url)', 8, 11));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/core exec vitest run src/notes/markdownEdit.test.ts`
Expected: FAIL, cannot resolve `./markdownEdit`.

- [ ] **Step 3: Implement**

```ts
// packages/core/src/notes/markdownEdit.ts
// Pure markdown toolbar transforms over text + selection. Platform-neutral.

export interface TextEdit {
  text: string;
  selStart: number;
  selEnd: number;
}

export function toggleInline(edit: TextEdit, marker: string): TextEdit {
  const { text, selStart, selEnd } = edit;
  const m = marker.length;
  const before = text.slice(selStart - m, selStart);
  const after = text.slice(selEnd, selEnd + m);
  if (selEnd > selStart && before === marker && after === marker) {
    return {
      text: text.slice(0, selStart - m) + text.slice(selStart, selEnd) + text.slice(selEnd + m),
      selStart: selStart - m,
      selEnd: selEnd - m,
    };
  }
  return {
    text: text.slice(0, selStart) + marker + text.slice(selStart, selEnd) + marker + text.slice(selEnd),
    selStart: selStart + m,
    selEnd: selEnd + m,
  };
}

const HEADING = /^#{1,6} /;

export function toggleLinePrefix(edit: TextEdit, prefix: string): TextEdit {
  const { text, selStart, selEnd } = edit;
  const lineStart = text.lastIndexOf('\n', selStart - 1) + 1;
  const nl = text.indexOf('\n', Math.max(selEnd - 1, selStart));
  const lineEnd = selEnd > selStart && text[selEnd - 1] === '\n' ? selEnd - 1 : nl === -1 ? text.length : nl;
  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const isHeading = HEADING.test(prefix);

  const allHave = lines.every((l) => l.startsWith(prefix));
  let delta0 = 0;
  const out = lines.map((l, i) => {
    let next: string;
    if (allHave) {
      next = l.slice(prefix.length);
    } else if (isHeading && HEADING.test(l)) {
      next = l.replace(HEADING, prefix);
    } else {
      next = prefix + l;
    }
    if (i === 0) delta0 = next.length - l.length;
    return next;
  });
  const newBlock = out.join('\n');
  const totalDelta = newBlock.length - block.length;
  const newText = text.slice(0, lineStart) + newBlock + text.slice(lineEnd);

  if (selStart === selEnd) {
    const pos = Math.max(lineStart, selStart + delta0);
    return { text: newText, selStart: pos, selEnd: pos };
  }
  return { text: newText, selStart: lineStart, selEnd: lineEnd + totalDelta };
}

export function insertLink(edit: TextEdit): TextEdit {
  const { text, selStart, selEnd } = edit;
  const label = selEnd > selStart ? text.slice(selStart, selEnd) : 'text';
  const inserted = `[${label}](url)`;
  const urlStart = selStart + label.length + 3; // "[" + label + "]("
  return {
    text: text.slice(0, selStart) + inserted + text.slice(selEnd),
    selStart: urlStart,
    selEnd: urlStart + 3,
  };
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './notes/markdownEdit';
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/core exec vitest run src/notes/markdownEdit.test.ts`
Expected: PASS (9 tests). If an offset assertion fails, fix the implementation, not the expected values. The expectations were computed by hand from the strings.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/notes/markdownEdit.ts packages/core/src/notes/markdownEdit.test.ts packages/core/src/index.ts
git commit -m "feat(core): add pure markdown toolbar transforms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: db — links queries and writes

**Files:**
- Create: `packages/db/src/queries/links.ts`
- Create: `packages/db/src/queries/links.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/db/src/queries/links.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  linkNoteToTask,
  unlinkNoteFromTask,
  deleteLinksFor,
  LINKED_TASKS_QUERY,
  LINKED_NOTES_QUERY,
} from './links';

function fakeDb(existing: { id: string } | null = null) {
  return {
    getOptional: vi.fn().mockResolvedValue(existing),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

describe('linkNoteToTask', () => {
  it('inserts a note->task link', async () => {
    const db = fakeDb(null);
    await linkNoteToTask(db as any, 'u1', 'n1', 't1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO links');
    // id, user_id, from_type, from_id, to_type, to_id, origin, created_at
    expect(params.slice(1, 7)).toEqual(['u1', 'note', 'n1', 'task', 't1', 'manual']);
  });

  it('is idempotent: no insert when the link already exists in either direction', async () => {
    const db = fakeDb({ id: 'l1' });
    await linkNoteToTask(db as any, 'u1', 'n1', 't1');
    expect(db.execute).not.toHaveBeenCalled();
    const [sql, params] = db.getOptional.mock.calls[0];
    expect(sql).toContain("from_type = 'note' AND from_id = ? AND to_type = 'task' AND to_id = ?");
    expect(sql).toContain("from_type = 'task' AND from_id = ? AND to_type = 'note' AND to_id = ?");
    expect(params).toEqual(['n1', 't1', 't1', 'n1']);
  });
});

describe('unlinkNoteFromTask', () => {
  it('hard-deletes the link in both directions', async () => {
    const db = fakeDb();
    await unlinkNoteFromTask(db as any, 'n1', 't1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('DELETE FROM links');
    expect(params).toEqual(['n1', 't1', 't1', 'n1']);
  });
});

describe('deleteLinksFor', () => {
  it('removes every link touching the entity', async () => {
    const db = fakeDb();
    await deleteLinksFor(db as any, 'note', 'n1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('DELETE FROM links');
    expect(sql).toContain('(from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?)');
    expect(params).toEqual(['note', 'n1', 'note', 'n1']);
  });
});

describe('linked-item queries', () => {
  it('LINKED_TASKS_QUERY reads both directions and hides deleted tasks', () => {
    expect(LINKED_TASKS_QUERY).toContain("l.from_type = 'note' AND l.from_id = ? AND l.to_type = 'task'");
    expect(LINKED_TASKS_QUERY).toContain("l.to_type = 'note' AND l.to_id = ? AND l.from_type = 'task'");
    expect(LINKED_TASKS_QUERY).toContain('t.deleted_at IS NULL');
  });
  it('LINKED_NOTES_QUERY reads both directions and hides deleted notes', () => {
    expect(LINKED_NOTES_QUERY).toContain("l.from_type = 'task' AND l.from_id = ? AND l.to_type = 'note'");
    expect(LINKED_NOTES_QUERY).toContain("l.to_type = 'task' AND l.to_id = ? AND l.from_type = 'note'");
    expect(LINKED_NOTES_QUERY).toContain('n.deleted_at IS NULL');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/links.test.ts`
Expected: FAIL, cannot resolve `./links`.

- [ ] **Step 3: Implement**

```ts
// packages/db/src/queries/links.ts
// Generic links between entities. v1 stores note->task; reads accept both
// directions so phase 2 can add more types without changing callers.
// Links are HARD-deleted (no deleted_at); see syncTables.ts for why the
// upload connectors need to know that.
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { NoteRecord, TaskRecord } from '../schema';

export type LinkEntityType = 'note' | 'task';

// Anything with execute(): the db itself or a writeTransaction tx.
export type SqlExecutor = { execute: (sql: string, params?: unknown[]) => Promise<unknown> };

const PAIR_WHERE = `(from_type = 'note' AND from_id = ? AND to_type = 'task' AND to_id = ?)
     OR (from_type = 'task' AND from_id = ? AND to_type = 'note' AND to_id = ?)`;

export const LINKED_TASKS_QUERY = `
  SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id
  FROM links l
  JOIN tasks t
    ON (l.from_type = 'note' AND l.from_id = ? AND l.to_type = 'task' AND t.id = l.to_id)
    OR (l.to_type = 'note' AND l.to_id = ? AND l.from_type = 'task' AND t.id = l.from_id)
  WHERE t.deleted_at IS NULL
  ORDER BY (t.status = 'completed'), l.created_at
`;

export const LINKED_NOTES_QUERY = `
  SELECT n.id, n.title, n.body, n.link_title, n.source_url, n.updated_at
  FROM links l
  JOIN notes n
    ON (l.from_type = 'task' AND l.from_id = ? AND l.to_type = 'note' AND n.id = l.to_id)
    OR (l.to_type = 'task' AND l.to_id = ? AND l.from_type = 'note' AND n.id = l.from_id)
  WHERE n.deleted_at IS NULL
  ORDER BY n.updated_at DESC
`;

export type LinkedTaskRow = Pick<TaskRecord, 'title' | 'status' | 'priority' | 'due_date' | 'project_id'> & { id: string };
export type LinkedNoteRow = Pick<NoteRecord, 'title' | 'body' | 'link_title' | 'source_url' | 'updated_at'> & { id: string };

// --- React hooks ---

export function useLinkedTasks(noteId: string) {
  return useQuery<LinkedTaskRow>(LINKED_TASKS_QUERY, [noteId, noteId]);
}

export function useLinkedNotes(taskId: string) {
  return useQuery<LinkedNoteRow>(LINKED_NOTES_QUERY, [taskId, taskId]);
}

// --- Write helpers ---

export async function linkNoteToTask(
  db: AbstractPowerSyncDatabase,
  userId: string,
  noteId: string,
  taskId: string
): Promise<void> {
  const existing = await db.getOptional<{ id: string }>(
    `SELECT id FROM links WHERE ${PAIR_WHERE} LIMIT 1`,
    [noteId, taskId, taskId, noteId]
  );
  if (existing) return;
  await db.execute(
    `INSERT INTO links (id, user_id, from_type, from_id, to_type, to_id, origin, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [crypto.randomUUID(), userId, 'note', noteId, 'task', taskId, 'manual', new Date().toISOString()]
  );
}

export async function unlinkNoteFromTask(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  taskId: string
): Promise<void> {
  await db.execute(`DELETE FROM links WHERE ${PAIR_WHERE}`, [noteId, taskId, taskId, noteId]);
}

export async function deleteLinksFor(db: SqlExecutor, type: LinkEntityType, id: string): Promise<void> {
  await db.execute(
    `DELETE FROM links WHERE (from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?)`,
    [type, id, type, id]
  );
}
```

Add to `packages/db/src/index.ts`:

```ts
export * from './queries/links';
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/links.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/links.ts packages/db/src/queries/links.test.ts packages/db/src/index.ts
git commit -m "feat(db): add note-task link queries and writes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: db — deleteTask removes the task's links

**Files:**
- Modify: `packages/db/src/queries/tasks.ts:502-509`
- Modify: `packages/db/src/queries/tasks.test.ts:234-251`

- [ ] **Step 1: Update the existing test to expect the links delete**

Replace the `describe('deleteTask', …)` block in `packages/db/src/queries/tasks.test.ts` with:

```ts
describe('deleteTask', () => {
  it("soft-deletes the task, cancels its reminder(s) and removes its links", async () => {
    const db = makeMockDb();

    await deleteTask(db, 'task-1');

    expect(db.execute).toHaveBeenCalledTimes(3);
    const [taskSql, taskParams] = db.execute.mock.calls[0];
    expect(taskSql).toContain('UPDATE tasks SET deleted_at = ?');
    expect(taskParams[taskParams.length - 1]).toBe('task-1');

    const [reminderSql, reminderParams] = db.execute.mock.calls[1];
    expect(reminderSql).toContain('UPDATE reminders');
    expect(reminderSql).toContain('deleted_at = ?');
    expect(reminderSql).toContain('task_id = ?');
    expect(reminderParams).toEqual([expect.any(String), expect.any(String), 'task-1']);

    const [linkSql, linkParams] = db.execute.mock.calls[2];
    expect(linkSql).toContain('DELETE FROM links');
    expect(linkParams).toEqual(['task', 'task-1', 'task', 'task-1']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/tasks.test.ts -t deleteTask`
Expected: FAIL, `expected "spy" to be called 3 times, but got 2 times`.

- [ ] **Step 3: Implement**

In `packages/db/src/queries/tasks.ts` add the import next to the reminders import:

```ts
import { deleteLinksFor } from './links';
```

Replace `deleteTask` with:

```ts
export async function deleteTask(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
  await deleteRemindersForTask(db, id);
  await deleteLinksFor(db, 'task', id);
}
```

The spec asks for link removal "in the same transaction". These are sequential local writes that don't fail in normal operation, and they follow the existing `deleteTask` → `deleteRemindersForTask` pattern, so a transaction adds nothing here. A crash between writes leaves an orphan link, which every linked-items query already hides via its `deleted_at IS NULL` join.

- [ ] **Step 4: Run the whole db suite**

Run: `pnpm --filter @todolist/db test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/tasks.ts packages/db/src/queries/tasks.test.ts
git commit -m "feat(db): remove a task's links when it is deleted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: db — notes queries, hooks and writes

**Files:**
- Create: `packages/db/src/queries/notes.ts`
- Create: `packages/db/src/queries/notes.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/db/src/queries/notes.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  buildNotesQuery,
  buildNoteSearchQuery,
  createNote,
  updateNoteBody,
  updateNoteTitle,
  setNoteLabels,
  setNoteProject,
  setNoteArchived,
  setNoteSourceUrl,
  deleteNote,
  createLinkedTask,
  createLinkedNote,
} from './notes';

function fakeDb() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    getOptional: vi.fn().mockResolvedValue(null),
  };
}

describe('buildNotesQuery', () => {
  it('defaults to non-deleted, non-archived, newest first', () => {
    const { sql, params } = buildNotesQuery();
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('is_archived = 0');
    expect(sql).toContain('ORDER BY updated_at DESC');
    expect(params).toEqual([]);
  });
  it('includes archived notes when asked', () => {
    expect(buildNotesQuery({ includeArchived: true }).sql).not.toContain('is_archived = 0');
  });
  it('filters links vs thoughts by source_url', () => {
    expect(buildNotesQuery({ kind: 'links' }).sql).toContain('source_url IS NOT NULL');
    expect(buildNotesQuery({ kind: 'thoughts' }).sql).toContain('source_url IS NULL');
  });
  it('filters by project and label with bound params in order', () => {
    const { sql, params } = buildNotesQuery({ projectId: 'p1', label: 'ideas' });
    expect(sql).toContain('project_id = ?');
    expect(sql).toContain('EXISTS (SELECT 1 FROM json_each(notes.labels) WHERE value = ?)');
    expect(params).toEqual(['p1', 'ideas']);
  });
});

describe('buildNoteSearchQuery', () => {
  it('matches title, body and link_title with escaped LIKE', () => {
    const { sql, params } = buildNoteSearchQuery('50%_off');
    expect(sql).toContain("title LIKE ? ESCAPE '\\'");
    expect(sql).toContain("body LIKE ? ESCAPE '\\'");
    expect(sql).toContain("link_title LIKE ? ESCAPE '\\'");
    expect(params).toEqual(['%50\\%\\_off%', '%50\\%\\_off%', '%50\\%\\_off%']);
  });
  it('excludes archived unless asked', () => {
    expect(buildNoteSearchQuery('x').sql).toContain('is_archived = 0');
    expect(buildNoteSearchQuery('x', { includeArchived: true }).sql).not.toContain('is_archived = 0');
  });
});

describe('createNote', () => {
  it('inserts with revision 0 and no link status for a plain note', async () => {
    const db = fakeDb();
    const id = await createNote(db as any, { userId: 'u1', body: 'hello' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO notes');
    // id, user_id, title, body, project_id, labels, is_archived, is_processed, source_url, link_status, revision, base_revision, created_at, updated_at
    expect(params[0]).toBe(id);
    expect(params.slice(1, 12)).toEqual(['u1', '', 'hello', null, '[]', 0, 0, null, null, 0, 0]);
  });
  it('marks link captures pending', async () => {
    const db = fakeDb();
    await createNote(db as any, { userId: 'u1', sourceUrl: 'https://a.b' });
    const params = db.execute.mock.calls[0][1];
    // params: id, user_id, title, body, project_id, labels, is_archived, is_processed, source_url, link_status, ...
    expect(params[8]).toBe('https://a.b');
    expect(params[9]).toBe('pending');
  });
});

describe('updateNoteBody', () => {
  it('chains the revision in one statement and skips no-op writes', async () => {
    const db = fakeDb();
    await updateNoteBody(db as any, 'n1', 'new text');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('base_revision = revision');
    expect(sql).toContain('revision = revision + 1');
    expect(sql).toContain('body IS NOT ?');
    expect(params).toEqual(['new text', expect.any(String), 'n1', 'new text']);
  });
});

describe('field updates never touch body or revision', () => {
  it.each([
    ['title', (db: any) => updateNoteTitle(db, 'n1', 'T')],
    ['labels', (db: any) => setNoteLabels(db, 'n1', ['a'])],
    ['project', (db: any) => setNoteProject(db, 'n1', 'p1')],
    ['archived', (db: any) => setNoteArchived(db, 'n1', true)],
  ])('%s', async (_name, run) => {
    const db = fakeDb();
    await run(db);
    const [sql] = db.execute.mock.calls[0];
    expect(sql).not.toContain('body');
    expect(sql).not.toContain('revision');
  });
});

describe('setNoteSourceUrl', () => {
  it('sets the URL, marks pending and clears stale preview fields', async () => {
    const db = fakeDb();
    await setNoteSourceUrl(db as any, 'n1', 'https://x.y');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain("link_status = 'pending'");
    expect(sql).toContain('link_title = NULL');
    expect(params[0]).toBe('https://x.y');
  });
});

describe('deleteNote', () => {
  it('soft-deletes the note then removes its links', async () => {
    const db = fakeDb();
    await deleteNote(db as any, 'n1');
    expect(db.execute.mock.calls[0][0]).toContain('UPDATE notes SET deleted_at = ?');
    expect(db.execute.mock.calls[1][0]).toContain('DELETE FROM links');
    expect(db.execute.mock.calls[1][1]).toEqual(['note', 'n1', 'note', 'n1']);
  });
});

describe('createLinkedTask / createLinkedNote', () => {
  it('creates a task and links it to the note', async () => {
    const db = fakeDb();
    const taskId = await createLinkedTask(db as any, { userId: 'u1', noteId: 'n1', title: 'Do it' });
    expect(db.execute.mock.calls[0][0]).toContain('INSERT INTO tasks');
    const [linkSql, linkParams] = db.execute.mock.calls[1];
    expect(linkSql).toContain('INSERT INTO links');
    expect(linkParams.slice(1, 7)).toEqual(['u1', 'note', 'n1', 'task', taskId, 'manual']);
  });
  it('creates a note and links it to the task', async () => {
    const db = fakeDb();
    const noteId = await createLinkedNote(db as any, { userId: 'u1', taskId: 't1', title: 'Ctx' });
    expect(db.execute.mock.calls[0][0]).toContain('INSERT INTO notes');
    expect(db.execute.mock.calls[1][1].slice(1, 7)).toEqual(['u1', 'note', noteId, 'task', 't1', 'manual']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: FAIL, cannot resolve `./notes`.

- [ ] **Step 3: Implement**

```ts
// packages/db/src/queries/notes.ts
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { NoteRecord } from '../schema';
import { createTask } from './tasks';
import { deleteLinksFor, linkNoteToTask } from './links';

// Existing repo convention: sync rules ship soft-deleted rows, so reads filter
// deleted_at IS NULL (same as every tasks query).

export type NoteKind = 'all' | 'links' | 'thoughts';

export interface NotesFilter {
  kind?: NoteKind;
  projectId?: string | null;
  label?: string | null;
  includeArchived?: boolean;
}

export const NOTE_LIST_COLUMNS = `id, title, body, project_id, labels, is_archived, source_url,
  link_title, link_excerpt, link_image_url, link_site_name, link_status, conflict_of, updated_at`;

export type NoteListRow = Pick<
  NoteRecord,
  | 'title' | 'body' | 'project_id' | 'labels' | 'is_archived' | 'source_url'
  | 'link_title' | 'link_excerpt' | 'link_image_url' | 'link_site_name' | 'link_status'
  | 'conflict_of' | 'updated_at'
> & { id: string };

export function buildNotesQuery(filter: NotesFilter = {}): { sql: string; params: string[] } {
  const where = ['deleted_at IS NULL'];
  const params: string[] = [];
  if (!filter.includeArchived) where.push('is_archived = 0');
  if (filter.kind === 'links') where.push('source_url IS NOT NULL');
  if (filter.kind === 'thoughts') where.push('source_url IS NULL');
  if (filter.projectId) {
    where.push('project_id = ?');
    params.push(filter.projectId);
  }
  if (filter.label) {
    where.push('EXISTS (SELECT 1 FROM json_each(notes.labels) WHERE value = ?)');
    params.push(filter.label);
  }
  return {
    sql: `SELECT ${NOTE_LIST_COLUMNS} FROM notes WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`,
    params,
  };
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => '\\' + c);
}

// v1 search: LIKE over local SQLite (ASCII case-insensitive). Swap the body of
// this function for FTS5 later; callers don't change.
export function buildNoteSearchQuery(
  term: string,
  opts: { includeArchived?: boolean } = {}
): { sql: string; params: string[] } {
  const p = `%${escapeLike(term.trim())}%`;
  const archived = opts.includeArchived ? '' : 'AND is_archived = 0';
  return {
    sql: `SELECT ${NOTE_LIST_COLUMNS} FROM notes
          WHERE deleted_at IS NULL ${archived}
            AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR link_title LIKE ? ESCAPE '\\')
          ORDER BY updated_at DESC
          LIMIT 100`,
    params: [p, p, p],
  };
}

// --- React hooks ---

export function useNotes(filter: NotesFilter = {}) {
  const key = JSON.stringify(filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { sql, params } = useMemo(() => buildNotesQuery(filter), [key]);
  return useQuery<NoteListRow>(sql, params);
}

export function useNoteSearch(term: string, opts: { includeArchived?: boolean } = {}) {
  const { sql, params } = useMemo(
    () => buildNoteSearchQuery(term, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [term, opts.includeArchived]
  );
  // An empty term matches everything; callers should only render results for non-empty terms.
  return useQuery<NoteListRow>(sql, params);
}

export function useNote(id: string) {
  return useQuery<NoteRecord & { id: string }>(
    `SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
}

// --- Write helpers ---

export async function createNote(
  db: AbstractPowerSyncDatabase,
  fields: {
    userId: string;
    title?: string;
    body?: string;
    projectId?: string | null;
    labels?: string[];
    sourceUrl?: string | null;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceUrl = fields.sourceUrl ?? null;
  await db.execute(
    `INSERT INTO notes
       (id, user_id, title, body, project_id, labels, is_archived, is_processed, source_url, link_status,
        revision, base_revision, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      fields.userId,
      fields.title ?? '',
      fields.body ?? '',
      fields.projectId ?? null,
      JSON.stringify(fields.labels ?? []),
      0,
      0,  // is_processed: false
      sourceUrl,
      sourceUrl ? 'pending' : null,
      0,
      0,
      now,
      now,
    ]
  );
  return id;
}

// Body edits chain the revision (SQLite evaluates every SET expression against
// the OLD row): base_revision = old revision, revision = old + 1. The server
// trigger accepts the edit only if base_revision matches its current revision.
export async function updateNoteBody(db: AbstractPowerSyncDatabase, id: string, body: string): Promise<void> {
  await db.execute(
    `UPDATE notes
        SET body = ?, base_revision = revision, revision = revision + 1, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL AND body IS NOT ?`,
    [body, new Date().toISOString(), id, body]
  );
}

export async function updateNoteTitle(db: AbstractPowerSyncDatabase, id: string, title: string): Promise<void> {
  await db.execute(
    `UPDATE notes SET title = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [title, new Date().toISOString(), id]
  );
}

export async function setNoteLabels(db: AbstractPowerSyncDatabase, id: string, labels: string[]): Promise<void> {
  await db.execute(
    `UPDATE notes SET labels = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [JSON.stringify(labels), new Date().toISOString(), id]
  );
}

export async function setNoteProject(db: AbstractPowerSyncDatabase, id: string, projectId: string | null): Promise<void> {
  await db.execute(
    `UPDATE notes SET project_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [projectId, new Date().toISOString(), id]
  );
}

export async function setNoteArchived(db: AbstractPowerSyncDatabase, id: string, archived: boolean): Promise<void> {
  await db.execute(
    `UPDATE notes SET is_archived = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [archived ? 1 : 0, new Date().toISOString(), id]
  );
}

export async function setNoteSourceUrl(db: AbstractPowerSyncDatabase, id: string, url: string): Promise<void> {
  await db.execute(
    `UPDATE notes
        SET source_url = ?, link_status = 'pending',
            link_title = NULL, link_excerpt = NULL, link_image_url = NULL, link_site_name = NULL,
            updated_at = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [url, new Date().toISOString(), id]
  );
}

export async function deleteNote(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(`UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
  await deleteLinksFor(db, 'note', id);
}

export async function createLinkedTask(
  db: AbstractPowerSyncDatabase,
  fields: { userId: string; noteId: string; title: string; projectId?: string | null }
): Promise<string> {
  const taskId = await createTask(db, {
    userId: fields.userId,
    title: fields.title,
    projectId: fields.projectId ?? null,
  });
  await linkNoteToTask(db, fields.userId, fields.noteId, taskId);
  return taskId;
}

export async function createLinkedNote(
  db: AbstractPowerSyncDatabase,
  fields: { userId: string; taskId: string; title?: string; projectId?: string | null }
): Promise<string> {
  const noteId = await createNote(db, {
    userId: fields.userId,
    title: fields.title ?? '',
    projectId: fields.projectId ?? null,
  });
  await linkNoteToTask(db, fields.userId, noteId, fields.taskId);
  return noteId;
}
```

Add to `packages/db/src/index.ts`:

```ts
export * from './queries/notes';
```

Note on the `createLinkedTask` test: the fake `getOptional` returns `null`, so `linkNoteToTask` inserts. Call 0 is the task insert and call 1 is the link insert.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck + full db suite**

Run: `pnpm --filter @todolist/db typecheck && pnpm --filter @todolist/db test`
Expected: pass. If lint flags the `eslint-disable` comments' rule name as unknown (the db package may not load the react-hooks plugin), delete those two comment lines.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/notes.ts packages/db/src/queries/notes.test.ts packages/db/src/index.ts
git commit -m "feat(db): add notes list, search, hooks and write helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: db — pending link enricher

**Files:**
- Create: `packages/db/src/queries/noteEnricher.ts`
- Create: `packages/db/src/queries/noteEnricher.test.ts`
- Modify: `packages/db/src/index.ts`

`packages/db` has no Supabase client dependency, so the caller injects the function invoker. Apps wire `invoke = (noteId, url) => supabase.functions.invoke('enrich-url', { body: { noteId, url } })` and call `runPendingEnrichment` on start and on reconnect (Plans 2 and 3).

- [ ] **Step 1: Write the failing tests**

```ts
// packages/db/src/queries/noteEnricher.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runPendingEnrichment, MAX_ENRICH_ATTEMPTS, PENDING_ENRICH_QUERY } from './noteEnricher';

function fakeDb(rows: { id: string; source_url: string }[]) {
  return {
    getAll: vi.fn().mockResolvedValue(rows),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

describe('runPendingEnrichment', () => {
  it('queries only pending, live notes with a URL', () => {
    expect(PENDING_ENRICH_QUERY).toContain("link_status = 'pending'");
    expect(PENDING_ENRICH_QUERY).toContain('source_url IS NOT NULL');
    expect(PENDING_ENRICH_QUERY).toContain('deleted_at IS NULL');
  });

  it('invokes enrichment for each pending note and counts the attempt', async () => {
    const db = fakeDb([{ id: 'n1', source_url: 'https://a' }, { id: 'n2', source_url: 'https://b' }]);
    const invoke = vi.fn().mockResolvedValue(undefined);
    const attempts = new Map<string, number>();
    await runPendingEnrichment(db as any, invoke, attempts);
    expect(invoke).toHaveBeenCalledWith('n1', 'https://a');
    expect(invoke).toHaveBeenCalledWith('n2', 'https://b');
    expect(attempts.get('n1')).toBe(1);
  });

  it('swallows invoke errors so one bad URL does not stop the rest', async () => {
    const db = fakeDb([{ id: 'n1', source_url: 'https://a' }, { id: 'n2', source_url: 'https://b' }]);
    const invoke = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    await runPendingEnrichment(db as any, invoke, new Map());
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('marks a note failed after MAX_ENRICH_ATTEMPTS and stops invoking', async () => {
    const db = fakeDb([{ id: 'n1', source_url: 'https://a' }]);
    const invoke = vi.fn().mockResolvedValue(undefined);
    const attempts = new Map([['n1', MAX_ENRICH_ATTEMPTS]]);
    await runPendingEnrichment(db as any, invoke, attempts);
    expect(invoke).not.toHaveBeenCalled();
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain("SET link_status = 'failed'");
    expect(sql).toContain("link_status = 'pending'");
    expect(params[1]).toBe('n1');
    expect(attempts.has('n1')).toBe(false);
  });

  it('gives up after exactly 3 runs', async () => {
    expect(MAX_ENRICH_ATTEMPTS).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/noteEnricher.test.ts`
Expected: FAIL, cannot resolve `./noteEnricher`.

- [ ] **Step 3: Implement**

```ts
// packages/db/src/queries/noteEnricher.ts
// Retries link previews that never ran (e.g. captured offline, so the
// fire-and-forget enrich-url call failed). The edge function sets 'ok' or
// 'failed' itself; a note still 'pending' means the function never completed.
// Attempt counts live in memory, owned by the caller (one Map per app session):
// they are device-local and deliberately not synced.
import type { AbstractPowerSyncDatabase } from '@powersync/common';

export const MAX_ENRICH_ATTEMPTS = 3;

export const PENDING_ENRICH_QUERY = `
  SELECT id, source_url FROM notes
  WHERE link_status = 'pending' AND source_url IS NOT NULL AND deleted_at IS NULL
`;

export type EnrichInvoker = (noteId: string, url: string) => Promise<unknown>;

export async function runPendingEnrichment(
  db: AbstractPowerSyncDatabase,
  invoke: EnrichInvoker,
  attempts: Map<string, number>
): Promise<void> {
  const rows = await db.getAll<{ id: string; source_url: string }>(PENDING_ENRICH_QUERY);
  for (const row of rows) {
    const n = attempts.get(row.id) ?? 0;
    if (n >= MAX_ENRICH_ATTEMPTS) {
      await db.execute(
        `UPDATE notes SET link_status = 'failed', updated_at = ? WHERE id = ? AND link_status = 'pending'`,
        [new Date().toISOString(), row.id]
      );
      attempts.delete(row.id);
      continue;
    }
    attempts.set(row.id, n + 1);
    try {
      await invoke(row.id, row.source_url);
    } catch (err) {
      console.warn('enrich-url retry failed for note', row.id, err);
    }
  }
}
```

Add to `packages/db/src/index.ts`:

```ts
export * from './queries/noteEnricher';
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/noteEnricher.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/noteEnricher.ts packages/db/src/queries/noteEnricher.test.ts packages/db/src/index.ts
git commit -m "feat(db): retry pending link previews with bounded attempts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: enrich-url — SSRF guard (pure)

**Files:**
- Create: `supabase/functions/enrich-url/urlGuard.ts`
- Create: `supabase/functions/enrich-url/urlGuard.test.ts`

Deno isn't installed locally, so these modules are pure TS with no Deno APIs and are tested with the db package's Vitest binary in globals mode. Tests don't import from `vitest`. Run command (used below):

```bash
pnpm --filter @todolist/db exec vitest run --globals --root ../../supabase/functions/enrich-url
```

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/enrich-url/urlGuard.test.ts
// Runs under Vitest globals (describe/it/expect); no imports so Deno never resolves 'vitest'.
import { isBlockedIp, isBlockedHostname, checkUrl } from './urlGuard.ts';

describe('isBlockedIp', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
  ])('blocks %s', (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700::1111'])('allows %s', (ip) =>
    expect(isBlockedIp(ip)).toBe(false)
  );
});

describe('isBlockedHostname', () => {
  it.each(['localhost', 'foo.localhost', 'printer.local', 'metadata.google.internal', '[::1]', '127.0.0.1'])(
    'blocks %s',
    (h) => expect(isBlockedHostname(h)).toBe(true)
  );
  it('allows public names', () => expect(isBlockedHostname('example.com')).toBe(false));
});

describe('checkUrl', () => {
  const publicDns = async () => ['93.184.216.34'];
  const privateDns = async () => ['10.0.0.5'];
  const noDns = async () => [] as string[];

  it('accepts a public https URL', async () => {
    expect((await checkUrl('https://example.com/a', publicDns))?.href).toBe('https://example.com/a');
  });
  it('rejects non-http schemes', async () => {
    expect(await checkUrl('file:///etc/passwd', publicDns)).toBeNull();
    expect(await checkUrl('gopher://x', publicDns)).toBeNull();
  });
  it('rejects garbage', async () => {
    expect(await checkUrl('not a url', publicDns)).toBeNull();
  });
  it('rejects blocked literal hosts without resolving', async () => {
    expect(await checkUrl('http://169.254.169.254/latest', publicDns)).toBeNull();
  });
  it('rejects names that resolve to private addresses', async () => {
    expect(await checkUrl('https://evil.example', privateDns)).toBeNull();
  });
  it('falls back to literal checks when DNS returns nothing', async () => {
    expect(await checkUrl('https://example.com', noDns)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run --globals --root ../../supabase/functions/enrich-url urlGuard`
Expected: FAIL, cannot resolve `./urlGuard.ts`.

- [ ] **Step 3: Implement**

```ts
// supabase/functions/enrich-url/urlGuard.ts
// SSRF guard for user-supplied URLs. Pure TS: no Deno APIs. DNS resolution is
// injected so this is testable under Node. Does not defend against DNS
// rebinding between check and fetch; acceptable for a personal app whose
// callers are authenticated users fetching their own links.

export type Resolver = (hostname: string) => Promise<string[]>;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function inV4Range(ip: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base)!;
  const size = 2 ** (32 - bits);
  return ip >= b && ip < b + size;
}

export function isBlockedIp(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, '').toLowerCase();
  const v4 = ipv4ToInt(ip);
  if (v4 !== null) return V4_BLOCKED.some(([base, bits]) => inV4Range(v4, base, bits));

  if (!ip.includes(':')) return false;
  if (ip === '::' || ip === '::1') return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIp(mapped[1]);
  const first = ip.split(':')[0];
  if (/^f[cd]/.test(first)) return true;        // fc00::/7 unique local
  if (/^fe[89ab]/.test(first)) return true;     // fe80::/10 link-local
  if (/^ff/.test(first)) return true;           // multicast
  return false;
}

export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  return isBlockedIp(h);
}

export async function checkUrl(raw: string, resolve: Resolver): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (isBlockedHostname(url.hostname)) return null;
  const addrs = await resolve(url.hostname.replace(/^\[|\]$/g, '')).catch(() => [] as string[]);
  if (addrs.some(isBlockedIp)) return null;
  return url;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run --globals --root ../../supabase/functions/enrich-url urlGuard`
Expected: PASS (34 tests). Vite resolves the Deno-style `./urlGuard.ts` import as-is; don't change it.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/enrich-url/urlGuard.ts supabase/functions/enrich-url/urlGuard.test.ts
git commit -m "feat(enrich-url): add SSRF guard for user-supplied URLs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: enrich-url — meta extraction (pure)

**Files:**
- Create: `supabase/functions/enrich-url/meta.ts`
- Create: `supabase/functions/enrich-url/meta.test.ts`

Moves `decodeEntities`, `extractTitle`, `extractDescription` out of `index.ts` unchanged in behavior, and adds `extractImage` and `extractSiteName`.

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/enrich-url/meta.test.ts
import { extractTitle, extractDescription, extractImage, extractSiteName } from './meta.ts';

const page = `<html><head>
  <title>Fallback &amp; Title</title>
  <meta property="og:title" content="OG Title">
  <meta content="OG desc" property="og:description">
  <meta property="og:image" content="/img/cover.png">
  <meta property="og:site_name" content="Example Blog">
</head></html>`;

describe('meta extraction', () => {
  it('prefers og:title and decodes entities in <title> fallback', () => {
    expect(extractTitle(page)).toBe('OG Title');
    expect(extractTitle('<title> A &amp; B </title>')).toBe('A & B');
  });
  it('reads og:description in either attribute order, then meta description', () => {
    expect(extractDescription(page)).toBe('OG desc');
    expect(extractDescription('<meta name="description" content="Plain">')).toBe('Plain');
  });
  it('absolutizes a relative og:image against the page URL', () => {
    expect(extractImage(page, 'https://example.com/post/1')).toBe('https://example.com/img/cover.png');
  });
  it('rejects non-http og:image values', () => {
    expect(extractImage('<meta property="og:image" content="javascript:x">', 'https://e.com')).toBeNull();
  });
  it('uses og:site_name, else the hostname without www', () => {
    expect(extractSiteName(page, 'https://example.com')).toBe('Example Blog');
    expect(extractSiteName('<html></html>', 'https://www.news.example.org/a')).toBe('news.example.org');
  });
  it('returns nulls for empty documents', () => {
    expect(extractTitle('')).toBeNull();
    expect(extractDescription('')).toBeNull();
    expect(extractImage('', 'https://e.com')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run --globals --root ../../supabase/functions/enrich-url meta`
Expected: FAIL, cannot resolve `./meta.ts`.

- [ ] **Step 3: Implement**

```ts
// supabase/functions/enrich-url/meta.ts
// Pure HTML <head> metadata extraction. No Deno APIs.

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}

function clean(raw: string | undefined): string | null {
  if (!raw) return null;
  const c = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  return c || null;
}

// <meta {attr}="{name}" content="..."> in either attribute order.
function metaContent(html: string, attr: 'property' | 'name', name: string): string | undefined {
  const a = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["']`, 'i');
  return html.match(a)?.[1] ?? html.match(b)?.[1];
}

export function extractTitle(html: string): string | null {
  const raw = metaContent(html, 'property', 'og:title') ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return clean(raw);
}

export function extractDescription(html: string): string | null {
  return clean(metaContent(html, 'property', 'og:description') ?? metaContent(html, 'name', 'description'));
}

export function extractImage(html: string, pageUrl: string): string | null {
  const raw = clean(metaContent(html, 'property', 'og:image'));
  if (!raw) return null;
  try {
    const u = new URL(raw, pageUrl);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function extractSiteName(html: string, pageUrl: string): string | null {
  const og = clean(metaContent(html, 'property', 'og:site_name'));
  if (og) return og;
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run --globals --root ../../supabase/functions/enrich-url meta`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/enrich-url/meta.ts supabase/functions/enrich-url/meta.test.ts
git commit -m "feat(enrich-url): extract page metadata helpers incl. image and site name

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: enrich-url — guarded fetch + `noteId` branch

**Files:**
- Modify (replace whole file): `supabase/functions/enrich-url/index.ts`

- [ ] **Step 1: Replace `index.ts`**

The task branch's behavior is unchanged (`Read: ` title, description backfill only when empty, `no-title` result). The new parts are the SSRF guard on every redirect hop and the `noteId` branch.

```ts
// Supabase Edge Function: enrich-url
//
// Body: { taskId, url } or { noteId, url }.
//
// taskId: fetches the page, sets the task title to "Read: <title>" and
//   backfills description only if empty (never clobbers user text).
// noteId: fetches the page and writes ONLY link_title / link_excerpt /
//   link_image_url / link_site_name / link_status. Never title or body, so it
//   can never trip the notes conflict-copy trigger.
//
// Auth: uses the caller's JWT so every UPDATE is constrained by RLS.
// SSRF: every hop (including redirects) passes urlGuard.checkUrl.
// The row may not have replicated from the device yet: retry until it appears.
//
// Deploy: supabase functions deploy enrich-url

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkUrl, type Resolver } from './urlGuard.ts';
import { extractTitle, extractDescription, extractImage, extractSiteName } from './meta.ts';

const TITLE_PREFIX = 'Read: ';
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const MAX_LINK_FIELD = 500;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 256 * 1024;
const MAX_REDIRECTS = 4;
const UPDATE_ATTEMPTS = 6;
const UPDATE_RETRY_MS = 1500;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Deno.resolveDns may be unavailable in some runtimes; checkUrl then falls back
// to literal host checks only.
const resolveDns: Resolver = async (host) => {
  try {
    const a = await Deno.resolveDns(host, 'A').catch(() => [] as string[]);
    const aaaa = await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]);
    return [...a, ...aaaa];
  } catch {
    return [];
  }
};

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  await reader.cancel().catch(() => {});
  const size = Math.min(total, maxBytes);
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    if (off >= size) break;
    const slice = c.subarray(0, size - off);
    out.set(slice, off);
    off += slice.length;
  }
  return new TextDecoder('utf-8').decode(out);
}

type PageMeta = {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const EMPTY: PageMeta = { title: null, description: null, image: null, siteName: null };

// Follows redirects manually so each hop is re-checked against the SSRF guard.
async function fetchPageMeta(startUrl: URL): Promise<PageMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current.href, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TodoListBot/1.0; +https://todolist.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        await res.body?.cancel().catch(() => {});
        if (!loc) return EMPTY;
        const next = await checkUrl(new URL(loc, current).href, resolveDns);
        if (!next) return EMPTY;
        current = next;
        continue;
      }
      if (!res.ok) return EMPTY;
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return EMPTY;
      const html = await readCapped(res, MAX_HTML_BYTES);
      return {
        title: extractTitle(html),
        description: extractDescription(html),
        image: extractImage(html, current.href),
        siteName: extractSiteName(html, current.href),
      };
    }
    return EMPTY;
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}

type Supa = ReturnType<typeof createClient>;

// Retry until the locally-created row has replicated to Postgres.
async function waitForRow(supabase: Supa, table: 'tasks' | 'notes', id: string, columns: string) {
  for (let attempt = 0; attempt < UPDATE_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.from(table).select(columns).eq('id', id).maybeSingle();
    if (error) return { error };
    if (data) return { data };
    if (attempt < UPDATE_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, UPDATE_RETRY_MS));
  }
  return { data: null };
}

async function enrichTask(supabase: Supa, taskId: string, url: URL): Promise<Response> {
  const meta = await fetchPageMeta(url);
  if (!meta.title) return json({ ok: false, reason: 'no-title' });

  const newTitle = (TITLE_PREFIX + meta.title).slice(0, MAX_TITLE);
  const newDescription = meta.description ? meta.description.slice(0, MAX_DESCRIPTION) : null;

  const found = await waitForRow(supabase, 'tasks', taskId, 'id, description');
  if ('error' in found && found.error) return json({ error: found.error.message }, 500);
  const existing = found.data as { id: string; description: string | null } | null;
  if (!existing) return json({ ok: false, reason: 'task-not-found' });

  const update: { title: string; updated_at: string; description?: string } = {
    title: newTitle,
    updated_at: new Date().toISOString(),
  };
  if (newDescription && !existing.description) update.description = newDescription;

  const { error } = await supabase.from('tasks').update(update).eq('id', taskId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, title: newTitle, description: update.description ?? null });
}

async function enrichNote(supabase: Supa, noteId: string, url: URL | null): Promise<Response> {
  const meta = url ? await fetchPageMeta(url) : EMPTY;
  const ok = Boolean(meta.title || meta.description);
  const update = {
    link_title: meta.title?.slice(0, MAX_LINK_FIELD) ?? null,
    link_excerpt: meta.description?.slice(0, MAX_DESCRIPTION) ?? null,
    link_image_url: meta.image?.slice(0, 2000) ?? null,
    link_site_name: meta.siteName?.slice(0, MAX_LINK_FIELD) ?? null,
    link_status: ok ? 'ok' : 'failed',
  };

  const found = await waitForRow(supabase, 'notes', noteId, 'id');
  if ('error' in found && found.error) return json({ error: found.error.message }, 500);
  if (!found.data) return json({ ok: false, reason: 'note-not-found' });

  const { error } = await supabase.from('notes').update(update).eq('id', noteId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok, link_status: update.link_status });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  let body: { taskId?: unknown; noteId?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { taskId, noteId, url } = body;
  if (typeof url !== 'string' || (typeof taskId !== 'string' && typeof noteId !== 'string')) {
    return json({ error: 'url and one of taskId / noteId are required' }, 400);
  }

  const safeUrl = await checkUrl(url, resolveDns);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  if (typeof noteId === 'string') {
    // A blocked/invalid URL still resolves the note to 'failed' so the client stops retrying.
    return enrichNote(supabase, noteId, safeUrl);
  }

  if (!safeUrl) return json({ error: 'Blocked or invalid URL' }, 400);
  return enrichTask(supabase, taskId as string, safeUrl);
});
```

- [ ] **Step 2: Re-run the pure-module tests (index.ts must not have broken their imports)**

Run: `pnpm --filter @todolist/db exec vitest run --globals --root ../../supabase/functions/enrich-url`
Expected: PASS (urlGuard + meta).

- [ ] **Step 3: Deploy and smoke-test against LIVE**

```bash
supabase functions deploy enrich-url
```

Expected: `Deployed Function enrich-url`. Deploy bundles and type-checks with Deno, so a type error in `index.ts` shows up here; fix and redeploy.

Smoke test (needs a signed-in user's access token; ask the user for one, e.g. copied from the web app's devtools `sb-*-auth-token` local storage `access_token`):

```bash
set -a; . apps/web/.env.local; set +a
TOKEN='<user access token>'
# 1) Create a note row directly (owner-scoped by RLS + enforce_user_id).
NOTE_ID=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/notes" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"title":"enrich smoke test","source_url":"https://example.com","link_status":"pending"}' | jq -r '.[0].id')
# 2) Enrich it.
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/enrich-url" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"noteId\":\"$NOTE_ID\",\"url\":\"https://example.com\"}"
# 3) Blocked URL resolves to failed.
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/functions/v1/enrich-url" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"noteId\":\"$NOTE_ID\",\"url\":\"http://169.254.169.254/\"}"
# 4) Inspect, then clean up.
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/notes?id=eq.$NOTE_ID&select=link_status,link_title,link_site_name,body,revision" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/notes?id=eq.$NOTE_ID" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
```

Expected: call 2 returns `{"ok":true,"link_status":"ok"}`; call 3 returns `{"ok":false,"link_status":"failed"}`; the inspect after call 3 shows `link_status: failed`, `body: ""`, `revision: 0` (body untouched, no conflict copy).

Regression check for the task path: share a URL from the mobile app as a task (existing flow) and confirm the title becomes `Read: …`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/enrich-url/index.ts
git commit -m "feat(enrich-url): add notes branch and SSRF-guarded redirect handling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Full verification

**Files:** none

- [ ] **Step 1: Run everything**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/notes_test.sql
pnpm --filter @todolist/db exec vitest run --globals --root ../../supabase/functions/enrich-url
pnpm lint
pnpm typecheck
pnpm test
pnpm build
npm run check-versions
```

Expected: `ALL NOTES TESTS PASSED`; every command exits 0. Paste the tail of each output into the hand-off message. Don't summarize a failure as a pass.

- [ ] **Step 2: Confirm the user deployed the sync rules (Task 4 Step 5)**

If not confirmed, the hand-off must say so prominently: Plan 2 cannot be verified end-to-end without it.

- [ ] **Step 3: Stop the local stack**

```bash
supabase stop
```

---

## Spec coverage (self-review)

| Spec item | Task |
|---|---|
| `notes` table, all columns incl. `conflict_of` | 3, 6 |
| Conflict-copy trigger (accept / stale / deleted) | 2, 3 |
| Non-body LWW | 2 (T4), 11 |
| `links` table, unique, hard delete | 2, 3, 5, 9 |
| RLS + `enforce_user_id` on both tables | 2 (T9, T10), 3 |
| Sync rules for both tables | 4 |
| Live apply + verification | 4 |
| Client schema | 6 |
| Revision chaining on device | 11 (`updateNoteBody`), 2 (T2) |
| Notes list filters (kind/project/label/archived) | 11 |
| LIKE search behind one query function | 11 |
| Note↔task link/unlink/list both directions; create linked task/note | 9, 11 |
| Links removed on note/task delete | 10, 11 |
| Selection → task title cleanup; title fallback; excerpt | 7 |
| Toolbar transforms | 8 |
| Paste-URL detection | 7 (`extractSoleUrl`), 11 (`setNoteSourceUrl`) |
| enrich-url notes branch (never title/body), og:image, site_name | 14, 15 |
| SSRF hardening incl. redirects | 13, 15 |
| Pending-enricher, 3 attempts | 12 |
| Upload connector must not wedge the queue | 5 |
| UI, share toggle, enricher wiring, Playwright E2E, device test | Plans 2 & 3 |

Deviation from spec: link removal on delete is sequential local writes rather than one transaction (see Task 10 Step 3 for why).
