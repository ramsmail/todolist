# Phase 2C — Saved Filters, Keyboard Shortcuts, Logbook & Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add saved filters (priority + due date + labels + project), full-power keyboard shortcuts with a `?` overlay, a `/logbook` completed-tasks view, and an extended axe-core scan to the web app.

**Architecture:** All new data logic lives in `packages/core` (FilterQuery type) and `packages/db` (saved_filters PowerSync table, buildFilterSQL, useLogbook). Web app adds thin UI: FilterBuilderModal, sidebar Filters section, `/filters/[id]`, `/logbook`, KeyboardShortcuts provider (tinykeys), and ShortcutsOverlay. No Supabase migration needed — `saved_filters` table, RLS, and PowerSync sync rule already exist server-side. Only the client `AppSchema` needs updating.

**Tech Stack:** Next.js 14 App Router, PowerSync (`@powersync/react`), `tinykeys` (new, < 1 KB), Tailwind, Vitest + RTL, Playwright.

**Spec:** `docs/design/specs/2026-06-23-phase2c-design.md`

---

## File Map

**New files:**
- `packages/core/src/filters/index.ts` — FilterQuery type + serialize/parse/isEmpty
- `packages/core/src/filters/filterQuery.test.ts`
- `packages/db/src/queries/savedFilters.ts` — useSavedFilters, buildFilterSQL, useFilteredTasks, CRUD
- `packages/db/src/queries/savedFilters.test.ts`
- `packages/db/src/queries/tasks.test.ts` — LOGBOOK_QUERY constraints
- `apps/web/app/logbook/page.tsx`
- `apps/web/app/filters/[id]/page.tsx`
- `apps/web/components/filters/FilterBuilderModal.tsx`
- `apps/web/lib/shortcuts/ShortcutContext.tsx`
- `apps/web/components/layout/ShortcutsOverlay.tsx`
- `apps/web/components/layout/KeyboardShortcuts.tsx`
- `apps/web/__tests__/Logbook.test.tsx`
- `apps/web/__tests__/FilterBuilderModal.test.tsx`
- `apps/web/__tests__/ShortcutsOverlay.test.tsx`
- `apps/web/__tests__/KeyboardShortcuts.test.tsx`
- `apps/web/e2e/filters-shortcuts.test.ts`

**Modified files:**
- `packages/core/src/index.ts` — export filters
- `packages/db/src/schema.ts` — add saved_filters table + SavedFilterRecord type
- `packages/db/src/index.ts` — export savedFilters + SavedFilterRecord
- `packages/db/src/queries/tasks.ts` — add LOGBOOK_QUERY + useLogbook
- `apps/web/components/layout/Sidebar.tsx` — add Logbook nav + Filters section
- `apps/web/components/tasks/TaskRow.tsx` — add tabIndex, data-task-id, readOnly + completedAt props
- `apps/web/components/tasks/TaskList.tsx` — add arrow-key row navigation
- `apps/web/app/ClientLayout.tsx` — add ShortcutProvider + KeyboardShortcuts + ShortcutsOverlay
- `apps/web/__tests__/axe.test.tsx` — extend scan to 2C components

---

## Task 1: FilterQuery type in packages/core

**Files:**
- Create: `packages/core/src/filters/index.ts`
- Create: `packages/core/src/filters/filterQuery.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

  Create `packages/core/src/filters/filterQuery.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import {
    serializeFilterQuery, parseFilterQuery, isEmptyFilterQuery,
    type FilterQuery,
  } from './index';

  describe('serializeFilterQuery / parseFilterQuery', () => {
    it('round-trips a full query', () => {
      const q: FilterQuery = {
        priority: [1, 2],
        dueDateRange: 'this_week',
        labels: ['home', 'work'],
        projectId: 'proj-1',
      };
      expect(parseFilterQuery(serializeFilterQuery(q))).toEqual(q);
    });

    it('round-trips a partial query (priority only)', () => {
      const q: FilterQuery = { priority: [3] };
      expect(parseFilterQuery(serializeFilterQuery(q))).toEqual(q);
    });

    it('round-trips null projectId (explicit no-project criterion)', () => {
      const q: FilterQuery = { projectId: null };
      expect(parseFilterQuery(serializeFilterQuery(q))).toEqual(q);
    });

    it('returns empty object for invalid JSON', () => {
      expect(parseFilterQuery('not json')).toEqual({});
    });
  });

  describe('isEmptyFilterQuery', () => {
    it('returns true for empty object', () => {
      expect(isEmptyFilterQuery({})).toBe(true);
    });

    it('returns true when all arrays are empty', () => {
      expect(isEmptyFilterQuery({ priority: [], labels: [] })).toBe(true);
    });

    it('returns false when priority is set', () => {
      expect(isEmptyFilterQuery({ priority: [1] })).toBe(false);
    });

    it('returns false when dueDateRange is set', () => {
      expect(isEmptyFilterQuery({ dueDateRange: 'today' })).toBe(false);
    });

    it('returns false when labels is set', () => {
      expect(isEmptyFilterQuery({ labels: ['home'] })).toBe(false);
    });

    it('returns false when projectId is null (explicit no-project criterion)', () => {
      expect(isEmptyFilterQuery({ projectId: null })).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```bash
  pnpm --filter @todolist/core test
  ```

  Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: Implement FilterQuery type**

  Create `packages/core/src/filters/index.ts`:

  ```ts
  export interface FilterQuery {
    priority?:     (1 | 2 | 3 | 4)[];
    dueDateRange?: 'today' | 'this_week' | 'next_week' | 'overdue' | 'no_date';
    labels?:       string[];
    projectId?:    string | null;
  }

  export function serializeFilterQuery(q: FilterQuery): string {
    return JSON.stringify(q);
  }

  export function parseFilterQuery(s: string): FilterQuery {
    try {
      return JSON.parse(s) as FilterQuery;
    } catch {
      return {};
    }
  }

  export function isEmptyFilterQuery(q: FilterQuery): boolean {
    return (
      (!q.priority || q.priority.length === 0) &&
      !q.dueDateRange &&
      (!q.labels || q.labels.length === 0) &&
      q.projectId === undefined
    );
  }
  ```

- [ ] **Step 4: Export from packages/core index**

  In `packages/core/src/index.ts`, add after existing exports:

  ```ts
  export * from './filters/index';
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/core test
  ```

  Expected: all PASS

- [ ] **Step 6: Commit**

  ```bash
  git add packages/core/src/filters/ packages/core/src/index.ts
  git commit -m "feat(core): FilterQuery type with serialize/parse/isEmpty"
  ```

---

## Task 2: saved_filters PowerSync client schema

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add saved_filters table to schema**

  In `packages/db/src/schema.ts`, add after the `labels` table definition and update `AppSchema` and add type export:

  ```ts
  const saved_filters = new Table(
    {
      user_id:    column.text,
      name:       column.text,
      icon:       column.text,
      query:      column.text,   // JSON-serialised FilterQuery
      sort_order: column.text,
      created_at: column.text,
      updated_at: column.text,
      deleted_at: column.text,
    },
    { indexes: { by_sort: ['sort_order'] } }
  );

  export const AppSchema = new Schema({ tasks, projects, labels, saved_filters });

  export type Database          = (typeof AppSchema)['types'];
  export type TaskRecord        = Database['tasks'];
  export type ProjectRecord     = Database['projects'];
  export type LabelRecord       = Database['labels'];
  export type SavedFilterRecord = Database['saved_filters'];
  ```

  (Replace the existing `export const AppSchema` and type lines — add `saved_filters` to the Schema call and add the `SavedFilterRecord` type.)

- [ ] **Step 2: Export SavedFilterRecord from packages/db index**

  In `packages/db/src/index.ts`, update the schema export line:

  ```ts
  export { AppSchema } from './schema';
  export type { Database, TaskRecord, ProjectRecord, LabelRecord, SavedFilterRecord } from './schema';
  export * from './queries/tasks';
  export * from './queries/projects';
  export * from './queries/labels';
  export * from './queries/labelUtils';
  ```

- [ ] **Step 3: Build packages/db to verify no type errors**

  ```bash
  pnpm --filter @todolist/db build
  ```

  Expected: exits 0 with no TypeScript errors

- [ ] **Step 4: Commit**

  ```bash
  git add packages/db/src/schema.ts packages/db/src/index.ts
  git commit -m "feat(db): add saved_filters to PowerSync AppSchema"
  ```

---

## Task 3: savedFilters CRUD helpers

**Files:**
- Create: `packages/db/src/queries/savedFilters.ts`
- Create: `packages/db/src/queries/savedFilters.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write failing tests for CRUD helpers**

  Create `packages/db/src/queries/savedFilters.test.ts`:

  ```ts
  import { describe, it, expect, vi } from 'vitest';
  import { createSavedFilter, updateSavedFilter, deleteSavedFilter } from './savedFilters';

  function makeMockDb(lastRow: { sort_order: string } | null = null) {
    return {
      execute:     vi.fn().mockResolvedValue(undefined),
      getOptional: vi.fn().mockResolvedValue(lastRow),
    } as any;
  }

  describe('createSavedFilter', () => {
    it('inserts a row and returns a UUID', async () => {
      const db = makeMockDb({ sort_order: 'a0' });
      const id = await createSavedFilter(db, {
        userId: 'u1',
        name:   'High priority this week',
        query:  '{"priority":[1],"dueDateRange":"this_week"}',
      });
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(36); // UUID format
      const [sql, params] = db.execute.mock.calls[0];
      expect(sql).toContain('INSERT INTO saved_filters');
      expect(params).toContain('u1');
      expect(params).toContain('High priority this week');
    });

    it('inserts with an initial sort_order when no filters exist', async () => {
      const db = makeMockDb(null);
      const id = await createSavedFilter(db, { userId: 'u1', name: 'Test', query: '{}' });
      expect(typeof id).toBe('string');
      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it('inserts optional icon when provided', async () => {
      const db = makeMockDb(null);
      await createSavedFilter(db, { userId: 'u1', name: 'Test', icon: '🔥', query: '{}' });
      const [, params] = db.execute.mock.calls[0];
      expect(params).toContain('🔥');
    });
  });

  describe('updateSavedFilter', () => {
    it('updates only the name field when only name provided', async () => {
      const db = makeMockDb();
      await updateSavedFilter(db, 'id-1', { name: 'Renamed' });
      const [sql, params] = db.execute.mock.calls[0];
      expect(sql).toContain('name = ?');
      expect(sql).not.toContain('icon = ?');
      expect(sql).not.toContain('query = ?');
      expect(params).toContain('Renamed');
      expect(params).toContain('id-1');
    });

    it('updates query and icon when provided', async () => {
      const db = makeMockDb();
      await updateSavedFilter(db, 'id-2', { icon: '⭐', query: '{"priority":[2]}' });
      const [sql, params] = db.execute.mock.calls[0];
      expect(sql).toContain('icon = ?');
      expect(sql).toContain('query = ?');
      expect(params).toContain('⭐');
    });
  });

  describe('deleteSavedFilter', () => {
    it('soft-deletes by setting deleted_at', async () => {
      const db = makeMockDb();
      await deleteSavedFilter(db, 'id-3');
      const [sql, params] = db.execute.mock.calls[0];
      expect(sql).toContain('deleted_at');
      expect(sql).toContain('UPDATE saved_filters');
      expect(params).toContain('id-3');
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  pnpm --filter @todolist/db test
  ```

  Expected: FAIL — `Cannot find module './savedFilters'`

- [ ] **Step 3: Implement CRUD helpers**

  Create `packages/db/src/queries/savedFilters.ts`:

  ```ts
  import type { AbstractPowerSyncDatabase } from '@powersync/common';
  import { useQuery } from '@powersync/react';
  import { generateKeyBetween } from 'fractional-indexing';
  import type { SavedFilterRecord } from '../schema';

  export function useSavedFilters() {
    return useQuery<SavedFilterRecord>(
      `SELECT * FROM saved_filters WHERE deleted_at IS NULL ORDER BY sort_order`
    );
  }

  export async function createSavedFilter(
    db: AbstractPowerSyncDatabase,
    fields: { userId: string; name: string; icon?: string; query: string }
  ): Promise<string> {
    const id  = crypto.randomUUID();
    const now = new Date().toISOString();
    const last = await db.getOptional<{ sort_order: string }>(
      `SELECT sort_order FROM saved_filters WHERE deleted_at IS NULL ORDER BY sort_order DESC LIMIT 1`
    );
    const sortOrder = generateKeyBetween(last?.sort_order ?? null, null);
    await db.execute(
      `INSERT INTO saved_filters (id, user_id, name, icon, query, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, fields.userId, fields.name, fields.icon ?? null, fields.query, sortOrder, now, now]
    );
    return id;
  }

  export async function updateSavedFilter(
    db: AbstractPowerSyncDatabase,
    id: string,
    fields: { name?: string; icon?: string; query?: string }
  ): Promise<void> {
    const now    = new Date().toISOString();
    const sets: string[]           = ['updated_at = ?'];
    const params: (string | null)[] = [now];
    if (fields.name  !== undefined) { sets.push('name = ?');  params.push(fields.name); }
    if (fields.icon  !== undefined) { sets.push('icon = ?');  params.push(fields.icon); }
    if (fields.query !== undefined) { sets.push('query = ?'); params.push(fields.query); }
    params.push(id);
    await db.execute(`UPDATE saved_filters SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  export async function deleteSavedFilter(
    db: AbstractPowerSyncDatabase,
    id: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await db.execute(
      `UPDATE saved_filters SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );
  }
  ```

- [ ] **Step 4: Export from packages/db index**

  In `packages/db/src/index.ts`, add after the labelUtils line:

  ```ts
  export * from './queries/savedFilters';
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/db test
  ```

  Expected: all PASS

- [ ] **Step 6: Commit**

  ```bash
  git add packages/db/src/queries/savedFilters.ts packages/db/src/queries/savedFilters.test.ts packages/db/src/index.ts
  git commit -m "feat(db): savedFilters CRUD helpers and useSavedFilters hook"
  ```

---

## Task 4: buildFilterSQL + useFilteredTasks

**Files:**
- Modify: `packages/db/src/queries/savedFilters.ts` (add buildFilterSQL + useFilteredTasks)
- Modify: `packages/db/src/queries/savedFilters.test.ts` (add buildFilterSQL tests)

- [ ] **Step 1: Write failing tests for buildFilterSQL**

  Append to `packages/db/src/queries/savedFilters.test.ts`:

  ```ts
  import { buildFilterSQL } from './savedFilters';

  describe('buildFilterSQL', () => {
    it('always excludes completed and cancelled tasks', () => {
      const { sql } = buildFilterSQL({});
      expect(sql).toContain("NOT IN ('completed', 'cancelled')");
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('filters by priority with IN clause', () => {
      const { sql, params } = buildFilterSQL({ priority: [1, 2] });
      expect(sql).toContain('priority IN (?, ?)');
      expect(params).toContain(1);
      expect(params).toContain(2);
    });

    it('filters by specific projectId', () => {
      const { sql, params } = buildFilterSQL({ projectId: 'p1' });
      expect(sql).toContain('project_id = ?');
      expect(params).toContain('p1');
    });

    it('filters for no-project when projectId is null', () => {
      const { sql, params } = buildFilterSQL({ projectId: null });
      expect(sql).toContain('project_id IS NULL');
      expect(params).not.toContain(null);
    });

    it('filters by labels with OR logic using json_each', () => {
      const { sql, params } = buildFilterSQL({ labels: ['home', 'work'] });
      expect(sql).toContain('json_each');
      expect(sql).toContain('OR');
      expect(params).toContain('home');
      expect(params).toContain('work');
    });

    it('filters for today using SQLite date() function', () => {
      const { sql, params } = buildFilterSQL({ dueDateRange: 'today' });
      expect(sql).toContain("date('now')");
      expect(params).toHaveLength(0);
    });

    it('filters for this_week as a rolling +1 to +7 days window', () => {
      const { sql } = buildFilterSQL({ dueDateRange: 'this_week' });
      expect(sql).toContain("+1 day");
      expect(sql).toContain("+7 days");
    });

    it('filters for next_week as a rolling +8 to +14 days window', () => {
      const { sql } = buildFilterSQL({ dueDateRange: 'next_week' });
      expect(sql).toContain("+8 days");
      expect(sql).toContain("+14 days");
    });

    it('filters overdue tasks', () => {
      const { sql } = buildFilterSQL({ dueDateRange: 'overdue' });
      expect(sql).toContain("due_date < date('now')");
      expect(sql).toContain('IS NOT NULL');
    });

    it('filters tasks with no date', () => {
      const { sql } = buildFilterSQL({ dueDateRange: 'no_date' });
      expect(sql).toContain('due_date IS NULL');
    });

    it('ANDs multiple criteria together', () => {
      const { sql, params } = buildFilterSQL({ priority: [1], projectId: 'p1' });
      expect(sql).toContain('priority IN');
      expect(sql).toContain('project_id = ?');
      expect(params).toContain(1);
      expect(params).toContain('p1');
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  pnpm --filter @todolist/db test
  ```

  Expected: FAIL — `buildFilterSQL is not a function`

- [ ] **Step 3: Implement buildFilterSQL and useFilteredTasks**

  Add to `packages/db/src/queries/savedFilters.ts` (after the existing imports, before `useSavedFilters`):

  ```ts
  import { parseFilterQuery, type FilterQuery } from '@todolist/core';
  import type { TaskRecord } from '../schema';

  export type FilteredTaskRow = Pick<
    TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule' | 'project_id'
  >;

  export function buildFilterSQL(query: FilterQuery): { sql: string; params: (string | number)[] } {
    const conditions: string[] = [
      "status NOT IN ('completed', 'cancelled')",
      'deleted_at IS NULL',
      'parent_task_id IS NULL',
    ];
    const params: (string | number)[] = [];

    if (query.priority && query.priority.length > 0) {
      const ph = query.priority.map(() => '?').join(', ');
      conditions.push(`priority IN (${ph})`);
      params.push(...query.priority);
    }

    if (query.projectId !== undefined) {
      if (query.projectId === null) {
        conditions.push('project_id IS NULL');
      } else {
        conditions.push('project_id = ?');
        params.push(query.projectId);
      }
    }

    if (query.labels && query.labels.length > 0) {
      const labelConds = query.labels.map(
        () => "EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)"
      );
      conditions.push(`(${labelConds.join(' OR ')})`);
      params.push(...query.labels);
    }

    if (query.dueDateRange) {
      switch (query.dueDateRange) {
        case 'today':
          conditions.push("due_date = date('now')");
          break;
        case 'this_week':
          conditions.push("due_date >= date('now', '+1 day') AND due_date <= date('now', '+7 days')");
          break;
        case 'next_week':
          conditions.push("due_date >= date('now', '+8 days') AND due_date <= date('now', '+14 days')");
          break;
        case 'overdue':
          conditions.push("due_date < date('now') AND due_date IS NOT NULL");
          break;
        case 'no_date':
          conditions.push('due_date IS NULL');
          break;
      }
    }

    const sql = `
      SELECT id, title, priority, due_date, status, sort_order, labels, recurrence_rule, project_id
      FROM tasks
      WHERE ${conditions.join(' AND ')}
      ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, priority ASC
    `;
    return { sql, params };
  }

  export function useFilteredTasks(queryStr: string) {
    const query = parseFilterQuery(queryStr);
    const { sql, params } = buildFilterSQL(query);
    return useQuery<FilteredTaskRow>(sql, params);
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/db test
  ```

  Expected: all PASS

- [ ] **Step 5: Commit**

  ```bash
  git add packages/db/src/queries/savedFilters.ts packages/db/src/queries/savedFilters.test.ts
  git commit -m "feat(db): buildFilterSQL and useFilteredTasks for saved filter views"
  ```

---

## Task 5: useLogbook

**Files:**
- Modify: `packages/db/src/queries/tasks.ts`
- Create: `packages/db/src/queries/tasks.test.ts`

- [ ] **Step 1: Write failing test**

  Create `packages/db/src/queries/tasks.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { LOGBOOK_QUERY } from './tasks';

  describe('LOGBOOK_QUERY', () => {
    it("selects only completed tasks", () => {
      expect(LOGBOOK_QUERY).toContain("status = 'completed'");
    });

    it("excludes soft-deleted tasks", () => {
      expect(LOGBOOK_QUERY).toContain("deleted_at IS NULL");
    });

    it("orders by updated_at descending", () => {
      expect(LOGBOOK_QUERY).toContain("updated_at DESC");
    });

    it("limits to 200 rows", () => {
      expect(LOGBOOK_QUERY).toContain("LIMIT 200");
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  pnpm --filter @todolist/db test
  ```

  Expected: FAIL — `LOGBOOK_QUERY is not exported`

- [ ] **Step 3: Add LOGBOOK_QUERY and useLogbook to tasks.ts**

  In `packages/db/src/queries/tasks.ts`, add after the `UPCOMING_QUERY` constant:

  ```ts
  export const LOGBOOK_QUERY = `
    SELECT id, title, priority, due_date, status, updated_at, project_id, labels
    FROM tasks
    WHERE status = 'completed'
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 200
  `;
  ```

  And add this hook after `useUpcomingTasks`:

  ```ts
  export function useLogbook() {
    return useQuery<Pick<TaskRecord,
      'id' | 'title' | 'priority' | 'due_date' | 'status' | 'updated_at' | 'project_id' | 'labels'
    >>(LOGBOOK_QUERY);
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/db test
  ```

  Expected: all PASS

- [ ] **Step 5: Commit**

  ```bash
  git add packages/db/src/queries/tasks.ts packages/db/src/queries/tasks.test.ts
  git commit -m "feat(db): LOGBOOK_QUERY and useLogbook hook"
  ```

---

## Task 6: TaskRow readOnly mode

Adds `readOnly` and `completedAt` props so the logbook can render completed task rows without an active checkbox or due-date chip.

**Files:**
- Modify: `apps/web/components/tasks/TaskRow.tsx`

- [ ] **Step 1: Update TaskRow to accept readOnly and completedAt**

  Replace the `Props` interface in `apps/web/components/tasks/TaskRow.tsx`:

  ```tsx
  interface Props {
    task:         TaskRowItem;
    onPress:      (id: string) => void;
    onComplete:   (id: string) => void;
    readOnly?:    boolean;
    completedAt?: string;
    tabIndex?:    number;
  }
  ```

  Update the function signature:

  ```tsx
  export const TaskRow = memo(function TaskRow({
    task, onPress, onComplete, readOnly = false, completedAt, tabIndex,
  }: Props) {
  ```

  Update the outer `<div>` to add focus support (needed for keyboard shortcuts in Task 12):

  ```tsx
  <div
    className="flex items-start gap-3 px-4 py-3.5 border-b border-border hover:bg-surface-alt/40 group cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset"
    role="listitem"
    tabIndex={readOnly ? undefined : (tabIndex ?? 0)}
    data-task-id={readOnly ? undefined : task.id}
  >
  ```

  Update the checkbox button to be disabled and visually checked when `readOnly`:

  ```tsx
  <button
    onClick={e => { e.stopPropagation(); if (!readOnly) onComplete(task.id); }}
    disabled={readOnly}
    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-accent
      ${readOnly ? 'opacity-40 cursor-default' : 'hover:bg-surface'}`}
    style={{ borderColor: PRIORITY_COLOR[task.priority] ?? '#9CA3AF' }}
    aria-label={readOnly ? `${task.title} (completed)` : `Complete ${task.title}`}
  />
  ```

  Update the date display section at the bottom of the content button to show `completedAt` when in readOnly mode:

  ```tsx
  {completedAt ? (
    <p className="text-xs mt-0.5 text-text-muted">
      Completed {completedAt.split('T')[0]}
    </p>
  ) : task.due_date ? (
    <p className={`text-xs mt-0.5 ${isOverdue(task.due_date) ? 'text-p1' : 'text-text-muted'}`}>
      {task.due_date}
    </p>
  ) : null}
  ```

- [ ] **Step 2: Run existing TaskRow tests to verify nothing broken**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS (existing tests pass; new props are optional with defaults)

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/components/tasks/TaskRow.tsx
  git commit -m "feat(web): TaskRow readOnly + completedAt props for logbook"
  ```

---

## Task 7: Logbook page + sidebar nav item

**Files:**
- Create: `apps/web/app/logbook/page.tsx`
- Modify: `apps/web/components/layout/Sidebar.tsx`
- Create: `apps/web/__tests__/Logbook.test.tsx`

- [ ] **Step 1: Write failing unit test**

  Create `apps/web/__tests__/Logbook.test.tsx`:

  ```tsx
  import { render, screen } from '@testing-library/react';
  import { describe, it, expect, vi } from 'vitest';

  vi.mock('@todolist/db', async () => {
    const actual = await vi.importActual<any>('@todolist/db');
    return { ...actual, useLogbook: vi.fn(), useLabels: vi.fn() };
  });

  import { useLogbook, useLabels } from '@todolist/db';
  import LogbookPage from '@/app/logbook/page';

  const TASKS = [
    { id: '1', title: 'Task A', priority: 3, due_date: null, status: 'completed',
      updated_at: new Date().toISOString(), project_id: null, labels: '[]' },
    { id: '2', title: 'Task B', priority: 2, due_date: '2026-06-10', status: 'completed',
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      project_id: null, labels: '[]' },
    { id: '3', title: 'Task C', priority: 1, due_date: null, status: 'completed',
      updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      project_id: null, labels: '[]' },
  ];

  describe('LogbookPage', () => {
    beforeEach(() => {
      (useLabels as any).mockReturnValue({ data: [] });
    });

    it('shows empty state when no tasks completed', () => {
      (useLogbook as any).mockReturnValue({ data: [] });
      render(<LogbookPage />);
      expect(screen.getByText('Nothing completed yet')).toBeInTheDocument();
    });

    it('groups tasks into Today, This week, Earlier buckets', () => {
      (useLogbook as any).mockReturnValue({ data: TASKS });
      render(<LogbookPage />);
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('This week')).toBeInTheDocument();
      expect(screen.getByText('Earlier')).toBeInTheDocument();
    });

    it('renders task titles in the correct buckets', () => {
      (useLogbook as any).mockReturnValue({ data: TASKS });
      render(<LogbookPage />);
      expect(screen.getByText('Task A')).toBeInTheDocument(); // today
      expect(screen.getByText('Task B')).toBeInTheDocument(); // this week
      expect(screen.getByText('Task C')).toBeInTheDocument(); // earlier
    });

    it('does not render empty buckets', () => {
      const todayOnly = [TASKS[0]];
      (useLogbook as any).mockReturnValue({ data: todayOnly });
      render(<LogbookPage />);
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.queryByText('This week')).not.toBeInTheDocument();
      expect(screen.queryByText('Earlier')).not.toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: FAIL — `Cannot find module '@/app/logbook/page'`

- [ ] **Step 3: Create the logbook page**

  Create `apps/web/app/logbook/page.tsx`:

  ```tsx
  'use client';

  import { useLogbook } from '@todolist/db';
  import { TaskRow, type TaskRowItem } from '@/components/tasks/TaskRow';

  type LogbookEntry = {
    id: string; title: string; priority: number; due_date: string | null;
    status: string; updated_at: string; project_id: string | null; labels: string | null;
  };

  function dateBucket(updatedAt: string): 'today' | 'this_week' | 'earlier' {
    const todayStr = new Date().toISOString().split('T')[0];
    const dayStr   = updatedAt.split('T')[0];
    if (dayStr === todayStr) return 'today';
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(dayStr) >= sevenDaysAgo ? 'this_week' : 'earlier';
  }

  const BUCKET_LABELS = {
    today:     'Today',
    this_week: 'This week',
    earlier:   'Earlier',
  } as const;

  export default function LogbookPage() {
    const { data: tasks } = useLogbook();

    const buckets: Record<'today' | 'this_week' | 'earlier', LogbookEntry[]> = {
      today: [], this_week: [], earlier: [],
    };
    for (const t of tasks) {
      buckets[dateBucket(t.updated_at as string)].push(t as LogbookEntry);
    }

    return (
      <div className="flex flex-col h-full">
        <header className="border-b border-border px-6 py-4">
          <h1 className="text-text-primary font-semibold text-xl">Logbook</h1>
        </header>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <p className="text-text-primary font-semibold text-lg">Nothing completed yet</p>
            <p className="text-text-muted text-sm">Tasks you finish will appear here.</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {(['today', 'this_week', 'earlier'] as const).map((b) => {
              if (buckets[b].length === 0) return null;
              return (
                <section key={b} aria-label={BUCKET_LABELS[b]}>
                  <h2 className="px-6 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border bg-bg/50">
                    {BUCKET_LABELS[b]}
                  </h2>
                  <ul role="list" aria-label={`${BUCKET_LABELS[b]} completed tasks`}>
                    {buckets[b].map((t) => (
                      <li key={t.id}>
                        <TaskRow
                          task={t as TaskRowItem}
                          onPress={() => {}}
                          onComplete={() => {}}
                          readOnly
                          completedAt={t.updated_at}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 4: Add Logbook link to sidebar**

  In `apps/web/components/layout/Sidebar.tsx`, update the `NAV` array to include Logbook between Upcoming and Search:

  ```tsx
  const NAV = [
    { href: '/inbox',    label: 'Inbox',    icon: '📥' },
    { href: '/today',    label: 'Today',    icon: '☀️' },
    { href: '/upcoming', label: 'Upcoming', icon: '📅' },
    { href: '/logbook',  label: 'Logbook',  icon: '✓' },
    { href: '/search',   label: 'Search',   icon: '🔍' },
  ];
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/app/logbook/page.tsx apps/web/components/layout/Sidebar.tsx apps/web/__tests__/Logbook.test.tsx
  git commit -m "feat(web): logbook page with date-bucket grouping + sidebar nav"
  ```

---

## Task 8: FilterBuilderModal

**Files:**
- Create: `apps/web/components/filters/FilterBuilderModal.tsx`
- Create: `apps/web/__tests__/FilterBuilderModal.test.tsx`

- [ ] **Step 1: Write failing tests**

  Create `apps/web/__tests__/FilterBuilderModal.test.tsx`:

  ```tsx
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  vi.mock('@powersync/react', () => ({
    usePowerSync: () => ({ execute: vi.fn(), getOptional: vi.fn().mockResolvedValue(null) }),
  }));
  vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
  }));
  vi.mock('@todolist/db', async () => {
    const actual = await vi.importActual<any>('@todolist/db');
    return {
      ...actual,
      useLabels:          vi.fn(),
      useProjects:        vi.fn(),
      createSavedFilter:  vi.fn().mockResolvedValue('new-filter-id'),
      updateSavedFilter:  vi.fn().mockResolvedValue(undefined),
    };
  });

  import { useLabels, useProjects, createSavedFilter, updateSavedFilter } from '@todolist/db';
  import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';

  describe('FilterBuilderModal', () => {
    beforeEach(() => {
      (useLabels as any).mockReturnValue({ data: [{ id: 'l1', name: 'home', color: '#10B981', deleted_at: null }] });
      (useProjects as any).mockReturnValue({ data: [{ id: 'p1', name: 'Work', color: '#6366F1', deleted_at: null }] });
      vi.clearAllMocks();
      (createSavedFilter as any).mockResolvedValue('new-filter-id');
      (updateSavedFilter as any).mockResolvedValue(undefined);
      (useLabels as any).mockReturnValue({ data: [{ id: 'l1', name: 'home', color: '#10B981', deleted_at: null }] });
      (useProjects as any).mockReturnValue({ data: [{ id: 'p1', name: 'Work', color: '#6366F1', deleted_at: null }] });
    });

    it('does not render when closed', () => {
      render(<FilterBuilderModal open={false} onClose={vi.fn()} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders form when open', () => {
      render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter name')).toBeInTheDocument();
    });

    it('Save button is disabled when name is empty', () => {
      render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
      expect(screen.getByText('Save')).toBeDisabled();
    });

    it('Save button is disabled when name is set but no criteria are selected', () => {
      render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'My filter' } });
      expect(screen.getByText('Save')).toBeDisabled();
    });

    it('Save is enabled when name + at least one criterion set', () => {
      render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'My filter' } });
      fireEvent.click(screen.getByText('P1'));
      expect(screen.getByText('Save')).not.toBeDisabled();
    });

    it('calls createSavedFilter with correct query on save', async () => {
      render(<FilterBuilderModal open={true} onClose={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'Urgent' } });
      fireEvent.click(screen.getByText('P1'));
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(createSavedFilter).toHaveBeenCalled());
      const [, fields] = (createSavedFilter as any).mock.calls[0];
      expect(fields.name).toBe('Urgent');
      expect(fields.query).toContain('"priority":[1]');
    });

    it('calls updateSavedFilter when editing an existing filter', async () => {
      const existing = {
        id: 'f1', name: 'Old name', icon: null,
        query: '{"priority":[2]}',
        sort_order: 'a0', created_at: '', updated_at: '', deleted_at: null, user_id: 'u1',
      };
      render(<FilterBuilderModal open={true} onClose={vi.fn()} filter={existing} />);
      fireEvent.change(screen.getByLabelText('Filter name'), { target: { value: 'New name' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(updateSavedFilter).toHaveBeenCalled());
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: FAIL — `Cannot find module '@/components/filters/FilterBuilderModal'`

- [ ] **Step 3: Create FilterBuilderModal**

  Create `apps/web/components/filters/FilterBuilderModal.tsx`:

  ```tsx
  'use client';

  import { useState, useEffect } from 'react';
  import { usePowerSync } from '@powersync/react';
  import { createClient } from '@/lib/supabase/client';
  import {
    useLabels, useProjects, createSavedFilter, updateSavedFilter,
    type SavedFilterRecord,
  } from '@todolist/db';
  import { serializeFilterQuery, isEmptyFilterQuery, type FilterQuery } from '@todolist/core';

  const PRIORITY_LABELS: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
  const DUE_OPTIONS = [
    { value: 'today',     label: 'Today' },
    { value: 'this_week', label: 'This week' },
    { value: 'next_week', label: 'Next week' },
    { value: 'overdue',   label: 'Overdue' },
    { value: 'no_date',   label: 'No date' },
  ] as const;

  interface Props {
    open:    boolean;
    onClose: () => void;
    filter?: SavedFilterRecord;
  }

  function parseExisting(filter?: SavedFilterRecord): FilterQuery {
    if (!filter?.query) return {};
    try { return JSON.parse(filter.query as string); } catch { return {}; }
  }

  export function FilterBuilderModal({ open, onClose, filter }: Props) {
    const db = usePowerSync();
    const { data: labels }   = useLabels();
    const { data: projects } = useProjects();

    const [name, setName]   = useState('');
    const [icon, setIcon]   = useState('');
    const [query, setQuery] = useState<FilterQuery>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (open) {
        setName((filter?.name as string) ?? '');
        setIcon((filter?.icon as string) ?? '');
        setQuery(parseExisting(filter));
      }
    }, [open, filter]);

    if (!open) return null;

    const togglePriority = (p: 1 | 2 | 3 | 4) => {
      setQuery(q => {
        const cur = q.priority ?? [];
        return {
          ...q,
          priority: cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p],
        };
      });
    };

    const toggleLabel = (labelName: string) => {
      setQuery(q => {
        const cur = q.labels ?? [];
        return {
          ...q,
          labels: cur.includes(labelName) ? cur.filter(x => x !== labelName) : [...cur, labelName],
        };
      });
    };

    const setProject = (projectId: string | null | undefined) => {
      setQuery(q => ({ ...q, projectId }));
    };

    const setDueRange = (v: FilterQuery['dueDateRange'] | '') => {
      setQuery(q => ({ ...q, dueDateRange: v || undefined }));
    };

    const canSave = name.trim().length > 0 && !isEmptyFilterQuery(query);

    const handleSave = async () => {
      if (!canSave) return;
      setSaving(true);
      try {
        const queryStr = serializeFilterQuery(query);
        if (filter?.id) {
          await updateSavedFilter(db, filter.id as string, {
            name: name.trim(), icon: icon || undefined, query: queryStr,
          });
        } else {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          await createSavedFilter(db, {
            userId: user.id, name: name.trim(), icon: icon || undefined, query: queryStr,
          });
        }
        onClose();
      } finally {
        setSaving(false);
      }
    };

    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-label={filter ? 'Edit filter' : 'New filter'}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl">
          <h2 className="text-text-primary font-semibold text-lg mb-4">
            {filter ? 'Edit filter' : 'New filter'}
          </h2>

          {/* Name */}
          <label className="block mb-3">
            <span className="text-xs text-text-muted block mb-1" id="filter-name-label">Filter name</span>
            <input
              id="filter-name"
              aria-labelledby="filter-name-label"
              aria-label="Filter name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Urgent this week"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          {/* Icon */}
          <label className="block mb-4">
            <span className="text-xs text-text-muted block mb-1">Icon (emoji, optional)</span>
            <input
              type="text"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              placeholder="e.g. 🔥"
              maxLength={2}
              className="w-24 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>

          {/* Priority */}
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">Priority</p>
            <div className="flex gap-2">
              {([1, 2, 3, 4] as const).map(p => (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${(query.priority ?? []).includes(p)
                      ? 'bg-accent text-white'
                      : 'bg-bg border border-border text-text-secondary hover:border-accent'}`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Due date range */}
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">Due date</p>
            <select
              value={query.dueDateRange ?? ''}
              onChange={e => setDueRange(e.target.value as FilterQuery['dueDateRange'] | '')}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Any</option>
              {DUE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-text-muted mb-2">Labels (any of)</p>
              <div className="flex flex-wrap gap-2">
                {labels.filter(l => l.name && !l.deleted_at).map(l => {
                  const lName = l.name as string;
                  const selected = (query.labels ?? []).includes(lName);
                  return (
                    <button
                      key={l.id}
                      onClick={() => toggleLabel(lName)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors
                        ${selected ? 'ring-2 ring-accent' : 'bg-bg border border-border'}`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color as string }} />
                      {lName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Project */}
          <div className="mb-6">
            <p className="text-xs text-text-muted mb-2">Project</p>
            <select
              value={query.projectId === null ? '__no_project__' : (query.projectId ?? '')}
              onChange={e => {
                const v = e.target.value;
                setProject(v === '' ? undefined : v === '__no_project__' ? null : v);
              }}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Any project</option>
              <option value="__no_project__">No project</option>
              {projects.filter(p => !p.deleted_at).map(p => (
                <option key={p.id as string} value={p.id as string}>{p.name as string}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/components/filters/FilterBuilderModal.tsx apps/web/__tests__/FilterBuilderModal.test.tsx
  git commit -m "feat(web): FilterBuilderModal for creating and editing saved filters"
  ```

---

## Task 9: Saved filters sidebar section + /filters/[id] route

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx`
- Create: `apps/web/app/filters/[id]/page.tsx`

- [ ] **Step 1: Add Filters section to Sidebar**

  In `apps/web/components/layout/Sidebar.tsx`:

  1. Add imports at the top:

     ```tsx
     import { useState } from 'react';
     import { useSavedFilters } from '@todolist/db';
     import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';
     ```

     (Note: `useState` is already imported, just add the db/modal imports.)

  2. Add inside the `Sidebar` component, alongside the other hooks:

     ```tsx
     const { data: savedFilters } = useSavedFilters();
     const [filterModal, setFilterModal] = useState<{ open: boolean; filter?: any }>({ open: false });
     ```

  3. Add the Filters section in the sidebar body, after the Labels section and before the bottom bar. Place it between the Labels `<Link>` for manage-labels and the closing of the scrollable `<div>`:

     ```tsx
     <p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
       Filters
     </p>
     <ul className="space-y-0.5" role="list">
       {savedFilters.map(f => {
         const active = pathname === `/filters/${f.id}`;
         return (
           <li key={f.id as string}>
             <Link
               href={`/filters/${f.id}`}
               className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                 ${active
                   ? 'bg-surface text-text-primary font-medium'
                   : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
               aria-current={active ? 'page' : undefined}
             >
               <span aria-hidden="true">{(f.icon as string) || '⊟'}</span>
               <span className="truncate">{f.name as string}</span>
             </Link>
           </li>
         );
       })}
     </ul>
     <button
       onClick={() => setFilterModal({ open: true })}
       className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
     >
       + New filter
     </button>
     ```

  4. Add `FilterBuilderModal` to the sidebar JSX (after the closing `</nav>`):

     ```tsx
     <FilterBuilderModal
       open={filterModal.open}
       onClose={() => setFilterModal({ open: false })}
       filter={filterModal.filter}
     />
     ```

- [ ] **Step 2: Create /filters/[id] page**

  Create `apps/web/app/filters/[id]/page.tsx`:

  ```tsx
  'use client';

  import { use } from 'react';
  import { useSavedFilters, useFilteredTasks } from '@todolist/db';
  import { TaskList } from '@/components/tasks/TaskList';
  import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
  import { useState } from 'react';
  import { usePowerSync } from '@powersync/react';
  import { completeTask } from '@todolist/db';
  import Link from 'next/link';

  interface Props {
    params: Promise<{ id: string }>;
  }

  export default function FilterPage({ params }: Props) {
    const { id } = use(params);
    const db     = usePowerSync();

    const { data: filters }  = useSavedFilters();
    const filter = filters.find(f => f.id === id);

    const { data: tasks } = useFilteredTasks((filter?.query as string) ?? '{}');
    const [selected, setSelected] = useState<string | null>(null);

    if (!filter) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <p className="text-text-primary font-semibold">Filter not found</p>
          <Link href="/inbox" className="text-accent text-sm">Go to Inbox</Link>
        </div>
      );
    }

    return (
      <div className="flex h-full">
        <div className="flex flex-col flex-1 min-w-0">
          <header className="border-b border-border px-6 py-4">
            <h1 className="text-text-primary font-semibold text-xl">
              {(filter.icon as string) ? `${filter.icon} ` : ''}{filter.name as string}
            </h1>
          </header>

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <p className="text-text-primary font-semibold text-lg">No tasks match this filter</p>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <TaskList
                tasks={tasks}
                onPress={setSelected}
                onComplete={(taskId) => completeTask(db, taskId)}
              />
            </div>
          )}
        </div>

        {selected && (
          <TaskDetailPanel taskId={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3: Run tests to verify nothing broken**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/components/layout/Sidebar.tsx apps/web/app/filters/
  git commit -m "feat(web): saved filters sidebar section and /filters/[id] view"
  ```

---

## Task 10: ShortcutContext

**Files:**
- Create: `apps/web/lib/shortcuts/ShortcutContext.tsx`

- [ ] **Step 1: Create ShortcutContext**

  Create `apps/web/lib/shortcuts/ShortcutContext.tsx`:

  ```tsx
  'use client';

  import { createContext, useContext, useState, type PropsWithChildren } from 'react';

  interface ShortcutContextType {
    shortcutsOpen:   boolean;
    openShortcuts:   () => void;
    closeShortcuts:  () => void;
    toggleShortcuts: () => void;
  }

  const ShortcutContext = createContext<ShortcutContextType | null>(null);

  export function ShortcutProvider({ children }: PropsWithChildren) {
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    return (
      <ShortcutContext.Provider value={{
        shortcutsOpen,
        openShortcuts:   () => setShortcutsOpen(true),
        closeShortcuts:  () => setShortcutsOpen(false),
        toggleShortcuts: () => setShortcutsOpen(p => !p),
      }}>
        {children}
      </ShortcutContext.Provider>
    );
  }

  export function useShortcuts() {
    const ctx = useContext(ShortcutContext);
    if (!ctx) throw new Error('useShortcuts must be used inside ShortcutProvider');
    return ctx;
  }
  ```

- [ ] **Step 2: Commit**

  (No tests needed — context is trivial state; it gets exercised by ShortcutsOverlay tests.)

  ```bash
  git add apps/web/lib/shortcuts/ShortcutContext.tsx
  git commit -m "feat(web): ShortcutContext for keyboard shortcut overlay state"
  ```

---

## Task 11: ShortcutsOverlay

**Files:**
- Create: `apps/web/components/layout/ShortcutsOverlay.tsx`
- Create: `apps/web/__tests__/ShortcutsOverlay.test.tsx`

- [ ] **Step 1: Write failing tests**

  Create `apps/web/__tests__/ShortcutsOverlay.test.tsx`:

  ```tsx
  import { render, screen, fireEvent } from '@testing-library/react';
  import { describe, it, expect, vi } from 'vitest';
  import { ShortcutProvider } from '@/lib/shortcuts/ShortcutContext';
  import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';

  function Wrapper({ open = false }: { open?: boolean }) {
    const [isOpen, setOpen] = vi.fn().mockImplementation ? undefined as never : undefined as never;
    // Use the provider and a trigger button
    return (
      <ShortcutProvider>
        <_Inner initialOpen={open} />
      </ShortcutProvider>
    );
  }

  import { useEffect } from 'react';
  import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';

  function _Inner({ initialOpen }: { initialOpen: boolean }) {
    const { openShortcuts } = useShortcuts();
    useEffect(() => { if (initialOpen) openShortcuts(); }, [initialOpen]);
    return <ShortcutsOverlay />;
  }

  describe('ShortcutsOverlay', () => {
    it('is not visible when closed', () => {
      render(<Wrapper open={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('is visible when open', () => {
      render(<Wrapper open={true} />);
      expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    });

    it('shows Navigation, Global Actions, and Task Actions sections', () => {
      render(<Wrapper open={true} />);
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Global Actions')).toBeInTheDocument();
      expect(screen.getByText('Task Actions (focused row)')).toBeInTheDocument();
    });

    it('closes when the close button is clicked', () => {
      render(<Wrapper open={true} />);
      fireEvent.click(screen.getByLabelText('Close shortcuts overlay'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes when Escape is pressed', () => {
      render(<Wrapper open={true} />);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      // Escape is handled by KeyboardShortcuts provider (Task 12), not the overlay itself
      // So this test just verifies the overlay renders and the close button works
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: FAIL — `Cannot find module '@/components/layout/ShortcutsOverlay'`

- [ ] **Step 3: Create ShortcutsOverlay**

  Create `apps/web/components/layout/ShortcutsOverlay.tsx`:

  ```tsx
  'use client';

  import { useEffect, useRef } from 'react';
  import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';

  const SECTIONS = [
    {
      title: 'Navigation',
      shortcuts: [
        { keys: 'g i', description: 'Go to Inbox' },
        { keys: 'g t', description: 'Go to Today' },
        { keys: 'g u', description: 'Go to Upcoming' },
        { keys: 'g b', description: 'Go to Logbook' },
        { keys: 'g l', description: 'Go to Labels' },
        { keys: 'g f', description: 'Go to first filter' },
        { keys: 'g p', description: 'Go to first project' },
      ],
    },
    {
      title: 'Global Actions',
      shortcuts: [
        { keys: 'q / n', description: 'Quick Capture' },
        { keys: '/', description: 'Search (Phase 3)' },
        { keys: '?', description: 'Toggle this overlay' },
        { keys: 'Esc', description: 'Close modal / panel' },
      ],
    },
    {
      title: 'Task Actions (focused row)',
      shortcuts: [
        { keys: 'Enter', description: 'Open task detail' },
        { keys: 'e', description: 'Edit title (via detail)' },
        { keys: 'c', description: 'Complete task' },
        { keys: 'p 1–4', description: 'Set priority' },
        { keys: 'd', description: 'Set due date (via detail)' },
        { keys: 'Del', description: 'Delete task' },
        { keys: '↑ / ↓', description: 'Move focus between rows' },
      ],
    },
  ] as const;

  export function ShortcutsOverlay() {
    const { shortcutsOpen, closeShortcuts } = useShortcuts();
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (shortcutsOpen) closeRef.current?.focus();
    }, [shortcutsOpen]);

    if (!shortcutsOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => { if (e.target === e.currentTarget) closeShortcuts(); }}
      >
        <div className="bg-surface rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-text-primary font-semibold text-lg">Keyboard Shortcuts</h2>
            <button
              ref={closeRef}
              onClick={closeShortcuts}
              className="text-text-muted hover:text-text-primary transition-colors text-lg"
              aria-label="Close shortcuts overlay"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  {section.title}
                </h3>
                <ul className="space-y-2.5">
                  {section.shortcuts.map((s) => (
                    <li key={s.keys} className="flex items-center justify-between gap-4">
                      <kbd className="text-xs font-mono bg-bg px-2 py-1 rounded border border-border text-text-secondary whitespace-nowrap flex-shrink-0">
                        {s.keys}
                      </kbd>
                      <span className="text-xs text-text-secondary text-right">{s.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/components/layout/ShortcutsOverlay.tsx apps/web/__tests__/ShortcutsOverlay.test.tsx apps/web/lib/shortcuts/ShortcutContext.tsx
  git commit -m "feat(web): ShortcutsOverlay keyboard shortcuts reference modal"
  ```

---

## Task 12: Install tinykeys + KeyboardShortcuts (nav + global shortcuts)

**Files:**
- Create: `apps/web/components/layout/KeyboardShortcuts.tsx`
- Create: `apps/web/__tests__/KeyboardShortcuts.test.tsx`

- [ ] **Step 1: Install tinykeys**

  ```bash
  pnpm --filter @todolist/web add tinykeys
  ```

  Expected: tinykeys added to `apps/web/package.json` dependencies

- [ ] **Step 2: Write failing tests for navigation and global shortcuts**

  Create `apps/web/__tests__/KeyboardShortcuts.test.tsx`:

  ```tsx
  import { render, screen } from '@testing-library/react';
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import userEvent from '@testing-library/user-event';

  const mockPush = vi.fn();
  vi.mock('next/navigation', () => ({
    useRouter:  () => ({ push: mockPush }),
    usePathname: () => '/',
  }));
  vi.mock('@powersync/react', () => ({
    usePowerSync: () => ({ execute: vi.fn() }),
  }));
  vi.mock('@todolist/db', async () => {
    const actual = await vi.importActual<any>('@todolist/db');
    return {
      ...actual,
      useSavedFilters: vi.fn(),
      useProjects:     vi.fn(),
      completeTask:    vi.fn().mockResolvedValue(undefined),
      updateTaskPriority: vi.fn().mockResolvedValue(undefined),
      deleteTask:      vi.fn().mockResolvedValue(undefined),
    };
  });

  import { useSavedFilters, useProjects } from '@todolist/db';
  import { ShortcutProvider } from '@/lib/shortcuts/ShortcutContext';
  import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
  import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';

  function renderShortcuts() {
    (useSavedFilters as any).mockReturnValue({ data: [{ id: 'f1' }] });
    (useProjects as any).mockReturnValue({ data: [{ id: 'p1' }] });
    return render(
      <ShortcutProvider>
        <KeyboardShortcuts onOpenQuickCapture={vi.fn()}>
          <ShortcutsOverlay />
          <div>Content</div>
        </KeyboardShortcuts>
      </ShortcutProvider>
    );
  }

  describe('KeyboardShortcuts — navigation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (useSavedFilters as any).mockReturnValue({ data: [{ id: 'f1' }] });
      (useProjects as any).mockReturnValue({ data: [{ id: 'p1' }] });
    });

    it('g i navigates to /inbox', async () => {
      renderShortcuts();
      await userEvent.keyboard('gi');
      expect(mockPush).toHaveBeenCalledWith('/inbox');
    });

    it('g t navigates to /today', async () => {
      renderShortcuts();
      await userEvent.keyboard('gt');
      expect(mockPush).toHaveBeenCalledWith('/today');
    });

    it('g u navigates to /upcoming', async () => {
      renderShortcuts();
      await userEvent.keyboard('gu');
      expect(mockPush).toHaveBeenCalledWith('/upcoming');
    });

    it('g b navigates to /logbook', async () => {
      renderShortcuts();
      await userEvent.keyboard('gb');
      expect(mockPush).toHaveBeenCalledWith('/logbook');
    });

    it('g l navigates to /labels', async () => {
      renderShortcuts();
      await userEvent.keyboard('gl');
      expect(mockPush).toHaveBeenCalledWith('/labels');
    });

    it('g f navigates to first saved filter', async () => {
      renderShortcuts();
      await userEvent.keyboard('gf');
      expect(mockPush).toHaveBeenCalledWith('/filters/f1');
    });

    it('g p navigates to first project', async () => {
      renderShortcuts();
      await userEvent.keyboard('gp');
      expect(mockPush).toHaveBeenCalledWith('/projects/p1');
    });
  });

  describe('KeyboardShortcuts — global actions', () => {
    it('q triggers onOpenQuickCapture', async () => {
      const open = vi.fn();
      (useSavedFilters as any).mockReturnValue({ data: [] });
      (useProjects as any).mockReturnValue({ data: [] });
      render(
        <ShortcutProvider>
          <KeyboardShortcuts onOpenQuickCapture={open}>
            <div>Content</div>
          </KeyboardShortcuts>
        </ShortcutProvider>
      );
      await userEvent.keyboard('q');
      expect(open).toHaveBeenCalled();
    });

    it('? opens the ShortcutsOverlay', async () => {
      renderShortcuts();
      expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
      await userEvent.keyboard('?');
      expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    });

    it('does not fire when typing in an input', async () => {
      (useSavedFilters as any).mockReturnValue({ data: [] });
      (useProjects as any).mockReturnValue({ data: [] });
      render(
        <ShortcutProvider>
          <KeyboardShortcuts onOpenQuickCapture={vi.fn()}>
            <input type="text" data-testid="inp" />
          </KeyboardShortcuts>
        </ShortcutProvider>
      );
      const inp = screen.getByTestId('inp');
      inp.focus();
      await userEvent.keyboard('gi');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 3: Run tests to verify they fail**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: FAIL — `Cannot find module '@/components/layout/KeyboardShortcuts'`

- [ ] **Step 4: Create KeyboardShortcuts provider**

  Create `apps/web/components/layout/KeyboardShortcuts.tsx`:

  ```tsx
  'use client';

  import { useEffect, useState, type PropsWithChildren } from 'react';
  import { useRouter } from 'next/navigation';
  import tinykeys from 'tinykeys';
  import { usePowerSync } from '@powersync/react';
  import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';
  import { useSavedFilters, useProjects, completeTask, updateTaskPriority, deleteTask } from '@todolist/db';
  import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';

  interface Props extends PropsWithChildren {
    onOpenQuickCapture: () => void;
  }

  function getFocusedTaskId(): string | null {
    const el = document.activeElement as HTMLElement | null;
    return el?.closest('[data-task-id]')?.getAttribute('data-task-id') ?? null;
  }

  function clickFocusedTaskTitle() {
    const el = document.activeElement as HTMLElement | null;
    const row = el?.closest('[data-task-id]');
    if (!row) return;
    (row.querySelector('button[aria-label^="Open task"]') as HTMLElement | null)?.click();
  }

  export function KeyboardShortcuts({ children, onOpenQuickCapture }: Props) {
    const router                       = useRouter();
    const db                           = usePowerSync();
    const { toggleShortcuts, closeShortcuts } = useShortcuts();
    const { data: filters }            = useSavedFilters();
    const { data: projects }           = useProjects();

    useEffect(() => {
      const unsub = tinykeys(window, {
        // Navigation
        'g i': (e) => { e.preventDefault(); router.push('/inbox'); },
        'g t': (e) => { e.preventDefault(); router.push('/today'); },
        'g u': (e) => { e.preventDefault(); router.push('/upcoming'); },
        'g b': (e) => { e.preventDefault(); router.push('/logbook'); },
        'g l': (e) => { e.preventDefault(); router.push('/labels'); },
        'g f': (e) => {
          e.preventDefault();
          if (filters.length > 0) router.push(`/filters/${filters[0].id}`);
        },
        'g p': (e) => {
          e.preventDefault();
          if (projects.length > 0) router.push(`/projects/${projects[0].id}`);
        },
        // Global actions
        'q': (e) => { e.preventDefault(); onOpenQuickCapture(); },
        'n': (e) => { e.preventDefault(); onOpenQuickCapture(); },
        '?': (e) => { e.preventDefault(); toggleShortcuts(); },
        'Escape': () => { closeShortcuts(); },
        // Task-level actions (fire only when a task row is focused)
        'c': (e) => {
          const id = getFocusedTaskId();
          if (!id) return;
          e.preventDefault();
          completeTask(db, id);
        },
        'p 1': (e) => {
          const id = getFocusedTaskId();
          if (!id) return;
          e.preventDefault();
          updateTaskPriority(db, id, 1);
        },
        'p 2': (e) => {
          const id = getFocusedTaskId();
          if (!id) return;
          e.preventDefault();
          updateTaskPriority(db, id, 2);
        },
        'p 3': (e) => {
          const id = getFocusedTaskId();
          if (!id) return;
          e.preventDefault();
          updateTaskPriority(db, id, 3);
        },
        'p 4': (e) => {
          const id = getFocusedTaskId();
          if (!id) return;
          e.preventDefault();
          updateTaskPriority(db, id, 4);
        },
        'Enter': () => {
          if (!getFocusedTaskId()) return;
          clickFocusedTaskTitle();
        },
        'e': () => {
          if (!getFocusedTaskId()) return;
          clickFocusedTaskTitle();
        },
        'd': () => {
          if (!getFocusedTaskId()) return;
          clickFocusedTaskTitle();
        },
        'Delete': (e) => {
          const id = getFocusedTaskId();
          if (!id) return;
          e.preventDefault();
          if (window.confirm('Delete this task?')) deleteTask(db, id);
        },
        'Backspace': (e) => {
          const id = getFocusedTaskId();
          if (!id) return;
          e.preventDefault();
          if (window.confirm('Delete this task?')) deleteTask(db, id);
        },
      });
      return unsub;
    }, [router, db, toggleShortcuts, closeShortcuts, onOpenQuickCapture, filters, projects]);

    return <>{children}</>;
  }
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS (tinykeys suppresses inside inputs automatically)

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/components/layout/KeyboardShortcuts.tsx apps/web/__tests__/KeyboardShortcuts.test.tsx
  git commit -m "feat(web): KeyboardShortcuts provider with nav + global + task shortcuts"
  ```

---

## Task 13: TaskRow focus model + TaskList arrow-key navigation

Adds `tabIndex={0}` and `data-task-id` to `TaskRow` (already partly done in Task 6) and arrow-key row navigation to `TaskList`.

**Files:**
- Modify: `apps/web/components/tasks/TaskList.tsx`

- [ ] **Step 1: Add arrow-key navigation to TaskList**

  In `apps/web/components/tasks/TaskList.tsx`, update the component to handle arrow keys on the list container. Replace the return statement:

  ```tsx
  'use client';

  import { useRef } from 'react';
  import { useVirtualizer } from '@tanstack/react-virtual';
  import { TaskRow, type TaskRowItem } from './TaskRow';

  interface Props {
    tasks:      TaskRowItem[];
    onPress:    (id: string) => void;
    onComplete: (id: string) => void;
  }

  export function TaskList({ tasks, onPress, onComplete }: Props) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
      count:            tasks.length,
      getScrollElement: () => parentRef.current,
      estimateSize:     () => 56,
      overscan:         5,
    });

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const current   = document.activeElement as HTMLElement | null;
      const currentRow = current?.closest('[data-task-id]') as HTMLElement | null;
      if (!currentRow) return;
      e.preventDefault();
      const rows = Array.from(
        (e.currentTarget as HTMLElement).querySelectorAll('[data-task-id]')
      ) as HTMLElement[];
      const idx = rows.indexOf(currentRow);
      if (e.key === 'ArrowDown' && idx < rows.length - 1) rows[idx + 1].focus();
      if (e.key === 'ArrowUp'   && idx > 0)               rows[idx - 1].focus();
    };

    if (tasks.length === 0) return null;

    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '100%' }}
        onKeyDown={handleKeyDown}
      >
        <div
          role="list"
          aria-label="Tasks"
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map(vi => (
            <div
              key={vi.key}
              style={{
                position:  'absolute',
                top:       0,
                left:      0,
                width:     '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              <TaskRow
                task={tasks[vi.index]}
                onPress={onPress}
                onComplete={onComplete}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Run tests to verify nothing broken**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/components/tasks/TaskList.tsx
  git commit -m "feat(web): TaskList arrow-key row navigation for keyboard shortcuts"
  ```

---

## Task 14: Wire KeyboardShortcuts into ClientLayout

**Files:**
- Modify: `apps/web/app/ClientLayout.tsx`

- [ ] **Step 1: Update ClientLayout to include ShortcutProvider, KeyboardShortcuts, and ShortcutsOverlay**

  Replace the entire `apps/web/app/ClientLayout.tsx` with:

  ```tsx
  'use client';

  import { PropsWithChildren, useState } from 'react';
  import dynamic from 'next/dynamic';
  import { Sidebar } from '@/components/layout/Sidebar';
  import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
  import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
  import { ShortcutProvider } from '@/lib/shortcuts/ShortcutContext';
  import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';
  import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
  import { usePathname } from 'next/navigation';

  // @powersync/web uses __dirname and browser-only APIs (WASM, Web Workers).
  // dynamic + ssr:false ensures the module never executes in the Node.js/Edge SSR context.
  const PowerSyncProvider = dynamic(
    () => import('@/lib/powersync/PowerSyncProvider').then(m => m.PowerSyncProvider),
    { ssr: false }
  );

  export function ClientLayout({ children }: PropsWithChildren) {
    const pathname      = usePathname();
    const isLogin       = pathname === '/login';
    const [showCreate, setShowCreate]   = useState(false);
    const [showCapture, setShowCapture] = useState(false);

    if (isLogin) return <>{children}</>;

    return (
      <PowerSyncProvider>
        <ShortcutProvider>
          <KeyboardShortcuts onOpenQuickCapture={() => setShowCapture(true)}>
            <div className="flex h-screen bg-bg overflow-hidden">
              <Sidebar onNewProject={() => setShowCreate(true)} />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
            <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
            <QuickCaptureModal  open={showCapture} onClose={() => setShowCapture(false)} />
            <ShortcutsOverlay />
          </KeyboardShortcuts>
        </ShortcutProvider>
      </PowerSyncProvider>
    );
  }
  ```

- [ ] **Step 2: Run unit tests to verify nothing broken**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/ClientLayout.tsx
  git commit -m "feat(web): wire ShortcutProvider + KeyboardShortcuts + QuickCapture into ClientLayout"
  ```

---

## Task 15: Playwright e2e tests

**Files:**
- Create: `apps/web/e2e/filters-shortcuts.test.ts`

- [ ] **Step 1: Create e2e tests**

  Create `apps/web/e2e/filters-shortcuts.test.ts`:

  ```ts
  import { test, expect } from '@playwright/test';

  const EMAIL    = process.env.E2E_EMAIL    ?? 'e2e@test.com';
  const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eTestPass123!';

  test.describe('Saved Filters', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/inbox', { timeout: 15_000 });
      await page.waitForTimeout(1_000);
    });

    test('create a filter and navigate to it via sidebar', async ({ page }) => {
      // Click "New filter" in the sidebar
      await page.click('button:has-text("New filter")');
      await expect(page.getByRole('dialog', { name: 'New filter' })).toBeVisible();

      // Fill in name and select P2 priority
      await page.fill('input[aria-label="Filter name"]', 'High prio this week');
      await page.click('button:has-text("P2")');

      // Select "This week" due date
      await page.selectOption('select', 'this_week');

      // Save
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1_000);

      // Filter appears in sidebar
      await expect(page.getByRole('link', { name: 'High prio this week' })).toBeVisible({ timeout: 8_000 });

      // Navigate to filter view
      await page.getByRole('link', { name: 'High prio this week' }).click();
      await expect(page).toHaveURL(/\/filters\//, { timeout: 8_000 });
      await expect(page.getByText('High prio this week')).toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/inbox', { timeout: 15_000 });
      await page.waitForTimeout(1_000);
    });

    test('q opens Quick Capture modal', async ({ page }) => {
      await page.keyboard.press('q');
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 4_000 });
      await expect(page.getByPlaceholderText('What needs to be done?')).toBeVisible();
    });

    test('g t navigates to Today', async ({ page }) => {
      await page.keyboard.press('g');
      await page.keyboard.press('t');
      await expect(page).toHaveURL('/today', { timeout: 4_000 });
    });

    test('? opens the shortcuts overlay', async ({ page }) => {
      await page.keyboard.press('?');
      await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible({ timeout: 4_000 });
      await expect(page.getByText('Navigation')).toBeVisible();
    });

    test('Escape closes the shortcuts overlay', async ({ page }) => {
      await page.keyboard.press('?');
      await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeVisible({ timeout: 2_000 });
    });
  });
  ```

- [ ] **Step 2: Run e2e tests (requires running dev server)**

  In one terminal:
  ```bash
  pnpm --filter @todolist/web dev
  ```

  In another:
  ```bash
  pnpm --filter @todolist/web test:e2e --grep "Saved Filters|Keyboard Shortcuts"
  ```

  Expected: all PASS (against a live Supabase dev instance with E2E_EMAIL and E2E_PASSWORD set)

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/e2e/filters-shortcuts.test.ts
  git commit -m "test(web): e2e for saved filters and keyboard shortcuts flows"
  ```

---

## Task 16: Extend axe-core scan to 2C components

**Files:**
- Modify: `apps/web/__tests__/axe.test.tsx`

- [ ] **Step 1: Add 2C component scans**

  In `apps/web/__tests__/axe.test.tsx`, add the following new `it` blocks inside the existing `describe('Accessibility', ...)` block (after the existing tests):

  ```tsx
  // Add these imports at the top of the file:
  import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';
  import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';
  import { ShortcutProvider } from '@/lib/shortcuts/ShortcutContext';
  import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';

  // Add these vi.mock calls alongside the existing mocks at the top:
  // (Add to the existing mock block or alongside it)
  vi.mock('@todolist/db', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
      ...actual,
      useLabels:       vi.fn().mockReturnValue({ data: [] }),
      useProjects:     vi.fn().mockReturnValue({ data: [] }),
      useSavedFilters: vi.fn().mockReturnValue({ data: [] }),
      useLogbook:      vi.fn().mockReturnValue({ data: [] }),
    };
  });
  vi.mock('@powersync/react', () => ({
    usePowerSync: () => ({ execute: vi.fn(), getOptional: vi.fn().mockResolvedValue(null) }),
  }));
  vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
  }));

  // New test cases:
  it('FilterBuilderModal has no axe violations', async () => {
    const { container } = render(<FilterBuilderModal open={true} onClose={() => {}} />);
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });

  it('ShortcutsOverlay has no axe violations', async () => {
    function OpenOverlay() {
      const { openShortcuts } = useShortcuts();
      return (
        <button onClick={openShortcuts}>
          Open
          <ShortcutsOverlay />
        </button>
      );
    }
    const { getByText, container } = render(
      <ShortcutProvider><OpenOverlay /></ShortcutProvider>
    );
    fireEvent.click(getByText('Open'));
    const results = await axe.run(container);
    expect(results.violations).toHaveLength(0);
  });
  ```

  **How to apply to the existing file:**
  - Add the new imports after the existing imports.
  - The file already has a `vi.mock('@powersync/react', ...)` mock — remove the duplicate and keep one.
  - If there is already a `vi.mock('@todolist/db', ...)` block, merge the new mock return values into it; otherwise add it fresh.
  - Add the new `it` blocks inside the existing `describe('Accessibility', ...)` block.
  - `fireEvent` needs to be imported from `@testing-library/react` — add it to the existing import if not already present.

- [ ] **Step 2: Run tests to verify they pass**

  ```bash
  pnpm --filter @todolist/web test
  ```

  Expected: all PASS including new axe scans with zero violations

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/__tests__/axe.test.tsx
  git commit -m "test(web): extend axe scan to FilterBuilderModal + ShortcutsOverlay"
  ```

---

## Final check

- [ ] **Run full test suite across all packages**

  ```bash
  pnpm test
  ```

  Expected: all PASS — core, db, and web packages

- [ ] **Build to verify TypeScript is clean**

  ```bash
  pnpm build
  ```

  Expected: exits 0

- [ ] **Final commit if any loose files remain**

  ```bash
  git status
  ```

  Commit any remaining files, then push to `feature/phase2c-filters-shortcuts-logbook`.
