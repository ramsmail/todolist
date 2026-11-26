# Notes Core — Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in user create, edit, find and link notes on the web app: a Notes list, a markdown editor with autosave, link previews, note↔task linking in both directions, project notes, and Tasks | Notes search.

**Architecture:** The data layer (PR #9, `feature/notes-core`) already provides tables, sync, queries, pure markdown/text helpers and the `enrich-url` function. This plan (1) fixes and extends that data layer where the UI needs it, then (2) adds web building blocks (autosave, enrichment runner, preview, editor, link panels), then (3) wires pages and existing screens (sidebar, task detail, project page, search, `n` shortcut). All writes go through PowerSync local writes; the only network call is `enrich-url`, invoked with the user's JWT.

**Tech Stack:** Next.js 14 App Router (client pages), React 18, Tailwind 3.4 (project tokens: `bg-surface`, `border-border`, `text-text-primary`, `bg-accent`…), PowerSync (`@powersync/react`), `@todolist/core` + `@todolist/db` (consumed from their built `dist/`), Vitest + React Testing Library, `react-markdown` 10 + `remark-gfm` 4 (web only).

**Spec:** `docs/superpowers/specs/2026-11-25-notes-core-design.md` (sections 2 and 3). Builds on `docs/superpowers/plans/2026-11-25-notes-core-1-data-layer.md`.

**Branch:** continue on `feature/notes-core` (worktree `.worktrees/notes-core`). Tasks 1–6 correct and extend the data layer of the open PR #9, so they should land with it.

---

## Read first

### Defects found in the shipped data layer (fixed by Tasks 1–4)

| # | Where | Problem | Consequence |
|---|---|---|---|
| 1 | `createLinkedTask` | Inserts `status='todo'`, `priority=1`, `sort_order='note:<id>'`, no `labels` | Postgres `tasks.status` has `check (status in ('inbox','active','completed','cancelled'))` and `labels jsonb not null`. Both violate class-23 constraints, which the upload connector treats as fatal and **drops silently**: the task shows locally, then vanishes after sync. `priority=1` would also make it a P1 (Do First, push cards). `'note:<id>'` is not a valid fractional-index key, so a later `generateKeyBetween(afterSortOrder, …)` can throw. |
| 2 | `updateNote(…, { revision })` | Caller supplies the revision | Two quick autosaves can read the same stale revision, upload with the same `base_revision`, and the server trigger creates a **spurious conflict copy**. Spec says the bump must be `base_revision = revision, revision = revision + 1` *in the same statement*, only when `body` changes. |
| 3 | `deleteNote` | Soft-deletes only | Spec requires removing the note's links in the same local transaction (orphan links otherwise). |
| 4 | `NOTES_LIST_QUERY` | Excludes `conflict_of IS NOT NULL` | Conflict copies would be invisible, so a user could never open, compare or delete one. |

### Decisions made in this plan (change them here if you disagree)

- **Conflict copies appear in the notes list** with a "Conflict copy" badge, and the editor shows the spec's banner.
- **Search page is currently a stub**, so Task 5/18 add a simple task `LIKE` search alongside the notes search to deliver the spec's *Tasks | Notes* scope.
- **`react-markdown` is added to `apps/web` only.** It is a web renderer; mobile will use a React Native renderer, so it does not belong in a shared package.
- **Playwright E2E is not written in this plan.** `apps/web/e2e/` does not exist and an authenticated fixture is a separate decision. Task 20 ends with an exact manual verification script instead.
- **Known limitation (not fixed here):** if two *online* devices type into the same note at the same moment, the later save wins. The server conflict trigger protects the offline-queue case (stale `base_revision`), which is what the spec targets.

### Conventions used by every task

- `packages/db` and `packages/core` are consumed by the web app from `dist/`. After changing either, run `pnpm --filter @todolist/db build` and `pnpm --filter @todolist/core build` before running web tests or `pnpm typecheck`. Task 6 does this once at the end of Part A.
- Web tests live in `apps/web/__tests__/*.test.tsx`; run one with `pnpm --filter @todolist/web exec vitest run __tests__/<File>.test.tsx`.
- db / core tests are colocated; run one with `pnpm --filter @todolist/db exec vitest run src/queries/<file>.test.ts` (or `@todolist/core`).
- Existing mocking style (copy it): `vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }))`, `vi.mock('@/lib/supabase/client', …)`, and `vi.mock('@todolist/db', async () => ({ ...(await vi.importActual<any>('@todolist/db')), useX: vi.fn() }))`.
- Pass the PowerSync db as `db as any` (existing precedent in `app/labels/page.tsx`).

### Prerequisites (user actions, not tasks)

1. `powersync/sync-rules.yaml` deployed to the PowerSync dashboard (notes + links lines). Without it nothing replicates.
2. For link previews on the live app: `supabase functions deploy enrich-url`.

---

## File structure

**`packages/db`**
- Modify `src/queries/notes.ts` — fix `createLinkedTask`; new `updateNote`; add `setNoteSourceUrl`, `setNoteProject`, `setNoteLabels`; `deleteNote` removes links; list queries include conflict copies; add `useNote`, `useNotesByProject`, `NoteListRow`, `NOTE_LIST_COLUMNS`.
- Modify `src/queries/notes.test.ts`
- Create `src/queries/search.ts` + `search.test.ts` — `useNoteSearch`, `useTaskSearch`, LIKE helpers.
- Modify `src/index.ts` — export search.

**`packages/core`**
- Create `src/notes/noteFilter.ts` + `noteFilter.test.ts`; export from `src/index.ts`.

**`apps/web`**
- `package.json` — add `react-markdown`, `remark-gfm`.
- `hooks/useAutosave.ts`, `hooks/useNewNote.ts`, `hooks/usePendingNoteEnricher.ts`
- `lib/notes/enrichUrl.ts`, `lib/notes/enrichPending.ts`, `lib/shortcuts/shouldIgnoreShortcut.ts`
- `components/notes/`: `MarkdownPreview`, `MarkdownToolbar`, `NoteEditor`, `NoteRow`, `LinkPreviewCard`, `ConflictBanner`, `SearchPicker`, `LinkedTasksPanel`, `LinkedNotesSection`, `ProjectNotesSection`, `NoteEnricherRunner`
- `app/notes/page.tsx`, `app/notes/[id]/page.tsx`
- Modify: `app/search/page.tsx`, `app/projects/[id]/page.tsx`, `app/ClientLayout.tsx`, `components/layout/Sidebar.tsx`, `components/layout/KeyboardShortcuts.tsx`, `components/layout/ShortcutsOverlay.tsx`, `components/tasks/TaskDetailPanel.tsx`, `__tests__/TaskDetailPanel.test.tsx`

---

# Part A — Data-layer fixes and additions

### Task 1: Fix `createLinkedTask` so the task survives upload

**Files:**
- Modify: `packages/db/src/queries/notes.ts`
- Modify: `packages/db/src/queries/notes.test.ts`

- [ ] **Step 1: Verify the constraint values against the migration (do not trust the TS)**

Run:
```bash
grep -n -A16 "create table tasks" supabase/migrations/20260620000001_initial_schema.sql | grep -E "status|priority|labels|sort_order"
```
Expected output includes: `status … default 'inbox' check (status in ('inbox','active','completed','cancelled'))`, `priority … default 4`, `labels jsonb not null default '[]'`, `sort_order text not null default 'a0'`.

- [ ] **Step 2: Replace the `createLinkedTask` test**

In `packages/db/src/queries/notes.test.ts`, replace the whole `describe('createLinkedTask', …)` block with:

```ts
describe('createLinkedTask', () => {
  it('inserts a task that satisfies the Postgres constraints, and the note->task link, in one transaction', async () => {
    const db = fakeDb();
    await createLinkedTask(db as any, { userId: 'u1', noteId: 'n1', title: 'Fix it' });
    expect(db.writeTransaction).toHaveBeenCalledTimes(1);
    const tx = await db.writeTransaction.mock.results[0].value;
    expect(tx.execute).toHaveBeenCalledTimes(2);

    const [taskSql, taskParams] = tx.execute.mock.calls[0];
    expect(taskSql).toContain('INSERT INTO tasks');
    // id, user_id, title, description, status, priority, labels, sort_order, created_at, updated_at
    // status must be one Postgres allows; priority 4 = normal; labels NOT NULL; sort_order a valid fractional key
    expect(taskParams.slice(1, 8)).toEqual(['u1', 'Fix it', null, 'inbox', 4, '[]', 'a0']);

    const [linkSql, linkParams] = tx.execute.mock.calls[1];
    expect(linkSql).toContain('INSERT INTO links');
    expect(linkParams.slice(1, 7)).toEqual(['u1', 'note', 'n1', 'task', taskParams[0], 'manual']);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: FAIL on the `createLinkedTask` test (`'todo'` received where `'inbox'` expected).

- [ ] **Step 4: Fix the implementation**

In `packages/db/src/queries/notes.ts` add the import at the top:

```ts
import { generateKeyBetween } from 'fractional-indexing';
```

and replace the task insert inside `createLinkedTask` with:

```ts
    await tx.execute(
      `INSERT INTO tasks
         (id, user_id, title, description, status, priority, labels, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [taskId, opts.userId, opts.title, null, 'inbox', 4, '[]', generateKeyBetween(null, null), now, now]
    );
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/notes.ts packages/db/src/queries/notes.test.ts
git commit -m "fix(db): createLinkedTask must satisfy tasks constraints so it survives upload"
```

---

### Task 2: `updateNote` bumps revisions in SQL; add source-url, project and label writers

**Files:**
- Modify: `packages/db/src/queries/notes.ts`
- Modify: `packages/db/src/queries/notes.test.ts`

- [ ] **Step 1: Update the test imports and replace the `updateNote` block**

In `notes.test.ts`, add `setNoteSourceUrl, setNoteProject, setNoteLabels` to the import list from `./notes`, then replace the whole `describe('updateNote', …)` block with:

```ts
describe('updateNote', () => {
  it('bumps the revision chain in SQL when the body changes', async () => {
    const db = fakeDb();
    await updateNote(db as any, 'n1', { body: 'new body' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('body = ?');
    // evaluated against the pre-update row, so base_revision = old, revision = old + 1
    expect(sql).toContain('base_revision = revision');
    expect(sql).toContain('revision = revision + 1');
    expect(params).toEqual(['new body', expect.any(String), 'n1']);
  });

  it('leaves the revision columns alone for a title-only change', async () => {
    const db = fakeDb();
    await updateNote(db as any, 'n1', { title: 'Plan' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).not.toContain('revision');
    expect(params).toEqual(['Plan', expect.any(String), 'n1']);
  });

  it('writes title and body together, bumping once', async () => {
    const db = fakeDb();
    await updateNote(db as any, 'n1', { title: 'T', body: 'B' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('title = ?');
    expect(sql).toContain('revision = revision + 1');
    expect(params).toEqual(['T', 'B', expect.any(String), 'n1']);
  });
});

describe('setNoteSourceUrl', () => {
  it('stores the url and marks the preview pending', async () => {
    const db = fakeDb();
    await setNoteSourceUrl(db as any, 'n1', 'https://example.com');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET source_url = ?');
    expect(sql).toContain("link_status = 'pending'");
    expect(params).toEqual(['https://example.com', expect.any(String), 'n1']);
  });
});

describe('setNoteProject / setNoteLabels', () => {
  it('setNoteProject updates project_id without touching revisions', async () => {
    const db = fakeDb();
    await setNoteProject(db as any, 'n1', 'p1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET project_id = ?');
    expect(sql).not.toContain('revision');
    expect(params).toEqual(['p1', expect.any(String), 'n1']);
  });

  it('setNoteLabels stores the labels as a JSON array', async () => {
    const db = fakeDb();
    await setNoteLabels(db as any, 'n1', ['work', 'idea']);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET labels = ?');
    expect(sql).not.toContain('revision');
    expect(params).toEqual(['["work","idea"]', expect.any(String), 'n1']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: FAIL (`setNoteSourceUrl` is not exported; `updateNote` params differ).

- [ ] **Step 3: Implement**

In `notes.ts`, replace `updateNote` and add the three writers:

```ts
export async function updateNote(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  patch: { body?: string; title?: string }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    params.push(patch.title);
  }
  if (patch.body !== undefined) {
    // Same statement, evaluated against the pre-update row: the server conflict
    // trigger compares base_revision with its stored revision. Reading the
    // revision here (not from the caller) keeps back-to-back autosaves chained.
    sets.push('body = ?', 'base_revision = revision', 'revision = revision + 1');
    params.push(patch.body);
  }
  sets.push('updated_at = ?');
  params.push(new Date().toISOString(), noteId);
  await db.execute(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function setNoteSourceUrl(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  url: string
): Promise<void> {
  await db.execute(
    `UPDATE notes SET source_url = ?, link_status = 'pending', updated_at = ? WHERE id = ?`,
    [url, new Date().toISOString(), noteId]
  );
}

export async function setNoteProject(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  projectId: string | null
): Promise<void> {
  await db.execute(
    `UPDATE notes SET project_id = ?, updated_at = ? WHERE id = ?`,
    [projectId, new Date().toISOString(), noteId]
  );
}

export async function setNoteLabels(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  labels: string[]
): Promise<void> {
  await db.execute(
    `UPDATE notes SET labels = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(labels), new Date().toISOString(), noteId]
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/notes.ts packages/db/src/queries/notes.test.ts
git commit -m "fix(db): bump note revisions in SQL; add source-url, project and label writers"
```

---

### Task 3: `deleteNote` removes the note's links in the same transaction

**Files:**
- Modify: `packages/db/src/queries/notes.ts`
- Modify: `packages/db/src/queries/notes.test.ts`

- [ ] **Step 1: Replace the `deleteNote` test**

```ts
describe('deleteNote', () => {
  it('soft-deletes the note and removes its links in one transaction', async () => {
    const db = fakeDb();
    await deleteNote(db as any, 'n1');
    expect(db.writeTransaction).toHaveBeenCalledTimes(1);
    const tx = await db.writeTransaction.mock.results[0].value;

    const [sql, params] = tx.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET deleted_at = ?');
    expect(params[params.length - 1]).toBe('n1');

    const [linkSql, linkParams] = tx.execute.mock.calls[1];
    expect(linkSql).toContain('DELETE FROM links');
    expect(linkParams).toEqual(['note', 'n1', 'note', 'n1']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: FAIL (`writeTransaction` called 0 times).

- [ ] **Step 3: Implement**

In `notes.ts` add `import { deleteLinksFor } from './links';` and replace `deleteNote`:

```ts
export async function deleteNote(
  db: AbstractPowerSyncDatabase,
  noteId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, noteId]
    );
    await deleteLinksFor(tx, 'note', noteId);
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/notes.ts packages/db/src/queries/notes.test.ts
git commit -m "fix(db): deleteNote removes the note's links in the same transaction"
```

---

### Task 4: Read queries — richer list (incl. conflict copies), `useNote`, `useNotesByProject`

**Files:**
- Modify: `packages/db/src/queries/notes.ts`
- Modify: `packages/db/src/queries/notes.test.ts`

- [ ] **Step 1: Replace the `query constants` test block**

Add `NOTES_LIST_WITH_ARCHIVED_QUERY, NOTES_BY_PROJECT_QUERY, NOTE_QUERY` to the imports, then replace `describe('query constants', …)`:

```ts
describe('query constants', () => {
  it('NOTES_LIST_QUERY excludes deleted and archived notes', () => {
    expect(NOTES_LIST_QUERY).toContain('deleted_at IS NULL');
    expect(NOTES_LIST_QUERY).toContain('is_archived = 0');
  });
  it('NOTES_LIST_QUERY includes conflict copies so they can be found and resolved', () => {
    expect(NOTES_LIST_QUERY).not.toContain('conflict_of IS NULL');
    expect(NOTES_LIST_QUERY).toContain('conflict_of');
  });
  it('NOTES_LIST_QUERY selects what a list row renders', () => {
    for (const col of ['link_excerpt', 'link_image_url', 'link_site_name', 'source_url', 'link_status', 'labels', 'project_id']) {
      expect(NOTES_LIST_QUERY).toContain(col);
    }
  });
  it('NOTES_LIST_WITH_ARCHIVED_QUERY keeps archived notes', () => {
    expect(NOTES_LIST_WITH_ARCHIVED_QUERY).toContain('deleted_at IS NULL');
    expect(NOTES_LIST_WITH_ARCHIVED_QUERY).not.toContain('is_archived = 0');
  });
  it('NOTES_BY_PROJECT_QUERY filters by project and hides archived', () => {
    expect(NOTES_BY_PROJECT_QUERY).toContain('project_id = ?');
    expect(NOTES_BY_PROJECT_QUERY).toContain('is_archived = 0');
    expect(NOTES_BY_PROJECT_QUERY).toContain('deleted_at IS NULL');
  });
  it('NOTE_QUERY loads one live note by id', () => {
    expect(NOTE_QUERY).toContain('WHERE id = ?');
    expect(NOTE_QUERY).toContain('deleted_at IS NULL');
  });
  it('NOTES_INBOX_QUERY filters for unprocessed, non-archived notes', () => {
    expect(NOTES_INBOX_QUERY).toContain('is_processed = 0');
    expect(NOTES_INBOX_QUERY).toContain('is_archived = 0');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts`
Expected: FAIL (new constants not exported; `conflict_of IS NULL` still present).

- [ ] **Step 3: Implement**

In `notes.ts`, replace the existing `NOTES_LIST_QUERY` constant and `useNotesList` with:

```ts
export type NoteListRow = Pick<
  NoteRecord,
  | 'title' | 'body' | 'link_title' | 'link_excerpt' | 'link_image_url' | 'link_site_name'
  | 'source_url' | 'link_status' | 'is_archived' | 'is_processed' | 'project_id'
  | 'labels' | 'conflict_of' | 'updated_at'
> & { id: string };

export const NOTE_LIST_COLUMNS = `id, title, body, link_title, link_excerpt, link_image_url, link_site_name,
         source_url, link_status, is_archived, is_processed, project_id, labels, conflict_of, updated_at`;

export const NOTES_LIST_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL AND is_archived = 0
  ORDER BY updated_at DESC
`;

export const NOTES_LIST_WITH_ARCHIVED_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL
  ORDER BY updated_at DESC
`;

export const NOTES_BY_PROJECT_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL AND is_archived = 0 AND project_id = ?
  ORDER BY updated_at DESC
`;

export const NOTE_QUERY = `SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL LIMIT 1`;

export function useNotesList(includeArchived = false) {
  return useQuery<NoteListRow>(includeArchived ? NOTES_LIST_WITH_ARCHIVED_QUERY : NOTES_LIST_QUERY);
}

export function useNotesByProject(projectId: string) {
  return useQuery<NoteListRow>(NOTES_BY_PROJECT_QUERY, [projectId]);
}

export function useNote(id: string) {
  return useQuery<NoteRecord>(NOTE_QUERY, [id]);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/notes.test.ts && pnpm --filter @todolist/db typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/notes.ts packages/db/src/queries/notes.test.ts
git commit -m "feat(db): note list shows conflict copies; add useNote and useNotesByProject"
```

---

### Task 5: Search queries (`useNoteSearch`, `useTaskSearch`)

**Files:**
- Create: `packages/db/src/queries/search.ts`
- Create: `packages/db/src/queries/search.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { escapeLike, toLikePattern, NOTE_SEARCH_QUERY, TASK_SEARCH_QUERY } from './search';

describe('escapeLike / toLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
  it('wraps the trimmed term in wildcards', () => {
    expect(toLikePattern('  plan ')).toBe('%plan%');
  });
});

describe('NOTE_SEARCH_QUERY', () => {
  it('searches title, body and link_title with an escape clause', () => {
    for (const col of ['title', 'body', 'link_title']) {
      expect(NOTE_SEARCH_QUERY).toContain(`${col} LIKE ? ESCAPE '\\'`);
    }
  });
  it('excludes deleted notes, and archived ones unless asked', () => {
    expect(NOTE_SEARCH_QUERY).toContain('deleted_at IS NULL');
    expect(NOTE_SEARCH_QUERY).toContain('(? = 1 OR is_archived = 0)');
  });
  it('caps the result count', () => {
    expect(NOTE_SEARCH_QUERY).toContain('LIMIT 50');
  });
});

describe('TASK_SEARCH_QUERY', () => {
  it('searches title and description, hides finished and deleted tasks', () => {
    expect(TASK_SEARCH_QUERY).toContain(`title LIKE ? ESCAPE '\\'`);
    expect(TASK_SEARCH_QUERY).toContain(`description LIKE ? ESCAPE '\\'`);
    expect(TASK_SEARCH_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
    expect(TASK_SEARCH_QUERY).toContain('deleted_at IS NULL');
  });
  it('selects the columns TaskRow renders', () => {
    expect(TASK_SEARCH_QUERY).toContain('SELECT id, title, priority, due_date, due_time, status, sort_order, labels, recurrence_rule');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/search.test.ts`
Expected: FAIL, cannot resolve `./search`.

- [ ] **Step 3: Implement**

`packages/db/src/queries/search.ts`:

```ts
import { useQuery } from '@powersync/react';
import type { TaskRecord } from '../schema';
import { NOTE_LIST_COLUMNS, type NoteListRow } from './notes';

// v1 search is a local SQLite LIKE. FTS5 can replace these two functions later
// without any UI change.

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function toLikePattern(term: string): string {
  return `%${escapeLike(term.trim())}%`;
}

export const NOTE_SEARCH_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL
    AND (? = 1 OR is_archived = 0)
    AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR link_title LIKE ? ESCAPE '\\')
  ORDER BY updated_at DESC
  LIMIT 50
`;

export const TASK_SEARCH_QUERY = `
  SELECT id, title, priority, due_date, due_time, status, sort_order, labels, recurrence_rule
  FROM tasks
  WHERE deleted_at IS NULL
    AND status NOT IN ('completed', 'cancelled')
    AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
  ORDER BY updated_at DESC
  LIMIT 50
`;

export type TaskSearchRow = Pick<
  TaskRecord,
  'title' | 'priority' | 'due_date' | 'due_time' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'
> & { id: string };

export function useNoteSearch(term: string, includeArchived = false) {
  const p = toLikePattern(term);
  return useQuery<NoteListRow>(NOTE_SEARCH_QUERY, [includeArchived ? 1 : 0, p, p, p]);
}

export function useTaskSearch(term: string) {
  const p = toLikePattern(term);
  return useQuery<TaskSearchRow>(TASK_SEARCH_QUERY, [p, p]);
}
```

Add to `packages/db/src/index.ts` (after the `notes` export):

```ts
export * from './queries/search';
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/search.test.ts && pnpm --filter @todolist/db typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/search.ts packages/db/src/queries/search.test.ts packages/db/src/index.ts
git commit -m "feat(db): add note and task LIKE search queries"
```

---

### Task 6: Core `filterNotes`, then rebuild the packages

**Files:**
- Create: `packages/core/src/notes/noteFilter.ts`
- Create: `packages/core/src/notes/noteFilter.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { filterNotes } from './noteFilter';

const thought = { id: 'a', source_url: null, project_id: 'p1', labels: '["work"]' };
const link = { id: 'b', source_url: 'https://x.com', project_id: null, labels: '["read","work"]' };
const blankUrl = { id: 'c', source_url: '   ', project_id: null, labels: '[]' };
const all = [thought, link, blankUrl];

describe('filterNotes', () => {
  it('returns everything by default', () => {
    expect(filterNotes(all, {})).toEqual(all);
  });
  it('links keeps only notes with a source_url', () => {
    expect(filterNotes(all, { kind: 'links' }).map(n => n.id)).toEqual(['b']);
  });
  it('thoughts keeps notes without a (non-blank) source_url', () => {
    expect(filterNotes(all, { kind: 'thoughts' }).map(n => n.id)).toEqual(['a', 'c']);
  });
  it('filters by project', () => {
    expect(filterNotes(all, { projectId: 'p1' }).map(n => n.id)).toEqual(['a']);
  });
  it('filters by label from the JSON labels column', () => {
    expect(filterNotes(all, { label: 'read' }).map(n => n.id)).toEqual(['b']);
    expect(filterNotes(all, { label: 'work' }).map(n => n.id)).toEqual(['a', 'b']);
  });
  it('combines filters with AND', () => {
    expect(filterNotes(all, { kind: 'thoughts', label: 'work' }).map(n => n.id)).toEqual(['a']);
  });
  it('treats null/empty project and label filters as "no filter"', () => {
    expect(filterNotes(all, { projectId: null, label: null })).toEqual(all);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/core exec vitest run src/notes/noteFilter.test.ts`
Expected: FAIL, cannot resolve `./noteFilter`.

- [ ] **Step 3: Implement**

`packages/core/src/notes/noteFilter.ts`:

```ts
import { parseLabelsJson } from '../labels';

export type NoteKind = 'all' | 'links' | 'thoughts';

export interface NoteFilterable {
  source_url?: string | null;
  project_id?: string | null;
  labels?: string | null;
}

export interface NoteFilter {
  kind?: NoteKind;
  projectId?: string | null;
  label?: string | null;
}

export function filterNotes<T extends NoteFilterable>(notes: T[], filter: NoteFilter): T[] {
  const kind = filter.kind ?? 'all';
  return notes.filter((n) => {
    const isLink = !!n.source_url && n.source_url.trim() !== '';
    if (kind === 'links' && !isLink) return false;
    if (kind === 'thoughts' && isLink) return false;
    if (filter.projectId && n.project_id !== filter.projectId) return false;
    if (filter.label && !parseLabelsJson(n.labels).includes(filter.label)) return false;
    return true;
  });
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './notes/noteFilter';
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/core exec vitest run src/notes/noteFilter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Rebuild both packages and run their full suites**

Run:
```bash
pnpm --filter @todolist/core build && pnpm --filter @todolist/db build
pnpm --filter @todolist/core test && pnpm --filter @todolist/db test
```
Expected: both builds clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/notes/noteFilter.ts packages/core/src/notes/noteFilter.test.ts packages/core/src/index.ts
git commit -m "feat(core): add filterNotes for the notes list filters"
```

---

# Part B — Web building blocks

### Task 7: Markdown dependencies and `MarkdownPreview`

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Create: `apps/web/components/notes/MarkdownPreview.tsx`
- Create: `apps/web/__tests__/MarkdownPreview.test.tsx`

`react-markdown` 10 is ESM-only, renders no raw HTML, and strips unsafe URL protocols (`javascript:`) by default. Do **not** override `urlTransform` and do **not** add `rehype-raw`.

- [ ] **Step 1: Install**

Run: `pnpm --filter @todolist/web add react-markdown@^10.1.0 remark-gfm@^4.0.1`
Expected: both appear under `dependencies` in `apps/web/package.json`.

- [ ] **Step 2: Write the failing test**

`apps/web/__tests__/MarkdownPreview.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownPreview } from '@/components/notes/MarkdownPreview';

describe('MarkdownPreview', () => {
  it('renders emphasis', () => {
    const { container } = render(<MarkdownPreview source="say **hello**" />);
    expect(container.querySelector('strong')).toHaveTextContent('hello');
  });

  it('renders GFM task list items as checkboxes', () => {
    render(<MarkdownPreview source={'- [ ] call bank\n- [x] pay rent'} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('opens links in a new tab safely', () => {
    render(<MarkdownPreview source="[docs](https://example.com)" />);
    const a = screen.getByRole('link', { name: 'docs' });
    expect(a).toHaveAttribute('href', 'https://example.com');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('drops javascript: URLs', () => {
    render(<MarkdownPreview source="[x](javascript:alert(1))" />);
    const a = screen.getByText('x').closest('a');
    expect(a?.getAttribute('href') ?? '').toBe('');
  });

  it('does not render raw HTML', () => {
    const { container } = render(<MarkdownPreview source={'<b>bold</b><script>alert(1)</script>'} />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('shows a placeholder for an empty note', () => {
    render(<MarkdownPreview source="   " />);
    expect(screen.getByText('Nothing to preview')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/MarkdownPreview.test.tsx`
Expected: FAIL, cannot resolve `@/components/notes/MarkdownPreview`.

- [ ] **Step 4: Implement**

`apps/web/components/notes/MarkdownPreview.tsx`:

```tsx
'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// react-markdown passes the hast `node` to every override; it must not reach the DOM.
function strip<T extends { node?: unknown }>({ node, ...rest }: T) {
  void node;
  return rest;
}

const components: Components = {
  a: (p) => <a {...strip(p)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline" />,
  h1: (p) => <h1 {...strip(p)} className="text-xl font-bold mt-4 mb-2" />,
  h2: (p) => <h2 {...strip(p)} className="text-lg font-semibold mt-4 mb-2" />,
  h3: (p) => <h3 {...strip(p)} className="font-semibold mt-3 mb-1" />,
  ul: (p) => <ul {...strip(p)} className="list-disc pl-5 space-y-1" />,
  ol: (p) => <ol {...strip(p)} className="list-decimal pl-5 space-y-1" />,
  blockquote: (p) => <blockquote {...strip(p)} className="border-l-2 border-border pl-3 text-text-secondary" />,
  code: (p) => <code {...strip(p)} className="font-mono text-xs bg-surface-alt px-1 py-0.5 rounded" />,
  pre: (p) => <pre {...strip(p)} className="font-mono text-xs bg-surface-alt p-3 rounded-lg overflow-x-auto" />,
};

export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-text-muted text-sm">Nothing to preview</p>;
  }
  return (
    <div className="text-text-primary text-sm leading-relaxed space-y-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/MarkdownPreview.test.tsx`
Expected: PASS (6 tests). If Vitest reports an ESM import error for `react-markdown`, add `server: { deps: { inline: ['react-markdown', 'remark-gfm'] } }` inside `test` in `apps/web/vitest.config.ts` and re-run.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/components/notes/MarkdownPreview.tsx apps/web/__tests__/MarkdownPreview.test.tsx
git commit -m "feat(web): add safe markdown preview for notes"
```

---

### Task 8: `useAutosave`

**Files:**
- Create: `apps/web/hooks/useAutosave.ts`
- Create: `apps/web/__tests__/useAutosave.test.ts`

Spec: local write 500 ms after typing stops, plus on blur and on navigation (unmount). No save button.

- [ ] **Step 1: Write the failing test**

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutosave } from '@/hooks/useAutosave';

describe('useAutosave', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('saves only the latest value, once, after the delay', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { result.current.schedule('a'); });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.schedule('ab'); });
    act(() => { vi.advanceTimersByTime(499); });
    expect(save).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('ab');
  });

  it('flush saves immediately and cancels the timer', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { result.current.schedule('x'); });
    act(() => { void result.current.flush(); });
    expect(save).toHaveBeenCalledWith('x');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending does not save', () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { void result.current.flush(); });
    expect(save).not.toHaveBeenCalled();
  });

  it('reports dirty while a save is pending', () => {
    const { result } = renderHook(() => useAutosave<string>(vi.fn(), 500));
    expect(result.current.isDirty()).toBe(false);
    act(() => { result.current.schedule('x'); });
    expect(result.current.isDirty()).toBe(true);
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.isDirty()).toBe(false);
  });

  it('flushes a pending value on unmount (navigation)', () => {
    const save = vi.fn();
    const { result, unmount } = renderHook(() => useAutosave<string>(save, 500));
    act(() => { result.current.schedule('last words'); });
    unmount();
    expect(save).toHaveBeenCalledWith('last words');
  });

  it('always calls the latest save callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useAutosave<string>(cb, 500), { initialProps: { cb: first } });
    act(() => { result.current.schedule('v'); });
    rerender({ cb: second });
    act(() => { vi.advanceTimersByTime(500); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('v');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/useAutosave.test.ts`
Expected: FAIL, cannot resolve `@/hooks/useAutosave`.

- [ ] **Step 3: Implement**

`apps/web/hooks/useAutosave.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useAutosave<T>(save: (value: T) => Promise<void> | void, delay = 500) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const p = pending.current;
    if (!p) return Promise.resolve();
    pending.current = null;
    return Promise.resolve(saveRef.current(p.value));
  }, []);

  const schedule = useCallback((value: T) => {
    pending.current = { value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, delay);
  }, [delay, flush]);

  const isDirty = useCallback(() => pending.current !== null, []);

  useEffect(() => () => { void flush(); }, [flush]);

  return { schedule, flush, isDirty };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/useAutosave.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/useAutosave.ts apps/web/__tests__/useAutosave.test.ts
git commit -m "feat(web): add useAutosave hook (500ms debounce, flush on blur/unmount)"
```

---

### Task 9: Enrichment helpers (`invokeEnrichUrl`, `runPendingEnrichment`)

**Files:**
- Create: `apps/web/lib/notes/enrichUrl.ts`
- Create: `apps/web/lib/notes/enrichPending.ts`
- Create: `apps/web/__tests__/enrichPending.test.ts`

One code path for every enrichment: creating or pasting a URL sets `link_status = 'pending'` locally, then calls `runPendingEnrichment`. The same function runs on reconnect. An in-memory `EnrichState` (not synced) dedupes in-flight calls and counts attempts; after 3 failed attempts the note is marked `failed`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@todolist/db', () => ({
  getPendingNotes: vi.fn(),
  applyEnrichment: vi.fn().mockResolvedValue(undefined),
}));

import { getPendingNotes, applyEnrichment } from '@todolist/db';
import { runPendingEnrichment, newEnrichState, MAX_ENRICH_ATTEMPTS } from '@/lib/notes/enrichPending';

const db = {} as any;

describe('runPendingEnrichment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('invokes enrichment for each pending note', async () => {
    (getPendingNotes as any).mockResolvedValue([
      { id: 'n1', source_url: 'https://a.com' },
      { id: 'n2', source_url: 'https://b.com' },
    ]);
    const invoke = vi.fn().mockResolvedValue(true);
    await runPendingEnrichment(db, invoke, newEnrichState());
    expect(invoke).toHaveBeenCalledWith('n1', 'https://a.com');
    expect(invoke).toHaveBeenCalledWith('n2', 'https://b.com');
  });

  it('does not re-invoke a note whose call already succeeded this session', async () => {
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: 'https://a.com' }]);
    const invoke = vi.fn().mockResolvedValue(true);
    const state = newEnrichState();
    await runPendingEnrichment(db, invoke, state);
    await runPendingEnrichment(db, invoke, state);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed call, then gives up after the maximum attempts', async () => {
    expect(MAX_ENRICH_ATTEMPTS).toBe(3);
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: 'https://a.com' }]);
    const invoke = vi.fn().mockResolvedValue(false);
    const state = newEnrichState();

    await runPendingEnrichment(db, invoke, state);
    await runPendingEnrichment(db, invoke, state);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(applyEnrichment).not.toHaveBeenCalled();

    await runPendingEnrichment(db, invoke, state);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(applyEnrichment).toHaveBeenCalledWith(db, 'n1', null);
  });

  it('marks a pending note with no url as failed without calling the function', async () => {
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: null }]);
    const invoke = vi.fn();
    await runPendingEnrichment(db, invoke, newEnrichState());
    expect(invoke).not.toHaveBeenCalled();
    expect(applyEnrichment).toHaveBeenCalledWith(db, 'n1', null);
  });

  it('does not double-invoke when two runs overlap', async () => {
    (getPendingNotes as any).mockResolvedValue([{ id: 'n1', source_url: 'https://a.com' }]);
    let release!: (ok: boolean) => void;
    const invoke = vi.fn(() => new Promise<boolean>((r) => { release = r; }));
    const state = newEnrichState();
    const first = runPendingEnrichment(db, invoke, state);
    await Promise.resolve();
    await Promise.resolve();
    const second = runPendingEnrichment(db, invoke, state);
    release(true);
    await Promise.all([first, second]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/enrichPending.test.ts`
Expected: FAIL, cannot resolve `@/lib/notes/enrichPending`.

- [ ] **Step 3: Implement**

`apps/web/lib/notes/enrichUrl.ts`:

```ts
import { createClient } from '@/lib/supabase/client';

// supabase-js attaches the signed-in user's JWT, which the function uses so
// that RLS scopes the update to the note's owner.
export async function invokeEnrichUrl(noteId: string, url: string): Promise<boolean> {
  try {
    const { error } = await createClient().functions.invoke('enrich-url', { body: { noteId, url } });
    return !error;
  } catch {
    return false;
  }
}
```

`apps/web/lib/notes/enrichPending.ts`:

```ts
import { applyEnrichment, getPendingNotes } from '@todolist/db';

type Db = Parameters<typeof getPendingNotes>[0];

export const MAX_ENRICH_ATTEMPTS = 3;

export interface EnrichState {
  attempts: Map<string, number>;
  invoked: Set<string>;
}

export function newEnrichState(): EnrichState {
  return { attempts: new Map(), invoked: new Set() };
}

// Shared by the create/paste paths and the reconnect runner.
export const enrichState = newEnrichState();

export async function runPendingEnrichment(
  db: Db,
  invoke: (noteId: string, url: string) => Promise<boolean>,
  state: EnrichState
): Promise<void> {
  const pending = await getPendingNotes(db);
  for (const note of pending) {
    if (!note.source_url) {
      await applyEnrichment(db, note.id, null);
      continue;
    }
    if (state.invoked.has(note.id)) continue;

    const used = state.attempts.get(note.id) ?? 0;
    if (used >= MAX_ENRICH_ATTEMPTS) {
      await applyEnrichment(db, note.id, null);
      continue;
    }

    state.attempts.set(note.id, used + 1);
    state.invoked.add(note.id);
    const ok = await invoke(note.id, note.source_url);
    if (!ok) {
      state.invoked.delete(note.id);
      if (used + 1 >= MAX_ENRICH_ATTEMPTS) await applyEnrichment(db, note.id, null);
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/enrichPending.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/notes apps/web/__tests__/enrichPending.test.ts
git commit -m "feat(web): add pending link-preview enrichment with attempt limit"
```

---

### Task 10: `useNewNote`, reconnect runner, mount in layout

**Files:**
- Create: `apps/web/hooks/useNewNote.ts`
- Create: `apps/web/hooks/usePendingNoteEnricher.ts`
- Create: `apps/web/components/notes/NoteEnricherRunner.tsx`
- Create: `apps/web/__tests__/useNewNote.test.tsx`
- Modify: `apps/web/app/ClientLayout.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/__tests__/useNewNote.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  }),
}));
vi.mock('@todolist/db', () => ({ createNote: vi.fn().mockResolvedValue('note-1') }));

import { createNote } from '@todolist/db';
import { useNewNote } from '@/hooks/useNewNote';

describe('useNewNote', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a blank note for the signed-in user and opens it', async () => {
    const { result } = renderHook(() => useNewNote());
    // userId loads asynchronously; the callback returns null until it has.
    await waitFor(async () => {
      expect(await result.current()).toBe('note-1');
    });
    expect(createNote).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', projectId: null });
    expect(push).toHaveBeenCalledWith('/notes/note-1');
  });

  it('creates the note inside a project when given one', async () => {
    const { result } = renderHook(() => useNewNote());
    await waitFor(async () => {
      expect(await result.current({ projectId: 'p1' })).toBe('note-1');
    });
    expect(createNote).toHaveBeenLastCalledWith(expect.anything(), { userId: 'user-1', projectId: 'p1' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/useNewNote.test.tsx`
Expected: FAIL, cannot resolve `@/hooks/useNewNote`.

- [ ] **Step 3: Implement**

`apps/web/hooks/useNewNote.ts`:

```ts
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePowerSync } from '@powersync/react';
import { createNote } from '@todolist/db';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useNewNote() {
  const db = usePowerSync();
  const router = useRouter();
  const { userId } = useCurrentUser();

  return useCallback(
    async (opts: { projectId?: string | null } = {}): Promise<string | null> => {
      if (!userId) return null;
      const id = await createNote(db as any, { userId, projectId: opts.projectId ?? null });
      router.push(`/notes/${id}`);
      return id;
    },
    [db, router, userId]
  );
}
```

`apps/web/hooks/usePendingNoteEnricher.ts`:

```ts
'use client';

import { useEffect } from 'react';
import { usePowerSync } from '@powersync/react';
import { invokeEnrichUrl } from '@/lib/notes/enrichUrl';
import { enrichState, runPendingEnrichment } from '@/lib/notes/enrichPending';

// Retries previews that were created offline: runs whenever the connection
// comes up (and once on mount if already connected).
export function usePendingNoteEnricher() {
  const db = usePowerSync();

  useEffect(() => {
    let wasConnected = false;
    const onStatus = () => {
      const connected = !!db.currentStatus?.connected;
      if (connected && !wasConnected) {
        void runPendingEnrichment(db as any, invokeEnrichUrl, enrichState);
      }
      wasConnected = connected;
    };
    onStatus();
    const unsubscribe = db.registerListener({ statusChanged: onStatus });
    return () => unsubscribe();
  }, [db]);
}
```

`apps/web/components/notes/NoteEnricherRunner.tsx`:

```tsx
'use client';

import { usePendingNoteEnricher } from '@/hooks/usePendingNoteEnricher';

export function NoteEnricherRunner() {
  usePendingNoteEnricher();
  return null;
}
```

In `apps/web/app/ClientLayout.tsx` add the import after the `usePathname` import:

```tsx
import { NoteEnricherRunner } from '@/components/notes/NoteEnricherRunner';
```

and render it as the first child of the provider:

```tsx
    <PowerSyncProvider>
      <NoteEnricherRunner />
      <FocusSessionProvider>
```

- [ ] **Step 4: Run to verify pass, then typecheck**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/useNewNote.test.tsx && pnpm --filter @todolist/web typecheck`
Expected: PASS; no new type errors in the files above.

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks apps/web/components/notes/NoteEnricherRunner.tsx apps/web/__tests__/useNewNote.test.tsx apps/web/app/ClientLayout.tsx
git commit -m "feat(web): add useNewNote and reconnect runner for pending link previews"
```

---

### Task 11: `NoteRow`, `LinkPreviewCard`, `ConflictBanner`

**Files:**
- Create: `apps/web/components/notes/NoteRow.tsx`
- Create: `apps/web/components/notes/LinkPreviewCard.tsx`
- Create: `apps/web/components/notes/ConflictBanner.tsx`
- Create: `apps/web/__tests__/NoteComponents.test.tsx`

External URLs (`source_url`, `link_image_url`) come from arbitrary sites. Both are passed through `extractSoleUrl` (from `@todolist/core`), which returns the URL only if it is a single `http(s)` URL, so a `javascript:` or `data:` value renders nothing.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NoteRow } from '@/components/notes/NoteRow';
import { LinkPreviewCard } from '@/components/notes/LinkPreviewCard';
import { ConflictBanner } from '@/components/notes/ConflictBanner';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'n1', title: 'Weekly plan', body: 'first line\nsecond line', link_title: null, link_excerpt: null,
  link_image_url: null, link_site_name: null, source_url: null, link_status: null,
  is_archived: 0, is_processed: 0, project_id: null, labels: '[]', conflict_of: null,
  updated_at: '2026-11-25T10:00:00.000Z', ...over,
}) as any;

describe('NoteRow', () => {
  it('links to the note and shows its title and excerpt', () => {
    render(<NoteRow note={row()} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/notes/n1');
    expect(screen.getByText('Weekly plan')).toBeInTheDocument();
    expect(screen.getByText('first line second line')).toBeInTheDocument();
  });

  it('falls back to the first body line when there is no title', () => {
    render(<NoteRow note={row({ title: '', body: '## Big idea\nmore' })} />);
    expect(screen.getByText('Big idea')).toBeInTheDocument();
  });

  it('shows site name, project chip and label chips', () => {
    render(
      <NoteRow
        note={row({ link_site_name: 'Example', labels: '["work"]' })}
        project={{ name: 'Home', color: '#10B981' }}
        labelColor={() => '#6366F1'}
      />
    );
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
  });

  it('badges conflict copies and archived notes', () => {
    render(<NoteRow note={row({ conflict_of: 'orig', is_archived: 1 })} />);
    expect(screen.getByText('Conflict copy')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('renders a thumbnail only for a safe http(s) image url', () => {
    const { container, rerender } = render(<NoteRow note={row({ link_image_url: 'https://x.com/a.jpg' })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://x.com/a.jpg');
    rerender(<NoteRow note={row({ link_image_url: 'javascript:alert(1)' })} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('LinkPreviewCard', () => {
  const base = { url: 'https://example.com/a', title: 'An article', excerpt: 'Summary text', imageUrl: null, siteName: 'Example', status: 'ok' };

  it('shows title, site, excerpt and an Open link when enriched', () => {
    render(<LinkPreviewCard {...base} />);
    expect(screen.getByText('An article')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Summary text')).toBeInTheDocument();
    const open = screen.getByRole('link', { name: 'Open' });
    expect(open).toHaveAttribute('href', 'https://example.com/a');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows a skeleton while pending', () => {
    render(<LinkPreviewCard {...base} title={null} status="pending" />);
    expect(screen.getByRole('status', { name: 'Loading link preview' })).toBeInTheDocument();
  });

  it('falls back to the bare url when enrichment failed', () => {
    render(<LinkPreviewCard {...base} title={null} status="failed" />);
    const link = screen.getByRole('link', { name: 'https://example.com/a' });
    expect(link).toHaveAttribute('href', 'https://example.com/a');
  });

  it('renders nothing for a missing or unsafe url', () => {
    const { container, rerender } = render(<LinkPreviewCard {...base} url={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LinkPreviewCard {...base} url="javascript:alert(1)" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ConflictBanner', () => {
  it('names the original and offers both actions', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(<ConflictBanner originalTitle="Plan" hasOriginal onOpenOriginal={onOpen} onDeleteCopy={onDelete} />);
    expect(screen.getByText(/Conflict copy of/)).toHaveTextContent('Plan');
    fireEvent.click(screen.getByRole('button', { name: 'Open original' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete copy' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('hides Open original when the original no longer exists', () => {
    render(<ConflictBanner originalTitle={null} hasOriginal={false} onOpenOriginal={vi.fn()} onDeleteCopy={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open original' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete copy' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NoteComponents.test.tsx`
Expected: FAIL, cannot resolve the component modules.

- [ ] **Step 3: Implement**

`apps/web/components/notes/NoteRow.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { extractSoleUrl, noteDisplayTitle, noteExcerpt, parseLabelsJson } from '@todolist/core';
import type { NoteListRow } from '@todolist/db';
import { LabelChip } from '@/components/tasks/LabelChip';

interface Props {
  note: NoteListRow;
  project?: { name: string; color: string | null } | null;
  labelColor?: (name: string) => string;
}

export function NoteRow({ note, project, labelColor = () => '#6366F1' }: Props) {
  const image = extractSoleUrl(note.link_image_url ?? '');
  const excerpt = noteExcerpt(note);
  const labels = parseLabelsJson(note.labels);

  return (
    <Link
      href={`/notes/${note.id}`}
      className="flex gap-3 bg-surface border border-border rounded-xl px-4 py-3 hover:border-accent transition-colors"
    >
      {image && (
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-text-primary text-sm font-semibold truncate">{noteDisplayTitle(note)}</p>
          {note.conflict_of && <span className="text-xs text-warning flex-shrink-0">Conflict copy</span>}
          {note.is_archived ? <span className="text-xs text-text-muted flex-shrink-0">Archived</span> : null}
        </div>
        {excerpt && <p className="text-text-secondary text-xs truncate mt-0.5">{excerpt}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {note.link_site_name && <span className="text-xs text-text-muted">{note.link_site_name}</span>}
          {project && (
            <span className="text-xs text-text-muted inline-flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: project.color ?? '#6366F1' }}
                aria-hidden="true"
              />
              {project.name}
            </span>
          )}
          {labels.map((name) => (
            <LabelChip key={name} name={name} color={labelColor(name)} />
          ))}
        </div>
      </div>
    </Link>
  );
}
```

`apps/web/components/notes/LinkPreviewCard.tsx`:

```tsx
'use client';

import { extractSoleUrl } from '@todolist/core';

interface Props {
  url: string | null;
  title: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  siteName: string | null;
  status: string | null;
}

export function LinkPreviewCard({ url, title, excerpt, imageUrl, siteName, status }: Props) {
  const href = extractSoleUrl(url ?? '');
  if (!href) return null;

  if (status === 'pending') {
    return (
      <div
        role="status"
        aria-label="Loading link preview"
        className="flex gap-3 border border-border rounded-xl p-3 animate-pulse"
      >
        <div className="w-16 h-16 rounded-lg bg-surface-alt" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 rounded bg-surface-alt" />
          <div className="h-3 w-full rounded bg-surface-alt" />
        </div>
      </div>
    );
  }

  if (status === 'failed' || !title) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent text-sm hover:underline break-all">
        {href}
      </a>
    );
  }

  const image = extractSoleUrl(imageUrl ?? '');
  return (
    <div className="flex gap-3 border border-border rounded-xl p-3 bg-surface">
      {image && (
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        {siteName && <p className="text-xs text-text-muted">{siteName}</p>}
        <p className="text-text-primary text-sm font-semibold">{title}</p>
        {excerpt && <p className="text-text-secondary text-xs mt-1 line-clamp-2">{excerpt}</p>}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-accent text-xs hover:underline"
        >
          Open
        </a>
      </div>
    </div>
  );
}
```

`apps/web/components/notes/ConflictBanner.tsx`:

```tsx
'use client';

interface Props {
  originalTitle: string | null;
  hasOriginal: boolean;
  onOpenOriginal: () => void;
  onDeleteCopy: () => void;
}

export function ConflictBanner({ originalTitle, hasOriginal, onOpenOriginal, onDeleteCopy }: Props) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warning bg-warning/10 px-4 py-3">
      <p className="text-sm text-text-primary">
        {hasOriginal
          ? <>Conflict copy of <strong>{originalTitle || 'Untitled'}</strong>. Compare and merge, then delete.</>
          : <>Conflict copy of a note that no longer exists.</>}
      </p>
      <div className="flex gap-2 flex-shrink-0">
        {hasOriginal && (
          <button type="button" onClick={onOpenOriginal} className="text-sm text-accent hover:underline">
            Open original
          </button>
        )}
        <button type="button" onClick={onDeleteCopy} className="text-sm text-error hover:underline">
          Delete copy
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NoteComponents.test.tsx`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/notes/NoteRow.tsx apps/web/components/notes/LinkPreviewCard.tsx apps/web/components/notes/ConflictBanner.tsx apps/web/__tests__/NoteComponents.test.tsx
git commit -m "feat(web): add note row, link preview card and conflict banner"
```

---

### Task 12: `MarkdownToolbar` and `NoteEditor`

**Files:**
- Create: `apps/web/components/notes/MarkdownToolbar.tsx`
- Create: `apps/web/components/notes/NoteEditor.tsx`
- Create: `apps/web/__tests__/NoteEditor.test.tsx`

The editor holds local drafts and saves through `updateNote` (title-only saves never touch revisions). It adopts remote changes only when there is no pending save. The page must mount it with `key={note.id}` so a pending save can never land on a different note.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@todolist/db', () => ({
  updateNote: vi.fn().mockResolvedValue(undefined),
  createLinkedTask: vi.fn().mockResolvedValue({ taskId: 't1' }),
  setNoteSourceUrl: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/notes/enrichUrl', () => ({ invokeEnrichUrl: vi.fn() }));
vi.mock('@/lib/notes/enrichPending', () => ({ enrichState: {}, runPendingEnrichment: vi.fn().mockResolvedValue(undefined) }));

import { updateNote, createLinkedTask, setNoteSourceUrl } from '@todolist/db';
import { runPendingEnrichment } from '@/lib/notes/enrichPending';
import { NoteEditor } from '@/components/notes/NoteEditor';

const note = (over: Record<string, unknown> = {}) => ({ id: 'n1', title: 'Plan', body: 'hello', source_url: null, ...over });
const body = () => screen.getByLabelText('Note body') as HTMLTextAreaElement;

describe('NoteEditor', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the note title and body', () => {
    render(<NoteEditor note={note()} userId="u1" />);
    expect(screen.getByLabelText('Note title')).toHaveValue('Plan');
    expect(body()).toHaveValue('hello');
  });

  it('autosaves the body 500ms after typing stops, sending only what changed', () => {
    vi.useFakeTimers();
    render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'hello world' } });
    act(() => { vi.advanceTimersByTime(499); });
    expect(updateNote).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { body: 'hello world' });
  });

  it('autosaves a title change on its own', () => {
    vi.useFakeTimers();
    render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'New title' } });
    act(() => { vi.advanceTimersByTime(500); });
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { title: 'New title' });
  });

  it('saves immediately on blur', () => {
    vi.useFakeTimers();
    render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'changed' } });
    fireEvent.blur(body());
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { body: 'changed' });
  });

  it('saves a pending edit when the editor unmounts', () => {
    vi.useFakeTimers();
    const { unmount } = render(<NoteEditor note={note()} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'unsaved' } });
    unmount();
    expect(updateNote).toHaveBeenCalledWith(expect.anything(), 'n1', { body: 'unsaved' });
  });

  it('toolbar Bold wraps the selection and keeps it selected', () => {
    render(<NoteEditor note={note({ body: '' })} userId="u1" />);
    fireEvent.change(body(), { target: { value: 'say hello now' } });
    body().setSelectionRange(4, 9);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(body()).toHaveValue('say **hello** now');
    expect(body().selectionStart).toBe(6);
    expect(body().selectionEnd).toBe(11);
  });

  it('Selection to task is disabled until text is selected, then creates a linked task', async () => {
    render(<NoteEditor note={note({ body: '- [ ] Call the bank' })} userId="u1" />);
    const button = screen.getByRole('button', { name: 'Selection to task' });
    expect(button).toBeDisabled();

    body().setSelectionRange(0, body().value.length);
    fireEvent.select(body());
    expect(button).toBeEnabled();

    await act(async () => { fireEvent.click(button); });
    expect(createLinkedTask).toHaveBeenCalledWith(expect.anything(), {
      userId: 'u1', noteId: 'n1', title: 'Call the bank',
    });
  });

  it('pasting a url into an empty note sets the source url and starts enrichment', async () => {
    render(<NoteEditor note={note({ body: '' })} userId="u1" />);
    await act(async () => {
      fireEvent.paste(body(), { clipboardData: { getData: () => 'https://example.com/post' } });
    });
    await waitFor(() => expect(setNoteSourceUrl).toHaveBeenCalledWith(expect.anything(), 'n1', 'https://example.com/post'));
    expect(runPendingEnrichment).toHaveBeenCalledTimes(1);
  });

  it('does not treat a paste as a link capture when the note already has text or a url', async () => {
    const { rerender } = render(<NoteEditor note={note({ body: 'already writing' })} userId="u1" />);
    await act(async () => {
      fireEvent.paste(body(), { clipboardData: { getData: () => 'https://example.com' } });
    });
    rerender(<NoteEditor note={note({ body: '', source_url: 'https://old.com' })} userId="u1" />);
    await act(async () => {
      fireEvent.paste(body(), { clipboardData: { getData: () => 'https://example.com' } });
    });
    expect(setNoteSourceUrl).not.toHaveBeenCalled();
  });

  it('switches to a rendered preview', () => {
    render(<NoteEditor note={note({ body: 'say **hi**' })} userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('hi').tagName).toBe('STRONG');
    expect(screen.queryByLabelText('Note body')).toBeNull();
  });

  it('adopts a remote change when there is no pending edit, but not while typing', () => {
    vi.useFakeTimers();
    const { rerender } = render(<NoteEditor note={note({ body: 'v1' })} userId="u1" />);
    rerender(<NoteEditor note={note({ body: 'remote v2' })} userId="u1" />);
    expect(body()).toHaveValue('remote v2');

    fireEvent.change(body(), { target: { value: 'my local edit' } });
    rerender(<NoteEditor note={note({ body: 'remote v3' })} userId="u1" />);
    expect(body()).toHaveValue('my local edit');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NoteEditor.test.tsx`
Expected: FAIL, cannot resolve the component modules.

- [ ] **Step 3: Implement the toolbar**

`apps/web/components/notes/MarkdownToolbar.tsx`:

```tsx
'use client';

export type ToolbarAction = 'bold' | 'italic' | 'heading' | 'list' | 'checkbox' | 'link' | 'task';

const BUTTONS: { action: Exclude<ToolbarAction, 'task'>; label: string; text: string }[] = [
  { action: 'bold', label: 'Bold', text: 'B' },
  { action: 'italic', label: 'Italic', text: 'I' },
  { action: 'heading', label: 'Heading', text: 'H' },
  { action: 'list', label: 'Bulleted list', text: '•' },
  { action: 'checkbox', label: 'Checkbox list', text: '☑' },
  { action: 'link', label: 'Insert link', text: '🔗' },
];

interface Props {
  onAction: (action: ToolbarAction) => void;
  canMakeTask: boolean;
}

const BTN = 'px-2 py-1 text-sm rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors';

export function MarkdownToolbar({ onAction, canMakeTask }: Props) {
  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-1 flex-wrap">
      {BUTTONS.map((b) => (
        <button
          key={b.action}
          type="button"
          aria-label={b.label}
          // keep focus and the selection in the textarea
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction(b.action)}
          className={BTN}
        >
          {b.text}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        aria-label="Selection to task"
        disabled={!canMakeTask}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onAction('task')}
        className={`${BTN} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        → Task
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement the editor**

`apps/web/components/notes/NoteEditor.tsx`:

```tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  extractSoleUrl, insertLink, selectionToTaskTitle, toggleInline, toggleLinePrefix, type TextEdit,
} from '@todolist/core';
import { createLinkedTask, setNoteSourceUrl, updateNote } from '@todolist/db';
import { useAutosave } from '@/hooks/useAutosave';
import { invokeEnrichUrl } from '@/lib/notes/enrichUrl';
import { enrichState, runPendingEnrichment } from '@/lib/notes/enrichPending';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownToolbar, type ToolbarAction } from './MarkdownToolbar';

export interface EditableNote {
  id: string;
  title: string | null;
  body: string | null;
  source_url: string | null;
}

interface Props {
  note: EditableNote;
  userId: string | null;
}

interface Draft {
  title: string;
  body: string;
}

export function NoteEditor({ note, userId }: Props) {
  const db = usePowerSync();
  const [title, setTitle] = useState(note.title ?? '');
  const [body, setBody] = useState(note.body ?? '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [hasSelection, setHasSelection] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const latest = useRef<Draft>({ title: note.title ?? '', body: note.body ?? '' });
  const saved = useRef<Draft>({ title: note.title ?? '', body: note.body ?? '' });

  const { schedule, flush, isDirty } = useAutosave<Draft>(async (draft) => {
    const patch: { title?: string; body?: string } = {};
    if (draft.title !== saved.current.title) patch.title = draft.title;
    if (draft.body !== saved.current.body) patch.body = draft.body;
    if (patch.title === undefined && patch.body === undefined) return;
    saved.current = { title: draft.title, body: draft.body };
    await updateNote(db as any, note.id, patch);
  });

  // Adopt changes that arrive from sync, but never overwrite text being typed.
  useEffect(() => {
    if (isDirty()) return;
    const incoming = { title: note.title ?? '', body: note.body ?? '' };
    saved.current = incoming;
    latest.current = incoming;
    setTitle(incoming.title);
    setBody(incoming.body);
  }, [note.title, note.body, isDirty]);

  // Restore the selection a toolbar action computed, after React re-renders the textarea.
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const ta = textareaRef.current;
    if (!sel || !ta) return;
    pendingSelection.current = null;
    ta.focus();
    ta.setSelectionRange(sel.start, sel.end);
    setHasSelection(sel.end > sel.start);
  }, [body]);

  const commit = (next: Draft) => {
    latest.current = next;
    schedule(next);
  };
  const onTitleChange = (value: string) => {
    setTitle(value);
    commit({ ...latest.current, title: value });
  };
  const onBodyChange = (value: string) => {
    setBody(value);
    commit({ ...latest.current, body: value });
  };

  const syncSelectionState = () => {
    const ta = textareaRef.current;
    if (ta) setHasSelection(ta.selectionEnd > ta.selectionStart);
  };

  const apply = (action: ToolbarAction) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const edit: TextEdit = { text: body, selStart: ta.selectionStart, selEnd: ta.selectionEnd };

    if (action === 'task') {
      const title = selectionToTaskTitle(edit.text.slice(edit.selStart, edit.selEnd));
      if (!title || !userId) return;
      void createLinkedTask(db as any, { userId, noteId: note.id, title });
      return;
    }

    const next = {
      bold: () => toggleInline(edit, '**'),
      italic: () => toggleInline(edit, '_'),
      heading: () => toggleLinePrefix(edit, '## '),
      list: () => toggleLinePrefix(edit, '- '),
      checkbox: () => toggleLinePrefix(edit, '- [ ] '),
      link: () => insertLink(edit),
    }[action]();

    pendingSelection.current = { start: next.selStart, end: next.selEnd };
    setBody(next.text);
    commit({ ...latest.current, body: next.text });
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const url = extractSoleUrl(e.clipboardData.getData('text'));
    if (!url || body.trim() !== '' || note.source_url) return;
    // The pasted url also stays in the body; the preview card is added above it.
    void (async () => {
      await setNoteSourceUrl(db as any, note.id, url);
      void runPendingEnrichment(db as any, invokeEnrichUrl, enrichState);
    })();
  };

  return (
    <div className="space-y-3">
      <input
        aria-label="Note title"
        value={title}
        placeholder="Untitled"
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={() => void flush()}
        className="w-full bg-transparent text-text-primary text-2xl font-bold placeholder:text-text-muted focus:outline-none"
      />

      <div className="flex items-center justify-between gap-3">
        <div role="group" aria-label="Editor mode" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                void flush();
                setHasSelection(false);
                setMode(m);
              }}
              className={`px-3 py-1 ${mode === m ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
            >
              {m === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
        {mode === 'edit' && <MarkdownToolbar onAction={apply} canMakeTask={hasSelection && !!userId} />}
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          aria-label="Note body"
          value={body}
          placeholder="Write in markdown…"
          onChange={(e) => onBodyChange(e.target.value)}
          onBlur={() => void flush()}
          onPaste={onPaste}
          onSelect={syncSelectionState}
          className="w-full min-h-[320px] bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm font-mono resize-y focus:outline-none focus:border-accent"
        />
      ) : (
        <div className="min-h-[320px] bg-surface border border-border rounded-xl px-4 py-3">
          <MarkdownPreview source={body} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NoteEditor.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/notes/MarkdownToolbar.tsx apps/web/components/notes/NoteEditor.tsx apps/web/__tests__/NoteEditor.test.tsx
git commit -m "feat(web): add markdown note editor with autosave, toolbar, preview and URL capture"
```

---

### Task 13: `SearchPicker` and `LinkedTasksPanel`

**Files:**
- Create: `apps/web/components/notes/SearchPicker.tsx`
- Create: `apps/web/components/notes/LinkedTasksPanel.tsx`
- Create: `apps/web/__tests__/LinkedTasksPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@todolist/db', () => ({
  useLinkedTasks: vi.fn(),
  useTaskSearch: vi.fn(),
  completeTask: vi.fn().mockResolvedValue(undefined),
  unlinkNoteFromTask: vi.fn().mockResolvedValue(undefined),
  linkNoteToTask: vi.fn().mockResolvedValue(undefined),
  createLinkedTask: vi.fn().mockResolvedValue({ taskId: 't9' }),
}));

import {
  useLinkedTasks, useTaskSearch, completeTask, unlinkNoteFromTask, linkNoteToTask, createLinkedTask,
} from '@todolist/db';
import { LinkedTasksPanel } from '@/components/notes/LinkedTasksPanel';

const linked = [
  { id: 't1', title: 'Call the bank', status: 'inbox', priority: 4, due_date: null, project_id: null },
  { id: 't2', title: 'Pay rent', status: 'completed', priority: 4, due_date: null, project_id: null },
];

describe('LinkedTasksPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLinkedTasks as any).mockReturnValue({ data: linked });
    (useTaskSearch as any).mockReturnValue({ data: [] });
  });

  it('lists linked tasks and shows completed ones as checked', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    expect(screen.getByText('Call the bank')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Complete Call the bank' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Complete Pay rent' })).toBeChecked();
  });

  it('shows an empty state', () => {
    (useLinkedTasks as any).mockReturnValue({ data: [] });
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    expect(screen.getByText('No linked tasks')).toBeInTheDocument();
  });

  it('completes a task in place', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete Call the bank' }));
    expect(completeTask).toHaveBeenCalledWith(expect.anything(), 't1');
  });

  it('unlinks without deleting the task', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Call the bank' }));
    expect(unlinkNoteFromTask).toHaveBeenCalledWith(expect.anything(), 'n1', 't1');
  });

  it('links an existing task, hiding tasks that are already linked', async () => {
    (useTaskSearch as any).mockReturnValue({
      data: [{ id: 't1', title: 'Call the bank' }, { id: 't9', title: 'Pay the electricity bill' }],
    });
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ Link existing' }));
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'bill' } });

    expect(screen.queryByRole('button', { name: 'Call the bank' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay the electricity bill' }));
    await waitFor(() => expect(linkNoteToTask).toHaveBeenCalledWith(expect.anything(), 'u1', 'n1', 't9'));
  });

  it('creates and links a new task', async () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ New task' }));
    const input = screen.getByLabelText('New task title');
    fireEvent.change(input, { target: { value: '  Book flights ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(createLinkedTask).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', noteId: 'n1', title: 'Book flights' })
    );
  });

  it('does not create a task with a blank title', () => {
    render(<LinkedTasksPanel noteId="n1" userId="u1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ New task' }));
    fireEvent.keyDown(screen.getByLabelText('New task title'), { key: 'Enter' });
    expect(createLinkedTask).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/LinkedTasksPanel.test.tsx`
Expected: FAIL, cannot resolve the component modules.

- [ ] **Step 3: Implement the shared picker**

`apps/web/components/notes/SearchPicker.tsx`:

```tsx
'use client';

export interface PickerResult {
  id: string;
  label: string;
}

interface Props {
  label: string;
  term: string;
  onTermChange: (term: string) => void;
  results: PickerResult[];
  onPick: (id: string) => void;
  onClose: () => void;
}

export function SearchPicker({ label, term, onTermChange, results, onPick, onClose }: Props) {
  return (
    <div className="mt-2 bg-surface border border-border rounded-xl p-2">
      <input
        autoFocus
        aria-label={label}
        placeholder={label}
        value={term}
        onChange={(e) => onTermChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            // keep the surrounding panel (which closes on Escape) open
            e.nativeEvent.stopPropagation();
            onClose();
          }
        }}
        className="w-full bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
      />
      {term.trim() !== '' &&
        (results.length === 0 ? (
          <p className="px-2 py-2 text-xs text-text-muted">No matches</p>
        ) : (
          <ul className="mt-1 max-h-48 overflow-y-auto scrollable">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r.id)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-text-primary hover:bg-surface-alt truncate"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement the panel**

`apps/web/components/notes/LinkedTasksPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  completeTask, createLinkedTask, linkNoteToTask, unlinkNoteFromTask, useLinkedTasks, useTaskSearch,
} from '@todolist/db';
import { SearchPicker } from './SearchPicker';

interface Props {
  noteId: string;
  userId: string | null;
}

function LinkTaskPicker({ excludeIds, onPick, onClose }: {
  excludeIds: Set<string>;
  onPick: (taskId: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useTaskSearch(term);
  const results = data.filter((t) => !excludeIds.has(t.id)).map((t) => ({ id: t.id, label: t.title ?? '' }));
  return (
    <SearchPicker label="Search tasks" term={term} onTermChange={setTerm} results={results} onPick={onPick} onClose={onClose} />
  );
}

export function LinkedTasksPanel({ noteId, userId }: Props) {
  const db = usePowerSync();
  const { data: tasks } = useLinkedTasks(noteId);
  const [mode, setMode] = useState<'idle' | 'link' | 'new'>('idle');
  const [newTitle, setNewTitle] = useState('');

  const close = () => {
    setMode('idle');
    setNewTitle('');
  };

  const submitNew = async () => {
    const title = newTitle.trim();
    if (!title || !userId) return;
    await createLinkedTask(db as any, { userId, noteId, title });
    close();
  };

  const pick = async (taskId: string) => {
    if (!userId) return;
    await linkNoteToTask(db as any, userId, noteId, taskId);
    close();
  };

  return (
    <section aria-label="Linked tasks">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Linked tasks</h2>

      {tasks.length === 0 ? (
        <p className="text-text-muted text-sm">No linked tasks</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const done = t.status === 'completed';
            return (
              <li key={t.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={done}
                  disabled={done}
                  onChange={() => completeTask(db as any, t.id)}
                  aria-label={`Complete ${t.title}`}
                  className="w-4 h-4 flex-shrink-0"
                />
                <span className={`text-sm flex-1 truncate ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                  {t.title}
                </span>
                <button
                  type="button"
                  onClick={() => unlinkNoteFromTask(db as any, noteId, t.id)}
                  aria-label={`Unlink ${t.title}`}
                  className="text-text-muted hover:text-error text-sm"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === 'link' && (
        <LinkTaskPicker excludeIds={new Set(tasks.map((t) => t.id))} onPick={pick} onClose={close} />
      )}

      {mode === 'new' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            aria-label="New task title"
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitNew();
              if (e.key === 'Escape') {
                e.nativeEvent.stopPropagation();
                close();
              }
            }}
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <button type="button" onClick={() => void submitNew()} className="text-accent text-sm font-medium">Add</button>
          <button type="button" onClick={close} className="text-text-muted text-sm">Cancel</button>
        </div>
      )}

      {mode === 'idle' && (
        <div className="mt-3 flex gap-4">
          <button type="button" onClick={() => setMode('link')} className="text-accent text-sm hover:opacity-80">
            + Link existing
          </button>
          <button type="button" onClick={() => setMode('new')} className="text-accent text-sm hover:opacity-80">
            + New task
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/LinkedTasksPanel.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/notes/SearchPicker.tsx apps/web/components/notes/LinkedTasksPanel.tsx apps/web/__tests__/LinkedTasksPanel.test.tsx
git commit -m "feat(web): add linked-tasks panel with link-existing and new-task actions"
```

---

# Part C — Pages and integration

### Task 14: Notes list page and sidebar entry

**Files:**
- Create: `apps/web/app/notes/page.tsx`
- Create: `apps/web/__tests__/NotesPage.test.tsx`
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotesPage from '@/app/notes/page';

const newNote = vi.fn();
vi.mock('@/hooks/useNewNote', () => ({ useNewNote: () => newNote }));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useNotesList: vi.fn(),
  useProjects: vi.fn(),
  useLabels: vi.fn(),
}));

import { useNotesList, useProjects, useLabels } from '@todolist/db';

const row = (over: Record<string, unknown>) => ({
  id: 'x', title: '', body: '', link_title: null, link_excerpt: null, link_image_url: null,
  link_site_name: null, source_url: null, link_status: null, is_archived: 0, is_processed: 0,
  project_id: null, labels: '[]', conflict_of: null, updated_at: '2026-11-25T10:00:00.000Z', ...over,
});

const thought = row({ id: 'a', title: 'A thought', project_id: 'p1', labels: '["work"]' });
const link = row({ id: 'b', title: 'A saved link', source_url: 'https://x.com' });

describe('NotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNotesList as any).mockReturnValue({ data: [thought, link] });
    (useProjects as any).mockReturnValue({ data: [{ id: 'p1', name: 'Work', color: '#111111' }] });
    (useLabels as any).mockReturnValue({ data: [{ id: 'l1', name: 'work', color: '#6366F1' }] });
  });

  it('renders the heading and a row per note', () => {
    render(<NotesPage />);
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.getByText('A saved link')).toBeInTheDocument();
  });

  it('shows an empty state when there are no notes', () => {
    (useNotesList as any).mockReturnValue({ data: [] });
    render(<NotesPage />);
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
  });

  it('filters to links and to thoughts', () => {
    render(<NotesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    expect(screen.queryByText('A thought')).toBeNull();
    expect(screen.getByText('A saved link')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Thoughts' }));
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.queryByText('A saved link')).toBeNull();
  });

  it('filters by project and by label', () => {
    render(<NotesPage />);
    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: 'p1' } });
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.queryByText('A saved link')).toBeNull();

    fireEvent.change(screen.getByLabelText('Filter by project'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by label'), { target: { value: 'work' } });
    expect(screen.getByText('A thought')).toBeInTheDocument();
    expect(screen.queryByText('A saved link')).toBeNull();
  });

  it('says so when filters hide every note', () => {
    render(<NotesPage />);
    fireEvent.change(screen.getByLabelText('Filter by label'), { target: { value: 'work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    expect(screen.getByText('No notes match these filters')).toBeInTheDocument();
  });

  it('asks for archived notes when "Show archived" is ticked', () => {
    render(<NotesPage />);
    expect(useNotesList).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(useNotesList).toHaveBeenLastCalledWith(true);
  });

  it('creates a new note', () => {
    render(<NotesPage />);
    fireEvent.click(screen.getByRole('button', { name: '+ New note' }));
    expect(newNote).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NotesPage.test.tsx`
Expected: FAIL, cannot resolve `@/app/notes/page`.

- [ ] **Step 3: Implement the page**

`apps/web/app/notes/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { filterNotes, type NoteKind } from '@todolist/core';
import { useLabels, useNotesList, useProjects } from '@todolist/db';
import { NoteRow } from '@/components/notes/NoteRow';
import { useNewNote } from '@/hooks/useNewNote';

const KINDS: { value: NoteKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'links', label: 'Links' },
  { value: 'thoughts', label: 'Thoughts' },
];

const SELECT = 'bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent';

export default function NotesPage() {
  const [kind, setKind] = useState<NoteKind>('all');
  const [projectId, setProjectId] = useState('');
  const [label, setLabel] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { data: notes } = useNotesList(showArchived);
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const newNote = useNewNote();

  const visible = useMemo(
    () => filterNotes(notes, { kind, projectId: projectId || null, label: label || null }),
    [notes, kind, projectId, label]
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const labelColor = (name: string) => labels.find((l) => l.name === name)?.color ?? '#6366F1';
  const filtering = kind !== 'all' || projectId !== '' || label !== '';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-text-primary text-2xl font-bold mb-1">Notes</h1>
          <p className="text-text-secondary text-sm">{visible.length} notes</p>
        </div>
        <button
          type="button"
          onClick={() => void newNote()}
          className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
        >
          + New note
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap px-6 py-3 border-b border-border">
        <div role="group" aria-label="Note type" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className={`px-3 py-1 ${kind === k.value ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <select aria-label="Filter by project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={SELECT}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select aria-label="Filter by label" value={label} onChange={(e) => setLabel(e.target.value)} className={SELECT}>
          <option value="">All labels</option>
          {labels.filter((l) => l.name).map((l) => (
            <option key={l.id} value={l.name as string}>{l.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            {filtering ? (
              <p className="text-text-primary font-semibold text-lg">No notes match these filters</p>
            ) : (
              <>
                <p className="text-text-primary font-semibold text-lg">No notes yet</p>
                <p className="text-text-muted text-sm">Capture a thought or paste a link to get started.</p>
              </>
            )}
          </div>
        ) : (
          <ul className="max-w-3xl space-y-2" role="list">
            {visible.map((n) => {
              const p = n.project_id ? projectById.get(n.project_id) : null;
              return (
                <li key={n.id}>
                  <NoteRow note={n} project={p ? { name: p.name ?? '', color: p.color } : null} labelColor={labelColor} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the sidebar entry**

In `apps/web/components/layout/Sidebar.tsx`, in the `NAV` array replace:

```tsx
  { href: '/logbook',  label: 'Logbook',  icon: '✓' },
```

with:

```tsx
  { href: '/logbook',  label: 'Logbook',  icon: '✓' },
  { href: '/notes',    label: 'Notes',    icon: '📝' },
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NotesPage.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/notes/page.tsx apps/web/__tests__/NotesPage.test.tsx apps/web/components/layout/Sidebar.tsx
git commit -m "feat(web): add notes list page with filters and sidebar entry"
```

---

### Task 15: Note page (`/notes/[id]`)

**Files:**
- Create: `apps/web/app/notes/[id]/page.tsx`
- Create: `apps/web/__tests__/NotePage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotePage from '@/app/notes/[id]/page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'n1' }), useRouter: () => ({ push }) }));
vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } }),
}));
vi.mock('@/components/notes/NoteEditor', () => ({
  NoteEditor: ({ note }: { note: { id: string } }) => <div data-testid="editor">{note.id}</div>,
}));
vi.mock('@/components/notes/LinkedTasksPanel', () => ({
  LinkedTasksPanel: () => <div data-testid="linked-tasks" />,
}));
vi.mock('@/components/projects/ProjectPicker', () => ({ ProjectPicker: () => <div data-testid="project-picker" /> }));
vi.mock('@/components/tasks/LabelPicker', () => ({ LabelPicker: () => <div data-testid="label-picker" /> }));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useNote: vi.fn(),
  archiveNote: vi.fn().mockResolvedValue(undefined),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  setNoteProject: vi.fn(),
  setNoteLabels: vi.fn(),
}));

import { useNote, archiveNote, deleteNote } from '@todolist/db';

let notes: Record<string, any>;
const note = (over: Record<string, unknown> = {}) => ({
  id: 'n1', title: 'Plan', body: 'text', source_url: null, link_title: null, link_excerpt: null,
  link_image_url: null, link_site_name: null, link_status: null, project_id: null, labels: '[]',
  is_archived: 0, conflict_of: null, ...over,
});

describe('NotePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notes = { n1: note() };
    (useNote as any).mockImplementation((id: string) => ({ data: notes[id] ? [notes[id]] : [], isLoading: false }));
  });

  it('renders the editor and the linked tasks panel', () => {
    render(<NotePage />);
    expect(screen.getByTestId('editor')).toHaveTextContent('n1');
    expect(screen.getByTestId('linked-tasks')).toBeInTheDocument();
  });

  it('shows not found for a missing note', () => {
    notes = {};
    render(<NotePage />);
    expect(screen.getByText('Note not found')).toBeInTheDocument();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('shows a loading state while the note loads', () => {
    (useNote as any).mockReturnValue({ data: [], isLoading: true });
    render(<NotePage />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the link preview card for a link note', () => {
    notes.n1 = note({ source_url: 'https://example.com/a', link_title: 'An article', link_status: 'ok' });
    render(<NotePage />);
    expect(screen.getByText('An article')).toBeInTheDocument();
  });

  it('archives and unarchives', () => {
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(archiveNote).toHaveBeenCalledWith(expect.anything(), 'n1', true);
  });

  it('offers Unarchive for an archived note', () => {
    notes.n1 = note({ is_archived: 1 });
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Unarchive' }));
    expect(archiveNote).toHaveBeenCalledWith(expect.anything(), 'n1', false);
  });

  it('deletes after confirmation and returns to the list', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    await waitFor(() => expect(deleteNote).toHaveBeenCalledWith(expect.anything(), 'n1'));
    expect(push).toHaveBeenCalledWith('/notes');
    vi.unstubAllGlobals();
  });

  it('does not delete when the confirmation is declined', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    render(<NotePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(deleteNote).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  describe('conflict copy', () => {
    beforeEach(() => {
      notes.n1 = note({ conflict_of: 'orig' });
      notes.orig = note({ id: 'orig', title: 'Original plan' });
    });

    it('shows the banner naming the original and opens it', () => {
      render(<NotePage />);
      expect(screen.getByText(/Conflict copy of/)).toHaveTextContent('Original plan');
      fireEvent.click(screen.getByRole('button', { name: 'Open original' }));
      expect(push).toHaveBeenCalledWith('/notes/orig');
    });

    it('deletes the copy after confirmation and goes to the original', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      render(<NotePage />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete copy' }));
      await waitFor(() => expect(deleteNote).toHaveBeenCalledWith(expect.anything(), 'n1'));
      expect(push).toHaveBeenCalledWith('/notes/orig');
      vi.unstubAllGlobals();
    });

    it('copes with an original that no longer exists', () => {
      delete notes.orig;
      render(<NotePage />);
      expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Open original' })).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NotePage.test.tsx`
Expected: FAIL, cannot resolve `@/app/notes/[id]/page`.

- [ ] **Step 3: Implement**

`apps/web/app/notes/[id]/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { usePowerSync } from '@powersync/react';
import { noteDisplayTitle, parseLabelsJson } from '@todolist/core';
import { archiveNote, deleteNote, setNoteLabels, setNoteProject, useNote } from '@todolist/db';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ProjectPicker } from '@/components/projects/ProjectPicker';
import { LabelPicker } from '@/components/tasks/LabelPicker';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { LinkPreviewCard } from '@/components/notes/LinkPreviewCard';
import { ConflictBanner } from '@/components/notes/ConflictBanner';
import { LinkedTasksPanel } from '@/components/notes/LinkedTasksPanel';

export default function NotePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const db = usePowerSync();
  const { userId } = useCurrentUser();
  const { data, isLoading } = useNote(id);
  const note = data?.[0];
  const { data: originalRows } = useNote(note?.conflict_of ?? '');
  const original = originalRows?.[0];

  if (!note) {
    return (
      <div className="px-6 py-8">
        {isLoading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : (
          <>
            <p className="text-text-primary font-semibold text-lg">Note not found</p>
            <Link href="/notes" className="text-accent text-sm hover:underline">Back to notes</Link>
          </>
        )}
      </div>
    );
  }

  const archived = !!note.is_archived;

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return;
    await deleteNote(db as any, note.id);
    router.push('/notes');
  };

  const handleDeleteCopy = async () => {
    if (!confirm('Delete this conflict copy? Make sure you have kept anything you need from it.')) return;
    await deleteNote(db as any, note.id);
    router.push(original ? `/notes/${original.id}` : '/notes');
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/notes" className="text-text-muted text-sm hover:text-text-primary">← Notes</Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void archiveNote(db as any, note.id, !archived)}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
          <button type="button" onClick={() => void handleDelete()} className="text-sm text-error hover:underline">
            Delete note
          </button>
        </div>
      </div>

      {note.conflict_of && (
        <ConflictBanner
          originalTitle={original ? noteDisplayTitle(original) : null}
          hasOriginal={!!original}
          onOpenOriginal={() => original && router.push(`/notes/${original.id}`)}
          onDeleteCopy={() => void handleDeleteCopy()}
        />
      )}

      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Project</p>
          <ProjectPicker value={note.project_id ?? null} onChange={(pid) => void setNoteProject(db as any, note.id, pid)} />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Labels</p>
          <LabelPicker
            selected={parseLabelsJson(note.labels)}
            onChange={(labels) => void setNoteLabels(db as any, note.id, labels)}
          />
        </div>
      </div>

      {note.source_url && (
        <LinkPreviewCard
          url={note.source_url}
          title={note.link_title}
          excerpt={note.link_excerpt}
          imageUrl={note.link_image_url}
          siteName={note.link_site_name}
          status={note.link_status}
        />
      )}

      <NoteEditor key={note.id} note={note} userId={userId} />

      <LinkedTasksPanel noteId={note.id} userId={userId} />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/NotePage.test.tsx`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/notes/[id]/page.tsx" apps/web/__tests__/NotePage.test.tsx
git commit -m "feat(web): add note page with editor, preview card, conflict banner and linked tasks"
```

---

### Task 16: "Linked notes" section on the task detail panel

**Files:**
- Create: `apps/web/components/notes/LinkedNotesSection.tsx`
- Create: `apps/web/__tests__/LinkedNotesSection.test.tsx`
- Modify: `apps/web/components/tasks/TaskDetailPanel.tsx`
- Modify: `apps/web/__tests__/TaskDetailPanel.test.tsx`

The section is only rendered inside the panel's open branch, so closed panels (and the page tests that render them) run none of these hooks.

- [ ] **Step 1: Write the failing test**

`apps/web/__tests__/LinkedNotesSection.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } }),
}));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useLinkedNotes: vi.fn(),
  useNoteSearch: vi.fn(),
  linkNoteToTask: vi.fn().mockResolvedValue(undefined),
  unlinkNoteFromTask: vi.fn().mockResolvedValue(undefined),
  createLinkedNote: vi.fn().mockResolvedValue({ noteId: 'n9' }),
}));

import { useLinkedNotes, useNoteSearch, linkNoteToTask, unlinkNoteFromTask, createLinkedNote } from '@todolist/db';
import { LinkedNotesSection } from '@/components/notes/LinkedNotesSection';

const linked = [{ id: 'n1', title: 'Meeting notes', body: '', link_title: null, source_url: null, updated_at: '2026-11-25T10:00:00.000Z' }];

describe('LinkedNotesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLinkedNotes as any).mockReturnValue({ data: linked });
    (useNoteSearch as any).mockReturnValue({ data: [] });
  });

  it('lists linked notes as links to the editor', () => {
    render(<LinkedNotesSection taskId="t1" />);
    expect(screen.getByRole('link', { name: 'Meeting notes' })).toHaveAttribute('href', '/notes/n1');
  });

  it('shows an empty state', () => {
    (useLinkedNotes as any).mockReturnValue({ data: [] });
    render(<LinkedNotesSection taskId="t1" />);
    expect(screen.getByText('No linked notes')).toBeInTheDocument();
  });

  it('unlinks without deleting the note', () => {
    render(<LinkedNotesSection taskId="t1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Unlink Meeting notes' }));
    expect(unlinkNoteFromTask).toHaveBeenCalledWith(expect.anything(), 'n1', 't1');
  });

  it('links an existing note, hiding notes already linked', async () => {
    (useNoteSearch as any).mockReturnValue({
      data: [
        { id: 'n1', title: 'Meeting notes', body: '', link_title: null },
        { id: 'n2', title: 'Budget ideas', body: '', link_title: null },
      ],
    });
    render(<LinkedNotesSection taskId="t1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Link existing' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '+ Link existing' }));
    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'budget' } });

    expect(screen.queryByRole('button', { name: 'Meeting notes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Budget ideas' }));
    await waitFor(() => expect(linkNoteToTask).toHaveBeenCalledWith(expect.anything(), 'u1', 'n2', 't1'));
  });

  it('creates a linked note and opens it', async () => {
    render(<LinkedNotesSection taskId="t1" />);
    await waitFor(() => expect(createLinkedNote).not.toHaveBeenCalled());
    await waitFor(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ New note' }));
      expect(createLinkedNote).toHaveBeenCalled();
    });
    expect(createLinkedNote).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', taskId: 't1', title: '' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/notes/n9'));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/LinkedNotesSection.test.tsx`
Expected: FAIL, cannot resolve `@/components/notes/LinkedNotesSection`.

- [ ] **Step 3: Implement the section**

`apps/web/components/notes/LinkedNotesSection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePowerSync } from '@powersync/react';
import { noteDisplayTitle } from '@todolist/core';
import { createLinkedNote, linkNoteToTask, unlinkNoteFromTask, useLinkedNotes, useNoteSearch } from '@todolist/db';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { SearchPicker } from './SearchPicker';

function LinkNotePicker({ excludeIds, onPick, onClose }: {
  excludeIds: Set<string>;
  onPick: (noteId: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useNoteSearch(term, false);
  const results = data.filter((n) => !excludeIds.has(n.id)).map((n) => ({ id: n.id, label: noteDisplayTitle(n) }));
  return (
    <SearchPicker label="Search notes" term={term} onTermChange={setTerm} results={results} onPick={onPick} onClose={onClose} />
  );
}

export function LinkedNotesSection({ taskId }: { taskId: string }) {
  const db = usePowerSync();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { data: notes } = useLinkedNotes(taskId);
  const [picking, setPicking] = useState(false);

  const pick = async (noteId: string) => {
    if (!userId) return;
    await linkNoteToTask(db as any, userId, noteId, taskId);
    setPicking(false);
  };

  const createNew = async () => {
    if (!userId) return;
    const { noteId } = await createLinkedNote(db as any, { userId, taskId, title: '' });
    router.push(`/notes/${noteId}`);
  };

  return (
    <div>
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Linked notes</p>

      {notes.length === 0 ? (
        <p className="text-text-muted text-sm">No linked notes</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const title = noteDisplayTitle(n);
            return (
              <li key={n.id} className="flex items-center gap-3">
                <Link href={`/notes/${n.id}`} className="flex-1 truncate text-sm text-accent hover:underline">
                  {title}
                </Link>
                <button
                  type="button"
                  onClick={() => unlinkNoteFromTask(db as any, n.id, taskId)}
                  aria-label={`Unlink ${title}`}
                  className="text-text-muted hover:text-error text-sm"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {picking && (
        <LinkNotePicker excludeIds={new Set(notes.map((n) => n.id))} onPick={pick} onClose={() => setPicking(false)} />
      )}

      {!picking && (
        <div className="mt-3 flex gap-4">
          <button type="button" onClick={() => setPicking(true)} className="text-accent text-sm hover:opacity-80">
            + Link existing
          </button>
          <button type="button" onClick={() => void createNew()} className="text-accent text-sm hover:opacity-80">
            + New note
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Render it in `TaskDetailPanel`**

In `apps/web/components/tasks/TaskDetailPanel.tsx` add to the imports:

```tsx
import { LinkedNotesSection } from '@/components/notes/LinkedNotesSection';
```

and insert the section between the sub-tasks block and the delete block. Replace:

```tsx
            {/* Delete */}
            <div className="pt-4 border-t border-border">
```

with:

```tsx
            {/* Linked notes */}
            <LinkedNotesSection taskId={task.id} />

            {/* Delete */}
            <div className="pt-4 border-t border-border">
```

- [ ] **Step 5: Keep the existing panel test green**

The panel now renders hooks that need a router and `useLinkedNotes`. In `apps/web/__tests__/TaskDetailPanel.test.tsx`, add this mock below the `@powersync/react` mock:

```tsx
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
```

and add this line to the object returned by the existing `vi.mock('@todolist/db', …)` factory (next to `useAttachmentsForTask`):

```tsx
    useLinkedNotes: vi.fn(() => ({ data: [] })),
```

Then add one test inside the existing top-level `describe('TaskDetailPanel description field', …)` block:

```tsx
  it('renders a Linked notes section', () => {
    render(<TaskDetailPanel taskId="task-1" onClose={vi.fn()} />);
    expect(screen.getByText('Linked notes')).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run to verify pass**

Run:
```bash
pnpm --filter @todolist/web exec vitest run __tests__/LinkedNotesSection.test.tsx __tests__/TaskDetailPanel.test.tsx __tests__/MatrixPage.test.tsx
```
Expected: PASS. (`MatrixPage` mocks the panel, so it should be unaffected; it is included to prove that.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/notes/LinkedNotesSection.tsx apps/web/__tests__/LinkedNotesSection.test.tsx apps/web/components/tasks/TaskDetailPanel.tsx apps/web/__tests__/TaskDetailPanel.test.tsx
git commit -m "feat(web): show linked notes on the task detail panel"
```

---

### Task 17: Notes section on project pages

**Files:**
- Create: `apps/web/components/notes/ProjectNotesSection.tsx`
- Create: `apps/web/__tests__/ProjectNotesSection.test.tsx`
- Modify: `apps/web/app/projects/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectNotesSection } from '@/components/notes/ProjectNotesSection';

const newNote = vi.fn();
vi.mock('@/hooks/useNewNote', () => ({ useNewNote: () => newNote }));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useNotesByProject: vi.fn(),
}));

import { useNotesByProject } from '@todolist/db';

const row = (over: Record<string, unknown>) => ({
  id: 'n1', title: 'Kickoff notes', body: '', link_title: null, link_excerpt: null, link_image_url: null,
  link_site_name: null, source_url: null, link_status: null, is_archived: 0, is_processed: 0,
  project_id: 'p1', labels: '[]', conflict_of: null, updated_at: '2026-11-25T10:00:00.000Z', ...over,
});

describe('ProjectNotesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNotesByProject as any).mockReturnValue({ data: [row({})] });
  });

  it('lists the project notes', () => {
    render(<ProjectNotesSection projectId="p1" />);
    expect(useNotesByProject).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Kickoff notes')).toBeInTheDocument();
  });

  it('shows an empty message', () => {
    (useNotesByProject as any).mockReturnValue({ data: [] });
    render(<ProjectNotesSection projectId="p1" />);
    expect(screen.getByText('No notes in this project yet')).toBeInTheDocument();
  });

  it('adds a note inside the project', () => {
    render(<ProjectNotesSection projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add note' }));
    expect(newNote).toHaveBeenCalledWith({ projectId: 'p1' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/ProjectNotesSection.test.tsx`
Expected: FAIL, cannot resolve the component.

- [ ] **Step 3: Implement**

`apps/web/components/notes/ProjectNotesSection.tsx`:

```tsx
'use client';

import { useNotesByProject } from '@todolist/db';
import { useNewNote } from '@/hooks/useNewNote';
import { NoteRow } from './NoteRow';

export function ProjectNotesSection({ projectId }: { projectId: string }) {
  const { data: notes } = useNotesByProject(projectId);
  const newNote = useNewNote();

  return (
    <section aria-label="Project notes" className="border-t border-border px-6 py-4 max-h-72 overflow-y-auto scrollable">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes</h2>
        <button type="button" onClick={() => void newNote({ projectId })} className="text-accent text-sm hover:opacity-80">
          + Add note
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-text-muted text-sm">No notes in this project yet</p>
      ) : (
        <ul className="space-y-2" role="list">
          {notes.map((n) => (
            <li key={n.id}>
              <NoteRow note={n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Render it on the project page**

In `apps/web/app/projects/[id]/page.tsx` add the import:

```tsx
import { ProjectNotesSection } from '@/components/notes/ProjectNotesSection';
```

and render it as the last child of the main column. Replace:

```tsx
          <div className="flex-1 overflow-hidden">
            <TaskList tasks={tasks as any} onPress={setDetailId} onComplete={handleComplete} />
          </div>
        )}
      </div>
```

with:

```tsx
          <div className="flex-1 overflow-hidden">
            <TaskList tasks={tasks as any} onPress={setDetailId} onComplete={handleComplete} />
          </div>
        )}

        <ProjectNotesSection projectId={id} />
      </div>
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/ProjectNotesSection.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/notes/ProjectNotesSection.tsx apps/web/__tests__/ProjectNotesSection.test.tsx "apps/web/app/projects/[id]/page.tsx"
git commit -m "feat(web): show a notes section on project pages"
```

---

### Task 18: Search page with Tasks | Notes scope

**Files:**
- Modify (replace): `apps/web/app/search/page.tsx`
- Create: `apps/web/__tests__/SearchPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SearchPage from '@/app/search/page';

vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/components/tasks/TaskDetailPanel', () => ({ TaskDetailPanel: () => null }));
vi.mock('@/components/tasks/TaskList', () => ({
  TaskList: ({ tasks }: { tasks: { id: string; title: string }[] }) => (
    <ul>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
  ),
}));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useTaskSearch: vi.fn(),
  useNoteSearch: vi.fn(),
  completeTask: vi.fn(),
}));

import { useTaskSearch, useNoteSearch } from '@todolist/db';

const noteRow = {
  id: 'n1', title: 'Budget ideas', body: '', link_title: null, link_excerpt: null, link_image_url: null,
  link_site_name: null, source_url: null, link_status: null, is_archived: 0, is_processed: 0,
  project_id: null, labels: '[]', conflict_of: null, updated_at: '2026-11-25T10:00:00.000Z',
};

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTaskSearch as any).mockReturnValue({ data: [{ id: 't1', title: 'Pay the bill' }] });
    (useNoteSearch as any).mockReturnValue({ data: [noteRow] });
  });

  it('asks for a query before showing anything', () => {
    render(<SearchPage />);
    expect(screen.getByText('Type to search')).toBeInTheDocument();
    expect(screen.queryByText('Pay the bill')).toBeNull();
  });

  it('searches tasks by default', () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'bill' } });
    expect(useTaskSearch).toHaveBeenLastCalledWith('bill');
    expect(screen.getByText('Pay the bill')).toBeInTheDocument();
    expect(screen.queryByText('Budget ideas')).toBeNull();
  });

  it('switches to notes', () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'budget' } });
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByText('Budget ideas')).toBeInTheDocument();
    expect(screen.queryByText('Pay the bill')).toBeNull();
  });

  it('includes archived notes only when asked', () => {
    render(<SearchPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(useNoteSearch).toHaveBeenLastCalledWith('', false);
    fireEvent.click(screen.getByLabelText('Include archived'));
    expect(useNoteSearch).toHaveBeenLastCalledWith('', true);
  });

  it('says when nothing matches', () => {
    (useTaskSearch as any).mockReturnValue({ data: [] });
    render(<SearchPage />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/SearchPage.test.tsx`
Expected: FAIL (the page is still the "Search coming soon" stub).

- [ ] **Step 3: Replace the page**

`apps/web/app/search/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { completeTask, useNoteSearch, useTaskSearch } from '@todolist/db';
import { NoteRow } from '@/components/notes/NoteRow';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

type Scope = 'tasks' | 'notes';

export default function SearchPage() {
  const db = usePowerSync();
  const [term, setTerm] = useState('');
  const [scope, setScope] = useState<Scope>('tasks');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const query = term.trim();
  const { data: tasks } = useTaskSearch(query);
  const { data: notes } = useNoteSearch(query, includeArchived);

  const empty = scope === 'tasks' ? tasks.length === 0 : notes.length === 0;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-border space-y-3">
          <h1 className="text-text-primary text-2xl font-bold">Search</h1>
          <input
            autoFocus
            aria-label="Search"
            placeholder="Search tasks and notes…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full max-w-xl bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-4">
            <div role="group" aria-label="Search scope" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
              {(['tasks', 'notes'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1 ${scope === s ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
                >
                  {s === 'tasks' ? 'Tasks' : 'Notes'}
                </button>
              ))}
            </div>
            {scope === 'notes' && (
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
                Include archived
              </label>
            )}
          </div>
        </div>

        {query === '' ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-sm">Type to search</p>
          </div>
        ) : empty ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-sm">No results</p>
          </div>
        ) : scope === 'tasks' ? (
          <div className="flex-1 overflow-hidden">
            <TaskList
              tasks={tasks as any}
              onPress={setDetailId}
              onComplete={(id) => { void completeTask(db as any, id); }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
            <ul className="max-w-3xl space-y-2" role="list">
              {notes.map((n) => (
                <li key={n.id}>
                  <NoteRow note={n} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/SearchPage.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/search/page.tsx apps/web/__tests__/SearchPage.test.tsx
git commit -m "feat(web): search page with Tasks | Notes scope"
```

---

### Task 19: `n` shortcut for a new note

**Files:**
- Create: `apps/web/lib/shortcuts/shouldIgnoreShortcut.ts`
- Create: `apps/web/__tests__/KeyboardShortcuts.test.tsx`
- Modify: `apps/web/components/layout/KeyboardShortcuts.tsx`
- Modify: `apps/web/components/layout/ShortcutsOverlay.tsx`

The spec says to verify `n` is free before using it. It is: the only existing shortcuts are `Cmd/Ctrl+Enter` and `Cmd/Ctrl+/` (`KeyboardShortcuts.tsx`), and there is no tinykeys map. A bare `n` must never fire while the user is typing, with a modifier held, or inside a dialog.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldIgnoreShortcut } from '@/lib/shortcuts/shouldIgnoreShortcut';

const newNote = vi.fn();
vi.mock('@/hooks/useNewNote', () => ({ useNewNote: () => newNote }));
vi.mock('@/lib/shortcuts/ShortcutContext', () => ({ useShortcuts: () => ({ openShortcuts: vi.fn() }) }));

import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';

describe('shouldIgnoreShortcut', () => {
  it('ignores typing targets', () => {
    expect(shouldIgnoreShortcut(document.createElement('input'))).toBe(true);
    expect(shouldIgnoreShortcut(document.createElement('textarea'))).toBe(true);
    expect(shouldIgnoreShortcut(document.createElement('select'))).toBe(true);
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(shouldIgnoreShortcut(editable)).toBe(true);
  });

  it('ignores anything inside a dialog', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    expect(shouldIgnoreShortcut(button)).toBe(true);
  });

  it('allows the page body and buttons', () => {
    expect(shouldIgnoreShortcut(document.body)).toBe(false);
    expect(shouldIgnoreShortcut(document.createElement('button'))).toBe(false);
    expect(shouldIgnoreShortcut(null)).toBe(false);
  });
});

describe('KeyboardShortcuts: n for new note', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  const mount = () => render(<KeyboardShortcuts onOpenQuickCapture={vi.fn()}><div /></KeyboardShortcuts>);

  it('creates a note on a bare n', () => {
    mount();
    fireEvent.keyDown(document.body, { key: 'n' });
    expect(newNote).toHaveBeenCalledTimes(1);
  });

  it('does nothing while typing in a field', () => {
    mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'n' });
    expect(newNote).not.toHaveBeenCalled();
    input.remove();
  });

  it('does nothing with a modifier held', () => {
    mount();
    fireEvent.keyDown(document.body, { key: 'n', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'n', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'n', altKey: true });
    fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    expect(newNote).not.toHaveBeenCalled();
  });

  it('still opens quick capture on Cmd+Enter', () => {
    const onOpen = vi.fn();
    render(<KeyboardShortcuts onOpenQuickCapture={onOpen}><div /></KeyboardShortcuts>);
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/KeyboardShortcuts.test.tsx`
Expected: FAIL, cannot resolve `@/lib/shortcuts/shouldIgnoreShortcut`.

- [ ] **Step 3: Implement**

`apps/web/lib/shortcuts/shouldIgnoreShortcut.ts`:

```ts
// Single-key shortcuts must not fire while the user is typing or inside a dialog.
export function shouldIgnoreShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  return target.closest('[role="dialog"]') !== null;
}
```

Replace `apps/web/components/layout/KeyboardShortcuts.tsx` with:

```tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';
import { shouldIgnoreShortcut } from '@/lib/shortcuts/shouldIgnoreShortcut';
import { useNewNote } from '@/hooks/useNewNote';

interface Props {
  children: ReactNode;
  onOpenQuickCapture: () => void;
}

export function KeyboardShortcuts({ children, onOpenQuickCapture }: Props) {
  const { openShortcuts } = useShortcuts();
  const newNote = useNewNote();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter for quick capture
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onOpenQuickCapture();
      }
      // Cmd+/ or Ctrl+/ to open shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        openShortcuts();
      }
      // n for a new note (never while typing or with a modifier held)
      if (
        e.key === 'n' &&
        !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey &&
        !shouldIgnoreShortcut(e.target)
      ) {
        e.preventDefault();
        void newNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenQuickCapture, openShortcuts, newNote]);

  return <>{children}</>;
}
```

In `apps/web/components/layout/ShortcutsOverlay.tsx`, add a row after the "Open Filters" row:

```tsx
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-700">New note</span>
            <kbd className="px-2 py-1 bg-gray-200 rounded">n</kbd>
          </div>
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/KeyboardShortcuts.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/shortcuts apps/web/components/layout/KeyboardShortcuts.tsx apps/web/components/layout/ShortcutsOverlay.tsx apps/web/__tests__/KeyboardShortcuts.test.tsx
git commit -m "feat(web): n shortcut creates a new note"
```

---

### Task 20: Full verification and manual end-to-end check

**Files:** none (verification only; fix anything it finds in the file that caused it).

Known pre-existing failures on this branch, unrelated to notes: `apps/web` `CreateLabelModal.test.tsx`, and `apps/mobile` typecheck errors in `ProgressRing.tsx`, `PomodoroContext.tsx`, `usePomodoro.ts`, `SwipeableTaskRow.tsx`. Anything else that fails is new and must be fixed.

- [ ] **Step 1: Rebuild the shared packages**

Run: `pnpm --filter @todolist/core build && pnpm --filter @todolist/db build`
Expected: clean.

- [ ] **Step 2: Tests, types, lint**

Run:
```bash
pnpm test
pnpm typecheck
pnpm lint
```
Expected: all pass apart from the known pre-existing failures. Show the output (CLAUDE.md: don't just assert it works). If a web test fails with `invariant expected app router to be mounted`, that test renders an open `TaskDetailPanel`; add `vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))` and `useLinkedNotes: vi.fn(() => ({ data: [] }))` to its mocks, exactly as in Task 16 Step 5.

- [ ] **Step 3: Full production build**

Run: `pnpm build`
Expected: Turbo build succeeds, including the new `/notes`, `/notes/[id]` and `/search` routes. (This catches the ESM-only `react-markdown` import under Next 14, which unit tests cannot.)

- [ ] **Step 4: Manual end-to-end check (replaces the spec's Playwright test; see "Decisions")**

Prerequisites: sync rules deployed; for step 7, `enrich-url` deployed to the live project. Start the app with `pnpm dev`, sign in, and use the Supabase dashboard SQL editor for the Postgres checks.

1. **Create + sync (silent-failure guard).** Press `n` on any non-input page. Type a title and some body text, wait one second. In SQL: `select id, title, left(body, 30), revision from notes order by created_at desc limit 3;` — the row must exist with your text. If it is missing, check sync rules before blaming the UI.
2. **Second session.** Open the app in a private window signed in as the same user. The note must appear in Notes within a few seconds.
3. **Link a task.** In the note: `+ New task` → "Book flights" → Enter. In SQL: `select status, priority, sort_order, labels from tasks order by created_at desc limit 1;` must show `inbox | 4 | a0 | []`, and `select from_type, to_type, origin from links order by created_at desc limit 1;` must show `note | task | manual`. (This proves the Task 1 fix: the task survived upload.)
4. **Selection → task.** Select a line of body text, click `→ Task`. A linked task appears with the cleaned title.
5. **Complete from the note.** Tick the checkbox on a linked task; the task shows struck through, and in the Today/Inbox views it is gone.
6. **Search.** Go to Search, type part of the note body, switch to Notes: the note is listed. Archive it: it disappears unless "Include archived" is ticked.
7. **Link preview.** Create a note and paste `https://example.com` into the empty body. A skeleton appears, then a card (title "Example Domain"). Turn the network off, paste a URL in another new note: it stays a skeleton, then resolves after reconnecting.
8. **Task side.** Open the task in the detail panel: "Linked notes" lists the note; `+ New note` opens the editor.
9. **Conflict copy.** Open the same note in two windows. Set both to Offline (DevTools → Network). Edit the body differently in each, then bring window A online, wait for sync, then window B. A "(conflict, …)" note must appear in the list with the "Conflict copy" badge; opening it shows the banner, and **Open original** / **Delete copy** work.
10. **Delete.** Delete the note; its links disappear from the task panel (`select count(*) from links where from_id = '<note id>' or to_id = '<note id>';` is 0).

- [ ] **Step 5: Report**

Report the test/typecheck/lint/build output and the result of each manual step. Do not mark the plan complete if any step 4 item fails.

---

## Self-review

**Spec coverage (design spec §3 UI, web only)**

| Spec requirement | Task |
|---|---|
| Notes sidebar entry, "New note" button, `n` shortcut (verify free) | 14, 19 |
| Notes list: sort, row contents, filters All/Links/Thoughts, project, label, Show archived | 4, 6, 11, 14 |
| Project pages get a Notes section | 17 |
| Editor: title + markdown body, Edit/Preview toggle | 7, 12 |
| Toolbar (bold, italic, heading, list, checkbox, link) | 12 |
| Autosave 500 ms + blur + navigation, no save button | 8, 12 |
| Link notes: preview card, skeleton while pending, bare URL if failed | 11, 15 |
| Paste URL into empty note → `source_url`, pending, enrichment | 2, 9, 12 |
| Pending-enricher on start/reconnect, 3 attempts then failed | 9, 10 |
| Conflict banner with Open original / Delete copy | 4, 11, 15 |
| Linked tasks panel: complete in place, Link existing, New task, Selection → task | 13, 12 |
| Linked notes on the task detail panel: Link existing, New note | 16 |
| Unlink deletes the link row only | 13, 16 |
| Search scope Tasks \| Notes, LIKE, archived toggle, one query function | 5, 18 |
| Delete removes links in the same transaction | 3 |
| Silent-failure guards (row actually arrived, links, conflict path) | 20 (manual) |
| Done = lint + typecheck + test + `pnpm build` output shown | 20 |

Not in this plan by design: mobile UI and share-sheet toggle (separate plan), capture inbox/review loop (roadmap phase 3), Playwright E2E (see Decisions).

**Placeholder scan:** none. Every code step contains the code; every test step contains the test.

**Type and name consistency checked:** `NoteListRow`/`NOTE_LIST_COLUMNS` (Task 4) are used by `search.ts` (5), `NoteRow` (11), pages (14, 18). `updateNote(db, id, { title?, body? })` (Task 2) matches the editor call (12). `useNewNote({ projectId })` (10) matches Tasks 14, 17, 19. `runPendingEnrichment(db, invoke, state)` and `enrichState` (9) match the runner (10) and editor (12). `ToolbarAction` literals match between toolbar and editor. `useLinkedTasks`/`useLinkedNotes`/`linkNoteToTask`/`unlinkNoteFromTask`/`createLinkedTask`/`createLinkedNote` signatures match `packages/db` as shipped.
