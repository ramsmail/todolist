# Eisenhower Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/matrix` route to the web app that displays all active tasks in a 2×2 Eisenhower priority grid with drag-to-reprioritize.

**Architecture:** Single PowerSync `useQuery` fetches all active tasks; JavaScript splits them by `priority` (1–4) into four quadrant arrays. Drag events write to `updateTaskPriority` (already in `@todolist/db`). No schema changes.

**Tech Stack:** Next.js 14 App Router, PowerSync (`usePowerSync`, `useQuery`), `@todolist/db`, Vitest + @testing-library/react, HTML5 native drag-and-drop.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/app/matrix/MatrixQuadrant.tsx` | Drop-zone card: header, task list, drag-over highlight |
| Create | `apps/web/app/matrix/page.tsx` | Route page: query, split by priority, orchestrate quadrants |
| Modify | `apps/web/components/layout/Sidebar.tsx` | Add Matrix nav item between Today and Upcoming |
| Create | `apps/web/__tests__/MatrixQuadrant.test.tsx` | Unit tests for the quadrant card |
| Create | `apps/web/__tests__/MatrixPage.test.tsx` | Unit tests for the page |

---

## Task 1: MatrixQuadrant component

**Files:**
- Create: `apps/web/app/matrix/MatrixQuadrant.tsx`
- Create: `apps/web/__tests__/MatrixQuadrant.test.tsx`

- [ ] **Step 1.1: Write the failing test**

Create `apps/web/__tests__/MatrixQuadrant.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MatrixQuadrant } from '@/app/matrix/MatrixQuadrant';

vi.mock('@todolist/db', () => ({
  useLabels: vi.fn().mockReturnValue({ data: [] }),
}));

const TASK = {
  id: 't1', title: 'Fix bug', priority: 1,
  due_date: null, status: 'inbox', labels: null, recurrence_rule: null,
};

describe('MatrixQuadrant', () => {
  it('renders the quadrant label', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={1} tasks={[]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('DO FIRST')).toBeTruthy();
  });

  it('shows empty state when no tasks', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={2} tasks={[]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('No tasks here')).toBeTruthy();
  });

  it('renders task titles', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={1} tasks={[TASK]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('Fix bug')).toBeTruthy();
  });

  it('calls onDropTask with quadrant number when a task is dropped', () => {
    const onDropTask = vi.fn();
    const { container } = render(
      <MatrixQuadrant quadrant={3} tasks={[]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={onDropTask} />
    );
    const card = container.firstChild as HTMLElement;
    fireEvent.drop(card, { dataTransfer: { getData: () => 't1' } });
    expect(onDropTask).toHaveBeenCalledWith('t1', 3);
  });

  it('shows task count in header', () => {
    const { getByText } = render(
      <MatrixQuadrant quadrant={4} tasks={[TASK]} onTaskPress={vi.fn()} onTaskComplete={vi.fn()} onDropTask={vi.fn()} />
    );
    expect(getByText('1')).toBeTruthy();
  });
});
```

- [ ] **Step 1.2: Run the test to confirm it fails**

```bash
cd apps/web && pnpm exec vitest run __tests__/MatrixQuadrant.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/matrix/MatrixQuadrant'`

- [ ] **Step 1.3: Implement MatrixQuadrant**

Create `apps/web/app/matrix/MatrixQuadrant.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { TaskRow, type TaskRowItem } from '@/components/tasks/TaskRow';

const QUADRANT_CONFIG = {
  1: { label: 'DO FIRST',  icon: '⚡', bg: 'bg-amber-50',   header: 'text-amber-700',   ring: 'ring-amber-400/50'   },
  2: { label: 'SCHEDULE',  icon: '📅', bg: 'bg-indigo-50',  header: 'text-indigo-700',  ring: 'ring-indigo-400/50'  },
  3: { label: 'DELEGATE',  icon: '↪',  bg: 'bg-neutral-50', header: 'text-neutral-600', ring: 'ring-neutral-400/50' },
  4: { label: 'ELIMINATE', icon: '✕',  bg: 'bg-rose-50',    header: 'text-rose-700',    ring: 'ring-rose-400/50'    },
} as const;

interface MatrixQuadrantProps {
  quadrant: 1 | 2 | 3 | 4;
  tasks: TaskRowItem[];
  onTaskPress: (id: string) => void;
  onTaskComplete: (id: string) => void;
  onDropTask: (taskId: string, targetQuadrant: number) => void;
}

export function MatrixQuadrant({
  quadrant, tasks, onTaskPress, onTaskComplete, onDropTask,
}: MatrixQuadrantProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = QUADRANT_CONFIG[quadrant];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onDropTask(taskId, quadrant);
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border border-border ${config.bg} transition-all ${isDragOver ? `ring-2 ${config.ring}` : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <span aria-hidden="true">{config.icon}</span>
        <span className={`text-xs font-bold tracking-widest uppercase ${config.header}`}>
          {config.label}
        </span>
        <span className="ml-auto text-xs text-text-muted">{tasks.length}</span>
      </div>
      <div
        className="flex-1 overflow-y-auto max-h-[calc(50vh-6rem)] px-3 pb-3 space-y-2"
        role="list"
      >
        {tasks.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">No tasks here</p>
        ) : (
          tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onPress={onTaskPress}
              onComplete={onTaskComplete}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/plain', task.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 1.4: Run the test to confirm it passes**

```bash
cd apps/web && pnpm exec vitest run __tests__/MatrixQuadrant.test.tsx
```

Expected: 5 tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/app/matrix/MatrixQuadrant.tsx apps/web/__tests__/MatrixQuadrant.test.tsx
git commit -m "feat: add MatrixQuadrant component with drag-and-drop support"
```

---

## Task 2: Matrix page

**Files:**
- Create: `apps/web/app/matrix/page.tsx`
- Create: `apps/web/__tests__/MatrixPage.test.tsx`

- [ ] **Step 2.1: Write the failing test**

Create `apps/web/__tests__/MatrixPage.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MatrixPage from '@/app/matrix/page';

vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
  useQuery: vi.fn().mockReturnValue({
    data: [
      { id: 't1', title: 'Fix bug',    priority: 1, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '1' },
      { id: 't2', title: 'Read book',  priority: 2, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '2' },
      { id: 't3', title: 'Reply Slack',priority: 3, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '3' },
      { id: 't4', title: 'Browse',     priority: 4, due_date: null, status: 'inbox', labels: null, recurrence_rule: null, sort_order: '4' },
    ],
  }),
}));

vi.mock('@todolist/db', () => ({
  useLabels:          vi.fn().mockReturnValue({ data: [] }),
  completeTask:       vi.fn().mockResolvedValue(undefined),
  updateTaskPriority: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/tasks/TaskDetailPanel', () => ({
  TaskDetailPanel: ({ taskId }: { taskId: string | null }) =>
    taskId ? <div>Panel:{taskId}</div> : null,
}));

vi.mock('@/components/tasks/QuickCaptureModal', () => ({
  QuickCaptureModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div role="dialog">QuickCapture<button onClick={onClose}>Close</button></div> : null,
}));

describe('MatrixPage', () => {
  it('renders all four quadrant labels', () => {
    const { getByText } = render(<MatrixPage />);
    expect(getByText('DO FIRST')).toBeTruthy();
    expect(getByText('SCHEDULE')).toBeTruthy();
    expect(getByText('DELEGATE')).toBeTruthy();
    expect(getByText('ELIMINATE')).toBeTruthy();
  });

  it('places tasks in the correct quadrant by priority', () => {
    const { getByText } = render(<MatrixPage />);
    expect(getByText('Fix bug')).toBeTruthy();
    expect(getByText('Read book')).toBeTruthy();
    expect(getByText('Reply Slack')).toBeTruthy();
    expect(getByText('Browse')).toBeTruthy();
  });

  it('opens QuickCaptureModal when + Add Task is clicked', () => {
    const { getByText, getByRole, queryByRole } = render(<MatrixPage />);
    expect(queryByRole('dialog')).toBeNull();
    fireEvent.click(getByText('+ Add Task'));
    expect(getByRole('dialog')).toBeTruthy();
  });

  it('closes QuickCaptureModal when onClose fires', () => {
    const { getByText, queryByRole } = render(<MatrixPage />);
    fireEvent.click(getByText('+ Add Task'));
    fireEvent.click(getByText('Close'));
    expect(queryByRole('dialog')).toBeNull();
  });

  it('renders page title', () => {
    const { getByText } = render(<MatrixPage />);
    expect(getByText('Task Matrix')).toBeTruthy();
  });
});
```

- [ ] **Step 2.2: Run the test to confirm it fails**

```bash
cd apps/web && pnpm exec vitest run __tests__/MatrixPage.test.tsx
```

Expected: FAIL — `Cannot find module '@/app/matrix/page'`

- [ ] **Step 2.3: Implement the matrix page**

Create `apps/web/app/matrix/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
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
  const [detailId, setDetailId]     = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  const byQuadrant = (p: number) => tasks.filter(t => t.priority === p);

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
                onTaskPress={setDetailId}
                onTaskComplete={handleComplete}
                onDropTask={handleDrop}
              />
            ))}
          </div>
        </div>
      </div>
      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={showCapture} onClose={() => setShowCapture(false)} />
    </div>
  );
}
```

- [ ] **Step 2.4: Run the test to confirm it passes**

```bash
cd apps/web && pnpm exec vitest run __tests__/MatrixPage.test.tsx
```

Expected: 5 tests PASS

- [ ] **Step 2.5: Run the full test suite to check for regressions**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm test
```

Expected: All existing tests still pass

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/app/matrix/page.tsx apps/web/__tests__/MatrixPage.test.tsx
git commit -m "feat: add /matrix route with 2x2 Eisenhower task grid"
```

---

## Task 3: Sidebar nav item + typecheck

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx` lines 13–19 (the `NAV` array)

- [ ] **Step 3.1: Add Matrix to the sidebar NAV array**

In `apps/web/components/layout/Sidebar.tsx`, update the `NAV` constant:

```ts
// Before:
const NAV = [
  { href: '/inbox',    label: 'Inbox',    icon: '📥' },
  { href: '/today',    label: 'Today',    icon: '☀️' },
  { href: '/upcoming', label: 'Upcoming', icon: '📅' },
  { href: '/logbook',  label: 'Logbook',  icon: '✓' },
  { href: '/search',   label: 'Search',   icon: '🔍' },
];

// After:
const NAV = [
  { href: '/inbox',    label: 'Inbox',    icon: '📥' },
  { href: '/today',    label: 'Today',    icon: '☀️' },
  { href: '/matrix',   label: 'Matrix',   icon: '⊞' },
  { href: '/upcoming', label: 'Upcoming', icon: '📅' },
  { href: '/logbook',  label: 'Logbook',  icon: '✓' },
  { href: '/search',   label: 'Search',   icon: '🔍' },
];
```

- [ ] **Step 3.2: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: No errors

- [ ] **Step 3.3: Run full test suite one final time**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm test
```

Expected: All tests pass (including the 10 new tests from Tasks 1 and 2)

- [ ] **Step 3.4: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx
git commit -m "feat: add Matrix to sidebar navigation"
```
