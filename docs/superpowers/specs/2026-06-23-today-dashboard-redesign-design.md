# Today Dashboard Redesign — Design Spec

**Date:** 2026-06-23  
**Approach:** Full redesign in one pass (Approach A)  
**Scope:** Sidebar, Today page, Right panel (reusable)

---

## 1. Schema & Data Layer

### `in_focus` flag on tasks
- Add `in_focus BOOLEAN DEFAULT false` column to the `tasks` table in Supabase.
- Mirror the column in the PowerSync schema (`packages/db`).
- New mutation: `toggleFocus(db, taskId)` — flips `in_focus` for the given task.
- New hook: `useFocusTasks()` — returns today's tasks where `in_focus = true`.

### Streak
- No new DB column. Derived from existing `completed_at` timestamps.
- New hook: `useStreak()` — queries completed tasks grouped by `date(completed_at)`, walks backwards from today counting consecutive days with ≥1 completion.
- Returns `{ count: number, days: boolean[] }` — 7-element array (oldest→today), `true` = streak day met.

### Weekly activity
- New hook: `useWeeklyActivity()` — returns completed-task counts per day for Mon–Fri of the current ISO week.
- Returns `{ day: string, count: number }[]` (5 entries).

### Focus session
- Client-only state, no DB persistence.
- `FocusSessionContext` (`lib/focus/FocusSessionContext.tsx`) holds `{ isRunning, secondsLeft, queue: Task[] }`.
- Exposes `start()`, `pause()`, `reset()` actions.
- `start()` seeds queue from current `in_focus` tasks.
- State resets on page reload (no persistence needed now).
- Timer implemented with `useInterval` hook.

---

## 2. Layout

- `ClientLayout.tsx` is **not changed**.
- The Today page renders its own `<div className="flex h-full">` containing main content + `<RightPanel>` side by side.
- Right panel is **280px wide**, fixed, non-scrollable outer shell; inner widgets scroll if needed.
- `RightPanel` (`components/today/RightPanel.tsx`) is a presentational wrapper that accepts `children`. Any page can compose it the same way.
- Column widths: Sidebar 240px (unchanged) | Main flex-1 | Right panel 280px.

---

## 3. Sidebar

File: `components/layout/Sidebar.tsx`

### Header
- App name + colored sync-status dot (green = synced, amber = syncing, red = error) — reuses `SyncStatusIndicator` state.
- Full-width `+ Quick add` button below app name, accent color, triggers `QuickCaptureModal`.

### Navigation
Reordered items (no emoji icons):
1. Today — with live task count badge (today's incomplete tasks)
2. Inbox — with unread count badge
3. Upcoming
4. Calendar (maps to existing `/upcoming` route, no new route needed)
5. All tasks (new route `/all` — lists all non-completed tasks; requires new page `app/all/page.tsx`)

Active item: solid surface background fill. Inactive: subtle hover.

### Projects
- Unchanged structurally; inherits updated nav styling.
- Labels and Filters remain in the scroll area below projects.

### Daily streak (bottom, fixed)
- Positioned above Sign out, below the scroll area.
- Shows streak count as large number + "days" label.
- 7 dot indicators: filled = streak day met, hollow = missed or future.
- Uses `useStreak()`.

---

## 4. Today Page

File: `app/today/page.tsx`

### Header
- Large `Today` heading.
- Subtitle: `{dayOfWeek}, {Month Day} · {n} tasks · {n} in focus`.
- List / Board toggle buttons top-right (Board is disabled stub for now).
- Sort control (existing behaviour).

### Add task bar
- Inline input row at top of task list area.
- Clicking opens `QuickCaptureModal` pre-filled with today's date.
- Placeholder text: `Add a task — try "Draft investor update Fri 9am #project !high"`.

### IN FOCUS section
- Hidden when no tasks have `in_focus = true`.
- Section header: small orange dot + "IN FOCUS" uppercase label.
- Each task renders as a card with:
  - Left accent border
  - Task title (larger weight)
  - Project dot + name · due time · label chips · subtask count (if any)
  - Priority badge (P1/P2 etc.) top-right
- Toggle focus: pin icon visible on row hover — calls `toggleFocus`. No right-click needed.

### LATER TODAY section
- All today's tasks where `in_focus = false`.
- Section header: "LATER TODAY" uppercase label.
- Renders with drag handles (visual only, no persistence yet).
- Each row: task title, project dot, label chips, time if set, priority badge.
- Lighter visual weight than IN FOCUS cards.

### Empty states
- No tasks at all: existing "All done 🎉" message.
- Tasks exist but none in focus: IN FOCUS section hidden, all tasks in LATER TODAY.

---

## 5. Right Panel Widgets

All in `components/today/`:

### `FocusSessionCard.tsx`
- Dark-background card (uses `bg-surface-alt` or equivalent dark token).
- Large mono countdown: `25:00` default.
- Subtitle: `{n} tasks queued · no distractions` when idle.
- Full-width primary button: "Start focusing" / "Pause" depending on `isRunning`.
- Reads/writes `FocusSessionContext`.

### `TodayProgressCard.tsx`
- Light card.
- SVG donut chart: arc proportional to `completed / total` today's tasks.
- Center label: fraction + "done".
- Caption: "On pace" if `completed/total ≥ hoursElapsedSinceMidnight/24`, else "X focus tasks left to hit your goal."
- Uses existing `useTodayTasks()`.

### `WeeklyActivityCard.tsx`
- Light card, "THIS WEEK" label.
- 5 vertical bars (Mon–Fri), height proportional to tasks completed that day.
- Current day bar uses accent color; others use muted tone.
- Day labels below: M T W T F.
- Uses `useWeeklyActivity()`.

### `RightPanel.tsx`
- Wrapper: `<aside className="w-[280px] flex-shrink-0 flex flex-col gap-3 p-4 overflow-y-auto">`.
- Accepts `children` — the three card components are dropped in by the Today page.

---

## 6. New Files Summary

| File | Purpose |
|------|---------|
| `packages/db/src/hooks/useFocusTasks.ts` | Hook for in-focus today tasks |
| `packages/db/src/hooks/useStreak.ts` | Streak computation hook |
| `packages/db/src/hooks/useWeeklyActivity.ts` | Weekly completion counts |
| `packages/db/src/mutations/toggleFocus.ts` | Flip in_focus on a task |
| `apps/web/lib/focus/FocusSessionContext.tsx` | Client-only Pomodoro timer context |
| `apps/web/components/today/RightPanel.tsx` | Reusable right panel wrapper |
| `apps/web/components/today/FocusSessionCard.tsx` | Pomodoro timer widget |
| `apps/web/components/today/TodayProgressCard.tsx` | Donut chart progress widget |
| `apps/web/components/today/WeeklyActivityCard.tsx` | Weekly bar chart widget |
| `apps/web/app/all/page.tsx` | All tasks page (new route) |

## 7. Modified Files Summary

| File | Change |
|------|--------|
| Supabase migration | Add `in_focus` column to tasks |
| `packages/db/src/schema.ts` | Add `in_focus` to PowerSync schema |
| `components/layout/Sidebar.tsx` | Full redesign per Section 3 |
| `app/today/page.tsx` | Full redesign per Section 4 |
