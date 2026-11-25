# Mobile Task Detail — Due Date Editing — Design Spec

**Date:** 2026-07-08
**Status:** Approved
**Scope:** Mobile only (`apps/mobile`)

---

## Overview

The mobile task detail screen (`apps/mobile/src/app/task/[id].tsx`) currently shows `due_date` as plain read-only text ("No date" or the raw date string) — there is no way to set, change, or clear it from this screen. The only existing way to move a task's due date at all is the fixed "swipe right → reschedule to tomorrow" shortcut on list rows (`SwipeableTaskRow`), which can't set an arbitrary date.

This adds arbitrary due-date editing to the task detail screen, using the platform's native date picker (`@react-native-community/datetimepicker`) rather than a custom-built calendar — web already has its own custom `DatePicker.tsx`, but that exists specifically to paper over inconsistent native `<input type="date">` behavior across browsers, a problem that doesn't exist on native mobile, where a real native picker is available and preferable for platform-appropriate UX.

Editing `due_time` (a separate existing column) and any recurrence-related due-date logic are both out of scope — this is a date-only change.

---

## New dependency

`@react-native-community/datetimepicker`, added via `npx expo install @react-native-community/datetimepicker` (not a plain `pnpm add`) so Expo pins the SDK-56-compatible version.

---

## Components

### `apps/mobile/src/components/DueDateField.tsx` (new)

Replaces the current plain due-date `<Text>` row in `task/[id].tsx` with a tappable field plus a conditional "Clear" action.

**Props:**
```ts
interface Props {
  dueDate:  string | null;             // stored format: 'YYYY-MM-DD'
  onChange: (dueDate: string | null) => void;
}
```

**Behavior:**
- Renders the current due date (formatted for display) or "No date" if `dueDate` is null, as a `Pressable`.
- Tapping opens the platform-appropriate native picker:
  - **Android:** `DateTimePickerAndroid.open({ value, mode: 'date', display: 'default', onValueChange, onDismiss })` — the library's recommended imperative API for Android.
  - **iOS:** the declarative `<DateTimePicker mode="date" .../>` component, shown conditionally via local `show` state (toggled on/off around the picker), since iOS doesn't have an equivalent imperative modal API.
- On a selected date, calls `onChange(formatDueDateForStorage(selectedDate))`.
- When `dueDate` is not null, renders a small "Clear" text button beside the date that calls `onChange(null)`.

### `apps/mobile/src/lib/dueDateFormat.ts` (new)

Pure, RN-import-free helpers — the one piece of actual logic in this feature, and the only part that's unit-testable given this repo's established constraint (RN component JSX can't be vitest-tested; see `resolveTaskPriority.ts` for the precedent this follows).

```ts
export function parseDueDate(dueDate: string | null): Date | null
```
Converts the stored `'YYYY-MM-DD'` string to a `Date` at local midnight for that calendar day (so the picker opens showing the currently-set date, not shifted by a timezone offset). Returns `null` when `dueDate` is `null` (the picker then opens defaulting to today, handled by the component, not this function).

```ts
export function formatDueDateForStorage(date: Date): string
```
Converts a `Date` returned by the picker back to `'YYYY-MM-DD'` using the date's local year/month/day (not `toISOString()`, which would shift the date across a UTC day boundary for users behind UTC in the evening).

---

## Wiring

In `task/[id].tsx`, replace:
```tsx
<View style={styles.section}>
  <Text style={styles.sectionLabel}>DUE DATE</Text>
  <Text style={styles.dueDate}>{task.due_date ?? 'No date'}</Text>
</View>
```
with:
```tsx
<View style={styles.section}>
  <Text style={styles.sectionLabel}>DUE DATE</Text>
  <DueDateField
    dueDate={task.due_date}
    onChange={(d) => updateTaskDue(db as any, taskId, d, null)}
  />
</View>
```
Reuses the existing `updateTaskDue(db, id, dueDate, dueTime)` mutation from `packages/db` (already used by `SwipeableTaskRow`'s reschedule action) — no new mutation needed. `dueTime` is passed as `null` since this feature doesn't touch it.

---

## Testing

- `dueDateFormat.ts`: unit tests for `parseDueDate`/`formatDueDateForStorage` — null handling, round-trip conversion, and a case exercising a date near a UTC day boundary to confirm no off-by-one-day bug.
- `DueDateField.tsx` and the `task/[id].tsx` wiring: typecheck + on-device verification only (RN JSX, same established constraint as the rest of this app).
- No schema, migration, or sync-rule changes — `due_date` already exists and syncs.

---

## Out of Scope

- Editing `due_time`
- Any change to recurrence-rule due-date computation
- Web (unaffected)
- Quick-preset date chips (e.g. "Tomorrow", "Next week") — could be a future addition to `DueDateField` if wanted later
