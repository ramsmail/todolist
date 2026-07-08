# Mobile Tasks Panel Layout — Design Spec

**Date:** 2026-07-08
**Status:** Approved
**Scope:** Mobile only (`apps/mobile`, `packages/ui`)

---

## Overview

Restyle the mobile Tasks matrix screen (`apps/mobile/src/app/(tabs)/index.tsx`) so each task renders as a distinct, rounded, color-tinted "panel" instead of a plain divided list row — matching a reference mockup — and give the Do First/Plan/Pass/Drop quadrant tabs a clearer visual distinction. No schema, data, or navigation changes; this is a pure styling pass on top of the existing Phase 1 Tasks matrix implementation.

The reference mockup uses a light theme with pastel green panels. The app is fully dark-themed (`packages/ui/src/tokens.ts`), so this spec adapts the panel concept to dark mode rather than matching the mockup's literal colors — muted, low-alpha tints of the existing priority colors instead of flat pastels.

---

## Quadrant tabs — header distinction

`apps/mobile/src/components/QuadrantTabs.tsx` keeps its current structure (segmented control, active tab = a white/`colors.surface` pill on a muted track) unchanged. The only change: the active tab's label color is set to that quadrant's priority color instead of a flat `colors.textPrimary`.

Quadrant number and priority number are already the same value (1–4), so this reuses the existing `priorityColor` map directly — no new tokens:

| Quadrant | Priority | Active label color |
|----------|----------|---------------------|
| 1 — Do First | 1 | `colors.p1` (red) |
| 2 — Plan | 2 | `colors.p2` (orange) |
| 3 — Pass | 3 | `colors.p3` (blue) |
| 4 — Drop | 4 | `colors.p4` (grey) |

Inactive tabs stay `colors.textMuted`, same as today.

---

## Task panels

### New tokens (`packages/ui/src/tokens.ts`)

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

`resolvePanelTint` defaults null/undefined/out-of-range priority to the P4 tint, mirroring the existing defaulting convention in `groupTasksByPriority` (`packages/db/src/queries/tasks.ts`).

### `SwipeableTaskRow` — new `variant` prop

`apps/mobile/src/components/SwipeableTaskRow.tsx` gains an optional prop:

```ts
variant?: 'flat' | 'panel'; // default 'flat' — existing behavior, used by Today
```

When `variant === 'panel'`:
- Row container gets `borderRadius: 14`, background = `resolvePanelTint(task.priority)`, no bottom border, and `marginBottom` for spacing between cards (replacing the current hairline-divider flat list look)
- The `renderLeftAction`/`renderRightAction` color blocks (swipe-to-complete / swipe-to-reschedule reveals) get matching rounded corners so they don't show square edges behind the rounded panel
- Project/category chip (`projectName`) moves from "below the title" to the right side of the row
- The existing small `PriorityBadge` (tap-to-reassign, already `interactive`) is positioned just above the project chip on the right side, instead of at the far right of the whole row

When `variant` is omitted or `'flat'` (Today's usage — unchanged): current layout, divider, and chip position stay exactly as they are today. Today's screen (`apps/mobile/src/app/(tabs)/today.tsx`) is not modified.

### Checkbox

`TaskCheckbox` is reused as-is — no visual change.

---

## Wiring

`apps/mobile/src/app/(tabs)/index.tsx` (Tasks screen) passes `variant="panel"` to each `SwipeableTaskRow` it renders. The tint is derived by `SwipeableTaskRow` itself from `task.priority` — no extra prop needs to be threaded down from the screen, since every task already carries its own priority.

---

## Testing

- `packages/ui`: unit test for `resolvePanelTint` — correct tint for priorities 1–4, defaults correctly for `null`/`undefined`/out-of-range values. Follows the same pure-logic-extraction pattern as `priorityBadgeLogic.ts`, for the same reason: RN component JSX (`SwipeableTaskRow.tsx`, `QuadrantTabs.tsx`) cannot be unit-tested with the current vitest setup (Flow-syntax parse failure on `react-native` internals) — only the pure token/logic layer is testable.
- `SwipeableTaskRow.tsx` and `QuadrantTabs.tsx` changes are verified via typecheck + Metro bundle export (`npx expo export`), plus a manual on-device check (all 4 tabs show correct label color; panels render tinted per priority; swipe-to-complete/reschedule still work with rounded reveal corners; tapping the priority badge still opens the quadrant-reassignment sheet; project chip renders correctly on the right).

No `supabase/migrations/`, `powersync/sync-rules.yaml`, or `packages/db` changes — this is styling only.

---

## Out of Scope

- Changing the quick-capture "+" button from a floating action button to an inline header button (reference mockup shows this, but explicitly kept as-is for this pass)
- Applying the panel treatment to the Today screen
- Any change to quadrant reassignment logic, swipe thresholds, or data queries
