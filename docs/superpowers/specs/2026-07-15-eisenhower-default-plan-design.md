# Eisenhower Matrix: default new tasks to Plan, not Drop

## Problem

New tasks silently default into the **Drop** quadrant (priority 4) unless the
user explicitly types a `p1`/`p2`/`p3` tag in quick capture. This happens on
both web and mobile, and is the wrong default for how the app is actually
used — new tasks should land in **Plan** (priority 2) instead.

Two related issues came up during investigation:

1. On mobile, adding a task from the Home or Today screens has no quadrant
   context to override the silent default (they don't pass `defaultPriority`
   to `QuickCaptureModal`), so those flows are the most visible source of
   tasks landing in Drop. The Tasks/Matrix screen has a `defaultPriority`
   override tied to whichever quadrant tab is active — see decision below on
   removing this.
2. New tasks always compute the same fixed `sort_order` sentinel key
   (`generateKeyBetween(null, null)`), because no caller passes
   `afterSortOrder`. This isn't deliberate "insert at top" — it's an
   accidental collision. Every new task should genuinely sort at the top of
   its quadrant.

## Scope

- Applies to **top-level task creation only**. Sub-task creation
  (`SubTaskList.tsx`, `TaskDetailPanel.tsx`'s sub-task add) keeps hardcoding
  priority 4 and its existing sort-order behavior — unchanged.
- Applies equally to web and mobile quick-capture flows.
- Does not change `packages/ui`'s `shouldRenderPriorityBadge`, which hides
  the priority badge specifically for **quadrant 4 (Drop)** — a Drop-specific
  display convention unrelated to what new tasks default to.

## A. Shared default-priority constant

Add `DEFAULT_PRIORITY = 2` to `packages/core/src/types.ts`, next to
`quadrantLabel`. Replace the two hardcoded `4`s that currently serve as the
silent default:

- `packages/core/src/nlp/parser.ts:84` — `parseTaskInput()`'s fallback when no
  `pN`/`!N` tag is present in the input text.
- `packages/db/src/queries/tasks.ts:231` — `createTask()`'s defensive
  `fields.priority ?? 4` fallback.
- `packages/db/src/queries/tasks.ts:61` — `groupTasksByPriority()`'s
  null-priority fallback (`task.priority ?? 4`), for consistency.

This alone makes every quick-capture entry point on both platforms default to
Plan, since none of them currently override priority. Explicit `p1`/`p3`/`p4`
tags are unaffected.

## B. sort_order: genuine top-of-quadrant placement

In `createTask()` (`packages/db/src/queries/tasks.ts`): when `parentTaskId`
is not provided and the caller doesn't explicitly pass `afterSortOrder`,
look up the current lowest `sort_order` among existing tasks in the same
target quadrant:

```sql
SELECT sort_order FROM tasks
WHERE priority = ? AND status NOT IN ('completed', 'cancelled') AND deleted_at IS NULL
ORDER BY sort_order LIMIT 1
```

(matches `MATRIX_QUERY`'s filters, scoped by the target priority) and
generate the new key below it: `generateKeyBetween(null, firstInQuadrant?.sort_order ?? null)`.
This guarantees any new top-level task — in any quadrant — lands at the true
top of that quadrant's list, not just Plan.

Sub-task creation (`parentTaskId` set) keeps the existing
`generateKeyBetween(afterSortOrder ?? null, null)` behavior, unchanged.

## C. Mobile: focus follows the resulting quadrant

Remove the existing "add task while viewing a quadrant tab defaults into
that quadrant" feature:

- Delete `apps/mobile/src/lib/resolveTaskPriority.ts` and its test
  (`apps/mobile/__tests__/resolveTaskPriority.test.ts`) — with the shared
  default now Plan and no caller left needing to override it, this
  indirection becomes dead code.
- Remove the `defaultPriority` prop from
  `apps/mobile/src/components/QuickCaptureModal.tsx`; `handleSave` uses
  `parsed.priority` directly (matching the web component already).
- `apps/mobile/src/app/(tabs)/tasks.tsx` stops passing `defaultPriority={active}`.

Add a new `onCreated?: (priority: 1 | 2 | 3 | 4) => void` callback to
`QuickCaptureModal`, fired after a successful save (not on cancel). The
Tasks screen wires it to `setActive(priority)`, so after adding a task the
active tab switches to wherever the task actually landed — Plan by default,
or the explicitly-tagged quadrant (`p1`/`p3`/`p4`) if the user typed one.
This satisfies "put focus on Plan" for the default case while still doing
the sensible thing when a user explicitly overrides the quadrant.

## D. Web: highlight the landed quadrant

Web's Matrix page shows all 4 quadrants in a grid simultaneously — no tabs
to switch, so "focus" means a transient visual highlight instead:

- Add the same `onCreated?: (priority: 1 | 2 | 3 | 4) => void` callback to
  `apps/web/components/tasks/QuickCaptureModal.tsx` (mirrors mobile).
- `MatrixQuadrant.tsx` gets a new `highlighted?: boolean` prop, OR'd with the
  existing `isDragOver` state to apply the same `ring-2 ${config.ring}` style.
- `MatrixPage` tracks a `highlightQuadrant` state, set from `onCreated`, and
  clears it after ~1.5s via `setTimeout`.

This only applies on the Matrix page itself. Adding a task from
Inbox/Today/a Project page just gets the new Plan default — there's no
quadrant panel visible there to highlight.

## Testing

- `packages/core/src/nlp/parser.test.ts` — update the two assertions that
  expect the silent default to be `4` (lines ~8-16, ~84-90) to expect `2`.
- `packages/db/src/queries/tasks.test.ts` — update `"defaults a null
  priority to group 4"` to expect group `2`.
- `packages/db/src/queries/tasks.test.ts` — add cases for `createTask()`'s
  new top-of-quadrant `sort_order` behavior (empty quadrant, quadrant with
  existing tasks, sub-task creation unaffected).
- `apps/mobile/__tests__/resolveTaskPriority.test.ts` — delete.
- Add/extend mobile test coverage for `onCreated` firing with the resolved
  priority and the Tasks screen switching `active` accordingly.
- Add/extend web `MatrixPage.test.tsx` coverage for the highlight state
  appearing and clearing.
- Run `pnpm test`, `pnpm typecheck`, `pnpm lint` before considering done, per
  root `CLAUDE.md`.
