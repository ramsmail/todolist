# List/Board Toggle + Kanban Board Design

**Date:** 2026-06-24  
**Feature:** View mode toggle (List/Board) with Kanban board for Today view  
**Status:** Design approved

## Overview

The Today page gains the ability to switch between two view modes:
- **List view** (current): "In Focus" and "Later Today" sections with row-based task display
- **Board view** (new): Kanban-style columns organized by priority (High, Medium, Low)

Users can toggle between views via buttons in the page header. The selected view is persisted and restored on return.

## Requirements

### 1. View Toggle UI

**Location:** Today page header, next to date info  
**Component:** Two mutually exclusive buttons: "List" and "Board"

```
┌─────────────────────────────────────────────┐
│ Today                    [List] [Board]     │
│ Tuesday, June 23 · 6 tasks · 2 in focus    │
└─────────────────────────────────────────────┘
```

**Styling:**
- Active button: highlighted (accent background)
- Inactive button: muted (standard button style)
- Both buttons same size and weight

**State:** Selected view is stored in localStorage as `today-view-mode` (values: `"list"` or `"board"`)

### 2. List View (No Changes)

Existing layout is preserved:
- "In Focus" section (tasks with `in_focus = 1`)
- "Later Today" section (remaining tasks)
- Right panel visible (Focus Session, Progress, Weekly Activity)
- TaskRow and FocusTaskCard components unchanged

### 3. Board View (Kanban)

**Layout:**
- Three columns representing priority levels: **High**, **Medium**, **Low**
- Tasks displayed as cards within columns
- Right panel remains visible (no horizontal compression)
- Add task bar moved above columns or remains in current position

**Column Content:**
- Tasks filtered into columns by `priority` field (1=High, 2=Medium, 3=Low)
- Ordered by `sort_order` within each column (initially sorted as they appear)
- Completed tasks hidden (PowerSync handles tombstone filtering)

**Task Card Styling:**
- Reuse FocusTaskCard or create BoardTaskCard (minimal styling variation)
- Show `in_focus` status with pin badge [📌] for tasks with `in_focus = 1`
- Display priority color bar, project name, title, due date
- Include checkbox for completion

**Right Panel:** Stays visible and unmodified (Focus Session, Progress, Weekly Activity cards)

### 4. Drag-to-Reorder / Update Priority

**Behavior:**

1. **Drag within a column:** Reorder tasks in that priority
   - Updates `sort_order` field
   - No priority change

2. **Drag between columns:** Move task to different priority column
   - Updates `priority` field to match target column (1 for High, 2 for Medium, 3 for Low)
   - Appends to bottom of target column (`sort_order` reset or incremented)
   - Change persists via PowerSync immediately

**Constraints:**
- All tasks (including `in_focus = 1`) can be dragged within and between columns
- Drag disabled for completed tasks
- Drag allowed offline; PowerSync queues the change and syncs on reconnect

**Libraries:** Use `@dnd-kit` or similar for drag-and-drop (check existing deps)

### 5. State Persistence

**View Mode:**
- localStorage key: `today-view-mode`
- Values: `"list"` | `"board"`
- Default: `"list"` (fallback if not set or corrupted)
- Sync: On load, check localStorage and render appropriate view

**Task Order:**
- Existing PowerSync mechanism handles `sort_order` and `priority` updates
- No additional persistence layer needed

### 6. Completed Tasks

- Powered by PowerSync's automatic tombstone filtering (no manual `deleted_at` checks)
- Progress card on right panel shows completed count (unchanged)
- In both views, completed tasks are invisible to user

### 7. "In Focus" Status in Board View

- Tasks with `in_focus = 1` display a pin badge [📌]
- Pin button still available in task actions (can toggle in/out of focus)
- Focused tasks remain in their priority column (not moved or separated)

## Data Model

No schema changes required. Existing fields used:
- `priority` (1, 2, 3 for High, Medium, Low)
- `sort_order` (integer for manual ordering)
- `in_focus` (0 or 1 boolean)
- `is_completed` (handled by PowerSync tombstone)

PowerSync sync rules already include these columns.

## Component Architecture

**New/Modified Components:**
1. **ViewToggle** (new) — Button group for List/Board toggle, emits view mode change
2. **BoardView** (new) — Kanban board layout with columns and cards
3. **BoardTaskCard** (new or reuse FocusTaskCard) — Task card for board column
4. **KanbanColumn** (new) — Single column container with drag-drop zone
5. **TodayPage** (`apps/web/app/today/page.tsx` modified) — Conditionally render ListView or BoardView based on selected mode

**No changes to:**
- TaskRow, FocusTaskCard (reuse in List view)
- RightPanel, TodayProgressCard, WeeklyActivityCard, FocusSessionCard
- Database queries or PowerSync sync rules

## Error Handling

- **localStorage unavailable:** Fall back to List view always (no error shown)
- **Drag between columns while offline:** Allow local update; PowerSync syncs on reconnect
- **Invalid priority in drag target:** Ignore drop (DnD library handles)

## Testing

**Manual test scenarios:**
1. Toggle List ↔ Board; refresh page; verify view is restored
2. In Board view, drag task within column; verify `sort_order` updates
3. In Board view, drag task between columns; verify `priority` updates and card moves
4. Complete task in Board view; verify it disappears
5. Pin/unpin task in Board view; verify pin badge toggles
6. Open Today in two browser tabs; drag task in one; verify it appears in other (PowerSync sync)

**Automated tests:**
- Unit tests for ViewToggle state changes
- Integration test: localStorage persistence
- E2E test: Kanban drag-drop and priority update

## Out of Scope

- Custom sort orders per user
- Filtering by labels or project in Board view
- Recurring task expansion
- Multi-select or bulk actions

## Acceptance Criteria

- [ ] View toggle buttons appear in Today page header
- [ ] Selecting Board shows Kanban with High/Medium/Low columns
- [ ] Selecting List shows current layout (no regression)
- [ ] View choice persists across page reload
- [ ] Drag within column reorders tasks (updates sort_order)
- [ ] Drag between columns updates priority and moves card
- [ ] Pin badge visible on in_focus tasks in Board view
- [ ] Right panel stays visible in both views
- [ ] Completed tasks hidden in both views
