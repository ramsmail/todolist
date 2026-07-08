# Sidebar Item Counters Design

**Date:** 2026-06-24  
**Feature:** Display task counters on Today and Inbox navigation items

## Overview

Add real-time item counters to the Today and Inbox sidebar navigation items, showing the count of incomplete tasks. Counters update in real-time as tasks are completed or added, with performance optimizations to prevent unnecessary recalculations.

## Requirements

- Display incomplete task counts for **Today** and **Inbox** only
- Right-aligned badge positioned at the end of each nav item
- Real-time updates as tasks change
- Zero counts displayed with faded/disabled appearance
- No performance degradation from existing query behavior

## Architecture

### Data Flow

```
PowerSync syncs tasks in real-time
         ↓
useInboxTasks() / useTodayTasks() hooks filter and compute count
         ↓
Sidebar component reads count and renders badge
         ↓
Badge updates when count changes (React dependency tracking)
```

### Hook Implementation

**File:** `packages/db/src/queries/tasks.ts`

Both `useInboxTasks()` and `useTodayTasks()` will be updated to return an object with:
- `data: Task[]` — the filtered task list (unchanged)
- `count: number` — count of incomplete tasks (`data.filter(t => !t.completed).length`)

The count is memoized using `useMemo` with `data` as the dependency. This ensures:
- Count recalculates only when the task list actually changes
- No performance overhead from redundant filtering

**Example shape:**
```typescript
{
  data: Task[],
  count: number
}
```

### Sidebar Component Changes

**File:** `apps/web/components/layout/Sidebar.tsx`

Changes required:
1. Call `useInboxTasks()` to get inbox count (already called; just extract the new `count` property)
2. Call `useTodayTasks()` to get today count (add this call)
3. Update NAV rendering loop (lines 66–84) to conditionally render count badge for Today and Inbox items
4. Render a right-aligned badge for each item with count data

**Badge placement:** Inside the `<Link>` element, after the label text, using `ml-auto` (flex: margin-left auto) to push it to the right edge.

**Example JSX pattern:**
```jsx
<Link href={href} className={linkClasses}>
  <span aria-hidden="true">{icon}</span>
  {label}
  {(label === 'Today' || label === 'Inbox') && (
    <span className={count > 0 ? activeCountClasses : fadedCountClasses}>
      {count}
    </span>
  )}
</Link>
```

### Styling

**Badge classes (Tailwind + NativeWind):**

When `count > 0`:
```
ml-auto text-xs bg-accent text-white px-2 py-0.5 rounded-full font-medium
```

When `count === 0` (faded):
```
ml-auto text-xs bg-gray-300 text-gray-500 px-2 py-0.5 rounded-full font-medium opacity-50
```

The badge should maintain consistent height with the nav item text for visual alignment.

## Performance Considerations

- **Memoization at hook level:** Count derivation is memoized, so it doesn't recalculate unless task data changes
- **No new queries:** Reuses existing `useInboxTasks()` and `useTodayTasks()` hooks, which already handle real-time sync via PowerSync
- **React optimization:** Sidebar component only re-renders when the count updates, due to React's built-in dependency tracking
- **Offline behavior:** Counts are computed from local PowerSync data, so they work seamlessly offline and sync when reconnected

## Testing Plan

1. **Display correctness:** Verify counters appear on Today and Inbox items, right-aligned with correct formatting
2. **Task completion:** Complete a task that affects Today/Inbox → verify count decreases in real-time
3. **Task creation:** Create a new incomplete task with due date today → verify Today counter increases
4. **Zero state:** When all tasks are completed, verify badge appears with faded appearance
5. **Offline scenario:** Disconnect, sync tasks, reconnect → verify counters update when sync completes
6. **Other nav items:** Verify Upcoming, Logbook, Search do NOT show counters (only Today and Inbox)
7. **Project/Label counts:** Confirm we're not adding counts to Projects or Labels in this phase

## Scope Notes

This feature is limited to:
- Today and Inbox nav items only
- Incomplete tasks only (completed tasks excluded from count)
- Sidebar navigation only (not other sections like Projects or Labels)

Future work could extend counters to Projects, Labels, or Filters if desired, following the same pattern.
