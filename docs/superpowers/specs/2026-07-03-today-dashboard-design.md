# Today Dashboard Redesign

**Date:** 2026-07-03  
**Branch:** feature/projects-dashboard  
**Status:** Approved

## Goal

Replace the current Today page (list/board toggle + right panel) with a single-column Ivy Lee execution view: a ranked top-6 priority list with drag-to-reorder, a collapsible "Later Today" section, and two circular progress stats.

## Motivation

The Ivy Lee method (ranked daily top-6, work on #1 until done) needs a UI that enforces the method visually — not a generic list with a right panel. The new layout makes priority order the primary affordance, not task metadata.

## No Schema Changes

All data is already available:
- `in_focus` (integer, 1 = in focus) — top priority membership
- `sort_order` (text) — fractional indexing key for ordering within the list
- `useTodayTasks()` — returns `id, title, priority, due_date, project_id, status, labels, in_focus, sort_order`
- `useTodayStats()` — returns `{total, completed}` for Tasks Done ring
- `FocusSessionContext` — elapsed focus time for Focus Time ring
- `completeTask(db, id)`, `toggleFocus(db, id)` — existing write functions
- `moveTask(db, id, priority, sortOrder)` — existing write function for reordering (uses `generateKeyBetween` from `fractional-indexing`)

## Architecture

`apps/web/app/today/page.tsx` is rewritten as a single-column layout. `ViewToggle`, `BoardView`, and `RightPanel` are no longer rendered (components stay in the codebase). `FocusSessionProvider` stays as the outer wrapper. Three new components are introduced:

- `IvyLeeList` — ranked top-6 with drag-to-reorder and task #1 accent
- `LaterTodaySection` — collapsed non-focus tasks
- `TodayStatsRow` — two SVG circular rings

`QuickCaptureModal` and `TaskDetailPanel` wiring is preserved unchanged.

## Layout

Single scrollable column, max-width constrained, centered:

```
Greeting + date
─────────────────────────
TOP PRIORITIES
  [1] Task — NOW badge (accented)
  [2] Task
  [3] Task
  [4] Task
  [5] Task
  [6] — empty slot (dashed)
─────────────────────────
Later Today  · 5 tasks  ▸
─────────────────────────
[Tasks Done ring]  [Focus Time ring]
─────────────────────────
⚡ Start Focus Session
```

## Components

### `apps/web/components/today/IvyLeeList.tsx`

Props: `tasks: Task[]` (pre-filtered to `in_focus === 1`, sorted by `sort_order`), `projects: Project[]`, `onOpenDetail: (id: string) => void`.

Renders exactly 6 slots. For each slot:
- If a task exists: render a draggable row
- If no task: render a dashed empty slot (`border border-dashed border-gray-200 rounded-lg`)

**Slot 1 treatment:** `border-l-2 border-indigo-500 shadow-sm bg-white` plus a "NOW" badge (`text-xs bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded`). Number `1` is rendered in indigo.

**Slots 2–6:** `bg-white rounded-lg` with muted gray number. Drag handle (⠿) on right.

**Drag-to-reorder:** Native HTML5 drag API — `draggable`, `onDragStart`, `onDragOver`, `onDrop` on each row. On drop, compute one new fractional key: `generateKeyBetween(taskAbove?.sort_order ?? null, taskBelow?.sort_order ?? null)` and call `moveTask(db, id, task.priority, newKey)`. One write per drag. Task #1's accent follows position, not identity.

**Checkbox:** calls `completeTask(db, id)`. Completed task disappears from the list; its slot becomes empty/dashed.

**Title click:** calls `onOpenDetail(id)`.

**"+ Focus" is not shown here** — adding happens from `LaterTodaySection`.

### `apps/web/components/today/LaterTodaySection.tsx`

Props: `tasks: Task[]` (pre-filtered to `in_focus !== 1`), `projects: Project[]`.

Local state: `isOpen: boolean` (default `false`).

Collapsed: single pill row — "Later Today · N tasks ▸"  
Expanded: list of task rows using the same row style as IvyLeeList slots 2–6 (no numbering, no drag).

Each row shows a "+ Focus" action on hover. Clicking calls `toggleFocus(db, id)` (sets `in_focus = 1`) then `moveTask(db, id, task.priority, generateKeyBetween(lastFocusTask?.sort_order ?? null, null))` to place it at the end of the ranked list. The button is hidden when `focusTasks.length >= 6`.

### `apps/web/components/today/TodayStatsRow.tsx`

Props: `total: number`, `completed: number`, `focusSeconds: number`.

Two side-by-side cards, each with an SVG ring:

**Tasks Done ring:** indigo (`#6366f1`). Fill = `completed / total` (0 if total = 0). Label inside ring: `N/M`. Label below: "Tasks Done".

**Focus Time ring:** amber (`#ca8a04`). Fill = `focusSeconds / (4 * 3600)` (4-hour target cap at 100%). Label inside: formatted as "Xh Ym" (or "Ym" if under 1h). Label below: "Focus Time".

SVG ring technique: `stroke-dasharray` and `stroke-dashoffset` on a `<circle>` with `r=20` inside a `viewBox="0 0 48 48"`.

### `apps/web/app/today/page.tsx` (rewritten)

```tsx
<FocusSessionProvider>
  <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
    <TodayGreeting />           {/* inline: date + "Good morning" */}
    <IvyLeeList ... />
    <LaterTodaySection ... />
    <TodayStatsRow ... />
    <StartFocusButton />        {/* inline CTA */}
  </div>
  <QuickCaptureModal ... />
  <TaskDetailPanel ... />
</FocusSessionProvider>
```

`TodayGreeting` and `StartFocusButton` are small inline renders within page.tsx, not separate files.

Focus time in seconds: read from `FocusSessionContext` (the same value `FocusSessionCard` already consumes).

## Interactions

### Completing a task
Checkbox → `completeTask(db, id)` → task removed from `IvyLeeList` via reactive query update → slot becomes dashed empty placeholder. Remaining tasks do not shift up automatically.

### Drag-to-reorder
Drag by the ⠿ handle. On drop: call `generateKeyBetween(taskAbove?.sort_order ?? null, taskBelow?.sort_order ?? null)` to get a new fractional key, then `moveTask(db, draggedId, draggedTask.priority, newKey)`. One write. The "NOW" accent always renders on whichever task occupies slot 1 after reorder.

### Adding to Top Priorities
Hover a Later Today row → "+ Focus" appears. Click → `toggleFocus(db, id)` sets `in_focus = 1`, then `moveTask(db, id, task.priority, generateKeyBetween(lastFocusTask?.sort_order ?? null, null))` places it at the bottom of IvyLeeList. If `focusTasks.length >= 6`, the button is hidden.

### Removing from Top Priorities
⋯ context menu on IvyLeeList rows → "Remove from priorities" → `toggleFocus(db, id)` sets `in_focus = 0`. Task drops to LaterTodaySection.

### Start Focus Session
Button calls the existing start-session handler from `FocusSessionContext`. No new logic.

## Files Changed

| Action | Path |
|--------|------|
| Rewrite | `apps/web/app/today/page.tsx` |
| Create | `apps/web/components/today/IvyLeeList.tsx` |
| Create | `apps/web/components/today/LaterTodaySection.tsx` |
| Create | `apps/web/components/today/TodayStatsRow.tsx` |
| No change | `apps/web/components/today/BoardView.tsx` (kept, not rendered) |
| No change | `apps/web/components/today/RightPanel.tsx` (kept, not rendered) |
| No change | `apps/web/components/today/ViewToggle.tsx` (kept, not rendered) |
| No change | `packages/db/src/queries/tasks.ts` |
| No change | `powersync/sync-rules.yaml` |

## Out of Scope

- Daily Focus card (requires new schema for intention text + energy level)
- Habits ring (requires new schema)
- Mobile Today page (separate work)
- Weekly Activity card (removed from view, component preserved)
