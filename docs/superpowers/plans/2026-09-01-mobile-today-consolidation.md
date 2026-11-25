# Mobile Today Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the mobile app's three overlapping tabs (Home / Tasks / Today) into two — Today and Tasks — so no task appears on more than one tab and the launch screen shows real, actionable data above the fold.

**Architecture:** The Home tab's only real content (greeting, energy, today's progress) becomes a compact header on the Today tab; its "Top Priorities" list is absorbed into Today as a third section fed by a widened query (`AGENDA_QUERY` = overdue + due today + undated P1). The band-splitting logic moves out of the screen into a pure, unit-tested function in `packages/db`. Everything on Home that was hardcoded placeholder data is deleted rather than ported.

**Tech Stack:** Expo Router (file-based tabs), React Native, PowerSync (`useQuery` over local SQLite), vitest (in `packages/db` only), TypeScript.

---

## Context an engineer needs before starting

**Why this is happening.** Read `packages/db/src/queries/tasks.ts`. Three queries back three tabs and barely differ:

| Tab | Query | Filter |
|---|---|---|
| Home → Top Priorities | `TOP_PRIORITIES_QUERY` (line ~152) | open tasks, `ORDER BY in_focus, priority`, `LIMIT 3` |
| Tasks → Do First | `MATRIX_QUERY` (line ~48) grouped by priority | open tasks, bucket `priority = 1` |
| Today | `TODAY_QUERY` (line ~21) | open tasks, `due_date <= date('now')` |

`TOP_PRIORITIES_QUERY` has no date filter and no quadrant filter, so with three P1 tasks in the DB it renders exactly the Tasks → Do First tab, truncated to 3. A P1 task that is also overdue currently appears on all three tabs at once.

**The one thing Home did that Today cannot.** `TOP_PRIORITIES_QUERY` surfaces high-priority tasks that have **no due date** — a date-filtered Today misses those entirely. That capability must survive the consolidation, or this is a feature regression, not a cleanup. It survives as the `Do First` section.

**Critical constraint — do not touch `TODAY_QUERY`.** It is used by three web surfaces:
- `apps/web/app/today/page.tsx:22`
- `apps/web/app/focus/page.tsx:21`
- `apps/web/components/layout/Sidebar.tsx:33` (the sidebar's Today **count badge**)

Widening `TODAY_QUERY` to include undated P1s would silently change the web Today page and inflate the sidebar counter. That is why this plan adds a **new** `AGENDA_QUERY` instead of editing the existing one. `apps/web/__tests__/TodayPage.test.tsx` and `FocusPage.test.tsx` cover those surfaces and must stay green.

**Where tests can live.** `packages/db` has a working vitest setup (`packages/db/vitest.config.ts`, `environment: 'node'`). `apps/mobile` has a `test` script but **no vitest config and no test files** — do not try to write component tests there in this plan. All TDD in this plan happens in `packages/db`; the mobile screens are verified by `typecheck` plus the manual device checklist in Task 10.

**Existing conventions to follow:**
- `packages/db` query tests are string assertions against the exported SQL constant plus mock-db behaviour tests. See `makeMockDb` at the top of `packages/db/src/queries/tasks.test.ts`.
- `packages/db/src/index.ts:15` does `export * from './queries/tasks'`, so anything exported from that file is automatically available as `@todolist/db`. **No index edit is needed.**
- `packages/db` already imports from `@todolist/core` (`parseRule`, `computeNext` at the top of `tasks.ts`), so importing `quadrantLabel` from there is in-pattern and does not breach the monorepo boundary rules in `CLAUDE.md`.
- Existing queries in this file all write `AND deleted_at IS NULL` even though `CLAUDE.md` says PowerSync excludes tombstones already. **Match the surrounding file** — consistency matters more than the rule here, and changing it is out of scope. Do not "fix" the other queries.

## Non-goals (explicitly out of scope — do not do these)

- **Do not delete `FOCUS_TASKS_QUERY` / `useFocusTasks`** (`packages/db/src/queries/tasks.ts:98-113`). It is dead code from `feat/today-dashboard-redesign` and its comment says it is pending reconciliation of the two *web* Today designs. This plan reconciles **mobile** only. Leave it and its tests alone.
- Do not build Focus sessions or Habits. The placeholder UI for those is deleted, not implemented.
- Do not change the Tasks tab's quadrant UI, `MATRIX_QUERY`, or `QuadrantTabs`.
- **Do not extract a shared `TaskListScreen` shell** for the FAB + `QuickCaptureModal` wiring. That duplication was worth removing across three screens; across two screens that render different list primitives (`SectionList` vs `FlatList`) it buys five lines and costs a layer of indirection. YAGNI.
- Do not touch `supabase/migrations/` or `powersync/sync-rules.yaml`. This plan adds **no columns and no tables** — every field it reads (`due_date`, `priority`, `parent_task_id`, `recurrence_rule`, `in_focus`, `sort_order`) is already selected by an existing query, so it already syncs.

## Accepted behaviour changes (intentional — do not "fix" these)

1. **The header ring counts dated work only.** `useTodayStats` counts `due_date <= date('now')`; undated P1s in the `Do First` section are not in that ratio. The caption reads "still due today" so the number is not misleading. Leave it.
2. **The gear icon moves.** Settings was reachable only from Home (`apps/mobile/src/app/(tabs)/index.tsx:55`). It moves into the Today header. There is no other entry point — if you drop it, Settings becomes unreachable.
3. **Progress rings for Focus (`0m/2h`) and Habits (`4/5`) disappear.** They were hardcoded literals at `index.tsx:87-88`, shipping fake numbers to a real user.
4. **The "Daily Focus" statement disappears.** It was a module constant at `index.tsx:19` with a comment saying a persisted version is a later phase.

## File Structure

**Created:**
- `apps/mobile/src/hooks/useTaskActions.ts` — the three task handlers both list screens need. Currently copy-pasted verbatim (comments included) in all three tabs.
- `apps/mobile/src/components/home/EnergyStrip.tsx` — row-shaped energy picker for the header. Same write path as `EnergySelector`, ~1/3 the height.
- `apps/mobile/src/components/home/TodayHeader.tsx` — greeting + settings + progress ring + energy strip.

**Modified:**
- `packages/db/src/queries/tasks.ts` — add `AGENDA_QUERY`, `useAgendaTasks`, `groupAgendaTasks`, `AgendaSection`.
- `packages/db/src/queries/tasks.test.ts` — tests for the above.
- `apps/mobile/src/app/(tabs)/index.tsx` — **replaced wholesale**: was Home, becomes Today.
- `apps/mobile/src/app/(tabs)/_layout.tsx` — three tabs to two.
- `apps/mobile/src/app/(tabs)/tasks.tsx:44-62` — swap duplicated handlers for `useTaskActions`.

**Deleted:**
- `apps/mobile/src/app/(tabs)/today.tsx` — its content moves into `index.tsx`.
- `apps/mobile/src/components/home/HomePriorityRow.tsx` — `SwipeableTaskRow` replaces it.
- `apps/mobile/src/components/home/DailyFocusCard.tsx` — static placeholder.
- `apps/mobile/src/components/home/StartFocusButton.tsx` — alerts "Coming soon".
- `apps/mobile/src/components/home/StatCard.tsx` — only consumer was Home's fake stat row.
- `apps/mobile/src/components/home/EnergySelector.tsx` — superseded by `EnergyStrip`.

**Kept, untouched:** `GreetingHeader.tsx`, `ProgressRing.tsx`, `homeTheme.ts` (the light palette the whole consolidated screen uses), `SwipeableTaskRow.tsx`, `QuadrantTabs.tsx`, `FAB.tsx`, `QuickCaptureModal.tsx`.

**Why `index.tsx` becomes Today rather than deleting `index.tsx` and keeping `today.tsx`:** every navigation target in the app that enters the tab group points at `/(tabs)`, which resolves to `index` — `apps/mobile/src/app/_layout.tsx:29` (post-login) and `apps/mobile/src/app/share.tsx:90` (after a share-intent capture). Nothing anywhere routes to `/(tabs)/today` or `/(tabs)/tasks` directly (verified by grepping every `router.push`/`replace`/`Redirect` in `apps/mobile/src`). Making `index` the Today screen means zero redirect shims and zero deep-link changes.

---

## Task 0: Land the in-flight work first

The working tree has uncommitted changes to five files from the recurring-task swipe fix. This plan **deletes** `HomePriorityRow.tsx`, which carries some of them.

**Files:**
- Inspect: `apps/mobile/src/components/SwipeableTaskRow.tsx`, `apps/mobile/src/components/home/HomePriorityRow.tsx`

- [ ] **Step 1: Confirm nothing is lost by deleting `HomePriorityRow`**

The uncommitted diff adds the same three fixes to both row components: the `[task.id, task.due_date, task.status]` opacity-reset dep list, the `runComplete` catch that restores a hidden row on write failure, and the `↻ {repeat}` recurrence label. `SwipeableTaskRow.tsx:44-73` and `:127-136` already carry all three, so deleting `HomePriorityRow` in Task 9 loses nothing.

Run: `git diff --stat`
Expected: 7 files changed, matching `SwipeableTaskRow.tsx` and `HomePriorityRow.tsx` among them.

- [ ] **Step 2: Commit the in-flight fix on its own**

It is unrelated to this consolidation and must not be tangled into it.

```bash
git add apps/mobile/src/components/SwipeableTaskRow.tsx \
        apps/mobile/src/components/home/HomePriorityRow.tsx \
        apps/mobile/src/app/'(tabs)'/index.tsx \
        apps/mobile/src/app/'(tabs)'/tasks.tsx \
        apps/mobile/src/app/'(tabs)'/today.tsx \
        packages/db/src/queries/tasks.ts \
        packages/db/src/queries/tasks.test.ts
git commit -m "fix(mobile): restore swiped rows when a recurring task survives completion"
```

- [ ] **Step 3: Verify the tree is clean**

Run: `git status --short`
Expected: no output.

---

## Task 1: Add `AGENDA_QUERY` and `useAgendaTasks`

**Files:**
- Modify: `packages/db/src/queries/tasks.ts` (insert after `TODAY_QUERY`, which ends at line ~28)
- Test: `packages/db/src/queries/tasks.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/db/src/queries/tasks.test.ts`. Also extend the import on line 2 to include `AGENDA_QUERY`.

```typescript
describe('AGENDA_QUERY', () => {
  it('includes everything already due', () => {
    expect(AGENDA_QUERY).toContain("due_date <= date('now')");
  });

  it('also includes undated top-level P1 work', () => {
    expect(AGENDA_QUERY).toContain('due_date IS NULL AND priority = 1 AND parent_task_id IS NULL');
  });

  it('excludes completed and cancelled tasks', () => {
    expect(AGENDA_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });

  it('excludes soft-deleted tasks', () => {
    expect(AGENDA_QUERY).toContain('deleted_at IS NULL');
  });

  it('selects recurrence_rule so rows can label repeats', () => {
    expect(AGENDA_QUERY).toContain('recurrence_rule');
  });

  it('orders by priority so P1 leads each section', () => {
    expect(AGENDA_QUERY).toContain('ORDER BY priority, sort_order');
  });
});

describe('TODAY_QUERY', () => {
  it('stays date-only, so the web Today page and sidebar count are unaffected', () => {
    expect(TODAY_QUERY).not.toContain('priority = 1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/db test`
Expected: FAIL — `AGENDA_QUERY` is not exported (`SyntaxError` / undefined import). The new `TODAY_QUERY` test passes already; that is correct, it is a regression guard.

- [ ] **Step 3: Add the query and hook**

In `packages/db/src/queries/tasks.ts`, immediately after the `TODAY_QUERY` template literal:

```typescript
// The mobile Today tab's list: everything already due (overdue + today) plus
// top-level P1 work carrying no date at all. That undated branch is the only
// thing the old Home "Top Priorities" list did that a date filter cannot;
// folding it in here is what let that tab go away.
//
// Deliberately NOT a widening of TODAY_QUERY: that one still backs the web
// Today page, the web Focus page, and the sidebar's Today count, and changing
// its meaning would move all three silently.
//
// parent_task_id is filtered on the undated branch only, so dated subtasks
// keep showing up exactly as they do today while undated P1 subtasks don't
// surface as if they were standalone work.
export const AGENDA_QUERY = `
  SELECT id, title, priority, due_date, due_time, project_id, status, labels, recurrence_rule, in_focus, sort_order
  FROM tasks
  WHERE status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
    AND (
      due_date <= date('now')
      OR (due_date IS NULL AND priority = 1 AND parent_task_id IS NULL)
    )
  ORDER BY priority, sort_order
`;
```

And next to `useTodayTasks` (line ~86), add:

```typescript
export function useAgendaTasks() {
  const query = useQuery<Pick<TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'project_id' |
    'status' | 'labels' | 'recurrence_rule' | 'in_focus' | 'sort_order'
  >>(AGENDA_QUERY);
  const count = useMemo(() => query.data?.length ?? 0, [query.data]);

  return { ...query, count };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @todolist/db test`
Expected: PASS, all `AGENDA_QUERY` and `TODAY_QUERY` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/tasks.ts packages/db/src/queries/tasks.test.ts
git commit -m "feat(db): add AGENDA_QUERY for due + undated-P1 work"
```

---

## Task 2: Add the `groupAgendaTasks` pure function

The old Today screen computed its sections inline in a `useMemo` (`apps/mobile/src/app/(tabs)/today.tsx:26-34`), which made the banding untestable. Move it to `packages/db` beside `groupTasksByPriority`, which sets the precedent for grouping helpers living next to their query.

**Files:**
- Modify: `packages/db/src/queries/tasks.ts` (after `groupTasksByPriority`, which ends at line ~65)
- Test: `packages/db/src/queries/tasks.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/db/src/queries/tasks.test.ts`, extending the line-2 import with `groupAgendaTasks`. Add `import { quadrantLabel } from '@todolist/core';` at the top of the test file.

```typescript
describe('groupAgendaTasks', () => {
  const today = '2026-09-01';

  it('splits dated tasks into Overdue and Today', () => {
    const sections = groupAgendaTasks([
      { id: 'late', due_date: '2026-08-25', priority: 2 },
      { id: 'now', due_date: '2026-09-01', priority: 3 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['overdue', 'today']);
    expect(sections[0].data.map(t => t.id)).toEqual(['late']);
    expect(sections[1].data.map(t => t.id)).toEqual(['now']);
  });

  it('puts undated P1 work in its own Do First band', () => {
    const sections = groupAgendaTasks([
      { id: 'someday', due_date: null, priority: 1 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['do-first']);
    expect(sections[0].data.map(t => t.id)).toEqual(['someday']);
  });

  it('titles the Do First band from the shared quadrant label', () => {
    const sections = groupAgendaTasks([{ id: 'a', due_date: null, priority: 1 }], today);

    expect(sections[0].title).toBe(quadrantLabel[1]);
  });

  it('drops undated non-P1 tasks rather than mislabelling them as Do First', () => {
    const sections = groupAgendaTasks([
      { id: 'undated-p3', due_date: null, priority: 3 },
    ], today);

    expect(sections).toEqual([]);
  });

  it('omits empty sections so no bare header renders', () => {
    const sections = groupAgendaTasks([
      { id: 'now', due_date: '2026-09-01', priority: 1 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['today']);
  });

  it('orders bands Overdue, then Today, then Do First', () => {
    const sections = groupAgendaTasks([
      { id: 'undated', due_date: null, priority: 1 },
      { id: 'now', due_date: '2026-09-01', priority: 1 },
      { id: 'late', due_date: '2026-08-01', priority: 1 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['overdue', 'today', 'do-first']);
  });

  it("preserves the query's order within a band", () => {
    const sections = groupAgendaTasks([
      { id: 'first', due_date: '2026-08-01', priority: 1 },
      { id: 'second', due_date: '2026-08-02', priority: 2 },
    ], today);

    expect(sections[0].data.map(t => t.id)).toEqual(['first', 'second']);
  });

  it('treats a null priority as non-P1 when undated', () => {
    const sections = groupAgendaTasks([
      { id: 'a', due_date: null, priority: null },
    ], today);

    expect(sections).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/db test`
Expected: FAIL — `groupAgendaTasks is not a function` / not exported.

- [ ] **Step 3: Implement**

In `packages/db/src/queries/tasks.ts`, extend the existing `@todolist/core` import on line 5 to `import { parseRule, computeNext, quadrantLabel } from '@todolist/core';`, then add after `groupTasksByPriority`:

```typescript
export type AgendaSectionKey = 'overdue' | 'today' | 'do-first';

export interface AgendaSection<T> {
  key:   AgendaSectionKey;
  title: string;
  data:  T[];
}

interface AgendaTask {
  due_date: string | null;
  priority: number | null;
}

// Splits AGENDA_QUERY's rows into the three bands the mobile Today tab renders.
// `today` is passed in rather than read off the clock so this stays pure and
// testable; callers pass new Date().toISOString().split('T')[0].
//
// Undated rows can only be P1 given AGENDA_QUERY's WHERE clause, but the
// priority check is repeated here so a future caller with a looser query can't
// quietly file ordinary undated tasks under "Do First".
export function groupAgendaTasks<T extends AgendaTask>(
  tasks: T[],
  today: string
): AgendaSection<T>[] {
  const overdue:  T[] = [];
  const dueToday: T[] = [];
  const doFirst:  T[] = [];

  for (const task of tasks) {
    if (task.due_date == null) {
      if (task.priority === 1) doFirst.push(task);
      continue;
    }
    if (task.due_date < today) overdue.push(task);
    else if (task.due_date === today) dueToday.push(task);
  }

  const sections: AgendaSection<T>[] = [
    { key: 'overdue',  title: 'Overdue',        data: overdue },
    { key: 'today',    title: 'Today',          data: dueToday },
    { key: 'do-first', title: quadrantLabel[1], data: doFirst },
  ];

  return sections.filter(section => section.data.length > 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @todolist/db test`
Expected: PASS, all 8 `groupAgendaTasks` tests green.

- [ ] **Step 5: Typecheck the package**

Run: `pnpm --filter @todolist/db typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/tasks.ts packages/db/src/queries/tasks.test.ts
git commit -m "feat(db): add groupAgendaTasks section splitter"
```

---

## Task 3: Extract `useTaskActions`

`handlePress`, `handleComplete` and `handleReschedule` are byte-identical across `index.tsx:33-44`, `tasks.tsx:44-62` and `today.tsx:36-52`, comments included.

**Files:**
- Create: `apps/mobile/src/hooks/useTaskActions.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { usePowerSync } from '@powersync/react';
import { completeTask, updateTaskDue } from '@todolist/db';

// The three handlers every task list needs. Previously copy-pasted verbatim
// into each tab screen, which meant the completeTask error-handling fix had to
// be applied three times.
export function useTaskActions() {
  const db = usePowerSync();
  const router = useRouter();

  const handlePress = useCallback((id: string) => router.push(`/task/${id}`), [router]);

  // Rethrow so the row un-hides itself; a swallowed failure here used to look
  // identical to a successful completion.
  const handleComplete = useCallback(async (id: string) => {
    try {
      await completeTask(db as any, id);
    } catch (e) {
      console.error(e);
      Alert.alert('Could not complete task', 'The change was not saved. Please try again.');
      throw e;
    }
  }, [db]);

  const handleReschedule = useCallback((id: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTaskDue(db as any, id, tomorrow.toISOString().split('T')[0], null).catch(console.error);
  }, [db]);

  return { handlePress, handleComplete, handleReschedule };
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no errors. (The hook is unused at this point — that is fine, TS does not flag unused exports.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useTaskActions.ts
git commit -m "refactor(mobile): extract useTaskActions from the tab screens"
```

---

## Task 4: Add the compact `EnergyStrip`

`EnergySelector` is a full card with its own title row — too tall for a list header. `EnergyStrip` keeps the identical write path (`setEnergy` + optimistic local state) in one row.

**Files:**
- Create: `apps/mobile/src/components/home/EnergyStrip.tsx`
- Reference: `apps/mobile/src/components/home/EnergySelector.tsx` (the version being replaced)

- [ ] **Step 1: Write the component**

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Zap } from 'lucide-react-native';
import { usePowerSync } from '@powersync/react';
import { useTodayEnergy, setEnergy } from '@todolist/db';
import { useAuth } from '../../auth/AuthContext';
import { homeColors } from './homeTheme';

const LEVELS = [1, 2, 3, 4, 5] as const;
const LEVEL_LABEL: Record<number, string> = {
  1: 'Low',
  2: 'Fair',
  3: 'Medium',
  4: 'High',
  5: 'Peak',
};

// Row-shaped energy picker for the Today header. Same write path as the
// card-shaped EnergySelector it replaces, about a third of the height, so the
// header can carry it without pushing the task list below the fold.
export function EnergyStrip() {
  const db = usePowerSync();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { energy } = useTodayEnergy();
  const [optimistic, setOptimistic] = useState<number | null>(null);

  const selected = optimistic ?? energy;

  const handleSelect = useCallback((level: number) => {
    if (!userId) return;
    setOptimistic(level);
    setEnergy(db as any, userId, level).catch(console.error);
  }, [db, userId]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Energy</Text>
      <View style={styles.segments}>
        {LEVELS.map((level) => {
          const active = selected != null && level <= selected;
          return (
            <Pressable
              key={level}
              onPress={() => handleSelect(level)}
              accessibilityRole="button"
              accessibilityLabel={`Set energy to ${LEVEL_LABEL[level]}`}
              accessibilityState={{ selected: active }}
              hitSlop={6}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Zap
                size={14}
                color={active ? homeColors.energy : homeColors.textMuted}
                fill={active ? homeColors.energy : 'transparent'}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.value, selected == null && styles.valueUnset]}>
        {selected != null ? LEVEL_LABEL[selected] : 'Not set'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 12, color: homeColors.textSecondary, fontWeight: '600' },
  segments: { flexDirection: 'row', gap: 4, flex: 1 },
  segment: {
    width: 30,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: homeColors.segmentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: homeColors.energySoft,
    borderColor: homeColors.energyBorder,
  },
  value: { fontSize: 12, color: homeColors.energy, fontWeight: '600' },
  valueUnset: { color: homeColors.textMuted, fontWeight: '500' },
});
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/EnergyStrip.tsx
git commit -m "feat(mobile): add compact EnergyStrip for the Today header"
```

---

## Task 5: Add `TodayHeader`

**Files:**
- Create: `apps/mobile/src/components/home/TodayHeader.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { GreetingHeader } from './GreetingHeader';
import { ProgressRing } from './ProgressRing';
import { EnergyStrip } from './EnergyStrip';
import { homeColors, homeSpace, homePriorityColor } from './homeTheme';

interface Props {
  completed: number;
  total:     number;
}

// Everything the old Home tab showed that was backed by real data, compressed
// into a list header. The static Daily Focus line, the hardcoded Focus/Habits
// rings and the "coming soon" focus button are deliberately not ported.
//
// The ratio counts dated work only (useTodayStats filters due_date <= today),
// so the caption says "due today" rather than implying it covers the undated
// P1s listed under Do First below.
export function TodayHeader({ completed, total }: Props) {
  const router = useRouter();
  const progress = total > 0 ? completed / total : 0;
  const remaining = Math.max(0, total - completed);

  const openSettings = useCallback(() => router.push('/settings'), [router]);

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <GreetingHeader />
        <Pressable
          onPress={openSettings}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Settings size={22} color={homeColors.textMuted} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.progressRow}>
          <ProgressRing
            progress={progress}
            size={44}
            strokeWidth={4}
            color={homePriorityColor[4]}
          />
          <View style={styles.progressText}>
            <Text style={styles.progressValue}>{completed} of {total} done</Text>
            <Text style={styles.progressCaption}>
              {remaining === 0 ? 'Nothing left due today' : `${remaining} still due today`}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <EnergyStrip />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: homeSpace.screen,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 14,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  card: {
    backgroundColor: homeColors.card,
    borderRadius: homeSpace.cardRadius,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    padding: 14,
    gap: 12,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressText: { flex: 1, gap: 2 },
  progressValue: { fontSize: 15, color: homeColors.textPrimary, fontWeight: '700' },
  progressCaption: { fontSize: 12, color: homeColors.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: homeColors.cardBorder },
});
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/home/TodayHeader.tsx
git commit -m "feat(mobile): add TodayHeader with real progress and energy"
```

---

## Task 6: Replace the Home screen with the consolidated Today screen

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/index.tsx` (full replacement of all 118 lines)

- [ ] **Step 1: Replace the file's entire contents**

```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { View, SectionList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAgendaTasks, useTodayStats, groupAgendaTasks, type AgendaSection } from '@todolist/db';
import { typography } from '@todolist/ui';
import { homeColors, homePriorityColor } from '../../components/home/homeTheme';
import { SwipeableTaskRow, type TaskRowData } from '../../components/SwipeableTaskRow';
import { TodayHeader } from '../../components/home/TodayHeader';
import { FAB } from '../../components/FAB';
import { QuickCaptureModal } from '../../components/QuickCaptureModal';
import { useTaskActions } from '../../hooks/useTaskActions';

// The app's landing tab. Merges what used to be three overlapping screens:
// the old Home dashboard's real widgets live in TodayHeader, and its "Top
// Priorities" list is now the Do First section — the only band a date filter
// alone could not produce.
export default function TodayScreen() {
  const { data: tasks } = useAgendaTasks();
  const { data: stats } = useTodayStats();
  const { handlePress, handleComplete, handleReschedule } = useTaskActions();
  const [capturing, setCapturing] = useState(false);

  const { completed, total } = useMemo(() => {
    const row = stats?.[0];
    return { completed: Number(row?.completed ?? 0), total: Number(row?.total ?? 0) };
  }, [stats]);

  const sections = useMemo(
    () => groupAgendaTasks(
      (tasks ?? []) as TaskRowData[],
      new Date().toISOString().split('T')[0]
    ),
    [tasks]
  );

  const renderItem = useCallback(({ item }: { item: TaskRowData }) => (
    <SwipeableTaskRow
      task={item}
      onPress={handlePress}
      onComplete={handleComplete}
      onReschedule={handleReschedule}
    />
  ), [handlePress, handleComplete, handleReschedule]);

  const renderSectionHeader = useCallback(({ section }: { section: AgendaSection<TaskRowData> }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, section.key === 'overdue' && styles.sectionTitleOverdue]}>
        {section.title}
      </Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item: TaskRowData) => item.id, []);

  const openCapture = useCallback(() => setCapturing(true), []);
  const closeCapture = useCallback(() => setCapturing(false), []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={<TodayHeader completed={completed} total={total} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing due today, and no P1 waiting.</Text>
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled
      />

      <FAB onPress={openCapture} />
      <QuickCaptureModal visible={capturing} onClose={closeCapture} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: homeColors.page },
  listContent: { paddingBottom: 100 },
  sectionHeader: {
    backgroundColor: homeColors.sectionBg,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionTitle: {
    ...typography.caption,
    color: homeColors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sectionTitleOverdue: { color: homePriorityColor[1] },
  empty: {
    ...typography.body,
    color: homeColors.textMuted,
    marginTop: 40,
    textAlign: 'center',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no errors.

**If TypeScript rejects the `renderSectionHeader` parameter type** (React Native types it as `SectionListData<ItemT, SectionT>`, which is `SectionBase & SectionT`), change that one signature to:

```tsx
import type { SectionListData } from 'react-native';
// ...
const renderSectionHeader = useCallback(
  ({ section }: { section: SectionListData<TaskRowData, AgendaSection<TaskRowData>> }) => (
```

Nothing else in the file changes. Do not work around it by typing the parameter `any`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/'(tabs)'/index.tsx
git commit -m "feat(mobile): merge Home and Today into one agenda screen"
```

---

## Task 7: Drop to two tabs

Expo Router registers a tab for **every file** in the `(tabs)` directory. Removing the `<Tabs.Screen>` entry alone is not enough — `today.tsx` must actually be deleted or it reappears as a third, unlabelled tab.

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Delete: `apps/mobile/src/app/(tabs)/today.tsx`

- [ ] **Step 1: Delete the old Today screen**

```bash
git rm apps/mobile/src/app/'(tabs)'/today.tsx
```

- [ ] **Step 2: Replace `_layout.tsx` entirely**

```tsx
import { Tabs } from 'expo-router';
import { CheckSquare, LayoutGrid } from 'lucide-react-native';
import { homeColors } from '../../components/home/homeTheme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: homeColors.accent,
        tabBarInactiveTintColor: homeColors.textMuted,
        tabBarStyle: {
          backgroundColor: homeColors.card,
          borderTopColor: homeColors.cardBorder,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <LayoutGrid size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Confirm nothing still routes to the deleted screen**

Run: `grep -rn "tabs)/today\|/today" apps/mobile/src --include=*.ts --include=*.tsx`
Expected: no output. (The only in-app entries to the tab group are `router.replace('/(tabs)')` at `apps/mobile/src/app/_layout.tsx:29` and `apps/mobile/src/app/share.tsx:90`, both of which resolve to `index` — now Today.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/'(tabs)'/_layout.tsx
git commit -m "feat(mobile): collapse the tab bar to Today and Tasks"
```

---

## Task 8: Point the Tasks tab at `useTaskActions`

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/tasks.tsx` (imports on lines 1-14; handlers on lines 44-62)

- [ ] **Step 1: Trim the imports**

`Alert`, `useRouter`, `completeTask` and `updateTaskDue` become unused. `usePowerSync` must stay — `handleReassign` at line 70 still needs `db` for `updateTaskPriority`.

Replace lines 1-14 with:

```tsx
import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useMatrixTasks, useProjects, updateTaskPriority } from '@todolist/db';
import { usePowerSync } from '@powersync/react';
import { typography } from '@todolist/ui';
import { homeColors } from '../../components/home/homeTheme';
import { SwipeableTaskRow, type TaskRowData } from '../../components/SwipeableTaskRow';
import { QuadrantTabs } from '../../components/QuadrantTabs';
import { QuadrantPickerSheet } from '../../components/QuadrantPickerSheet';
import { FAB } from '../../components/FAB';
import { QuickCaptureModal } from '../../components/QuickCaptureModal';
import { useTaskActions } from '../../hooks/useTaskActions';
```

- [ ] **Step 2: Replace the duplicated handlers**

Delete lines 44-62 (`handlePress`, `handleComplete`, `handleReschedule`) entirely, and delete the `const router = useRouter();` line near the top of the component. In their place, right after `const db = usePowerSync();`, add:

```tsx
  const { handlePress, handleComplete, handleReschedule } = useTaskActions();
```

Everything downstream (`renderItem`'s dependency array, `handlePriorityPress`, `handleReassign`) is unchanged — the handler names and signatures are identical.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no errors. If TS reports an unused import, remove it — do not suppress it.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/'(tabs)'/tasks.tsx
git commit -m "refactor(mobile): use shared useTaskActions in the Tasks tab"
```

---

## Task 9: Delete the dead Home components

**Files:**
- Delete: `apps/mobile/src/components/home/HomePriorityRow.tsx`, `DailyFocusCard.tsx`, `StartFocusButton.tsx`, `StatCard.tsx`, `EnergySelector.tsx`

- [ ] **Step 1: Confirm every one of them is now unreferenced**

Run:
```bash
grep -rn "HomePriorityRow\|DailyFocusCard\|StartFocusButton\|StatCard\|EnergySelector" apps/ packages/ --include=*.ts --include=*.tsx
```
Expected: only the five component definition files themselves appear. If any app file still imports one, **stop** — a previous task was left incomplete.

- [ ] **Step 2: Delete them**

```bash
git rm apps/mobile/src/components/home/HomePriorityRow.tsx \
       apps/mobile/src/components/home/DailyFocusCard.tsx \
       apps/mobile/src/components/home/StartFocusButton.tsx \
       apps/mobile/src/components/home/StatCard.tsx \
       apps/mobile/src/components/home/EnergySelector.tsx
```

- [ ] **Step 3: Confirm the kept components survived**

`ProgressRing` was only ever used through `StatCard`; it is now used directly by `TodayHeader`. `GreetingHeader` and `homeTheme` are both still in use.

Run: `ls apps/mobile/src/components/home/`
Expected exactly: `EnergyStrip.tsx  GreetingHeader.tsx  ProgressRing.tsx  TodayHeader.tsx  homeTheme.ts`

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(mobile): delete the placeholder Home dashboard components"
```

---

## Task 10: Full verification

`CLAUDE.md` requires lint + typecheck + test output before anything is called done, and a full `pnpm build` before any deploy-relevant change ships.

**⚠️ Known landmine:** the root `pnpm test` runs `turbo test`, which invokes `apps/mobile`'s `"test": "vitest"` — mobile has **no vitest config and no test files**, and bare `vitest` starts in watch mode, so that command can hang. This is pre-existing and out of scope. Run the package-scoped test commands below instead, and if you do run the root one, be ready to Ctrl-C the mobile watcher.

- [ ] **Step 1: Run the unit tests that cover this change**

Run: `pnpm --filter @todolist/db test`
Expected: PASS, including the new `AGENDA_QUERY`, `TODAY_QUERY` and `groupAgendaTasks` suites.

- [ ] **Step 2: Prove the web surfaces are untouched**

This is the regression that matters most — `TODAY_QUERY` backs the web Today page, the web Focus page, and the sidebar count badge.

Run: `pnpm --filter @todolist/web test`
Expected: PASS, including `TodayPage.test.tsx` and `FocusPage.test.tsx`.

- [ ] **Step 3: Typecheck and lint the whole monorepo**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors from either.

- [ ] **Step 4: Full build**

Run: `pnpm build`
Expected: success across all packages.

- [ ] **Step 5: Verify on device**

Per `docs/MOBILE_DEV_LESSONS.md` and the project's build preference, install via the EAS build link/QR rather than adb. Then confirm each of these by hand — per `CLAUDE.md`, confirm the expected row *actually arrived*, since this stack fails silently:

- The tab bar shows exactly **two** tabs: Today, Tasks.
- Cold launch lands on Today, with the greeting, progress ring and energy strip visible above the first task.
- Tapping an energy segment persists it — background the app, reopen, and confirm the level is still selected (this exercises the `daily_log` sync path).
- The gear icon opens Settings.
- Sections appear in order Overdue → Today → Do First, and an empty section renders **no** header.
- A P1 task with **no due date** appears under Do First and appears nowhere else on the Today tab.
- Nothing on Today is duplicated: a task that is both P1 and overdue appears exactly once, under Overdue.
- Swipe-left completes a task and it leaves the list; swipe-right pushes it to tomorrow and it leaves the Today band.
- Completing a **recurring** task advances it rather than leaving an invisible row holding empty space (this is the Task 0 fix — confirm the consolidation did not undo it).
- The FAB opens Quick Capture from both tabs, and a captured task appears in the right band.
- The Tasks tab is unchanged: four quadrant tabs, priority badges, tap-badge-to-reassign.

- [ ] **Step 6: Update the project docs**

Add a line to `docs/TODO.md` or the relevant `docs/design/` phase spec recording that the mobile Home tab was folded into Today, so the next person does not rebuild it. Reference this plan file by path.

- [ ] **Step 7: Final commit**

```bash
git add docs/
git commit -m "docs: record the mobile Home-into-Today consolidation"
```

---

## Rollback

Every task commits separately, so `git revert` of the Task 6-9 commits restores the three-tab layout. `AGENDA_QUERY`, `groupAgendaTasks` and `useTaskActions` (Tasks 1-3) are purely additive and can stay.
