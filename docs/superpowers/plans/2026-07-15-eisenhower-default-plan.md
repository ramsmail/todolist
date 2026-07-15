# Eisenhower Matrix: Default New Tasks to Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New tasks (web and mobile) default into the "Plan" Eisenhower quadrant instead of "Drop", land at the true top of their quadrant's list, and the UI shows the user where the task landed.

**Architecture:** One shared constant (`DEFAULT_PRIORITY = 2`) in `packages/core` replaces two hardcoded `4`s (the parser's silent default, `packages/db`'s defensive fallback). `packages/db`'s `createTask()` also gets a genuine top-of-quadrant `sort_order` computation for top-level tasks. Mobile removes its now-redundant "default to the active quadrant tab" feature and instead has focus follow wherever the new task actually landed (via a new `onCreated` callback). Web gets the same `onCreated` callback, driving a transient ring-highlight on the matching quadrant panel on the Matrix page.

**Tech Stack:** TypeScript, Next.js 14 (web), Expo/React Native (mobile), PowerSync (SQLite), vitest, @testing-library/react.

---

### Task 1: `DEFAULT_PRIORITY` constant in packages/core

**Files:**
- Modify: `packages/core/src/types.ts`
- Test: `packages/core/src/types.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the full contents of `packages/core/src/types.test.ts` with (adds
the `DEFAULT_PRIORITY` import and a new describe block, keeps the existing
`quadrantLabel` block as-is):

```ts
import { describe, it, expect } from 'vitest';
import { quadrantLabel, DEFAULT_PRIORITY } from './types';

describe('quadrantLabel', () => {
  it('maps priority 1-4 to the Eisenhower matrix quadrant names', () => {
    expect(quadrantLabel[1]).toBe('Do First');
    expect(quadrantLabel[2]).toBe('Plan');
    expect(quadrantLabel[3]).toBe('Pass');
    expect(quadrantLabel[4]).toBe('Drop');
  });
});

describe('DEFAULT_PRIORITY', () => {
  it('is Plan (2) — the quadrant new tasks land in by default', () => {
    expect(DEFAULT_PRIORITY).toBe(2);
    expect(quadrantLabel[DEFAULT_PRIORITY]).toBe('Plan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --filter @todolist/core -- types.test.ts`
Expected: FAIL — `DEFAULT_PRIORITY` is not exported from `./types`

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/types.ts`, add after the `quadrantLabel` export:

```ts
// The priority new tasks silently get when no explicit p1-p4 tag is given.
export const DEFAULT_PRIORITY: Priority = 2;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --filter @todolist/core -- types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/types.test.ts
git commit -m "feat(core): add DEFAULT_PRIORITY constant (Plan)"
```

---

### Task 2: Parser uses `DEFAULT_PRIORITY` instead of hardcoded 4

**Files:**
- Modify: `packages/core/src/nlp/parser.ts:3,84`
- Test: `packages/core/src/nlp/parser.test.ts:7-17,84-90`

- [ ] **Step 1: Write the failing test**

In `packages/core/src/nlp/parser.test.ts`, update the two assertions that
currently expect the silent default to be `4`:

```ts
  it('returns plain title with defaults when input has no tokens', () => {
    expect(parseTaskInput('Buy milk', { now })).toEqual({
      title: 'Buy milk',
      priority: 2,
      projectSlug: null,
      labels: [],
      dueDate: null,
      dueTime: null,
      recurrenceRule: null,
    });
  });
```

and:

```ts
  it('falls back gracefully on unrecognised input — title preserved, no data lost', () => {
    const result = parseTaskInput('Just a plain task ??? 123', { now });
    expect(result.title).toBe('Just a plain task ??? 123');
    expect(result.priority).toBe(2);
    expect(result.projectSlug).toBeNull();
    expect(result.labels).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --filter @todolist/core -- parser.test.ts`
Expected: FAIL — both assertions above receive `priority: 4` from the current implementation

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/nlp/parser.ts`, change the import at the top:

```ts
import type { Priority } from '../types';
import { DEFAULT_PRIORITY } from '../types';
```

and the silent-default line inside `parseTaskInput`:

```ts
  // Extract priority — last match wins (rightmost p1 beats p2 if both present)
  let priority: Priority = DEFAULT_PRIORITY;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --filter @todolist/core -- parser.test.ts`
Expected: PASS (full parser suite, all other assertions unaffected since they set an explicit `pN`/`!N` tag)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/nlp/parser.ts packages/core/src/nlp/parser.test.ts
git commit -m "feat(core): default parsed tasks to Plan instead of Drop"
```

---

### Task 3: packages/db default-priority fallbacks

**Files:**
- Modify: `packages/db/src/queries/tasks.ts:5,61,231`
- Test: `packages/db/src/queries/tasks.test.ts:63-69`

- [ ] **Step 1: Write the failing test**

In `packages/db/src/queries/tasks.test.ts`, replace the `"defaults a null
priority to group 4"` test:

```ts
  it("defaults a null priority to group 2 (Plan)", () => {
    const tasks = [{ id: 'a', priority: null }];

    const groups = groupTasksByPriority(tasks);

    expect(groups[2].map(t => t.id)).toEqual(['a']);
    expect(groups[4]).toEqual([]);
  });
```

First, update the top of the file to import `vi` (for mocks) and `createTask`
(the function under test):

```ts
import { describe, it, expect, vi } from 'vitest';
import { LOGBOOK_QUERY, MATRIX_QUERY, groupTasksByPriority, createTask } from './tasks';
```

Then add a new `describe('createTask')` block at the end of the file (this
also sets up the `fakeDb` helper Task 4 will reuse):

```ts
function fakeDb(firstInQuadrant: { sort_order: string } | null = null) {
  return {
    getOptional: vi.fn().mockResolvedValue(firstInQuadrant),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

describe('createTask', () => {
  it('defaults priority to 2 (Plan) when not provided', async () => {
    const db = fakeDb();
    await createTask(db as any, { userId: 'user-1', title: 'Buy milk' });

    const [, params] = db.execute.mock.calls[0];
    expect(params[5]).toBe(2); // priority column
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --filter @todolist/db -- tasks.test.ts`
Expected: FAIL — `groups[2]` is empty (current code buckets the null-priority task into group 4); `params[5]` is `4` in the `createTask` test

- [ ] **Step 3: Write minimal implementation**

In `packages/db/src/queries/tasks.ts`, update the import line:

```ts
import { parseRule, computeNext, DEFAULT_PRIORITY } from '@todolist/core';
```

Update `groupTasksByPriority`:

```ts
export function groupTasksByPriority<T extends { priority: number | null }>(
  tasks: T[]
): Record<1 | 2 | 3 | 4, T[]> {
  const groups: Record<1 | 2 | 3 | 4, T[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const task of tasks) {
    const priority = (task.priority ?? DEFAULT_PRIORITY) as 1 | 2 | 3 | 4;
    (groups[priority] ?? groups[DEFAULT_PRIORITY]).push(task);
  }
  return groups;
}
```

Update the `createTask` INSERT params array — change `fields.priority ?? 4`
to `fields.priority ?? DEFAULT_PRIORITY`:

```ts
      fields.status ?? 'inbox',
      fields.priority ?? DEFAULT_PRIORITY,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --filter @todolist/db -- tasks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/tasks.ts packages/db/src/queries/tasks.test.ts
git commit -m "feat(db): default task priority fallbacks to Plan instead of Drop"
```

---

### Task 4: `createTask` — genuine top-of-quadrant `sort_order`

**Files:**
- Modify: `packages/db/src/queries/tasks.ts:195-247`
- Test: `packages/db/src/queries/tasks.test.ts` (extends the `createTask` describe block from Task 3)

- [ ] **Step 1: Write the failing test**

Add these cases inside the `describe('createTask', ...)` block:

```ts
  it('inserts a new top-level task above the current first task in its quadrant', async () => {
    const db = fakeDb({ sort_order: 'b0' });
    await createTask(db as any, { userId: 'user-1', title: 'New task', priority: 2 });

    const [, params] = db.execute.mock.calls[0];
    const sortOrder = params[14]; // sort_order column
    expect(sortOrder < 'b0').toBe(true);
  });

  it('scopes the top-of-quadrant lookup to the target priority', async () => {
    const db = fakeDb();
    await createTask(db as any, { userId: 'user-1', title: 'Task', priority: 3 });

    const [sql, params] = db.getOptional.mock.calls[0];
    expect(sql).toContain('WHERE priority = ?');
    expect(params[0]).toBe(3);
  });

  it('does not perform the top-of-quadrant lookup for sub-tasks', async () => {
    const db = fakeDb();
    await createTask(db as any, {
      userId: 'user-1', title: 'Sub', priority: 4, parentTaskId: 'parent-1',
    });

    expect(db.getOptional).not.toHaveBeenCalled();
  });

  it('uses an explicit afterSortOrder override instead of the top-of-quadrant lookup', async () => {
    const db = fakeDb();
    await createTask(db as any, {
      userId: 'user-1', title: 'Task', priority: 2, afterSortOrder: 'm0',
    });

    expect(db.getOptional).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --filter @todolist/db -- tasks.test.ts`
Expected: FAIL — `db.getOptional` is never called by the current implementation, so the first two new tests fail (no lookup happens, sort_order is always the same fixed sentinel key)

- [ ] **Step 3: Write minimal implementation**

Replace the body of `createTask` in `packages/db/src/queries/tasks.ts`:

```ts
export async function createTask(
  db: AbstractPowerSyncDatabase,
  fields: {
    userId: string;
    title: string;
    description?: string | null;
    priority?: number;
    status?: string;
    dueDate?: string | null;
    dueTime?: string | null;
    timezone?: string | null;
    projectId?: string | null;
    parentTaskId?: string | null;
    labels?: string[];
    afterSortOrder?: string | null;
    recurrenceRule?: string | null;
    sourceUrl?: string | null;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const priority = fields.priority ?? DEFAULT_PRIORITY;

  // New top-level tasks land at the true top of their quadrant, unless the
  // caller explicitly requests a position (e.g. inserting after a specific
  // task). Sub-tasks keep the old append-after behavior.
  let sortOrder: string;
  if (!fields.parentTaskId && fields.afterSortOrder == null) {
    const firstInQuadrant = await db.getOptional<{ sort_order: string }>(
      `SELECT sort_order FROM tasks
       WHERE priority = ? AND status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL
       ORDER BY sort_order LIMIT 1`,
      [priority]
    );
    sortOrder = generateKeyBetween(null, firstInQuadrant?.sort_order ?? null);
  } else {
    sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  }

  const recurrenceRule = fields.recurrenceRule ?? null;
  const recurrenceStart = recurrenceRule ? (fields.dueDate ?? null) : null;
  await db.execute(
    `INSERT INTO tasks
       (id, user_id, title, description, status, priority, due_date, due_time, timezone,
        project_id, parent_task_id, recurrence_rule, recurrence_start,
        labels, sort_order, source_url, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      fields.userId,
      fields.title,
      fields.description ?? null,
      fields.status ?? 'inbox',
      priority,
      fields.dueDate ?? null,
      fields.dueTime ?? null,
      fields.timezone ?? null,
      fields.projectId ?? null,
      fields.parentTaskId ?? null,
      recurrenceRule,
      recurrenceStart,
      JSON.stringify(fields.labels ?? []),
      sortOrder,
      fields.sourceUrl ?? null,
      now,
      now,
    ]
  );
  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --filter @todolist/db -- tasks.test.ts`
Expected: PASS — all `createTask` tests (Task 3's and Task 4's) pass

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/tasks.ts packages/db/src/queries/tasks.test.ts
git commit -m "fix(db): new top-level tasks land at the true top of their quadrant"
```

---

### Task 5: Mobile — remove `resolveTaskPriority`, add `onCreated` to QuickCaptureModal

**Files:**
- Delete: `apps/mobile/src/lib/resolveTaskPriority.ts`
- Delete: `apps/mobile/__tests__/resolveTaskPriority.test.ts`
- Modify: `apps/mobile/src/components/QuickCaptureModal.tsx:8-23,37-39,66-102`

**Note:** No automated test is added for this component in this task —
`apps/mobile/__tests__` currently only contains pure-function unit tests
(no React Native component-rendering harness exists in this repo). This
task is verified via typecheck and the manual smoke test in Task 10.

- [ ] **Step 1: Delete the now-dead helper and its test**

```bash
git rm apps/mobile/src/lib/resolveTaskPriority.ts apps/mobile/__tests__/resolveTaskPriority.test.ts
```

- [ ] **Step 2: Update `QuickCaptureModal.tsx` imports and Props**

In `apps/mobile/src/components/QuickCaptureModal.tsx`, remove the
`resolveTaskPriority` import and add a `Priority` type import:

```ts
import { parseTaskInput, mergeLabels, type Priority } from '@todolist/core';
import { createTask, ensureLabels, useLabels } from '@todolist/db';
import { useAuth }       from '../auth/AuthContext';
import { colors, typography } from '@todolist/ui';
import { LabelChip } from './LabelChip';
import { LabelPickerSheet } from './LabelPickerSheet';
```

(the `resolveTaskPriority` import line and its file are gone)

Update `Props`:

```ts
interface Props {
  visible:   boolean;
  projectId?: string | null;
  onCreated?: (priority: Priority) => void;
  onClose:   () => void;
}

export function QuickCaptureModal({ visible, projectId, onCreated, onClose }: Props) {
```

- [ ] **Step 3: Add a stable `onCreated` ref, alongside the existing `onClose` ref**

```ts
  // Stable ref so onClose is never a useCallback dependency (avoids churn)
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const onCreatedRef = useRef(onCreated);
  useEffect(() => { onCreatedRef.current = onCreated; }, [onCreated]);
```

- [ ] **Step 4: Use `parsed.priority` directly and call `onCreated` on success**

Replace the `handleSave` body:

```ts
  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !session) return;

    setError(null);
    setSaving(true);
    let succeeded = false;
    try {
      const parsed = parseTaskInput(trimmed, { now: new Date() });
      const labels = mergeLabels(pickedLabels, parsed.labels);
      if (labels.length) await ensureLabels(db as any, session.user.id, labels);
      // Note: parsed.projectSlug (#tag) is not yet resolved to an ID — projectId prop takes precedence
      await createTask(db as any, {
        userId:    session.user.id,
        title:     parsed.title,
        priority:  parsed.priority,
        dueDate:   parsed.dueDate,
        dueTime:   parsed.dueTime,
        timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId: projectId ?? null,
        labels,
        status:    'inbox',
      });
      onCreatedRef.current?.(parsed.priority);
      succeeded = true;
    } catch (e) {
      console.error('createTask failed:', e);
      setError('Could not save task. Please try again.');
    } finally {
      setSaving(false);
    }
    // Call onClose after finally so setSaving(false) runs on the mounted component
    if (succeeded) {
      setInput('');
      setPickedLabels([]);
      onCloseRef.current();
    }
  }, [db, input, session, projectId, pickedLabels]);
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck --filter @todolist/mobile`
Expected: PASS — no references to the deleted `resolveTaskPriority` or the
removed `defaultPriority` prop remain in this file

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/QuickCaptureModal.tsx
git commit -m "refactor(mobile): remove resolveTaskPriority, add onCreated callback"
```

---

### Task 6: Mobile — Tasks screen focus follows the new task's quadrant

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/tasks.tsx:104`

**Note:** No automated test for this wiring, for the same reason as Task 5.
Verified via typecheck and the manual smoke test in Task 10.

- [ ] **Step 1: Remove `defaultPriority`, add `onCreated`**

In `apps/mobile/src/app/(tabs)/tasks.tsx`, change:

```tsx
      <QuickCaptureModal visible={capturing} onClose={closeCapture} defaultPriority={active} />
```

to:

```tsx
      <QuickCaptureModal visible={capturing} onClose={closeCapture} onCreated={setActive} />
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck --filter @todolist/mobile`
Expected: PASS — `setActive` (a `Dispatch<SetStateAction<1 | 2 | 3 | 4>>`) is
assignable to `onCreated?: (priority: Priority) => void`

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/src/app/(tabs)/tasks.tsx"
git commit -m "feat(mobile): Tasks screen switches to the quadrant a new task lands in"
```

---

### Task 7: Web — `onCreated` callback on QuickCaptureModal

**Files:**
- Modify: `apps/web/components/tasks/QuickCaptureModal.tsx:11-15,42-75`
- Test: `apps/web/__tests__/QuickCaptureModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/__tests__/QuickCaptureModal.test.tsx`:

```ts
  it('calls onCreated with the resolved priority after a successful save', async () => {
    const onCreated = vi.fn();
    render(<QuickCaptureModal open={true} onClose={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Buy milk p1' },
    });
    fireEvent.click(screen.getByText('Add task'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(1));
  });

  it('defaults the resolved priority to 2 (Plan) when no priority tag is typed', async () => {
    const onCreated = vi.fn();
    render(<QuickCaptureModal open={true} onClose={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
      target: { value: 'Buy milk' },
    });
    fireEvent.click(screen.getByText('Add task'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(2));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --filter @todolist/web -- QuickCaptureModal.test.tsx`
Expected: FAIL — TypeScript error / runtime `onCreated` prop does not exist on `QuickCaptureModal`

- [ ] **Step 3: Write minimal implementation**

In `apps/web/components/tasks/QuickCaptureModal.tsx`, add a `Priority` type
import and the new prop:

```ts
import { parseTaskInput, mergeLabels, type Priority } from '@todolist/core';
```

```ts
interface Props {
  open:       boolean;
  projectId?: string | null;
  onCreated?: (priority: Priority) => void;
  onClose:    () => void;
}

export function QuickCaptureModal({ open, projectId, onCreated, onClose }: Props) {
```

Update `handleSave` to call it after a successful `createTask`:

```ts
  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const parsed = parseTaskInput(trimmed, { now: new Date() });
      const labels = mergeLabels(pickedLabels, parsed.labels);
      if (labels.length) await ensureLabels(db as any, user.id, labels);
      // An explicitly picked date wins; otherwise fall back to one parsed from the title.
      await createTask(db as any, {
        userId:         user.id,
        title:          parsed.title,
        priority:       parsed.priority,
        dueDate:        dueDate ?? parsed.dueDate,
        dueTime:        parsed.dueTime,
        timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId:      projectId ?? null,
        labels,
        recurrenceRule: parsed.recurrenceRule,
        status:         'inbox',
      });
      onCreated?.(parsed.priority);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }, [db, input, dueDate, pickedLabels, projectId, onClose, onCreated]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --filter @todolist/web -- QuickCaptureModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/tasks/QuickCaptureModal.tsx apps/web/__tests__/QuickCaptureModal.test.tsx
git commit -m "feat(web): QuickCaptureModal reports the resolved priority via onCreated"
```

---

### Task 8: Web — `highlighted` prop on MatrixQuadrant

**Files:**
- Modify: `apps/web/app/matrix/MatrixQuadrant.tsx:14-48`
- Test: `apps/web/__tests__/MatrixQuadrant.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/__tests__/MatrixQuadrant.test.tsx`:

```ts
  it('shows the ring highlight when the highlighted prop is true', () => {
    const { container } = render(
      <MatrixQuadrant quadrant={2} tasks={[]} highlighted onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('ring-2');
  });

  it('does not show the ring highlight by default', () => {
    const { container } = render(
      <MatrixQuadrant quadrant={2} tasks={[]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('ring-2');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --filter @todolist/web -- MatrixQuadrant.test.tsx`
Expected: FAIL — TypeScript error / the `highlighted` prop doesn't exist yet, so the first test's ring never appears

- [ ] **Step 3: Write minimal implementation**

In `apps/web/app/matrix/MatrixQuadrant.tsx`:

```tsx
interface MatrixQuadrantProps {
  quadrant: 1 | 2 | 3 | 4;
  tasks: TaskRowItem[];
  highlighted?: boolean;
  onTaskPress: (id: string) => void;
  onTaskComplete: (id: string) => void;
  onDropTask: (taskId: string, targetQuadrant: number) => void;
}

export function MatrixQuadrant({
  quadrant, tasks, highlighted, onTaskPress, onTaskComplete, onDropTask,
}: MatrixQuadrantProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = QUADRANT_CONFIG[quadrant];
  const showRing = isDragOver || highlighted;
```

and update the root `div`'s className to use `showRing` instead of `isDragOver`:

```tsx
      className={`flex flex-col rounded-2xl border border-border ${config.bg} transition-all ${showRing ? `ring-2 ${config.ring}` : ''}`}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --filter @todolist/web -- MatrixQuadrant.test.tsx`
Expected: PASS (all `MatrixQuadrant` tests, including the pre-existing drag-over one)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/matrix/MatrixQuadrant.tsx apps/web/__tests__/MatrixQuadrant.test.tsx
git commit -m "feat(web): MatrixQuadrant supports an externally-controlled highlight"
```

---

### Task 9: Web — MatrixPage highlights the landed quadrant

**Files:**
- Modify: `apps/web/app/matrix/page.tsx`
- Test: `apps/web/__tests__/MatrixPage.test.tsx`

- [ ] **Step 1: Write the failing test**

In `apps/web/__tests__/MatrixPage.test.tsx`, update the `QuickCaptureModal`
mock to accept `onCreated` and add a trigger button, and import `act`:

```ts
import { render, fireEvent, act } from '@testing-library/react';
```

```ts
vi.mock('@/components/tasks/QuickCaptureModal', () => ({
  QuickCaptureModal: ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (priority: number) => void }) =>
    open ? (
      <div role="dialog">
        QuickCapture
        <button onClick={onClose}>Close</button>
        <button onClick={() => onCreated?.(2)}>SimulateCreate</button>
      </div>
    ) : null,
}));
```

Add new test cases:

```ts
  it('highlights the Plan quadrant panel after a task is created', () => {
    const { getByText } = render(<MatrixPage />);
    fireEvent.click(getByText('+ Add Task'));
    fireEvent.click(getByText('SimulateCreate'));

    const panel = getByText('Plan').closest('div.rounded-2xl');
    expect(panel?.className).toContain('ring-2');
  });

  it('clears the quadrant highlight after ~1.5s', () => {
    vi.useFakeTimers();
    const { getByText } = render(<MatrixPage />);
    fireEvent.click(getByText('+ Add Task'));
    fireEvent.click(getByText('SimulateCreate'));

    const panel = getByText('Plan').closest('div.rounded-2xl');
    expect(panel?.className).toContain('ring-2');

    act(() => { vi.advanceTimersByTime(1500); });
    expect(panel?.className).not.toContain('ring-2');
    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --filter @todolist/web -- MatrixPage.test.tsx`
Expected: FAIL — `MatrixPage` doesn't yet pass `highlighted` to any `MatrixQuadrant`, so no `ring-2` class ever appears

- [ ] **Step 3: Write minimal implementation**

In `apps/web/app/matrix/page.tsx`:

```tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePowerSync, useQuery } from '@powersync/react';
import { completeTask, updateTaskPriority } from '@todolist/db';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { MatrixQuadrant } from './MatrixQuadrant';
import type { TaskRowItem } from '@/components/tasks/TaskRow';

const MATRIX_QUERY = `
  SELECT id, title, priority, labels, status, due_date, recurrence_rule, sort_order
  FROM tasks
  WHERE status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY sort_order
`;

export default function MatrixPage() {
  const db = usePowerSync();
  const { data: tasks } = useQuery<TaskRowItem & { sort_order: string }>(MATRIX_QUERY);
  const [detailId, setDetailId]       = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);
  const [highlightQuadrant, setHighlightQuadrant] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byQuadrant = (p: number) => tasks.filter(t => t.priority === p);

  const handleTaskCreated = useCallback((priority: number) => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightQuadrant(priority);
    highlightTimeoutRef.current = setTimeout(() => setHighlightQuadrant(null), 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const handleDrop = async (taskId: string, targetQuadrant: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.priority === targetQuadrant) return;
    await updateTaskPriority(db as any, taskId, targetQuadrant);
  };

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-6 pt-8 pb-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-3xl font-bold">Task Matrix</h1>
            <p className="text-text-muted text-sm mt-1">
              Eisenhower decision framework — prioritize by urgency and importance
            </p>
          </div>
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 bg-accent text-white font-semibold rounded-xl px-4 py-2 text-sm hover:bg-accent-dark transition-colors"
          >
            + Add Task
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 h-full min-h-[600px]" style={{ gridTemplateRows: '1fr 1fr' }}>
            {([1, 2, 3, 4] as const).map(q => (
              <MatrixQuadrant
                key={q}
                quadrant={q}
                tasks={byQuadrant(q)}
                highlighted={highlightQuadrant === q}
                onTaskPress={setDetailId}
                onTaskComplete={handleComplete}
                onDropTask={handleDrop}
              />
            ))}
          </div>
        </div>
      </div>
      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={showCapture} onClose={() => setShowCapture(false)} onCreated={handleTaskCreated} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --filter @todolist/web -- MatrixPage.test.tsx`
Expected: PASS (all `MatrixPage` tests, including the pre-existing ones)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/matrix/page.tsx apps/web/__tests__/MatrixPage.test.tsx
git commit -m "feat(web): highlight the Matrix quadrant a new task lands in"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: PASS across all packages/apps (`@todolist/core`, `@todolist/db`, `@todolist/ui`, `apps/web`; mobile's vitest suite has no changed tests but should still pass)

- [ ] **Step 2: Typecheck everything**

Run: `pnpm typecheck`
Expected: PASS — no leftover references to `resolveTaskPriority` or `defaultPriority` anywhere

- [ ] **Step 3: Lint everything**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Manually verify on web**

Start the dev server (`pnpm dev`), open `/matrix`, click **+ Add Task**, type
a plain title (no `pN` tag) and save. Confirm: the task appears at the top
of the **Plan** quadrant, and that quadrant's panel briefly shows a ring
highlight. Then repeat with a title ending in `p1` and confirm it lands at
the top of **Do First** instead, with that quadrant highlighted.

- [ ] **Step 5: Manually verify on mobile**

None of the mobile changes in this plan touch native dependencies (only JS:
prop/callback wiring, deleted helper), so they can ship as an OTA update to
the already-installed preview build rather than a new native `eas build`:

```bash
cd apps/mobile
eas update --channel preview --message "Default new tasks to Plan quadrant"
```

On the phone, force-stop and relaunch the app to pick up the update. From
the Home tab, add a task with a plain title — open the Tasks tab and
confirm it's in **Plan**, at the top, and that the Tasks screen's active tab
is now **Plan**. Then, from the Tasks screen while viewing a different tab
(e.g. **Do First**), add another plain-title task and confirm the screen
switches to **Plan** and the new task is at the top there too.

- [ ] **Step 6: Final commit (if manual verification turned up fixes)**

Only needed if Steps 4-5 required code changes; otherwise this plan is done
once Task 9's commit lands.
