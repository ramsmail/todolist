# Today Dashboard (Ivy Lee) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Today page list/board layout with a single-column Ivy Lee execution view — ranked top-6 priorities with drag-to-reorder, a collapsible "Later Today" section, and two circular SVG progress rings.

**Architecture:** Three new components (`IvyLeeList`, `LaterTodaySection`, `TodayStatsRow`) are created, then `apps/web/app/today/page.tsx` is fully rewritten as a single-column layout wrapping them. `FocusSessionProvider` stays as the outer shell; a new inner `TodayContent` function component consumes `useFocusSession()` for the focus ring. `ViewToggle`, `BoardView`, `RightPanel` remain in the codebase but are no longer rendered.

**Tech Stack:** Next.js 14 App Router, React (HTML5 drag API for reorder), TailwindCSS, `fractional-indexing` (`generateKeyBetween`), PowerSync (`usePowerSync`, `useQuery`), `@todolist/db` (`completeTask`, `moveTask`, `toggleFocus`), Vitest + Testing Library.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/components/today/TodayStatsRow.tsx` | Two SVG ring cards: Tasks Done (indigo) + Focus Time (amber) |
| Create | `apps/web/components/today/IvyLeeList.tsx` | Ranked 6-slot list: drag-to-reorder, NOW badge, checkbox, context menu |
| Create | `apps/web/components/today/LaterTodaySection.tsx` | Collapsible non-focus tasks with "+ Focus" action |
| Rewrite | `apps/web/app/today/page.tsx` | Orchestration: greeting, all three components, focus CTA |
| Create | `apps/web/__tests__/TodayStatsRow.test.tsx` | Ring rendering and label format tests |
| Create | `apps/web/__tests__/IvyLeeList.test.tsx` | Slot count, NOW badge, title click tests |
| Create | `apps/web/__tests__/LaterTodaySection.test.tsx` | Collapse/expand, + Focus visibility tests |
| Rewrite | `apps/web/__tests__/TodayPage.test.tsx` | Updated for new single-column layout |

---

## Task 1: TodayStatsRow component

**Files:**
- Create: `apps/web/components/today/TodayStatsRow.tsx`
- Create: `apps/web/__tests__/TodayStatsRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/TodayStatsRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TodayStatsRow } from '@/components/today/TodayStatsRow';

describe('TodayStatsRow', () => {
  it('renders Tasks Done label', () => {
    render(<TodayStatsRow total={5} completed={2} focusSeconds={0} />);
    expect(screen.getByText('Tasks Done')).toBeInTheDocument();
  });

  it('renders task completion ratio inside ring', () => {
    render(<TodayStatsRow total={5} completed={3} focusSeconds={0} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('renders 0/0 when no tasks', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('renders Focus Time label', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={0} />);
    expect(screen.getByText('Focus Time')).toBeInTheDocument();
  });

  it('formats focus time in minutes when under 1 hour', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={600} />);
    expect(screen.getByText('10m')).toBeInTheDocument();
  });

  it('formats focus time with hours and minutes when >= 1 hour', () => {
    render(<TodayStatsRow total={0} completed={0} focusSeconds={3900} />);
    expect(screen.getByText('1h 5m')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test TodayStatsRow
```

Expected: FAIL — `Cannot find module '@/components/today/TodayStatsRow'`

- [ ] **Step 3: Create the component**

Create `apps/web/components/today/TodayStatsRow.tsx`:

```tsx
'use client';

interface Props {
  total: number;
  completed: number;
  focusSeconds: number;
}

const R = 20;
const CIRCUMFERENCE = 2 * Math.PI * R;

function formatFocusTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Ring({
  fill, color, innerLabel, outerLabel,
}: {
  fill: number; color: string; innerLabel: string; outerLabel: string;
}) {
  const clampedFill = Math.max(0, Math.min(1, fill));
  const offset = CIRCUMFERENCE * (1 - clampedFill);
  return (
    <div className="flex flex-col items-center gap-2 flex-1 bg-white rounded-xl p-4">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 48 48" className="w-full h-full -rotate-90">
          <circle cx="24" cy="24" r={R} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="24" cy="24" r={R} fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-gray-800">{innerLabel}</span>
        </div>
      </div>
      <p className="text-xs text-gray-500">{outerLabel}</p>
    </div>
  );
}

export function TodayStatsRow({ total, completed, focusSeconds }: Props) {
  const taskFill = total > 0 ? completed / total : 0;
  const focusFill = Math.min(focusSeconds / (4 * 3600), 1);

  return (
    <div className="flex gap-3">
      <Ring
        fill={taskFill}
        color="#6366f1"
        innerLabel={`${completed}/${total}`}
        outerLabel="Tasks Done"
      />
      <Ring
        fill={focusFill}
        color="#ca8a04"
        innerLabel={formatFocusTime(focusSeconds)}
        outerLabel="Focus Time"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test TodayStatsRow
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/today/TodayStatsRow.tsx apps/web/__tests__/TodayStatsRow.test.tsx
git commit -m "feat: add TodayStatsRow with SVG task-done and focus-time rings"
```

---

## Task 2: IvyLeeList component

**Files:**
- Create: `apps/web/components/today/IvyLeeList.tsx`
- Create: `apps/web/__tests__/IvyLeeList.test.tsx`

**Key logic — drag-to-reorder neighbors:**

Given `tasks = [A, B, C, D, E]` sorted by `sort_order`, when dragging from index `fromIdx` to `toIdx`:
- If `toIdx > fromIdx`: `taskAbove = tasks[toIdx]`, `taskBelow = tasks[toIdx + 1] ?? null`
- If `toIdx < fromIdx`: `taskAbove = tasks[toIdx - 1] ?? null`, `taskBelow = tasks[toIdx]`

This gives the correct neighbors in the final arrangement without needing to mutate the array.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/IvyLeeList.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
}));
vi.mock('@todolist/db', () => ({
  completeTask: vi.fn(),
  moveTask: vi.fn(),
  toggleFocus: vi.fn(),
}));
vi.mock('fractional-indexing', () => ({
  generateKeyBetween: vi.fn(() => 'new-key'),
}));

import { IvyLeeList } from '@/components/today/IvyLeeList';

const makeTask = (n: number) => ({
  id: `t${n}`, title: `Task ${n}`, priority: 1,
  sort_order: `a${n}`, project_id: null, status: 'active', in_focus: 1,
});

describe('IvyLeeList', () => {
  it('renders Top Priorities heading', () => {
    render(<IvyLeeList tasks={[]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getByText('Top Priorities')).toBeInTheDocument();
  });

  it('renders 6 empty dashes when no tasks', () => {
    render(<IvyLeeList tasks={[]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getAllByText('—')).toHaveLength(6);
  });

  it('renders 4 empty slots when 2 tasks provided', () => {
    render(<IvyLeeList tasks={[makeTask(1), makeTask(2)]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('renders NOW badge on slot 1 only', () => {
    render(<IvyLeeList tasks={[makeTask(1), makeTask(2)]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.getAllByText('NOW')).toHaveLength(1);
  });

  it('does not render NOW badge when no tasks', () => {
    render(<IvyLeeList tasks={[]} projects={[]} onOpenDetail={vi.fn()} />);
    expect(screen.queryByText('NOW')).not.toBeInTheDocument();
  });

  it('calls onOpenDetail when task title is clicked', () => {
    const onOpenDetail = vi.fn();
    render(<IvyLeeList tasks={[makeTask(1)]} projects={[]} onOpenDetail={onOpenDetail} />);
    fireEvent.click(screen.getByText('Task 1'));
    expect(onOpenDetail).toHaveBeenCalledWith('t1');
  });

  it('renders slot numbers 1-6', () => {
    render(<IvyLeeList tasks={[makeTask(1)]} projects={[]} onOpenDetail={vi.fn()} />);
    ['1', '2', '3', '4', '5', '6'].forEach(n => {
      expect(screen.getByText(n)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test IvyLeeList
```

Expected: FAIL — `Cannot find module '@/components/today/IvyLeeList'`

- [ ] **Step 3: Create the component**

Create `apps/web/components/today/IvyLeeList.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { completeTask, moveTask, toggleFocus } from '@todolist/db';
import { generateKeyBetween } from 'fractional-indexing';

type Task = {
  id: string;
  title: string | null;
  priority: number | null;
  sort_order: string | null;
  project_id: string | null;
  status: string | null;
  in_focus: number | null;
};

type Project = { id: string; name: string | null; color: string | null };

interface Props {
  tasks: Task[];      // pre-filtered in_focus===1, sorted by sort_order
  projects: Project[];
  onOpenDetail: (id: string) => void;
}

const SLOTS = 6;

export function IvyLeeList({ tasks, projects, onOpenDetail }: Props) {
  const db = usePowerSync();
  const dragIdxRef = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  const handleDragStart = (idx: number) => {
    dragIdxRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = async (toIdx: number) => {
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === toIdx) {
      dragIdxRef.current = null;
      setOverIdx(null);
      return;
    }
    const task = tasks[fromIdx];
    if (!task) return;

    let taskAbove: Task | null;
    let taskBelow: Task | null;
    if (toIdx > fromIdx) {
      taskAbove = tasks[toIdx] ?? null;
      taskBelow = tasks[toIdx + 1] ?? null;
    } else {
      taskAbove = tasks[toIdx - 1] ?? null;
      taskBelow = tasks[toIdx] ?? null;
    }

    const newKey = generateKeyBetween(
      taskAbove?.sort_order ?? null,
      taskBelow?.sort_order ?? null,
    );
    await moveTask(db as any, task.id, task.priority ?? 4, newKey);
    dragIdxRef.current = null;
    setOverIdx(null);
  };

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  const handleRemoveFromFocus = async (id: string) => {
    setMenuOpenId(null);
    await toggleFocus(db as any, id);
  };

  const slots = Array.from({ length: SLOTS }, (_, i) => tasks[i] ?? null);

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Top Priorities
      </p>
      {slots.map((task, i) => {
        const isFirst = i === 0;

        if (!task) {
          return (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 px-3 py-3 border border-dashed border-gray-200 rounded-lg"
            >
              <span className="text-xs text-gray-300 w-5 text-center">{i + 1}</span>
              <span className="text-sm text-gray-300">—</span>
            </div>
          );
        }

        const proj = projectOf(task.project_id ?? null);

        return (
          <div
            key={task.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { dragIdxRef.current = null; setOverIdx(null); }}
            className={[
              'flex items-center gap-3 px-3 py-3 rounded-lg select-none relative',
              isFirst
                ? 'border-l-2 border-indigo-500 shadow-sm bg-white'
                : 'bg-white',
              overIdx === i && dragIdxRef.current !== i ? 'ring-2 ring-indigo-300' : '',
            ].join(' ')}
          >
            <span className={`text-xs w-5 text-center font-semibold flex-shrink-0 ${isFirst ? 'text-indigo-500' : 'text-gray-400'}`}>
              {i + 1}
            </span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-indigo-500 cursor-pointer flex-shrink-0"
              onChange={() => handleComplete(task.id)}
              aria-label={`Complete ${task.title}`}
            />
            <button
              onClick={() => onOpenDetail(task.id)}
              className="flex-1 text-left text-sm text-gray-800 truncate hover:text-indigo-600 transition-colors"
            >
              {task.title}
            </button>
            {proj && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: proj.color ?? '#808080' }}
              />
            )}
            {isFirst && (
              <span className="text-xs bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                NOW
              </span>
            )}
            {/* Context menu */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpenId(menuOpenId === task.id ? null : task.id)}
                className="text-gray-300 hover:text-gray-500 px-1 focus:outline-none"
                aria-label="Task options"
              >
                ⋯
              </button>
              {menuOpenId === task.id && (
                <div className="absolute right-0 top-6 z-20 bg-white border border-gray-100 rounded-lg shadow-lg py-1 min-w-max">
                  <button
                    onClick={() => handleRemoveFromFocus(task.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Remove from priorities
                  </button>
                </div>
              )}
            </div>
            {/* Drag handle */}
            <span className="text-gray-300 cursor-grab flex-shrink-0" aria-hidden="true">⠿</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test IvyLeeList
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/today/IvyLeeList.tsx apps/web/__tests__/IvyLeeList.test.tsx
git commit -m "feat: add IvyLeeList with 6-slot ranked list, drag-to-reorder, and NOW badge"
```

---

## Task 3: LaterTodaySection component

**Files:**
- Create: `apps/web/components/today/LaterTodaySection.tsx`
- Create: `apps/web/__tests__/LaterTodaySection.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/LaterTodaySection.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
}));
vi.mock('@todolist/db', () => ({
  toggleFocus: vi.fn(),
  moveTask: vi.fn(),
}));
vi.mock('fractional-indexing', () => ({
  generateKeyBetween: vi.fn(() => 'new-key'),
}));

import { LaterTodaySection } from '@/components/today/LaterTodaySection';

const makeTask = (n: number) => ({
  id: `l${n}`, title: `Later Task ${n}`, priority: 3,
  sort_order: `b${n}`, project_id: null, status: 'active', in_focus: 0,
});

const makeFocusTask = (n: number) => ({
  id: `f${n}`, title: `Focus Task ${n}`, priority: 1,
  sort_order: `a${n}`, project_id: null, status: 'active', in_focus: 1,
});

describe('LaterTodaySection', () => {
  it('renders null when tasks array is empty', () => {
    const { container } = render(
      <LaterTodaySection tasks={[]} projects={[]} focusTasks={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders collapsed by default with task count', () => {
    render(<LaterTodaySection tasks={[makeTask(1), makeTask(2)]} projects={[]} focusTasks={[]} />);
    expect(screen.getByText('Later Today')).toBeInTheDocument();
    expect(screen.getByText('· 2 tasks')).toBeInTheDocument();
    expect(screen.queryByText('Later Task 1')).not.toBeInTheDocument();
  });

  it('shows singular "task" when count is 1', () => {
    render(<LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[]} />);
    expect(screen.getByText('· 1 task')).toBeInTheDocument();
  });

  it('expands and shows task titles when header is clicked', () => {
    render(<LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[]} />);
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.getByText('Later Task 1')).toBeInTheDocument();
  });

  it('collapses again when header is clicked twice', () => {
    render(<LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[]} />);
    fireEvent.click(screen.getByText('Later Today'));
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.queryByText('Later Task 1')).not.toBeInTheDocument();
  });

  it('shows + Focus button when fewer than 6 focus tasks', () => {
    render(
      <LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={[makeFocusTask(1)]} />
    );
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.getByText('+ Focus')).toBeInTheDocument();
  });

  it('hides + Focus button when 6 focus tasks exist', () => {
    const focusTasks = Array.from({ length: 6 }, (_, i) => makeFocusTask(i + 1));
    render(
      <LaterTodaySection tasks={[makeTask(1)]} projects={[]} focusTasks={focusTasks} />
    );
    fireEvent.click(screen.getByText('Later Today'));
    expect(screen.queryByText('+ Focus')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test LaterTodaySection
```

Expected: FAIL — `Cannot find module '@/components/today/LaterTodaySection'`

- [ ] **Step 3: Create the component**

Create `apps/web/components/today/LaterTodaySection.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { toggleFocus, moveTask } from '@todolist/db';
import { generateKeyBetween } from 'fractional-indexing';

type Task = {
  id: string;
  title: string | null;
  priority: number | null;
  sort_order: string | null;
  project_id: string | null;
  status: string | null;
  in_focus: number | null;
};

type Project = { id: string; name: string | null; color: string | null };

interface Props {
  tasks: Task[];       // pre-filtered: in_focus !== 1
  projects: Project[];
  focusTasks: Task[];  // current focus list — used to check count and last sort_order
}

export function LaterTodaySection({ tasks, projects, focusTasks }: Props) {
  const db = usePowerSync();
  const [isOpen, setIsOpen] = useState(false);
  const canAddFocus = focusTasks.length < 6;

  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  const handleAddToFocus = async (task: Task) => {
    const lastFocus = focusTasks[focusTasks.length - 1] ?? null;
    await toggleFocus(db as any, task.id);
    await moveTask(
      db as any,
      task.id,
      task.priority ?? 4,
      generateKeyBetween(lastFocus?.sort_order ?? null, null),
    );
  };

  if (tasks.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-gray-600">Later Today</span>
        <span className="text-xs text-gray-400">
          · {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto text-gray-400 text-xs">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-1">
          {tasks.map(task => {
            const proj = projectOf(task.project_id ?? null);
            return (
              <div key={task.id} className="group flex items-center gap-3 px-3 py-3 bg-white rounded-lg">
                {proj && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: proj.color ?? '#808080' }}
                  />
                )}
                <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                {canAddFocus && (
                  <button
                    onClick={() => handleAddToFocus(task)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-indigo-500 hover:text-indigo-700 font-medium flex-shrink-0"
                    aria-label={`Add ${task.title} to Top Priorities`}
                  >
                    + Focus
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test LaterTodaySection
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/today/LaterTodaySection.tsx apps/web/__tests__/LaterTodaySection.test.tsx
git commit -m "feat: add LaterTodaySection with collapsible task list and + Focus action"
```

---

## Task 4: Rewrite page.tsx and update TodayPage tests

**Files:**
- Rewrite: `apps/web/app/today/page.tsx`
- Rewrite: `apps/web/__tests__/TodayPage.test.tsx`

**Notes before writing:**
- `FocusSessionContext` has `secondsLeft` (counts down from `25 * 60 = 1500`). Elapsed focus time = `1500 - secondsLeft`. This is what the `TodayStatsRow` receives as `focusSeconds`.
- `useFocusSession()` must be called inside `FocusSessionProvider`. Solve this by splitting into an outer `TodayPage` (renders `<FocusSessionProvider><TodayContent /></FocusSessionProvider>`) and an inner `TodayContent` function that calls `useFocusSession()`.
- `useProjects()` returns `{ data: Array<{ id, name, color, icon, sort_order }> }`. The new components expect `{ id, name, color }` — no narrowing needed, extra fields are harmless.
- The greeting ("Good morning/afternoon/evening") is computed inline in `TodayContent` — no separate file.
- `StartFocusButton` is an inline `<button>` in `TodayContent` — no separate file.

- [ ] **Step 1: Write the updated failing tests**

Overwrite `apps/web/__tests__/TodayPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@powersync/react', () => ({
  usePowerSync: vi.fn(() => ({ execute: vi.fn() })),
  useQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return {
    ...actual,
    useTodayTasks: vi.fn(),
    useTodayStats: vi.fn(),
    useProjects:   vi.fn(),
  };
});

vi.mock('@/components/today/IvyLeeList', () => ({
  IvyLeeList: ({ tasks }: any) => (
    <div data-testid="ivy-lee-list">
      {tasks.map((t: any) => <span key={t.id}>{t.title}</span>)}
    </div>
  ),
}));
vi.mock('@/components/today/LaterTodaySection', () => ({
  LaterTodaySection: ({ tasks }: any) => (
    <div data-testid="later-section">{tasks.length} later</div>
  ),
}));
vi.mock('@/components/today/TodayStatsRow', () => ({
  TodayStatsRow: () => <div data-testid="stats-row">Stats</div>,
}));
vi.mock('@/components/tasks/TaskDetailPanel', () => ({
  TaskDetailPanel: () => null,
}));
vi.mock('@/components/tasks/QuickCaptureModal', () => ({
  QuickCaptureModal: () => null,
}));

import { useTodayTasks, useTodayStats, useProjects } from '@todolist/db';
import TodayPage from '@/app/today/page';

const FOCUS_TASK = {
  id: 'f1', title: 'Ship MVP', priority: 1,
  due_date: '2026-07-03', project_id: null, status: 'active',
  labels: '[]', recurrence_rule: null, in_focus: 1, sort_order: 'a1',
};
const LATER_TASK = {
  id: 'l1', title: 'Reply emails', priority: 3,
  due_date: '2026-07-03', project_id: null, status: 'active',
  labels: '[]', recurrence_rule: null, in_focus: 0, sort_order: 'b1',
};

beforeEach(() => {
  (useProjects as any).mockReturnValue({ data: [] });
  (useTodayStats as any).mockReturnValue({ data: [{ total: 2, completed: 0 }] });
  (useTodayTasks as any).mockReturnValue({ data: [] });
});

describe('TodayPage', () => {
  it('renders a greeting', () => {
    render(<TodayPage />);
    expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
  });

  it('renders IvyLeeList', () => {
    render(<TodayPage />);
    expect(screen.getByTestId('ivy-lee-list')).toBeInTheDocument();
  });

  it('passes focus tasks to IvyLeeList', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByTestId('ivy-lee-list')).toHaveTextContent('Ship MVP');
  });

  it('passes later tasks to LaterTodaySection', () => {
    (useTodayTasks as any).mockReturnValue({ data: [FOCUS_TASK, LATER_TASK] });
    render(<TodayPage />);
    expect(screen.getByTestId('later-section')).toHaveTextContent('1 later');
  });

  it('renders stats row', () => {
    render(<TodayPage />);
    expect(screen.getByTestId('stats-row')).toBeInTheDocument();
  });

  it('renders Start Focus Session button', () => {
    render(<TodayPage />);
    expect(screen.getByText(/Start Focus Session/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test TodayPage
```

Expected: tests fail because the current `page.tsx` doesn't render `ivy-lee-list` / `later-section` / `stats-row` test IDs.

- [ ] **Step 3: Rewrite page.tsx**

Overwrite `apps/web/app/today/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useTodayTasks, useTodayStats, useProjects } from '@todolist/db';
import { FocusSessionProvider, useFocusSession } from '@/lib/focus/FocusSessionContext';
import { IvyLeeList } from '@/components/today/IvyLeeList';
import { LaterTodaySection } from '@/components/today/LaterTodaySection';
import { TodayStatsRow } from '@/components/today/TodayStatsRow';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';

const POMODORO = 25 * 60;

function TodayContent() {
  const { data: tasks }     = useTodayTasks();
  const { data: statsRows } = useTodayStats();
  const { data: projects }  = useProjects();
  const { isRunning, secondsLeft, start, pause } = useFocusSession();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats = statsRows[0] ?? { total: 0, completed: 0 };
  const focusTasks = tasks.filter(t => t.in_focus === 1);
  const laterTasks = tasks.filter(t => t.in_focus !== 1);
  const focusSeconds = POMODORO - secondsLeft;

  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const handleStartFocus = () => {
    if (isRunning) {
      pause();
    } else {
      start(focusTasks.filter(t => t.title).map(t => ({ id: t.id, title: t.title! })));
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dateStr}</p>
        </div>

        {/* Top Priorities */}
        <IvyLeeList
          tasks={focusTasks}
          projects={projects}
          onOpenDetail={setDetailId}
        />

        {/* Later Today */}
        <LaterTodaySection
          tasks={laterTasks}
          projects={projects}
          focusTasks={focusTasks}
        />

        {/* Stats rings */}
        <TodayStatsRow
          total={stats.total}
          completed={stats.completed}
          focusSeconds={focusSeconds}
        />

        {/* Start Focus Session CTA */}
        <button
          onClick={handleStartFocus}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold transition-colors"
        >
          <span aria-hidden="true">⚡</span>
          <span>{isRunning ? 'Pause Focus Session' : 'Start Focus Session'}</span>
        </button>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </>
  );
}

export default function TodayPage() {
  return (
    <FocusSessionProvider>
      <TodayContent />
    </FocusSessionProvider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test TodayPage
```

Expected: 6 tests PASS

- [ ] **Step 5: Run the full test suite**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm test
```

Expected: all tests pass. If `FocusSessionContext.test.tsx` or `FocusSessionCard.test.tsx` fail, they mock `FocusSessionContext` independently and should not be affected.

- [ ] **Step 6: Run typecheck**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm typecheck
```

Expected: no errors. If TypeScript complains about `projects` type (the `useProjects` return shape has `icon` and `sort_order` extra fields), no fix is needed — the components only destructure `id`, `name`, `color` which all exist.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/today/page.tsx apps/web/__tests__/TodayPage.test.tsx
git commit -m "feat: rewrite Today page as single-column Ivy Lee execution view"
```

---

## Task 5: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /home/rameshv/Repos/Projects/todolist && pnpm dev
```

- [ ] **Step 2: Open http://localhost:3000/today and verify**

Walk through the golden path:

1. **Layout**: Single-column, max-width centered. No right panel, no view toggle.
2. **Greeting**: Shows "Good morning/afternoon/evening" + date.
3. **Top Priorities**: Shows "Top Priorities" heading. If you have focus tasks, they appear numbered 1–6. Task #1 has a left indigo border and "NOW" badge. Empty slots show dashed `—` rows.
4. **Drag**: Grab the `⠿` handle on a task row and drop it onto another slot. Confirm the reorder is reflected after releasing.
5. **Complete**: Check the checkbox on a focus task. Confirm the task disappears and its slot becomes a dashed empty row.
6. **Later Today**: If you have non-focus tasks, the "Later Today · N tasks ▸" pill appears. Click it — the list expands. Hover a row — "+ Focus" appears. Click "+ Focus" — task moves to IvyLeeList.
7. **Context menu**: Click `⋯` on a focus task row → dropdown shows "Remove from priorities" → clicking it moves the task to Later Today.
8. **Stats**: Two ring cards appear — "Tasks Done" (indigo) and "Focus Time" (amber).
9. **Start Focus Session**: Button at bottom. Click it — timer starts (check browser console / FocusSessionCard elsewhere confirms it's running).

- [ ] **Step 3: Commit final state**

```bash
git add -p   # review any unintentional changes
git commit -m "chore: today dashboard visual verification complete"
```

---

## Self-Review against spec

| Spec requirement | Task covering it | Status |
|-----------------|-----------------|--------|
| Single-column layout, max-w-2xl centered | Task 4 (page.tsx) | ✓ |
| TodayGreeting inline (greeting + date) | Task 4 (page.tsx) | ✓ |
| IvyLeeList with 6 slots | Task 2 | ✓ |
| Slot 1 indigo accent + NOW badge | Task 2 | ✓ |
| Dashed empty slots for missing tasks | Task 2 | ✓ |
| Drag-to-reorder with HTML5 drag API | Task 2 | ✓ |
| `generateKeyBetween` → `moveTask` on drop | Task 2 | ✓ |
| Checkbox → `completeTask` | Task 2 | ✓ |
| Title click → `onOpenDetail` | Task 2 | ✓ |
| ⋯ context menu → "Remove from priorities" → `toggleFocus` | Task 2 | ✓ |
| LaterTodaySection collapsed by default | Task 3 | ✓ |
| Expand/collapse on click | Task 3 | ✓ |
| "+ Focus" on hover, calls toggleFocus + moveTask | Task 3 | ✓ |
| Hide "+ Focus" when focusTasks.length >= 6 | Task 3 | ✓ |
| TodayStatsRow: Tasks Done ring (indigo, N/M label) | Task 1 | ✓ |
| TodayStatsRow: Focus Time ring (amber, Xh Ym label) | Task 1 | ✓ |
| SVG ring: stroke-dasharray / stroke-dashoffset | Task 1 | ✓ |
| StartFocusButton inline CTA | Task 4 (page.tsx) | ✓ |
| FocusSessionProvider as outer wrapper | Task 4 (page.tsx) | ✓ |
| QuickCaptureModal + TaskDetailPanel preserved | Task 4 (page.tsx) | ✓ |
| ViewToggle / BoardView / RightPanel kept, not rendered | Task 4 (page.tsx – by omission) | ✓ |
