# Eisenhower Task Matrix — Design Spec

**Date:** 2026-07-02  
**Status:** Approved  
**Scope:** Web only (`apps/web`)

---

## Overview

A new "Matrix" view that presents all active tasks in a 2×2 Eisenhower decision grid, grouped by the existing `priority` field (1–4). Tasks can be dragged between quadrants to reprioritize them. No schema changes required.

---

## Quadrant Mapping

| Priority | Quadrant | Icon | Color |
|----------|----------|------|-------|
| 1 | Do First | ⚡ | Amber (`bg-amber-50`) |
| 2 | Schedule | 📅 | Indigo (`bg-indigo-50`) |
| 3 | Delegate | ↪ | Neutral (`bg-neutral-50`) |
| 4 | Eliminate | ✕ | Rose (`bg-rose-50`) |

Tasks with no explicit priority default to P4 (Eliminate) — this is already the schema default.

---

## Architecture

### Route

New App Router page: `apps/web/app/matrix/page.tsx`

Follows the same pattern as `/all` and `/today`: a `'use client'` page that uses `useQuery` from `@powersync/react` and mounts `TaskDetailPanel` for task editing.

### Data

Single PowerSync query — all active, non-deleted tasks:

```sql
SELECT id, title, priority, labels, status, due_date, recurrence_rule, sort_order
FROM tasks
WHERE status NOT IN ('completed', 'cancelled')
  AND deleted_at IS NULL
ORDER BY sort_order
```

Tasks are split into four groups in JavaScript by `priority` value before rendering.

### Write path

Quadrant reassignment calls `updateTaskPriority(db, id, newPriority)` from `packages/db/src/queries/tasks.ts` — already implemented. No new write functions needed. PowerSync syncs the change to other devices automatically.

### Sidebar navigation

Add to `NAV` array in `apps/web/components/layout/Sidebar.tsx`, between Today and Upcoming:

```ts
{ href: '/matrix', label: 'Matrix', icon: '⊞' }
```

---

## Components

### `apps/web/app/matrix/page.tsx`

- Fetches tasks via `useQuery`
- Splits results into 4 arrays by priority
- Renders a 2×2 CSS grid of `MatrixQuadrant` cards
- Mounts `TaskDetailPanel` (same slide-in panel used across all views)
- Header: "Task Matrix" title + "Eisenhower decision framework — prioritize by urgency and importance" subtitle + "+ Add Task" button (opens existing `QuickCaptureModal`)

### `apps/web/app/matrix/MatrixQuadrant.tsx`

New component, local to the matrix route.

**Props:**
```ts
interface MatrixQuadrantProps {
  quadrant: 1 | 2 | 3 | 4;
  tasks: TaskRow[];
  onTaskPress: (id: string) => void;
  onTaskComplete: (id: string) => void;
  onDropTask: (taskId: string, targetQuadrant: number) => void;
}
```

**Renders:**
- Colored header with icon, label, and task count
- Drop zone: `onDragOver` (prevent default to allow drop) + `onDrop` extracts task id from `dataTransfer`, calls `onDropTask`
- Drop target gets a subtle highlight ring (`ring-2 ring-accent/40`) while a dragged task hovers
- Scrollable task list (`overflow-y-auto max-h-[calc(50vh-6rem)]`)
- Empty state: centered muted text "No tasks here" when the quadrant is empty

### `TaskRow` (existing — no changes)

Reused as-is. Already accepts `draggable` prop. The page sets `draggable={true}` and attaches `onDragStart` to store the task id in `dataTransfer.setData('text/plain', task.id)`.

---

## Interactions

### Drag to reassign

1. User drags a `TaskRow` — `onDragStart` writes `task.id` into `dataTransfer`
2. Dragging over a `MatrixQuadrant` triggers drop-zone highlight
3. On drop: extract task id, call `updateTaskPriority(db, id, targetPriority)`
4. No-op if source and target quadrant are the same priority

### Click to edit

Clicking a task opens `TaskDetailPanel` where priority (and all other fields) can be changed — consistent with all other views.

### Add Task

"+ Add Task" button opens `QuickCaptureModal` without pre-selecting a quadrant. Users can type `p1`–`p4` or `!1`–`!4` in the NLP input to assign priority at capture time. Default is P4.

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Quadrant is empty | "No tasks here" empty state; grid layout stays stable |
| Too many tasks in one quadrant | Quadrant card scrolls independently; grid does not scroll |
| Drop onto same quadrant | No-op (priority unchanged, no write) |
| Task has `priority = null` | Cannot happen — schema enforces `NOT NULL DEFAULT 4` |
| Completed / cancelled tasks | Excluded at query level, same as all other views |

---

## Out of Scope

- Mobile (to be designed separately)
- Per-quadrant "Add Task" button pre-set to that quadrant's priority
- Within-quadrant drag reordering (would require `sort_order` updates and a DnD library)
- Auto-classification from due date / AI
- Schema changes (`is_urgent`, `is_important` columns)
