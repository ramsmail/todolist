# Sidebar Item Counters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time incomplete task counters to Today and Inbox sidebar navigation items.

**Architecture:** Extend the existing `useInboxTasks()` and `useTodayTasks()` hooks to compute and return a `count` field alongside the task data. The Sidebar component then reads this count and renders a right-aligned badge. Memoization ensures the count only recalculates when the task list changes, avoiding performance overhead.

**Tech Stack:** React hooks (PowerSync), Tailwind CSS, TypeScript

---

## Task 1: Add count derivation to useInboxTasks hook

**Files:**
- Modify: `packages/db/src/queries/tasks.ts:49-51`

- [ ] **Step 1: Add useMemo import**

At the top of `packages/db/src/queries/tasks.ts`, add `useMemo` to the imports:

```typescript
import { useMemo } from 'react';
```

(Note: Check if this import already exists; if so, skip this step.)

- [ ] **Step 2: Update useInboxTasks to compute and return count**

Replace the `useInboxTasks` function (lines 49-51):

```typescript
export function useInboxTasks() {
  const query = useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'>>(INBOX_QUERY);
  const count = useMemo(() => {
    return query.data?.length ?? 0;
  }, [query.data]);
  
  return { ...query, count };
}
```

**Explanation:** The hook now returns an object that spreads the original query result (including `data`, `isLoading`, `error`) and adds a `count` field. The count is memoized so it recalculates only when `query.data` changes.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm typecheck`

Expected: No errors in `packages/db`

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries/tasks.ts
git commit -m "feat: add count field to useInboxTasks hook"
```

---

## Task 2: Add count derivation to useTodayTasks hook

**Files:**
- Modify: `packages/db/src/queries/tasks.ts:53-55`

- [ ] **Step 1: Update useTodayTasks to compute and return count**

Replace the `useTodayTasks` function (lines 53-55):

```typescript
export function useTodayTasks() {
  const query = useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'project_id' | 'status' | 'labels' | 'recurrence_rule' | 'in_focus' | 'sort_order'>>(TODAY_QUERY);
  const count = useMemo(() => {
    return query.data?.length ?? 0;
  }, [query.data]);
  
  return { ...query, count };
}
```

**Same pattern as Task 1:** Return object with spread query result plus memoized count.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`

Expected: No errors in `packages/db`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add count field to useTodayTasks hook"
```

---

## Task 3: Update Sidebar hook calls to destructure count

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx:26-31`

- [ ] **Step 1: Update hook calls in Sidebar**

Replace lines 26-31 (the hook calls in the Sidebar component):

```typescript
const pathname        = usePathname();
const router          = useRouter();
const { data: inboxTasks, count: inboxCount } = useInboxTasks();
const { data: projects } = useProjects();
const { data: labels } = useLabels();
const { userId } = useCurrentUser();
const { data: todayTasks, count: todayCount } = useTodayTasks();
const { data: savedFilters } = useSavedFilters(userId ?? '');
```

**Changes:** 
- `useInboxTasks()` now destructures both `data` (as `inboxTasks`) and `count` (as `inboxCount`)
- Added new call to `useTodayTasks()` with same destructuring pattern
- Reordered for logical grouping

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`

Expected: No errors in `apps/web`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx
git commit -m "refactor: update Sidebar hook calls to destructure count"
```

---

## Task 4: Render count badge in Today nav item

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx:65-85`

- [ ] **Step 1: Update NAV rendering loop to display Today counter**

Replace the nav rendering section (lines 65-85). Update the map function to conditionally render the count badge:

```typescript
<ul className="mt-2 space-y-0.5 px-2" role="list">
  {NAV.map(({ href, label, icon }) => {
    const active = pathname === href || pathname.startsWith(href + '/');
    let count: number | null = null;
    
    if (label === 'Today') count = todayCount;
    if (label === 'Inbox') count = inboxCount;
    
    return (
      <li key={href}>
        <Link
          href={href}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
            ${active
              ? 'bg-surface text-text-primary font-medium'
              : 'text-text-secondary hover:bg-surface hover:text-text-primary'
            }`}
          aria-current={active ? 'page' : undefined}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
          {count !== null && (
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              count > 0
                ? 'bg-accent text-white'
                : 'bg-gray-300 text-gray-500 opacity-50'
            }`}>
              {count}
            </span>
          )}
        </Link>
      </li>
    );
  })}
</ul>
```

**Explanation:**
- Compute `count` based on which nav item (Today or Inbox)
- Render badge only if count is not null (i.e., Today or Inbox)
- Badge styling: active state (count > 0) shows colored badge; zero state shows faded gray badge
- `ml-auto` pushes the badge to the right edge within the flex container

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm typecheck`

Expected: No errors in `apps/web`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: render count badge in sidebar nav items"
```

---

## Task 5: Test the feature in the browser

**Files:**
- No file changes; manual testing only

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

Expected: Web app starts at `http://localhost:3000`

- [ ] **Step 2: Verify counters appear**

Navigate to the home page. In the left sidebar:
- Look for "Today" with a count badge (e.g., "Today 6")
- Look for "Inbox" with a count badge (e.g., "Inbox 9")
- Badge should be right-aligned, colored if count > 0, faded if count === 0

- [ ] **Step 3: Verify counters update in real-time**

In the Today view, mark a task as complete (click the checkbox). The Today counter should decrease by 1 in real-time.

- [ ] **Step 4: Verify Inbox counter updates**

Create a new task via Quick Add with no due date (stays in Inbox). The Inbox counter should increase by 1 in real-time.

- [ ] **Step 5: Verify zero state appearance**

If you complete all tasks in Today, the badge should still appear but be faded (gray background, reduced opacity).

- [ ] **Step 6: Verify other nav items don't have counters**

Confirm that Upcoming, Logbook, and Search nav items do NOT show counters.

- [ ] **Step 7: Stop dev server**

Press `Ctrl+C` to stop the dev server.

---

## Summary

- **2 hooks updated** to compute and return task count with memoization
- **1 component updated** to display count badges in Sidebar
- **Styling:** Active state (colored), zero state (faded)
- **Real-time updates:** Automatic via PowerSync sync + React dependency tracking

All changes are backwards-compatible; the hook API now includes a `count` field but the `data` field remains unchanged.
