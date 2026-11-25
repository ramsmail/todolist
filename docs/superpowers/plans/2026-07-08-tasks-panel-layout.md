# Mobile Tasks Panel Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the mobile Tasks matrix screen so each task renders as a rounded, priority-tinted panel instead of a plain divided row, and give the Do First/Plan/Pass/Drop tabs distinct per-quadrant header colors — matching `docs/superpowers/specs/2026-07-08-tasks-panel-layout-design.md`.

**Architecture:** Add one pure token/helper (`resolvePanelTint`) to `packages/ui`, extend the existing shared `SwipeableTaskRow` with an opt-in `variant="panel"` prop (default `"flat"`, so the Today screen is unaffected), color `QuadrantTabs`' active label per-quadrant using the already-existing `priorityColor` map, then wire the Tasks screen to opt into the new variant.

**Tech Stack:** React Native (Expo, `apps/mobile`), shared component package (`packages/ui`), vitest for pure-logic unit tests (RN component JSX is not vitest-testable in this repo — see Task 3's testing note).

---

### Task 1: Add `priorityPanelTint` + `resolvePanelTint` to `packages/ui`

**Files:**
- Create: `packages/ui/src/tokens.test.ts`
- Modify: `packages/ui/src/tokens.ts:41` (insert after the `priorityLabel` block, before `typography`)

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolvePanelTint, priorityPanelTint } from './tokens';

describe('resolvePanelTint', () => {
  it('returns the matching tint for priorities 1-4', () => {
    expect(resolvePanelTint(1)).toBe(priorityPanelTint[1]);
    expect(resolvePanelTint(2)).toBe(priorityPanelTint[2]);
    expect(resolvePanelTint(3)).toBe(priorityPanelTint[3]);
    expect(resolvePanelTint(4)).toBe(priorityPanelTint[4]);
  });

  it('defaults null to the P4 tint', () => {
    expect(resolvePanelTint(null)).toBe(priorityPanelTint[4]);
  });

  it('defaults undefined to the P4 tint', () => {
    expect(resolvePanelTint(undefined)).toBe(priorityPanelTint[4]);
  });

  it('defaults an out-of-range priority to the P4 tint', () => {
    expect(resolvePanelTint(99)).toBe(priorityPanelTint[4]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/ui && npx vitest run tokens.test.ts`
Expected: FAIL — `resolvePanelTint` (and `priorityPanelTint`) are not exported from `./tokens`.

- [ ] **Step 3: Implement the tokens**

In `packages/ui/src/tokens.ts`, insert immediately after the `priorityLabel` block (after line 41, before the `typography` export):

```ts
export const priorityPanelTint: Record<1 | 2 | 3 | 4, string> = {
  1: `${colors.p1}26`, // ~15% alpha wash over the dark surface
  2: `${colors.p2}26`,
  3: `${colors.p3}26`,
  4: `${colors.p4}26`,
};

export function resolvePanelTint(priority: number | null | undefined): string {
  const key = (priority ?? 4) as 1 | 2 | 3 | 4;
  return priorityPanelTint[key] ?? priorityPanelTint[4];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/ui && npx vitest run tokens.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Rebuild `packages/ui`'s `dist/` output**

`apps/mobile` consumes `packages/ui` via its built `dist/` output, not live `src/` — this package must be rebuilt or the new export won't be visible to typecheck in later tasks.

Run: `cd packages/ui && npm run build`
Expected: exits 0, no output (a plain `tsc` build).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
git commit -m "feat(ui): add resolvePanelTint for priority-tinted task panels"
```

---

### Task 2: Color `QuadrantTabs`' active label per quadrant

**Files:**
- Modify: `apps/mobile/src/components/QuadrantTabs.tsx`

This file imports and renders JSX from `react-native`, which cannot be unit-tested with this repo's vitest setup (Flow-syntax parse failure on RN internals — established constraint, see `docs/MOBILE_DEV_LESSONS.md`). Verification here is typecheck + the on-device check in Task 5, not an automated test.

- [ ] **Step 1: Make the edit**

Replace the full contents of `apps/mobile/src/components/QuadrantTabs.tsx` with:

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { quadrantLabel } from '@todolist/core';
import { colors, typography, priorityColor } from '@todolist/ui';

const QUADRANTS = [1, 2, 3, 4] as const;

interface Props {
  active:   1 | 2 | 3 | 4;
  onChange: (quadrant: 1 | 2 | 3 | 4) => void;
}

export function QuadrantTabs({ active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {QUADRANTS.map(quadrant => {
        const isActive = quadrant === active;
        return (
          <Pressable
            key={quadrant}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(quadrant)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && { color: priorityColor[quadrant] }]}>
              {quadrantLabel[quadrant]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.surface },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
});
```

The only changes from the current file: `priorityColor` added to the `@todolist/ui` import, the active `<Text>`'s style array now includes `{ color: priorityColor[quadrant] }` instead of `styles.labelActive`, and the now-unused `labelActive` style object is removed.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors. (Pre-existing, unrelated errors in `today.tsx`/`SubTaskList.tsx` — `title: string | null` vs `TaskRowData.title: string` — may still be present; confirm via `git diff` that you haven't introduced anything new.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/QuadrantTabs.tsx
git commit -m "feat(mobile): color active quadrant tab label by priority"
```

---

### Task 3: Add panel variant to `SwipeableTaskRow`

**Files:**
- Modify: `apps/mobile/src/components/SwipeableTaskRow.tsx`

Same testability note as Task 2: this file imports `react-native` and `react-native-gesture-handler`/`react-native-reanimated`, so it's verified via typecheck + the Task 5 on-device check, not vitest.

- [ ] **Step 1: Make the edit**

Replace the full contents of `apps/mobile/src/components/SwipeableTaskRow.tsx` with:

```tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { TaskCheckbox, PriorityBadge, colors, typography, resolvePanelTint } from '@todolist/ui';

export interface TaskRowData {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
}

interface Props {
  task:            TaskRowData;
  onPress:         (id: string) => void;
  onComplete:      (id: string) => void;
  onReschedule:    (id: string) => void;
  projectName?:    string | null;
  onPriorityPress?: (id: string) => void;
  variant?:        'flat' | 'panel';
}

export function SwipeableTaskRow({ task, onPress, onComplete, onReschedule, projectName, onPriorityPress, variant = 'flat' }: Props) {
  const swipeRef  = useRef<Swipeable>(null);
  const opacity   = useSharedValue(1);
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().split('T')[0];
  const isPanel   = variant === 'panel';

  // Reset opacity when FlatList recycles this cell for a different task
  useEffect(() => {
    opacity.value = 1;
  }, [task.id, opacity]);

  const closeSwipe = useCallback(() => {
    swipeRef.current?.close();
  }, []);

  const handleComplete = useCallback((id: string) => {
    opacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(closeSwipe)();
      runOnJS(onComplete)(id);
    });
  }, [onComplete, opacity, closeSwipe]);

  const handleSwipeLeft = useCallback(() => {
    handleComplete(task.id);
  }, [handleComplete, task.id]);

  const handleSwipeRight = useCallback(() => {
    swipeRef.current?.close();
    onReschedule(task.id);
  }, [onReschedule, task.id]);

  const rowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const renderLeftAction = useCallback(() => (
    <View style={[styles.actionComplete, isPanel && styles.actionRounded]}>
      <Text style={styles.actionText}>✓ Done</Text>
    </View>
  ), [isPanel]);

  const renderRightAction = useCallback(() => (
    <View style={[styles.actionReschedule, isPanel && styles.actionRounded]}>
      <Text style={styles.actionText}>Later →</Text>
    </View>
  ), [isPanel]);

  const handleCheckboxComplete = useCallback(() => handleComplete(task.id), [handleComplete, task.id]);
  const handleRowPress = useCallback(() => onPress(task.id), [onPress, task.id]);
  const handlePriorityPress = useCallback(() => onPriorityPress?.(task.id), [onPriorityPress, task.id]);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderLeftActions={renderLeftAction}
      renderRightActions={renderRightAction}
      onSwipeableLeftOpen={handleSwipeLeft}
      onSwipeableRightOpen={handleSwipeRight}
    >
      <Animated.View
        style={[
          styles.row,
          isPanel && styles.rowPanel,
          isPanel && { backgroundColor: resolvePanelTint(task.priority) },
          rowStyle,
        ]}
      >
        <TaskCheckbox
          priority={task.priority as 1 | 2 | 3 | 4}
          onComplete={handleCheckboxComplete}
        />
        <Pressable style={styles.content} onPress={handleRowPress}>
          <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
          {task.due_date && (
            <Text style={[styles.due, isOverdue ? styles.overdue : null]}>
              {task.due_date}
            </Text>
          )}
          {!isPanel && projectName && (
            <View style={styles.projectChip}>
              <Text style={styles.projectChipText}>{projectName}</Text>
            </View>
          )}
        </Pressable>
        {isPanel ? (
          <View style={styles.panelRight}>
            <PriorityBadge
              priority={task.priority as 1 | 2 | 3 | 4}
              interactive={!!onPriorityPress}
              onPress={handlePriorityPress}
            />
            {projectName && (
              <View style={styles.projectChip}>
                <Text style={styles.projectChipText}>{projectName}</Text>
              </View>
            )}
          </View>
        ) : (
          <PriorityBadge
            priority={task.priority as 1 | 2 | 3 | 4}
            interactive={!!onPriorityPress}
            onPress={handlePriorityPress}
          />
        )}
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowPanel: {
    borderRadius: 14,
    borderBottomWidth: 0,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  content: { flex: 1 },
  title: { ...typography.body, color: colors.textPrimary },
  due:   { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  overdue: { color: colors.p1 },
  panelRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  projectChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  projectChipText: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  actionComplete: {
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    width: 100,
  },
  actionReschedule: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    width: 100,
  },
  actionRounded: {
    borderRadius: 14,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
```

Key points for the reviewer:
- `variant` defaults to `'flat'` — any existing caller that doesn't pass it (Today's screen) renders byte-for-byte the same as before: same `styles.row` (no `rowPanel` override merged in), project chip still under the title, `PriorityBadge` still at the far right, action reveal blocks still square.
- `rowPanel` is merged into the style array *after* `styles.row`, so it only needs to list the properties that differ (RN merges style arrays left-to-right).
- `panelRight` stacks the (already-existing, unchanged) `PriorityBadge` above the project chip on the right, per the spec.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (same pre-existing caveats as Task 2).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/SwipeableTaskRow.tsx
git commit -m "feat(mobile): add panel variant to SwipeableTaskRow"
```

---

### Task 4: Wire the Tasks screen to use the panel variant

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/index.tsx:63-72`

- [ ] **Step 1: Make the edit**

In the `renderItem` callback, add `variant="panel"`:

```tsx
  const renderItem = useCallback(({ item }: { item: MatrixTask }) => (
    <SwipeableTaskRow
      task={item}
      onPress={handlePress}
      onComplete={handleComplete}
      onReschedule={handleReschedule}
      onPriorityPress={handlePriorityPress}
      projectName={item.project_id ? projectNameById.get(item.project_id) : null}
      variant="panel"
    />
  ), [handlePress, handleComplete, handleReschedule, handlePriorityPress, projectNameById]);
```

(Only the added `variant="panel"` line — the dependency array is unchanged since `"panel"` is a literal constant, not a variable.)

- [ ] **Step 2: Confirm Today's screen is untouched**

Run: `git diff apps/mobile/src/app/\(tabs\)/today.tsx`
Expected: empty — Today's screen must not appear in this task's diff at all.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/src/app/(tabs)/index.tsx"
git commit -m "feat(mobile): render Tasks screen rows as priority-tinted panels"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full `packages/ui` test suite**

Run: `cd packages/ui && npx vitest run`
Expected: all test files pass, including the new `tokens.test.ts` (4 tests) and the existing `PriorityBadge.test.ts` (3 tests) — 2 files, 7 tests passed.

- [ ] **Step 2: Typecheck every touched package**

Run: `cd packages/ui && npx tsc --noEmit && cd ../../apps/mobile && npx tsc --noEmit`
Expected: no new errors in either package (pre-existing, unrelated errors in `today.tsx`/`SubTaskList.tsx` may remain — confirm via `git status --porcelain` that those files are not part of this branch's diff).

- [ ] **Step 3: Metro bundle export sanity check**

Run: `cd apps/mobile && npx expo export --platform android`
Expected: exits 0, all modules resolve/bundle without error. This is a partial substitute for on-device testing when no simulator/device is available (per `docs/MOBILE_DEV_LESSONS.md`) — prefer Step 4 when a device is available.

- [ ] **Step 4: On-device manual verification**

Using the dev loop documented in `docs/MOBILE_DEV_LESSONS.md` (Metro + `adb reverse`, or an EAS Update OTA push to the `preview` channel if no dev-client build is available), confirm on a real device:
- Each of the 4 quadrant tabs (Do First/Plan/Pass/Drop) shows its label in a distinct color when active (red/orange/blue/grey), and muted grey when inactive
- Task rows in the Tasks screen render as rounded, tinted panels with spacing between them (not a continuous divided list)
- The project/category chip appears on the right side of each panel, with the priority badge stacked just above it
- Tapping the priority badge still opens the quadrant-reassignment sheet and moves the task
- Swipe left still completes a task; swipe right still reschedules to tomorrow; both reveal color blocks have rounded corners matching the panel
- The Today screen (separate tab) is visually unchanged — still a flat divided list, project chip below the title

- [ ] **Step 5: Final commit (if any fixes were needed)**

If Steps 1–4 required any fixes, stage and commit them now with a descriptive message before moving on. If everything passed as-is from Tasks 1–4, there is nothing further to commit.
