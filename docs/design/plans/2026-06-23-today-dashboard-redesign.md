# Today Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Today view into a 3-column dashboard with IN FOCUS / LATER TODAY task sections, a right panel with Pomodoro timer + progress + weekly activity widgets, and a refreshed sidebar with Quick Add and Daily Streak.

**Architecture:** Schema gains an `in_focus` boolean column on `tasks`; three new db-package hooks derive streak, weekly activity, and focus-task counts from existing `completed_at` / `in_focus` data. The right panel is a reusable `<RightPanel>` wrapper composed with three independent card components; the Today page mounts its own `FocusSessionProvider` context so the Pomodoro timer state stays scoped to that route.

**Tech Stack:** Next.js 14 App Router, PowerSync (`@powersync/react`), Supabase, Tailwind CSS, Vitest + React Testing Library

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260623000001_add_in_focus.sql` | Create — adds `in_focus` column to tasks |
| `packages/db/src/schema.ts` | Modify — add `in_focus: column.integer` |
| `packages/db/src/queries/tasks.ts` | Modify — add `in_focus`/`due_time` to TODAY_QUERY, add `useTodayStats`, `toggleFocus` |
| `packages/db/src/queries/streak.ts` | Create — `computeStreak` pure fn + `useStreak` hook |
| `packages/db/src/queries/weeklyActivity.ts` | Create — `useWeeklyActivity` hook |
| `packages/db/src/index.ts` | Modify — export new files |
| `apps/web/lib/focus/FocusSessionContext.tsx` | Create — Pomodoro timer context |
| `apps/web/components/today/FocusTaskCard.tsx` | Create — card-style row for IN FOCUS tasks |
| `apps/web/components/today/RightPanel.tsx` | Create — reusable right-panel wrapper |
| `apps/web/components/today/FocusSessionCard.tsx` | Create — Pomodoro timer widget |
| `apps/web/components/today/TodayProgressCard.tsx` | Create — donut chart progress widget |
| `apps/web/components/today/WeeklyActivityCard.tsx` | Create — weekly bar chart widget |
| `apps/web/components/layout/Sidebar.tsx` | Modify — Quick Add button, reordered nav, Daily Streak |
| `apps/web/app/ClientLayout.tsx` | Modify — pass `onQuickCapture` to Sidebar |
| `apps/web/app/today/page.tsx` | Modify — full redesign with new sections + right panel |
| `apps/web/app/all/page.tsx` | Create — All Tasks page |
| `apps/web/__tests__/FocusSessionContext.test.tsx` | Create |
| `apps/web/__tests__/FocusTaskCard.test.tsx` | Create |
| `apps/web/__tests__/FocusSessionCard.test.tsx` | Create |
| `apps/web/__tests__/TodayProgressCard.test.tsx` | Create |
| `apps/web/__tests__/WeeklyActivityCard.test.tsx` | Create |
| `apps/web/__tests__/TodayPage.test.tsx` | Create |
| `packages/db/src/queries/streak.test.ts` | Create |

---

## Task 1: Supabase migration + PowerSync schema

**Files:**
- Create: `supabase/migrations/20260623000001_add_in_focus.sql`
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Create Supabase migration**

Create `supabase/migrations/20260623000001_add_in_focus.sql`:

```sql
ALTER TABLE tasks ADD COLUMN in_focus BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Add column to PowerSync schema**

In `packages/db/src/schema.ts`, add `in_focus: column.integer,` after `deleted_at`:

```typescript
import { column, Schema, Table } from '@powersync/common';

const tasks = new Table(
  {
    user_id:          column.text,
    title:            column.text,
    description:      column.text,
    status:           column.text,
    priority:         column.integer,
    due_date:         column.text,
    due_time:         column.text,
    timezone:         column.text,
    project_id:       column.text,
    parent_task_id:   column.text,
    recurrence_rule:  column.text,
    recurrence_start: column.text,
    labels:           column.text,
    sort_order:       column.text,
    in_focus:         column.integer,   // 0 = false, 1 = true
    created_at:       column.text,
    updated_at:       column.text,
    deleted_at:       column.text,
  },
  {
    indexes: {
      by_project:  ['project_id'],
      by_parent:   ['parent_task_id'],
      by_status:   ['status'],
      by_due_date: ['due_date'],
    },
  }
);
```

*(Keep `projects`, `labels`, `saved_filters`, and the exports at the bottom of the file unchanged.)*

- [ ] **Step 3: Apply migration in Supabase**

```bash
supabase migration up
# or if using the dashboard, run the SQL manually in the SQL editor
```

Expected: no errors, `tasks` table now has `in_focus` column.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623000001_add_in_focus.sql packages/db/src/schema.ts
git commit -m "feat(db): add in_focus column to tasks schema"
```

---

## Task 2: Update TODAY_QUERY + add toggleFocus + useTodayStats

**Files:**
- Modify: `packages/db/src/queries/tasks.ts`

- [ ] **Step 1: Update TODAY_QUERY to include in_focus and due_time**

Replace `TODAY_QUERY` in `packages/db/src/queries/tasks.ts`:

```typescript
export const TODAY_QUERY = `
  SELECT id, title, priority, due_date, due_time, project_id, status, labels, recurrence_rule, in_focus
  FROM tasks
  WHERE due_date <= date('now')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY priority, sort_order
`;
```

Update `useTodayTasks` return type to include the new fields:

```typescript
export function useTodayTasks() {
  return useQuery<Pick<TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'project_id' |
    'status' | 'labels' | 'recurrence_rule' | 'in_focus'
  >>(TODAY_QUERY);
}
```

- [ ] **Step 2: Add useTodayStats hook**

After `useTodayTasks`, add:

```typescript
export const TODAY_STATS_QUERY = `
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
  FROM tasks
  WHERE due_date = date('now')
    AND deleted_at IS NULL
`;

export function useTodayStats() {
  return useQuery<{ total: number; completed: number }>(TODAY_STATS_QUERY);
}
```

- [ ] **Step 3: Add useFocusTasks hook**

After `useTodayTasks`, add:

```typescript
export const FOCUS_TASKS_QUERY = `
  SELECT id, title, priority, due_date, due_time, project_id, status, labels, recurrence_rule, in_focus
  FROM tasks
  WHERE in_focus = 1
    AND due_date <= date('now')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY priority, sort_order
`;

export function useFocusTasks() {
  return useQuery<Pick<TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'project_id' |
    'status' | 'labels' | 'recurrence_rule' | 'in_focus'
  >>(FOCUS_TASKS_QUERY);
}
```

- [ ] **Step 4: Add toggleFocus mutation**

After `updateTaskProject`, add:

```typescript
export async function toggleFocus(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  await db.execute(
    `UPDATE tasks
     SET in_focus = CASE WHEN in_focus = 1 THEN 0 ELSE 1 END,
         updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [new Date().toISOString(), id]
  );
}
```

- [ ] **Step 4: Verify TODAY_QUERY string test**

Add to `packages/db/src/queries/tasks.test.ts`:

```typescript
describe('TODAY_QUERY', () => {
  it('includes in_focus field', () => {
    expect(TODAY_QUERY).toContain('in_focus');
  });

  it('includes due_time field', () => {
    expect(TODAY_QUERY).toContain('due_time');
  });
});

describe('FOCUS_TASKS_QUERY', () => {
  it('filters on in_focus = 1', () => {
    expect(FOCUS_TASKS_QUERY).toContain('in_focus = 1');
  });

  it('excludes completed and cancelled tasks', () => {
    expect(FOCUS_TASKS_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });
});

describe('TODAY_STATS_QUERY', () => {
  it('counts completed tasks', () => {
    expect(TODAY_STATS_QUERY).toContain("status = 'completed'");
    expect(TODAY_STATS_QUERY).toContain('completed');
  });

  it('scopes to today', () => {
    expect(TODAY_STATS_QUERY).toContain("date('now')");
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @todolist/db test
```

Expected: all tests pass (existing + new).

- [ ] **Step 6: Update exports in packages/db/src/index.ts**

Add `toggleFocus` and `useTodayStats` to the existing `export * from './queries/tasks'` — they're automatically exported since that line already exists. No change needed here.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/queries/tasks.ts packages/db/src/queries/tasks.test.ts
git commit -m "feat(db): add in_focus to today query, toggleFocus mutation, useTodayStats"
```

---

## Task 3: computeStreak pure function + useStreak hook

**Files:**
- Create: `packages/db/src/queries/streak.ts`
- Create: `packages/db/src/queries/streak.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/queries/streak.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeStreak } from './streak';

describe('computeStreak', () => {
  it('returns count=0 and all-false days when no completions', () => {
    const today = '2026-06-23';
    const result = computeStreak(new Set(), today);
    expect(result.count).toBe(0);
    expect(result.days.every(d => d === false)).toBe(true);
    expect(result.days).toHaveLength(7);
  });

  it('counts 1 for a single completion today', () => {
    const today = '2026-06-23';
    const result = computeStreak(new Set(['2026-06-23']), today);
    expect(result.count).toBe(1);
    expect(result.days[6]).toBe(true);
  });

  it('counts consecutive days ending today', () => {
    const today = '2026-06-23';
    const daySet = new Set(['2026-06-21', '2026-06-22', '2026-06-23']);
    const result = computeStreak(daySet, today);
    expect(result.count).toBe(3);
  });

  it('breaks streak on a gap', () => {
    const today = '2026-06-23';
    // gap on the 21st
    const daySet = new Set(['2026-06-20', '2026-06-22', '2026-06-23']);
    const result = computeStreak(daySet, today);
    expect(result.count).toBe(2);
  });

  it('returns 7-element days array with oldest first', () => {
    const today = '2026-06-23';
    const daySet = new Set(['2026-06-23']);
    const result = computeStreak(daySet, today);
    expect(result.days).toHaveLength(7);
    expect(result.days[6]).toBe(true);   // today
    expect(result.days[5]).toBe(false);  // yesterday
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @todolist/db test streak
```

Expected: FAIL — `computeStreak` not found.

- [ ] **Step 3: Implement streak.ts**

Create `packages/db/src/queries/streak.ts`:

```typescript
import { useQuery } from '@powersync/react';

/** Pure function — testable without PowerSync context. */
export function computeStreak(
  daySet: Set<string>,
  today: string
): { count: number; days: boolean[] } {
  const days: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - i);
    days.push(daySet.has(d.toISOString().split('T')[0]));
  }
  let count = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]) count++;
    else break;
  }
  return { count, days };
}

export function useStreak(): { count: number; days: boolean[] } {
  const { data } = useQuery<{ day: string }>(
    `SELECT DISTINCT date(updated_at) as day
     FROM tasks
     WHERE status = 'completed'
       AND deleted_at IS NULL
       AND date(updated_at) >= date('now', '-6 days')
     ORDER BY day DESC`
  );
  const daySet = new Set(data.map(r => r.day));
  const today = new Date().toISOString().split('T')[0];
  return computeStreak(daySet, today);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @todolist/db test streak
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Export from index**

In `packages/db/src/index.ts`, add:

```typescript
export * from './queries/streak';
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/streak.ts packages/db/src/queries/streak.test.ts packages/db/src/index.ts
git commit -m "feat(db): add computeStreak pure fn and useStreak hook"
```

---

## Task 4: useWeeklyActivity hook

**Files:**
- Create: `packages/db/src/queries/weeklyActivity.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Create weeklyActivity.ts**

```typescript
import { useQuery } from '@powersync/react';

export interface DayActivity { day: string; count: number; }

export function useWeeklyActivity(): DayActivity[] {
  const today = new Date();
  const dow = today.getDay(); // 0 = Sunday
  const offsetToMonday = (dow + 6) % 7;

  const monday = new Date(today);
  monday.setDate(today.getDate() - offsetToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monStr = monday.toISOString().split('T')[0];
  const friStr = friday.toISOString().split('T')[0];

  const { data } = useQuery<DayActivity>(
    `SELECT date(updated_at) as day, COUNT(*) as count
     FROM tasks
     WHERE status = 'completed'
       AND deleted_at IS NULL
       AND date(updated_at) >= ?
       AND date(updated_at) <= ?
     GROUP BY date(updated_at)`,
    [monStr, friStr]
  );

  const countMap = new Map(data.map(r => [r.day, Number(r.count)]));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const day = d.toISOString().split('T')[0];
    return { day, count: countMap.get(day) ?? 0 };
  });
}
```

- [ ] **Step 2: Export from index**

In `packages/db/src/index.ts`, add:

```typescript
export * from './queries/weeklyActivity';
```

- [ ] **Step 3: Confirm db package still builds**

```bash
pnpm --filter @todolist/db test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries/weeklyActivity.ts packages/db/src/index.ts
git commit -m "feat(db): add useWeeklyActivity hook"
```

---

## Task 5: FocusSessionContext

**Files:**
- Create: `apps/web/lib/focus/FocusSessionContext.tsx`
- Create: `apps/web/__tests__/FocusSessionContext.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/FocusSessionContext.test.tsx`:

```typescript
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusSessionProvider, useFocusSession } from '@/lib/focus/FocusSessionContext';

function TestConsumer() {
  const { isRunning, secondsLeft, queue, start, pause, reset } = useFocusSession();
  return (
    <div>
      <span data-testid="running">{String(isRunning)}</span>
      <span data-testid="seconds">{secondsLeft}</span>
      <span data-testid="queue">{queue.length}</span>
      <button onClick={() => start([{ id: '1', title: 'Task A' }])}>start</button>
      <button onClick={pause}>pause</button>
      <button onClick={reset}>reset</button>
    </div>
  );
}

describe('FocusSessionContext', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with 25:00 and not running', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    expect(screen.getByTestId('running').textContent).toBe('false');
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
  });

  it('start() sets isRunning and seeds queue', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    expect(screen.getByTestId('running').textContent).toBe('true');
    expect(screen.getByTestId('queue').textContent).toBe('1');
  });

  it('counts down every second', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('seconds').textContent).toBe('1497');
  });

  it('pause() stops countdown', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => { screen.getByText('pause').click(); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('seconds').textContent).toBe('1498');
  });

  it('reset() restores 1500 and stops', () => {
    render(<FocusSessionProvider><TestConsumer /></FocusSessionProvider>);
    act(() => { screen.getByText('start').click(); });
    act(() => { vi.advanceTimersByTime(10000); });
    act(() => { screen.getByText('reset').click(); });
    expect(screen.getByTestId('seconds').textContent).toBe('1500');
    expect(screen.getByTestId('running').textContent).toBe('false');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @todolist/web test FocusSessionContext
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement FocusSessionContext.tsx**

Create `apps/web/lib/focus/FocusSessionContext.tsx`:

```typescript
'use client';

import {
  createContext, useContext, useState, useRef, useCallback, type ReactNode,
} from 'react';

export interface FocusTask { id: string; title: string; }

interface FocusSessionState {
  isRunning:   boolean;
  secondsLeft: number;
  queue:       FocusTask[];
  start:       (tasks: FocusTask[]) => void;
  pause:       () => void;
  reset:       () => void;
}

const Ctx = createContext<FocusSessionState | null>(null);

const POMODORO = 25 * 60;

export function FocusSessionProvider({ children }: { children: ReactNode }) {
  const [isRunning,   setIsRunning]   = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(POMODORO);
  const [queue,       setQueue]       = useState<FocusTask[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback((tasks: FocusTask[]) => {
    setQueue(tasks);
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setIsRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    setSecondsLeft(POMODORO);
  }, []);

  return (
    <Ctx.Provider value={{ isRunning, secondsLeft, queue, start, pause, reset }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFocusSession(): FocusSessionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFocusSession must be used within FocusSessionProvider');
  return ctx;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @todolist/web test FocusSessionContext
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/focus/FocusSessionContext.tsx apps/web/__tests__/FocusSessionContext.test.tsx
git commit -m "feat(web): add FocusSessionContext with Pomodoro timer"
```

---

## Task 6: FocusTaskCard component

**Files:**
- Create: `apps/web/components/today/FocusTaskCard.tsx`
- Create: `apps/web/__tests__/FocusTaskCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/FocusTaskCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return { ...actual, useLabels: vi.fn() };
});

import { useLabels } from '@todolist/db';
import { FocusTaskCard } from '@/components/today/FocusTaskCard';

const TASK = {
  id: 't1', title: 'Ship MVP', priority: 1,
  due_date: '2026-06-23', due_time: '14:00:00',
  labels: '[]', project_name: 'App Studio', project_color: '#6366F1',
};

beforeEach(() => {
  (useLabels as any).mockReturnValue({ data: [] });
});

describe('FocusTaskCard', () => {
  it('renders task title', () => {
    render(<FocusTaskCard task={TASK} onPress={vi.fn()} onComplete={vi.fn()} onToggleFocus={vi.fn()} />);
    expect(screen.getByText('Ship MVP')).toBeInTheDocument();
  });

  it('renders project name', () => {
    render(<FocusTaskCard task={TASK} onPress={vi.fn()} onComplete={vi.fn()} onToggleFocus={vi.fn()} />);
    expect(screen.getByText('App Studio')).toBeInTheDocument();
  });

  it('calls onComplete when checkbox clicked', () => {
    const onComplete = vi.fn();
    render(<FocusTaskCard task={TASK} onPress={vi.fn()} onComplete={onComplete} onToggleFocus={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Complete Ship MVP'));
    expect(onComplete).toHaveBeenCalledWith('t1');
  });

  it('calls onPress when content area clicked', () => {
    const onPress = vi.fn();
    render(<FocusTaskCard task={TASK} onPress={onPress} onComplete={vi.fn()} onToggleFocus={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Open task: Ship MVP'));
    expect(onPress).toHaveBeenCalledWith('t1');
  });

  it('calls onToggleFocus when unpin button clicked', () => {
    const onToggleFocus = vi.fn();
    render(<FocusTaskCard task={TASK} onPress={vi.fn()} onComplete={vi.fn()} onToggleFocus={onToggleFocus} />);
    fireEvent.click(screen.getByLabelText('Remove Ship MVP from focus'));
    expect(onToggleFocus).toHaveBeenCalledWith('t1');
  });

  it('shows priority badge', () => {
    render(<FocusTaskCard task={TASK} onPress={vi.fn()} onComplete={vi.fn()} onToggleFocus={vi.fn()} />);
    expect(screen.getByLabelText('Priority 1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @todolist/web test FocusTaskCard
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement FocusTaskCard.tsx**

Create `apps/web/components/today/FocusTaskCard.tsx`:

```typescript
'use client';

import { memo } from 'react';
import { useLabels } from '@todolist/db';
import { LabelChip } from '@/components/tasks/LabelChip';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

interface FocusTaskItem {
  id:             string;
  title:          string;
  priority:       number;
  due_date?:      string | null;
  due_time?:      string | null;
  labels?:        string | null;
  project_name?:  string | null;
  project_color?: string | null;
}

interface Props {
  task:           FocusTaskItem;
  onPress:        (id: string) => void;
  onComplete:     (id: string) => void;
  onToggleFocus:  (id: string) => void;
}

export const FocusTaskCard = memo(function FocusTaskCard({
  task, onPress, onComplete, onToggleFocus,
}: Props) {
  const { data: allLabels } = useLabels();
  const colorOf = (name: string) => allLabels.find(l => l.name === name)?.color ?? '#9CA3AF';
  const names: string[] = task.labels ? JSON.parse(task.labels) : [];

  return (
    <div className="relative border border-border rounded-xl bg-surface-alt/60 overflow-hidden group">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-xl" />

      <div className="pl-4 pr-3 py-3 flex items-start gap-3">
        <button
          onClick={e => { e.stopPropagation(); onComplete(task.id); }}
          className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ borderColor: PRIORITY_COLOR[task.priority] ?? '#9CA3AF' }}
          aria-label={`Complete ${task.title}`}
        />

        <button
          onClick={() => onPress(task.id)}
          className="flex-1 text-left min-w-0 focus:outline-none"
          aria-label={`Open task: ${task.title}`}
        >
          <p className="text-text-primary text-sm font-medium">{task.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.project_name && (
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.project_color ?? '#6366F1' }}
                />
                {task.project_name}
              </span>
            )}
            {task.due_time && (
              <span className="text-xs text-text-muted">· {task.due_time.slice(0, 5)}</span>
            )}
            {names.map(n => <LabelChip key={n} name={n} color={colorOf(n)} />)}
          </div>
        </button>

        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
          style={{ color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}20` }}
          aria-label={`Priority ${task.priority}`}
        >
          P{task.priority}
        </span>

        <button
          onClick={e => { e.stopPropagation(); onToggleFocus(task.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary flex-shrink-0 mt-0.5 focus:outline-none focus:opacity-100"
          aria-label={`Remove ${task.title} from focus`}
          title="Remove from focus"
        >
          📌
        </button>
      </div>
    </div>
  );
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @todolist/web test FocusTaskCard
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/today/FocusTaskCard.tsx apps/web/__tests__/FocusTaskCard.test.tsx
git commit -m "feat(web): add FocusTaskCard component for IN FOCUS section"
```

---

## Task 7: RightPanel wrapper + FocusSessionCard

**Files:**
- Create: `apps/web/components/today/RightPanel.tsx`
- Create: `apps/web/components/today/FocusSessionCard.tsx`
- Create: `apps/web/__tests__/FocusSessionCard.test.tsx`

- [ ] **Step 1: Create RightPanel.tsx**

```typescript
// apps/web/components/today/RightPanel.tsx
import type { ReactNode } from 'react';

export function RightPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="w-[280px] flex-shrink-0 flex flex-col gap-3 p-4 overflow-y-auto border-l border-border">
      {children}
    </aside>
  );
}
```

- [ ] **Step 2: Write the failing FocusSessionCard test**

Create `apps/web/__tests__/FocusSessionCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FocusSessionProvider } from '@/lib/focus/FocusSessionContext';
import { FocusSessionCard } from '@/components/today/FocusSessionCard';

const FOCUS_TASKS = [{ id: '1', title: 'Task A' }, { id: '2', title: 'Task B' }];

function Wrapper({ children }: { children: React.ReactNode }) {
  return <FocusSessionProvider>{children}</FocusSessionProvider>;
}

describe('FocusSessionCard', () => {
  it('shows 25:00 timer by default', () => {
    render(<Wrapper><FocusSessionCard focusTasks={FOCUS_TASKS} /></Wrapper>);
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('shows task queue count', () => {
    render(<Wrapper><FocusSessionCard focusTasks={FOCUS_TASKS} /></Wrapper>);
    expect(screen.getByText(/2 tasks queued/)).toBeInTheDocument();
  });

  it('shows "Start focusing" button when idle', () => {
    render(<Wrapper><FocusSessionCard focusTasks={FOCUS_TASKS} /></Wrapper>);
    expect(screen.getByRole('button', { name: 'Start focusing' })).toBeInTheDocument();
  });

  it('shows "Pause" after clicking Start', () => {
    render(<Wrapper><FocusSessionCard focusTasks={FOCUS_TASKS} /></Wrapper>);
    fireEvent.click(screen.getByRole('button', { name: 'Start focusing' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
pnpm --filter @todolist/web test FocusSessionCard
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement FocusSessionCard.tsx**

Create `apps/web/components/today/FocusSessionCard.tsx`:

```typescript
'use client';

import { useFocusSession, type FocusTask } from '@/lib/focus/FocusSessionContext';

function fmt(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

interface Props { focusTasks: FocusTask[]; }

export function FocusSessionCard({ focusTasks }: Props) {
  const { isRunning, secondsLeft, queue, start, pause, reset } = useFocusSession();
  const qLen = isRunning ? queue.length : focusTasks.length;

  return (
    <div className="bg-surface-alt rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Focus Session</p>
      <p className="text-5xl font-mono font-bold text-text-primary leading-none">{fmt(secondsLeft)}</p>
      <p className="text-xs text-text-muted">
        {qLen} task{qLen !== 1 ? 's' : ''} queued · no distractions
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => isRunning ? pause() : start(focusTasks)}
          className="flex-1 bg-accent text-white text-sm font-semibold py-2 rounded-xl hover:bg-accent-dark transition-colors"
        >
          {isRunning ? 'Pause' : 'Start focusing'}
        </button>
        {secondsLeft < 25 * 60 && (
          <button
            onClick={reset}
            className="px-3 py-2 text-xs text-text-muted hover:text-text-secondary border border-border rounded-xl transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @todolist/web test FocusSessionCard
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/today/RightPanel.tsx apps/web/components/today/FocusSessionCard.tsx apps/web/__tests__/FocusSessionCard.test.tsx
git commit -m "feat(web): add RightPanel wrapper and FocusSessionCard widget"
```

---

## Task 8: TodayProgressCard

**Files:**
- Create: `apps/web/components/today/TodayProgressCard.tsx`
- Create: `apps/web/__tests__/TodayProgressCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/TodayProgressCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TodayProgressCard } from '@/components/today/TodayProgressCard';

describe('TodayProgressCard', () => {
  it('renders fraction label', () => {
    render(<TodayProgressCard completed={3} total={8} />);
    expect(screen.getByText('3/8')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('shows "On pace" when all tasks completed', () => {
    render(<TodayProgressCard completed={8} total={8} />);
    expect(screen.getByText(/On pace/)).toBeInTheDocument();
  });

  it('shows remaining count when behind', () => {
    // Mock time to midday so day fraction = 0.5, task fraction = 0 → behind
    vi.setSystemTime(new Date('2026-06-23T12:00:00'));
    render(<TodayProgressCard completed={0} total={8} />);
    expect(screen.getByText(/8 tasks left/)).toBeInTheDocument();
  });

  it('shows singular "task" when 1 remaining', () => {
    vi.setSystemTime(new Date('2026-06-23T12:00:00'));
    render(<TodayProgressCard completed={7} total={8} />);
    expect(screen.getByText(/1 task left/)).toBeInTheDocument();
  });

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @todolist/web test TodayProgressCard
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TodayProgressCard.tsx**

Create `apps/web/components/today/TodayProgressCard.tsx`:

```typescript
'use client';

interface Props { completed: number; total: number; }

function DonutChart({ completed, total }: Props) {
  const pct = total === 0 ? 0 : completed / total;
  const r = 28;
  const circ = 2 * Math.PI * r;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="currentColor" strokeWidth="8"
        className="text-border"
      />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="currentColor" strokeWidth="8"
        className="text-accent"
        strokeDasharray={`${pct * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="33" textAnchor="middle" fill="#F9FAFB" fontSize="11" fontWeight="bold">
        {completed}/{total}
      </text>
      <text x="36" y="46" textAnchor="middle" fill="#6B7280" fontSize="9">
        done
      </text>
    </svg>
  );
}

export function TodayProgressCard({ completed, total }: Props) {
  const now = new Date();
  const dayFraction = (now.getHours() + now.getMinutes() / 60) / 24;
  const taskFraction = total === 0 ? 1 : completed / total;
  const onPace = taskFraction >= dayFraction;
  const remaining = total - completed;

  return (
    <div className="bg-surface rounded-2xl p-4 flex items-center gap-3 border border-border">
      <DonutChart completed={completed} total={total} />
      <div>
        <p className="text-sm font-semibold text-text-primary">Today's progress</p>
        <p className="text-xs text-text-muted mt-1">
          {onPace
            ? 'On pace — keep going!'
            : `${remaining} task${remaining !== 1 ? 's' : ''} left to hit your goal.`}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @todolist/web test TodayProgressCard
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/today/TodayProgressCard.tsx apps/web/__tests__/TodayProgressCard.test.tsx
git commit -m "feat(web): add TodayProgressCard with SVG donut chart"
```

---

## Task 9: WeeklyActivityCard

**Files:**
- Create: `apps/web/components/today/WeeklyActivityCard.tsx`
- Create: `apps/web/__tests__/WeeklyActivityCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/WeeklyActivityCard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return { ...actual, useWeeklyActivity: vi.fn() };
});

import { useWeeklyActivity } from '@todolist/db';
import { WeeklyActivityCard } from '@/components/today/WeeklyActivityCard';

describe('WeeklyActivityCard', () => {
  it('renders THIS WEEK header', () => {
    (useWeeklyActivity as any).mockReturnValue([
      { day: '2026-06-23', count: 3 },
      { day: '2026-06-24', count: 0 },
      { day: '2026-06-25', count: 2 },
      { day: '2026-06-26', count: 0 },
      { day: '2026-06-27', count: 1 },
    ]);
    render(<WeeklyActivityCard />);
    expect(screen.getByText('THIS WEEK')).toBeInTheDocument();
  });

  it('renders 5 day labels M T W T F', () => {
    (useWeeklyActivity as any).mockReturnValue([
      { day: '2026-06-23', count: 0 },
      { day: '2026-06-24', count: 0 },
      { day: '2026-06-25', count: 0 },
      { day: '2026-06-26', count: 0 },
      { day: '2026-06-27', count: 0 },
    ]);
    render(<WeeklyActivityCard />);
    const labels = screen.getAllByText(/^[MTWF]$/);
    expect(labels).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @todolist/web test WeeklyActivityCard
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement WeeklyActivityCard.tsx**

Create `apps/web/components/today/WeeklyActivityCard.tsx`:

```typescript
'use client';

import { useWeeklyActivity } from '@todolist/db';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F'];

export function WeeklyActivityCard() {
  const activity = useWeeklyActivity();
  const maxCount = Math.max(1, ...activity.map(d => d.count));
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-surface rounded-2xl p-4 border border-border">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">This Week</p>
      <div className="flex items-end gap-2 h-12">
        {activity.map((d, i) => {
          const isToday = d.day === todayStr;
          const heightPct = d.count === 0 ? 8 : Math.round((d.count / maxCount) * 100);
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className={`w-full rounded-sm transition-all ${isToday ? 'bg-accent' : 'bg-border'}`}
                style={{ height: `${heightPct}%` }}
                aria-label={`${DAY_LABELS[i]}: ${d.count} tasks completed`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1.5">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="flex-1 text-center text-xs text-text-muted">{l}</div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @todolist/web test WeeklyActivityCard
```

Expected: all 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/today/WeeklyActivityCard.tsx apps/web/__tests__/WeeklyActivityCard.test.tsx
git commit -m "feat(web): add WeeklyActivityCard bar chart widget"
```

---

## Task 10: Sidebar redesign

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx`
- Modify: `apps/web/app/ClientLayout.tsx`

- [ ] **Step 1: Add onQuickCapture prop to ClientLayout**

In `apps/web/app/ClientLayout.tsx`, pass `onQuickCapture` to Sidebar:

```typescript
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

const PowerSyncProvider = dynamic(
  () => import('@/lib/powersync/PowerSyncProvider').then(m => m.PowerSyncProvider),
  { ssr: false }
);

export function ClientLayout({ children }: PropsWithChildren) {
  const pathname      = usePathname();
  const isLogin       = pathname === '/login';
  const [showCreate,  setShowCreate]  = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  if (isLogin) return <>{children}</>;

  return (
    <PowerSyncProvider>
      <ShortcutProvider>
        <KeyboardShortcuts onOpenQuickCapture={() => setShowCapture(true)}>
          <div className="flex h-screen bg-bg overflow-hidden">
            <Sidebar
              onNewProject={() => setShowCreate(true)}
              onQuickCapture={() => setShowCapture(true)}
            />
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

- [ ] **Step 2: Rewrite Sidebar.tsx**

Replace the entire contents of `apps/web/components/layout/Sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProjects, useLabels, useSavedFilters, useTodayTasks, useInboxTasks, useStreak } from '@todolist/db';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { FilterBuilderModal } from '@/components/filters/FilterBuilderModal';

const SYNC_DOT: Record<string, string> = {
  synced:  'bg-success',
  syncing: 'bg-accent animate-pulse',
  stale:   'bg-warning',
  offline: 'bg-error',
};

const NAV = [
  { href: '/today',    label: 'Today',     countKey: 'today'    },
  { href: '/inbox',    label: 'Inbox',     countKey: 'inbox'    },
  { href: '/upcoming', label: 'Upcoming',  countKey: null       },
  { href: '/logbook',  label: 'Logbook',   countKey: null       },
  { href: '/all',      label: 'All tasks', countKey: null       },
];

interface Props {
  onNewProject:  () => void;
  onQuickCapture: () => void;
}

export function Sidebar({ onNewProject, onQuickCapture }: Props) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { status }              = useSyncStatus();
  const { data: projects }      = useProjects();
  const { data: labels }        = useLabels();
  const { userId }              = useCurrentUser();
  const { data: savedFilters }  = useSavedFilters(userId ?? '');
  const { data: todayTasks }    = useTodayTasks();
  const { data: inboxTasks }    = useInboxTasks();
  const { count: streakCount, days: streakDays } = useStreak();
  const [signingOut, setSigningOut] = useState(false);
  const [filterModal, setFilterModal] = useState<{ open: boolean; filter?: any }>({ open: false });

  const counts: Record<string, number> = {
    today: todayTasks.length,
    inbox: inboxTasks.length,
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav
      className="w-60 flex-shrink-0 bg-sidebar border-r border-border flex flex-col h-screen sticky top-0"
      aria-label="Main navigation"
    >
      {/* Header: app name + sync dot */}
      <div className="px-4 py-5 border-b border-border flex items-center gap-2">
        <span className="text-text-primary font-bold text-lg tracking-tight">TodoList</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SYNC_DOT[status]}`} aria-hidden="true" />
      </div>

      {/* Quick Add */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onQuickCapture}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white text-sm font-semibold transition-colors"
        >
          + Quick add
        </button>
      </div>

      {/* Core nav */}
      <ul className="mt-1 space-y-0.5 px-2" role="list">
        {NAV.map(({ href, label, countKey }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          const count = countKey ? counts[countKey] : null;
          return (
            <li key={href + label}>
              <Link
                href={href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                  ${active
                    ? 'bg-surface text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                aria-current={active ? 'page' : undefined}
              >
                <span>{label}</span>
                {count != null && count > 0 && (
                  <span className="text-xs text-text-muted bg-surface-alt px-1.5 py-0.5 rounded-full">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Projects + Labels + Filters */}
      <div className="mt-4 px-2 flex-1 overflow-y-auto">
        <p className="px-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">Projects</p>
        <ul className="space-y-0.5" role="list">
          {projects.map(p => {
            const active = pathname === `/projects/${p.id}`;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color ?? '#6366F1' }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{p.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
        >
          + New project
        </button>

        <p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">Labels</p>
        <ul className="space-y-0.5" role="list">
          {labels.filter(l => l.name).map(l => {
            const active = pathname === `/labels/${encodeURIComponent(l.name as string)}`;
            return (
              <li key={l.id}>
                <Link
                  href={`/labels/${encodeURIComponent(l.name as string)}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: l.color ?? '#6366F1' }} aria-hidden="true" />
                  <span className="truncate">{l.name as string}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/labels"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
        >
          + Manage labels
        </Link>

        <p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">Filters</p>
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
      </div>

      {/* Daily Streak */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-text-muted mb-1">Daily streak</p>
        <p className="text-text-primary font-bold text-lg leading-none">
          {streakCount} <span className="text-sm font-normal text-text-muted">days</span>
        </p>
        <div className="flex gap-1 mt-2" aria-label={`${streakCount} day streak`}>
          {streakDays.map((met, i) => (
            <span
              key={i}
              className={`w-4 h-4 rounded-full ${met ? 'bg-accent' : 'bg-surface-alt border border-border'}`}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="border-t border-border pb-2">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full text-left px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
        >
          Sign out
        </button>
      </div>

      <FilterBuilderModal
        open={filterModal.open}
        onClose={() => setFilterModal({ open: false })}
        filter={filterModal.filter}
      />
    </nav>
  );
}
```

- [ ] **Step 3: Verify the app compiles**

```bash
pnpm --filter @todolist/web build 2>&1 | tail -20
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx apps/web/app/ClientLayout.tsx
git commit -m "feat(web): redesign sidebar with Quick Add, reordered nav, Daily Streak"
```

---

## Task 11: Today page redesign

**Files:**
- Modify: `apps/web/app/today/page.tsx`
- Create: `apps/web/__tests__/TodayPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/TodayPage.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
}));

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useTodayTasks:  vi.fn(),
    useTodayStats:  vi.fn(),
    useProjects:    vi.fn(),
    useLabels:      vi.fn(),
    useWeeklyActivity: vi.fn(),
    useStreak:      vi.fn(),
    completeTask:   vi.fn(),
    toggleFocus:    vi.fn(),
  };
});

import {
  useTodayTasks, useTodayStats, useProjects, useLabels,
  useWeeklyActivity, useStreak,
} from '@todolist/db';
import TodayPage from '@/app/today/page';

const FOCUS_TASK = {
  id: 'f1', title: 'Ship MVP', priority: 1,
  due_date: '2026-06-23', due_time: '14:00:00',
  project_id: 'p1', status: 'active', labels: '[]',
  recurrence_rule: null, in_focus: 1,
};

const LATER_TASK = {
  id: 'l1', title: 'Reply emails', priority: 3,
  due_date: '2026-06-23', due_time: null,
  project_id: null, status: 'active', labels: '[]',
  recurrence_rule: null, in_focus: 0,
};

beforeEach(() => {
  (useProjects as any).mockReturnValue({ data: [
    { id: 'p1', name: 'App Studio', color: '#6366F1' },
  ]});
  (useLabels as any).mockReturnValue({ data: [] });
  (useTodayStats as any).mockReturnValue({ data: [{ total: 2, completed: 0 }] });
  (useWeeklyActivity as any).mockReturnValue([
    { day: '2026-06-23', count: 0 },
    { day: '2026-06-24', count: 0 },
    { day: '2026-06-25', count: 0 },
    { day: '2026-06-26', count: 0 },
    { day: '2026-06-27', count: 0 },
  ]);
  (useStreak as any).mockReturnValue({ count: 0, days: Array(7).fill(false) });
});

describe('TodayPage', () => {
  it('shows empty state when no tasks', () => {
    (useTodayTasks as any).mockReturnValue({ data: [] });
    render(<TodayPage />);
    expect(screen.getByText(/All done for today/)).toBeInTheDocument();
  });

  it('renders IN FOCUS section for tasks with in_focus=1', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByText('IN FOCUS')).toBeInTheDocument();
    expect(screen.getByText('Ship MVP')).toBeInTheDocument();
  });

  it('renders LATER TODAY section for non-focus tasks', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByText('LATER TODAY')).toBeInTheDocument();
    expect(screen.getByText('Reply emails')).toBeInTheDocument();
  });

  it('hides IN FOCUS section when no focus tasks', () => {
    (useTodayTasks as any).mockReturnValue({ data: [LATER_TASK] });
    render(<TodayPage />);
    expect(screen.queryByText('IN FOCUS')).not.toBeInTheDocument();
  });

  it('renders Focus Session widget', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK] });
    render(<TodayPage />);
    expect(screen.getByText('Focus Session')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('shows task + in focus count in subtitle', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByText(/2 tasks · 1 in focus/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @todolist/web test TodayPage
```

Expected: FAIL (missing imports, old page structure).

- [ ] **Step 3: Rewrite apps/web/app/today/page.tsx**

```typescript
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  useTodayTasks, useTodayStats, useProjects, completeTask, toggleFocus,
} from '@todolist/db';
import { FocusSessionProvider } from '@/lib/focus/FocusSessionContext';
import { TaskRow } from '@/components/tasks/TaskRow';
import { FocusTaskCard } from '@/components/today/FocusTaskCard';
import { RightPanel } from '@/components/today/RightPanel';
import { FocusSessionCard } from '@/components/today/FocusSessionCard';
import { TodayProgressCard } from '@/components/today/TodayProgressCard';
import { WeeklyActivityCard } from '@/components/today/WeeklyActivityCard';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';

export default function TodayPage() {
  const db                  = usePowerSync();
  const { data: tasks }     = useTodayTasks();
  const { data: statsRows } = useTodayStats();
  const { data: projects }  = useProjects();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats     = statsRows[0] ?? { total: 0, completed: 0 };
  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  const focusTasks = tasks.filter(t => t.in_focus === 1);
  const laterTasks = tasks.filter(t => t.in_focus !== 1);

  const today   = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const handleComplete    = async (id: string) => { await completeTask(db as any, id); };
  const handleToggleFocus = async (id: string) => { await toggleFocus(db as any, id); };

  return (
    <FocusSessionProvider>
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="px-6 pt-8 pb-4">
            <h1 className="text-text-primary text-3xl font-bold">Today</h1>
            <p className="text-text-muted text-sm mt-1">
              {dateStr} · {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {focusTasks.length} in focus
            </p>
          </div>

          {/* Add task bar */}
          <div className="px-6 pb-4">
            <button
              onClick={() => setCapture(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border text-text-muted text-sm hover:border-accent/40 hover:bg-surface transition-colors text-left"
            >
              <span>+</span>
              <span>Add a task — try "Draft update Fri 9am #project !high"</span>
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <p className="text-text-primary font-semibold text-lg">All done for today 🎉</p>
              <p className="text-text-muted text-sm">Nothing due today or overdue</p>
            </div>
          ) : (
            <>
              {/* IN FOCUS */}
              {focusTasks.length > 0 && (
                <section className="px-6 pb-4" aria-labelledby="section-in-focus">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
                    <h2 id="section-in-focus" className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      In Focus
                    </h2>
                  </div>
                  <div className="flex flex-col gap-2">
                    {focusTasks.map(task => {
                      const proj = projectOf(task.project_id);
                      return (
                        <FocusTaskCard
                          key={task.id}
                          task={{
                            ...task,
                            project_name:  proj?.name  ?? null,
                            project_color: proj?.color ?? null,
                          }}
                          onPress={setDetailId}
                          onComplete={handleComplete}
                          onToggleFocus={handleToggleFocus}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {/* LATER TODAY */}
              {laterTasks.length > 0 && (
                <section className="px-6 pb-4" aria-labelledby="section-later">
                  <h2 id="section-later" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Later Today
                  </h2>
                  <div role="list">
                    {laterTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-2 group relative">
                        <span
                          className="text-text-muted opacity-0 group-hover:opacity-100 cursor-grab text-sm flex-shrink-0 select-none"
                          aria-hidden="true"
                        >
                          ⠿
                        </span>
                        <div className="flex-1 min-w-0">
                          <TaskRow
                            task={task as any}
                            onPress={setDetailId}
                            onComplete={handleComplete}
                          />
                        </div>
                        <button
                          onClick={() => handleToggleFocus(task.id)}
                          className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary flex-shrink-0 text-sm focus:outline-none focus:opacity-100"
                          aria-label={`Add ${task.title} to focus`}
                          title="Add to focus"
                        >
                          📌
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
        <RightPanel>
          <FocusSessionCard focusTasks={focusTasks.map(t => ({ id: t.id, title: t.title }))} />
          <TodayProgressCard completed={stats.completed} total={stats.total} />
          <WeeklyActivityCard />
        </RightPanel>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </FocusSessionProvider>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @todolist/web test TodayPage
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pnpm --filter @todolist/web test
```

Expected: all tests pass (no regressions).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/today/page.tsx apps/web/__tests__/TodayPage.test.tsx
git commit -m "feat(web): redesign Today page with IN FOCUS / LATER TODAY sections and right panel"
```

---

## Task 12: All Tasks page

**Files:**
- Create: `apps/web/app/all/page.tsx`

- [ ] **Step 1: Create the All Tasks page**

Create `apps/web/app/all/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useQuery } from '@powersync/react';
import { completeTask } from '@todolist/db';
import { TaskRow } from '@/components/tasks/TaskRow';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function AllTasksPage() {
  const db = usePowerSync();
  const { data: tasks } = useQuery<{
    id: string; title: string; priority: number;
    due_date: string | null; status: string;
    labels: string | null; recurrence_rule: string | null;
  }>(
    `SELECT id, title, priority, due_date, status, labels, recurrence_rule
     FROM tasks
     WHERE status NOT IN ('completed', 'cancelled')
       AND deleted_at IS NULL
     ORDER BY priority, sort_order`
  );
  const [detailId, setDetailId] = useState<string | null>(null);

  const handleComplete = async (id: string) => { await completeTask(db as any, id); };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 pt-8 pb-4 border-b border-border">
          <h1 className="text-text-primary text-3xl font-bold">All Tasks</h1>
          <p className="text-text-muted text-sm mt-1">{tasks.length} active</p>
        </div>
        <div className="flex-1 overflow-y-auto" role="list">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-text-primary font-semibold text-lg">No active tasks</p>
              <p className="text-text-muted text-sm">You're all caught up</p>
            </div>
          ) : (
            tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task as any}
                onPress={setDetailId}
                onComplete={handleComplete}
              />
            ))
          )}
        </div>
      </div>
      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the full test suite**

```bash
pnpm test
```

Expected: all tests across all packages pass.

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm --filter @todolist/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/all/page.tsx
git commit -m "feat(web): add All Tasks page at /all route"
```

---

## Final verification

- [ ] Start the dev server: `pnpm --filter @todolist/web dev`
- [ ] Open `http://localhost:3000/today` — confirm 3-column layout, IN FOCUS / LATER TODAY sections, right panel with timer/progress/chart
- [ ] Mark a task as in-focus (pin icon) — confirm it moves to IN FOCUS section
- [ ] Start a focus session — confirm timer counts down
- [ ] Complete a task — confirm Today's progress donut updates
- [ ] Navigate to `/all` — confirm all active tasks render
- [ ] Check sidebar — confirm Quick Add button opens QuickCaptureModal, streak dots render, nav counts update
