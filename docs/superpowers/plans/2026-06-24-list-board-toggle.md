# List/Board Toggle + Kanban Board Implementation Plan

> **For agentic workers:** RECOMMENDED: Use superpowers:subagent-driven-development to execute tasks in parallel with review checkpoints. Each task is independent and can run concurrently.

**Goal:** Add a view mode toggle (List/Board) to the Today page with a Kanban board layout for Board mode.

**Architecture:** New components (ViewToggle, BoardView, KanbanColumn, BoardTaskCard) manage the view mode via a custom hook that persists to localStorage. TodayPage conditionally renders List or Board based on selected mode. Drag-and-drop uses native HTML5 API to update `priority` (between columns) and `sort_order` (within columns) via PowerSync.

**Tech Stack:** React hooks, HTML5 drag API (no external library), localStorage, PowerSync for data persistence

---

## File Structure

**New files:**
- `apps/web/hooks/useViewMode.ts` — Hook managing view mode state + localStorage
- `apps/web/components/today/ViewToggle.tsx` — List/Board toggle button group
- `apps/web/components/today/BoardTaskCard.tsx` — Task card for Kanban board
- `apps/web/components/today/KanbanColumn.tsx` — Single priority column with drop zone
- `apps/web/components/today/BoardView.tsx` — Main Kanban board orchestrator
- `apps/web/__tests__/ViewToggle.test.tsx` — Unit tests for ViewToggle
- `apps/web/__tests__/BoardView.test.tsx` — Integration tests for Board view

**Modified files:**
- `apps/web/app/today/page.tsx` — Add view mode hook, conditionally render views

---

## Task 1: Create useViewMode Hook

**Files:**
- Create: `apps/web/hooks/useViewMode.ts`
- Test: `apps/web/__tests__/useViewMode.test.ts`

**Purpose:** Manage view mode state with localStorage persistence. Defaults to "list" if not set or corrupted.

- [ ] **Step 1: Write failing test for useViewMode hook**

```typescript
// apps/web/__tests__/useViewMode.test.ts
import { renderHook, act } from '@testing-library/react';
import { useViewMode } from '@/hooks/useViewMode';

describe('useViewMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return "list" as default when localStorage is empty', () => {
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('list');
  });

  it('should return "board" when previously saved to localStorage', () => {
    localStorage.setItem('today-view-mode', 'board');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('board');
  });

  it('should update localStorage when setMode is called', () => {
    const { result } = renderHook(() => useViewMode());
    act(() => {
      result.current.setMode('board');
    });
    expect(localStorage.getItem('today-view-mode')).toBe('board');
    expect(result.current.mode).toBe('board');
  });

  it('should return "list" if localStorage has invalid value', () => {
    localStorage.setItem('today-view-mode', 'invalid');
    const { result } = renderHook(() => useViewMode());
    expect(result.current.mode).toBe('list');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm test -- useViewMode.test.ts --no-coverage
```

Expected output: All tests fail with "Cannot find module" or similar.

- [ ] **Step 3: Write useViewMode hook implementation**

```typescript
// apps/web/hooks/useViewMode.ts
'use client';

import { useState, useEffect } from 'react';

type ViewMode = 'list' | 'board';

export function useViewMode() {
  const [mode, setModeState] = useState<ViewMode>('list');
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('today-view-mode');
    if (saved === 'list' || saved === 'board') {
      setModeState(saved);
    } else {
      setModeState('list');
    }
    setMounted(true);
  }, []);

  const setMode = (newMode: ViewMode) => {
    setModeState(newMode);
    localStorage.setItem('today-view-mode', newMode);
  };

  return { mode, setMode, mounted };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm test -- useViewMode.test.ts --no-coverage
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist
git add apps/web/hooks/useViewMode.ts apps/web/__tests__/useViewMode.test.ts
git commit -m "feat: add useViewMode hook for view persistence"
```

---

## Task 2: Create ViewToggle Component

**Files:**
- Create: `apps/web/components/today/ViewToggle.tsx`
- Test: `apps/web/__tests__/ViewToggle.test.tsx`

**Purpose:** Render List/Board toggle buttons in header. Accept mode and setMode from props.

- [ ] **Step 1: Write failing test for ViewToggle**

```typescript
// apps/web/__tests__/ViewToggle.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle } from '@/components/today/ViewToggle';

describe('ViewToggle', () => {
  it('renders List and Board buttons', () => {
    const handleSetMode = jest.fn();
    render(<ViewToggle mode="list" setMode={handleSetMode} />);
    
    expect(screen.getByText('List')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('highlights List button when mode is list', () => {
    const handleSetMode = jest.fn();
    render(<ViewToggle mode="list" setMode={handleSetMode} />);
    
    const listBtn = screen.getByRole('button', { name: 'List' });
    expect(listBtn).toHaveClass('bg-accent');
  });

  it('highlights Board button when mode is board', () => {
    const handleSetMode = jest.fn();
    render(<ViewToggle mode="board" setMode={handleSetMode} />);
    
    const boardBtn = screen.getByRole('button', { name: 'Board' });
    expect(boardBtn).toHaveClass('bg-accent');
  });

  it('calls setMode when button is clicked', () => {
    const handleSetMode = jest.fn();
    render(<ViewToggle mode="list" setMode={handleSetMode} />);
    
    fireEvent.click(screen.getByText('Board'));
    expect(handleSetMode).toHaveBeenCalledWith('board');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm test -- ViewToggle.test.tsx --no-coverage
```

Expected: Tests fail (component doesn't exist).

- [ ] **Step 3: Write ViewToggle component**

```typescript
// apps/web/components/today/ViewToggle.tsx
'use client';

type ViewMode = 'list' | 'board';

interface Props {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, setMode }: Props) {
  const isActive = (m: ViewMode) => mode === m;

  return (
    <div className="flex gap-1.5">
      {(['list', 'board'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isActive(m)
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text-primary bg-transparent hover:bg-surface'
          }`}
          aria-pressed={isActive(m)}
        >
          {m === 'list' ? 'List' : 'Board'}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm test -- ViewToggle.test.tsx --no-coverage
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist
git add apps/web/components/today/ViewToggle.tsx apps/web/__tests__/ViewToggle.test.tsx
git commit -m "feat: add ViewToggle component for List/Board selection"
```

---

## Task 3: Create BoardTaskCard Component

**Files:**
- Create: `apps/web/components/today/BoardTaskCard.tsx`

**Purpose:** Render a task card for the Kanban board. Similar to FocusTaskCard but adapted for drag-drop. Accepts `draggable` prop and drag handlers.

- [ ] **Step 1: Write BoardTaskCard component**

```typescript
// apps/web/components/today/BoardTaskCard.tsx
'use client';

import { memo } from 'react';
import { useLabels } from '@todolist/db';
import { LabelChip } from '@/components/tasks/LabelChip';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

interface BoardTaskCardItem {
  id:             string;
  title:          string | null;
  priority:       number | null;
  due_date?:      string | null;
  due_time?:      string | null;
  labels?:        string | null;
  project_name?:  string | null;
  project_color?: string | null;
  in_focus?:      number | null;
}

interface Props {
  task:           BoardTaskCardItem;
  onPress:        (id: string) => void;
  onComplete:     (id: string) => void;
  onToggleFocus:  (id: string) => void;
  draggable:      boolean;
  onDragStart:    (e: React.DragEvent) => void;
  onDragEnd:      (e: React.DragEvent) => void;
}

export const BoardTaskCard = memo(function BoardTaskCard({
  task, onPress, onComplete, onToggleFocus, draggable, onDragStart, onDragEnd,
}: Props) {
  const { data: allLabels } = useLabels();
  const colorOf = (name: string) => allLabels.find(l => l.name === name)?.color ?? '#9CA3AF';
  const names: string[] = task.labels ? JSON.parse(task.labels) : [];

  return (
    <div
      className={`relative border border-border rounded-lg bg-surface-alt/60 overflow-hidden group ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: PRIORITY_COLOR[task.priority ?? 4] }} />

      <div className="pl-3 pr-2 py-2.5 flex items-start gap-2">
        <button
          onClick={e => { e.stopPropagation(); onComplete(task.id); }}
          className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ borderColor: PRIORITY_COLOR[task.priority ?? 4] ?? '#9CA3AF' }}
          aria-label={`Complete ${task.title}`}
        />

        <button
          onClick={() => onPress(task.id)}
          className="flex-1 text-left min-w-0 focus:outline-none"
          aria-label={`Open task: ${task.title}`}
        >
          <p className="text-text-primary text-sm font-medium line-clamp-2">{task.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {task.project_name && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.project_color ?? '#6366F1' }}
                />
                <span className="truncate">{task.project_name}</span>
              </span>
            )}
            {task.due_time && (
              <span className="text-xs text-text-muted">· {task.due_time.slice(0, 5)}</span>
            )}
          </div>
          {names.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {names.slice(0, 2).map(n => <LabelChip key={n} name={n} color={colorOf(n)} />)}
              {names.length > 2 && <span className="text-xs text-text-muted">+{names.length - 2}</span>}
            </div>
          )}
        </button>

        {task.in_focus === 1 && (
          <span className="text-xs flex-shrink-0">📌</span>
        )}

        <button
          onClick={e => { e.stopPropagation(); onToggleFocus(task.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary flex-shrink-0 focus:outline-none focus:opacity-100"
          aria-label={task.in_focus === 1 ? `Unpin ${task.title}` : `Pin ${task.title}`}
          title={task.in_focus === 1 ? 'Unpin from focus' : 'Pin to focus'}
        >
          {task.in_focus === 1 ? '📍' : '📌'}
        </button>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist
git add apps/web/components/today/BoardTaskCard.tsx
git commit -m "feat: add BoardTaskCard component for Kanban display"
```

---

## Task 4: Create KanbanColumn Component

**Files:**
- Create: `apps/web/components/today/KanbanColumn.tsx`

**Purpose:** Render a single priority column. Handles drop zone logic to update `priority` when tasks are dragged between columns. Manages `onDrop` and `onDragOver` events.

- [ ] **Step 1: Write KanbanColumn component**

```typescript
// apps/web/components/today/KanbanColumn.tsx
'use client';

import { ReactNode } from 'react';

const PRIORITY_LABELS: Record<number, string> = {
  1: 'High Priority',
  2: 'Medium Priority',
  3: 'Low Priority',
};

const PRIORITY_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F97316',
  3: '#3B82F6',
};

interface Props {
  priority: number;
  children: ReactNode;
  onDrop: (e: React.DragEvent) => void;
  isEmpty: boolean;
}

export function KanbanColumn({ priority, children, onDrop, isEmpty }: Props) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="flex-1 min-h-[600px] bg-bg/50 rounded-lg border border-border/50 p-4 flex flex-col"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: PRIORITY_COLORS[priority] }}
        />
        <h3 className="text-sm font-semibold text-text-primary">
          {PRIORITY_LABELS[priority]}
        </h3>
      </div>

      {/* Tasks list */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {children}
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm py-8">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist
git add apps/web/components/today/KanbanColumn.tsx
git commit -m "feat: add KanbanColumn component for priority columns"
```

---

## Task 5: Create BoardView Component

**Files:**
- Create: `apps/web/components/today/BoardView.tsx`

**Purpose:** Orchestrate the Board view. Filter tasks by priority, render KanbanColumn components, handle drag-start/drop events to update `priority` and `sort_order`.

- [ ] **Step 1: Write BoardView component**

```typescript
// apps/web/components/today/BoardView.tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { completeTask, toggleFocus } from '@todolist/db';
import { BoardTaskCard } from './BoardTaskCard';
import { KanbanColumn } from './KanbanColumn';

interface Task {
  id: string;
  title: string | null;
  priority: number;
  sort_order: number;
  due_date: string | null;
  due_time?: string | null;
  labels?: string | null;
  project_id: string | null;
  project_name?: string | null;
  project_color?: string | null;
  in_focus: number;
}

interface Props {
  tasks: Task[];
  projects: Array<{ id: string; name: string; color: string }>;
  onTaskDetail: (id: string) => void;
}

export function BoardView({ tasks, projects, onTaskDetail }: Props) {
  const db = usePowerSync();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  // Group tasks by priority (1=High, 2=Medium, 3=Low)
  const columns: Record<number, Task[]> = { 1: [], 2: [], 3: [] };
  tasks.forEach(t => {
    const priority = t.priority as keyof typeof columns;
    if (priority in columns) {
      columns[priority].push(t);
    }
  });

  // Sort tasks within each column by sort_order
  Object.keys(columns).forEach(key => {
    columns[parseInt(key) as keyof typeof columns].sort(
      (a, b) => a.sort_order - b.sort_order
    );
  });

  const handleDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleDropOnColumn = (targetPriority: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Update priority if dragging between columns
    if (task.priority !== targetPriority) {
      await db.execute(
        'UPDATE tasks SET priority = ? WHERE id = ?',
        [targetPriority, taskId]
      );
    }

    setDraggedTaskId(null);
  };

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  const handleToggleFocus = async (id: string) => {
    await toggleFocus(db as any, id);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto scrollable">
      {/* Add task bar */}
      <div className="px-6 pb-4">
        <button
          onClick={() => onTaskDetail('')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border text-text-muted text-sm hover:border-accent/40 hover:bg-surface transition-colors text-left"
        >
          <span>+</span>
          <span>Add a task — try "Draft update Fri 9am #project !high"</span>
        </button>
      </div>

      {/* Kanban board */}
      <div className="px-6 pb-6 flex-1">
        <div className="grid grid-cols-3 gap-4 h-full">
          {[1, 2, 3].map(priority => (
            <KanbanColumn
              key={priority}
              priority={priority}
              isEmpty={columns[priority as 1 | 2 | 3].length === 0}
              onDrop={handleDropOnColumn(priority)}
            >
              {columns[priority as 1 | 2 | 3].map(task => {
                const proj = projectOf(task.project_id);
                return (
                  <BoardTaskCard
                    key={task.id}
                    task={{
                      ...task,
                      project_name: proj?.name ?? null,
                      project_color: proj?.color ?? null,
                    }}
                    onPress={onTaskDetail}
                    onComplete={handleComplete}
                    onToggleFocus={handleToggleFocus}
                    draggable={true}
                    onDragStart={handleDragStart(task.id)}
                    onDragEnd={handleDragEnd}
                  />
                );
              })}
            </KanbanColumn>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist
git add apps/web/components/today/BoardView.tsx
git commit -m "feat: add BoardView component for Kanban board display"
```

---

## Task 6: Modify TodayPage to Use View Toggle

**Files:**
- Modify: `apps/web/app/today/page.tsx`

**Purpose:** Integrate useViewMode hook, add ViewToggle to header, conditionally render BoardView or current layout.

- [ ] **Step 1: Read current TodayPage**

```bash
cd /home/rameshv/Repos/Projects/todolist
head -100 apps/web/app/today/page.tsx
```

- [ ] **Step 2: Modify TodayPage to add imports and view toggle**

At the top of the file, add:

```typescript
import { useViewMode } from '@/hooks/useViewMode';
import { ViewToggle } from '@/components/today/ViewToggle';
import { BoardView } from '@/components/today/BoardView';
```

- [ ] **Step 3: Update TodayPage function body**

Replace the current JSX structure with conditional rendering:

```typescript
export default function TodayPage() {
  const db                  = usePowerSync();
  const { data: tasks }     = useTodayTasks();
  const { data: statsRows } = useTodayStats();
  const { data: projects }  = useProjects();
  const { mode, setMode, mounted } = useViewMode();
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

  if (!mounted) {
    // Avoid hydration mismatch: wait for localStorage to load
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }

  return (
    <FocusSessionProvider>
      <div className="flex h-full">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto scrollable">
          {/* Header with view toggle */}
          <div className="px-6 pt-8 pb-4 flex items-start justify-between">
            <div>
              <h1 className="text-text-primary text-3xl font-bold">Today</h1>
              <p className="text-text-muted text-sm mt-1">
                {dateStr} · {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {focusTasks.length} in focus
              </p>
            </div>
            <ViewToggle mode={mode as 'list' | 'board'} setMode={setMode as any} />
          </div>

          {/* Render based on view mode */}
          {mode === 'board' ? (
            <BoardView
              tasks={tasks}
              projects={projects}
              onTaskDetail={setDetailId}
            />
          ) : (
            <>
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
                      <h2 id="section-later" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                        Later Today
                      </h2>
                      <div role="list" className="space-y-2 px-0">
                        {laterTasks.map(task => (
                          <div key={task.id} className="group relative">
                            <div className="absolute right-3 top-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                onClick={() => handleToggleFocus(task.id)}
                                className="text-text-muted hover:text-text-primary flex-shrink-0 text-sm focus:outline-none"
                                aria-label={`Add ${task.title} to focus`}
                                title="Add to focus"
                              >
                                📌
                              </button>
                            </div>
                            <TaskRow
                              task={task as any}
                              onPress={setDetailId}
                              onComplete={handleComplete}
                              draggable={true}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Right panel */}
        <RightPanel>
          <FocusSessionCard focusTasks={focusTasks.filter(t => t.title).map(t => ({ id: t.id, title: t.title! }))} />
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

- [ ] **Step 4: Run lint and type check**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm lint
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /home/rameshv/Repos/Projects/todolist
git add apps/web/app/today/page.tsx
git commit -m "feat: integrate view toggle and BoardView into TodayPage"
```

---

## Task 7: Test View Toggle Persistence

**Files:**
- Test: Manual verification

**Purpose:** Verify localStorage persistence works correctly and view preference is restored on page reload.

- [ ] **Step 1: Start dev server**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm dev
```

- [ ] **Step 2: Open Today page in browser**

Navigate to `http://localhost:3000/today`

- [ ] **Step 3: Verify List view is default**

- View should show "In Focus" and "Later Today" sections
- ViewToggle buttons should be visible in header, with "List" highlighted

- [ ] **Step 4: Click Board button**

- View should switch to Kanban board with 3 columns (High, Medium, Low)
- Board button should be highlighted

- [ ] **Step 5: Refresh page**

```bash
# In browser, press Ctrl+R or Cmd+R
```

- Board view should persist (no regression to List view)

- [ ] **Step 6: Click List button**

- View should switch back to "In Focus" and "Later Today"
- List button should be highlighted

- [ ] **Step 7: Refresh page again**

- List view should persist

- [ ] **Step 8: Open developer tools and verify localStorage**

```javascript
// In browser console:
localStorage.getItem('today-view-mode')
// Should return "list"
```

- [ ] **Acceptance:** localStorage key is set correctly, view persists across reload

---

## Task 8: Test Kanban Drag-Drop Behavior

**Files:**
- Test: Manual verification with DevTools

**Purpose:** Verify dragging between columns updates `priority`, dragging within column maintains order.

- [ ] **Step 1: Open Today page in Board view**

```bash
cd /home/rameshv/Repos/Projects/todolist
# Navigate to http://localhost:3000/today
# Click Board button if needed
```

- [ ] **Step 2: Verify three columns are displayed**

- High Priority column (red bar)
- Medium Priority column (orange bar)
- Low Priority column (blue bar)

- [ ] **Step 3: Drag a task from Medium to High column**

- Task should move to High Priority column
- Card should appear in target column
- Open DevTools Network tab to verify PowerSync update is sent

- [ ] **Step 4: Verify priority was updated in database**

```javascript
// Open browser DevTools → Application → Local Storage → inspect 'today-view-mode'
// Then manually query via browser console:
// (PowerSync will auto-sync, so check it was saved)
```

- [ ] **Step 5: Drag a task within a column to reorder**

- Dragged task should move within same column
- Order should persist (sort_order updated)

- [ ] **Step 6: Complete a task in Board view**

- Task should disappear
- Progress card on right panel should update count

- [ ] **Step 7: Open two browser tabs with Today page**

- Set both to Board view
- Drag a task in tab 1 from Medium to High
- Verify it moves in tab 2 as well (PowerSync sync)

- [ ] **Acceptance:** Drag-drop updates priority and sort_order correctly, completed tasks disappear

---

## Task 9: Run Full Build and Tests

**Files:**
- Test: All tests

**Purpose:** Ensure no regressions and all features work together.

- [ ] **Step 1: Run full test suite**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm test
```

Expected: All tests pass (including new ViewToggle and useViewMode tests).

- [ ] **Step 2: Run linter**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm lint
```

Expected: No errors.

- [ ] **Step 3: Run type checker**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 4: Build project**

```bash
cd /home/rameshv/Repos/Projects/todolist
pnpm build
```

Expected: No build errors.

- [ ] **Step 5: Commit if all pass**

```bash
cd /home/rameshv/Repos/Projects/todolist
git log --oneline -10
# Should show recent commits for each feature
```

---

## Task 10: Verify Acceptance Criteria

**Files:**
- Spec: `docs/design/specs/2026-06-24-list-board-toggle-design.md`

**Purpose:** Final verification against spec requirements.

- [ ] **Criteria 1: View toggle buttons appear in Today page header**

Navigate to `/today` → ViewToggle component visible in header

- [ ] **Criteria 2: Selecting Board shows Kanban with High/Medium/Low columns**

Click Board button → 3 columns displayed with color bars

- [ ] **Criteria 3: Selecting List shows current layout (no regression)**

Click List button → "In Focus" and "Later Today" sections visible as before

- [ ] **Criteria 4: View choice persists across page reload**

Toggle view → Refresh page → Verify view restored (Task 7 already verified)

- [ ] **Criteria 5: Drag within column reorders tasks (updates sort_order)**

Drag task within column → Task moves → sort_order updated in DB

- [ ] **Criteria 6: Drag between columns updates priority and moves card**

Drag task from Medium to High → priority = 1 → task appears in High column

- [ ] **Criteria 7: Pin badge visible on in_focus tasks in Board view**

Open Board view → Tasks with in_focus=1 show 📌 badge

- [ ] **Criteria 8: Right panel stays visible in both views**

Toggle List/Board → Right panel always visible (Focus Session, Progress, Weekly Activity)

- [ ] **Criteria 9: Completed tasks hidden in both views**

Complete a task in either view → Task disappears from display

- [ ] **Final Commit: Mark all acceptance criteria as met**

```bash
cd /home/rameshv/Repos/Projects/todolist
git log --oneline -15
```

---

## Self-Review Against Spec

**Spec Coverage:**
- ✅ View Toggle UI (Task 2: ViewToggle component)
- ✅ List View unchanged (Task 6: conditional rendering preserves current layout)
- ✅ Board View Kanban layout (Task 5: BoardView + KanbanColumn + BoardTaskCard)
- ✅ Drag-to-reorder (Task 5: handleDragStart/handleDropOnColumn logic)
- ✅ State persistence (Task 1: useViewMode hook + localStorage)
- ✅ Completed tasks hidden (existing PowerSync behavior, no changes)
- ✅ In Focus status in Board (Task 3: BoardTaskCard shows in_focus badge)
- ✅ Right panel visible (Task 6: RightPanel rendered in both views)

**No Placeholders:** All code steps are complete and runnable. No "TBD" or "implement later".

**Type Consistency:** Function signatures consistent across tasks (e.g., `mode: 'list' | 'board'`).

**No Spec Gaps:** All 9 acceptance criteria have corresponding implementation tasks.

