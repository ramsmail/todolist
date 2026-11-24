# Notes Core (Second Brain, Phase 1) — Design

**Date:** 2026-11-25
**Status:** Approved in brainstorming, pending spec review
**Scope:** Web + mobile

## Context and goal

Extend the TodoList app toward a "second brain": a place to capture what you read
(links, articles) and what you think (ideas, meeting notes), connected to the tasks
you act on. This spec covers only the first sub-project, **Notes Core**.

### Second-brain roadmap (each is its own spec → plan → build cycle)

1. **Notes Core** (this spec): notes, link capture + previews, note↔task links, search.
2. **Links:** `[[note]]` links between notes, backlinks.
3. **Review loop:** unprocessed-capture inbox, weekly review, daily check-in hook.
4. **People (light CRM):** person entity, `@mentions`, per-person timeline.
5. **Later/optional:** reader mode + highlights, AI summarise, semantic "related notes".

### Decisions made during brainstorming

| Question | Decision |
|---|---|
| What to capture | Both reading pile (links) and own thinking; project context and people later |
| Platforms | Full reading **and editing** on both web and mobile |
| Link capture | Link preview (title, excerpt, image, site) now; full reader mode later |
| Organization | Reuse existing structure: optional project + labels + archived flag. No new Areas/PARA tree |
| Note↔task | Bidirectional linking in v1, via a generic `links` table reused by phase 2 |
| Body storage / conflicts | Single markdown body column; server-side conflict copy on concurrent edits |
| Editor | Plain markdown with Edit/Preview toggle and a formatting toolbar on both platforms |

### Explicitly out of scope for v1

`[[note]]` links and backlinks, people/`@mentions`, review inbox/check-in hook, reader
mode/highlights, AI features, WYSIWYG editing, FTS5 ranking, Areas.

## 1. Data model

All three representations change together, in this order and in the same commit:
`supabase/migrations/` → `powersync/sync-rules.yaml` → `packages/db`.

### `notes`

| column | type | notes |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `user_id` | `uuid not null → auth.users on delete cascade` | |
| `title` | `text not null default ''` | blank allowed; UI falls back to the body's first non-empty line |
| `body` | `text not null default ''` | markdown |
| `project_id` | `uuid null → projects on delete set null` | no project = "resource" |
| `labels` | `jsonb not null default '[]'` | same shape as `tasks.labels`; GIN index |
| `is_archived` | `boolean not null default false` | |
| `is_processed` | `boolean not null default false` | for capture-inbox review; false = unprocessed, true = reviewed |
| `source_url` | `text null` | set for link captures |
| `link_title`, `link_excerpt`, `link_image_url`, `link_site_name` | `text null` | written only by `enrich-url` |
| `link_status` | `text null check (link_status in ('pending','ok','failed'))` | |
| `revision` | `int not null default 0` | |
| `base_revision` | `int not null default 0` | |
| `conflict_of` | `uuid null → notes on delete set null` | set on conflict copies |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | standard conventions (`updated_at` trigger, soft delete) |

Indexes: `(user_id, updated_at desc)`, GIN on `labels`, `(project_id)`.

### Revision protocol and conflict trigger

**Client:** every local write that changes `body` sets
`base_revision = revision, revision = revision + 1` in the same statement. Queued
offline edits therefore chain (5→6, 6→7, …). Writes that do not change `body` leave
both columns untouched.

**Server:** `BEFORE UPDATE` trigger on `notes`, acting only when
`NEW.body IS DISTINCT FROM OLD.body`:

- `NEW.base_revision = OLD.revision` → accept (the incoming `revision` stands).
- Otherwise → **conflict**:
  1. Insert a new note: incoming `body`, same `user_id`/`project_id`/`labels`,
     `title = coalesce(nullif(NEW.title,''), 'Untitled') || ' (conflict, <timestamp>)'`,
     `conflict_of = OLD.id`, `revision = 0`, `base_revision = 0`.
  2. Set `NEW.body = OLD.body`, `NEW.revision = OLD.revision`, `NEW.base_revision = OLD.base_revision`.
- If `OLD.deleted_at IS NOT NULL` and the body changed → conflict copy as above; the
  delete stands.

Non-body fields (title, labels, project, archived, link_*) are last-write-wins, as
tasks are today. Server writes from `enrich-url` never touch `body`, so they never
trigger conflicts.

### `links`

| column | type |
|---|---|
| `id` | `uuid pk` |
| `user_id` | `uuid not null → auth.users on delete cascade` |
| `from_type`, `to_type` | `text not null check (… in ('note','task','person','project'))` |
| `from_id`, `to_id` | `uuid not null` |
| `origin` | `text not null default 'manual' check (origin in ('manual','wikilink'))` | phase 2 sets `'wikilink'` for `[[links]]`; never auto-deletes `'manual'` links |
| `created_at` | `timestamptz not null default now()` |

- Unique `(user_id, from_type, from_id, to_type, to_id)`.
- **Hard delete** (no `deleted_at`): links have no content worth keeping, and soft
  delete would collide with the unique constraint when re-linking.
- v1 stores note→task only; queries read both directions so phase 2 can add
  note→note and future entity types (person, project) without migration.
- `origin = 'manual'` protects hand-made links: phase 2 `[[wikilink]]` sync must
  only create/delete `wikilink`-origin rows and never touch `manual` ones.
- Polymorphic ids have no FKs. Acceptable because all reads are `user_id`-scoped: a
  link to a foreign id resolves to nothing. The client deletes a note's or task's
  links in the same local transaction as the soft delete.

### Security surfaces

- **RLS** on `notes` and `links`: select/insert/update/delete where
  `user_id = auth.uid()` (mirror existing policies).
- **Sync rules** (`user_data` stream):
  `SELECT * FROM notes WHERE user_id = auth.user_id()` and
  `SELECT * FROM links WHERE user_id = auth.user_id()`.
- **`packages/db`:** `notes` and `links` tables in `AppSchema`; query modules.
- Migration is applied to the live DB and columns verified **before** UI work.

## 2. Capture and link previews

### Capture surfaces

- **Mobile share sheet** (`apps/mobile/src/app/share.tsx`): add a **Note | Task**
  toggle. Shared URLs and shared text default to Note; last choice is remembered.
  Existing task path unchanged.
- **Mobile:** new **Notes** tab; "+" opens the editor with the cursor in the body.
- **Web:** **Notes** sidebar entry, "New note" button, keyboard shortcut `n`
  (verify it is free in the existing tinykeys map; pick another if not).
- Pasting a URL into an empty note body on either platform sets `source_url`,
  `link_status = 'pending'`, and starts enrichment.

### Preview pipeline

1. Client writes the note locally via PowerSync with `source_url` and
   `link_status = 'pending'`.
2. Client invokes `enrich-url` with `{ noteId, url }` (fire-and-forget).
3. `enrich-url` gains a `noteId` branch beside `taskId`, sharing fetch/parse code. It
   additionally extracts `og:image` and `og:site_name`, writes `link_title`,
   `link_excerpt`, `link_image_url`, `link_site_name`, and `link_status`
   (`ok`/`failed`). It **never** writes `title` or `body`. Uses the caller's JWT
   (RLS-constrained) and the existing retry-until-replicated loop.
4. The update replicates to all devices.

**Pending-enricher** (`packages/db`): on app start and on reconnect, finds notes with
`link_status = 'pending'` and re-invokes `enrich-url`. Attempt count is tracked
locally (not synced); after 3 failures the client sets `link_status = 'failed'`.

**SSRF hardening** (applies to both branches): only `http`/`https`; reject hosts
resolving to private, loopback, link-local or metadata ranges; keep the 256 KB / 8 s
caps. Audit the current function and close gaps.

## 3. UI

### Notes list (web sidebar page, mobile tab)

- Sorted by `updated_at` desc. Row: title (or fallback), one-line body excerpt, link
  thumbnail + site name if present, project chip, labels.
- Filters: All / Links / Thoughts (`source_url` set or not), project, label.
  Archived hidden unless "Show archived" is on.
- Project pages (web and mobile) get a **Notes** section beside tasks.

### Editor

- Title field above a markdown body (`<textarea>` on web, multiline `TextInput` on
  mobile), with an **Edit | Preview** toggle.
- Toolbar: bold, italic, heading, list, checkbox, link. Transforms are pure functions
  in `packages/core` (text + selection in → text + selection out).
- **Autosave:** local write 500 ms after typing stops, plus on blur and navigation.
  No save button.
- Link notes show a preview card (image, title, site, Open). Skeleton while
  `pending`; bare URL if `failed`.
- Notes with `conflict_of` set show a banner: "Conflict copy of *X*. Compare and
  merge, then delete," with **Open original** and **Delete copy** actions.

### Note↔task linking

- **On a note:** "Linked tasks" panel listing linked tasks with checkboxes (completable
  in place). Actions: **+ Link existing** (task search picker), **+ New task**
  (creates and links), **Selection → task** (toolbar button when text is selected;
  selection becomes the new task's title, trimmed and stripped of markdown list/checkbox
  markers).
- **On a task** (web detail panel, mobile task screen): "Linked notes" section with
  tappable titles, **+ Link existing**, **+ New note**.
- Unlink deletes the `links` row only.

### Search

- Web `/search` and a mobile search field gain a **Tasks | Notes** scope.
- v1 note search: local SQLite `LIKE` over `title`, `body`, `link_title`, excluding
  archived unless toggled. One query function in `packages/db` so FTS5 can replace it
  later without UI changes.

### Package placement

- `packages/core`: markdown transforms, title fallback, selection→task title cleanup.
  No DB imports.
- `packages/db`: schema, notes/links/search queries, revision-bump helper, pending-enricher.
- `packages/ui`: shared note list row, preview card, linked-items list, conflict
  banner (NativeWind only).
- `apps/web`, `apps/mobile`: screens, editor shells, navigation.

## 4. Error handling and verification

### Silent-failure guards

| Risk | Guard |
|---|---|
| Missing sync rule for `notes`/`links` | E2E: create note on web → assert row exists in Postgres and appears in a second client session |
| Missing RLS | SQL test: a second user reads 0 rows; cannot insert/update rows with another `user_id` |
| Migration drift vs live DB | Apply migration live and verify columns before UI work |
| Conflict trigger not firing | DB test: two updates with the same `base_revision` → original body kept, exactly one copy, `conflict_of` set |
| Chained offline edits misflagged | DB test: three updates chaining from revision 5 → no conflict copy |
| Preview stuck offline | Unit test: enricher retries `pending` on reconnect, gives up after 3 |
| Orphan links | Query test: deleting a note or task removes its links in the same transaction |

### Error handling

- Local writes do not fail in normal operation. Investigate how the existing PowerSync
  upload connector handles a permanently rejected op (it can block the upload queue);
  ensure notes/links constraint errors are logged and do not wedge the queue.
- `enrich-url` failure only results in `link_status = 'failed'`; the note is never at risk.

### Tests

- `packages/core`: toolbar transforms, title fallback, selection→task cleanup (Vitest).
- `packages/db`: notes/links/search queries, revision bump, enricher (Vitest).
- Database: trigger and RLS tests as SQL against local Supabase.
- Web E2E (Playwright): create note → link task → find via search → complete linked
  task from the note.
- Mobile: share URL → Note → preview appears, verified on a preview build.
- Done = lint + typecheck + test + `pnpm build` output shown.

### Build order

Migration + sync rules + RLS (applied and verified live) → `packages/db` →
`packages/core` → `enrich-url` notes branch → web UI → mobile UI → share toggle.
