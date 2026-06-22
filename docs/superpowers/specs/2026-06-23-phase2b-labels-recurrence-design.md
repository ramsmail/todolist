# Phase 2B — Labels & Recurrence Design Spec

**Date:** 2026-06-23
**Status:** Approved

---

## Overview

Phase 2B adds **labels** and **recurring tasks** to both platforms (web *and* mobile),
building on the Phase 2A web foundation and the Phase 1 mobile app. Both features are
implemented primarily in the shared `packages/core` and `packages/db` packages so the two
apps stay thin and consistent.

**Scope (in):**
- Labels: name-based, auto-created on `@mention`, colored, with a Manage Labels page and a
  per-label filtered view; label chips on task rows; inline Labels section in the
  web sidebar / mobile drawer.
- Recurrence: presets + simple custom (`daily`, `every weekday`, `weekly` on chosen
  weekdays, `monthly` same-day, `yearly`, and `every N days/weeks/months/years`); a
  recurrence picker in the task detail UI; NLP recurrence parsing in quick-capture;
  snapshot-on-complete with in-place advance.

**Scope (out):** Saved filters, keyboard shortcuts, accessibility audit (all 2C); a
browsable **Completed/Logbook** view (deferred to 2C — snapshots are recorded now but not
surfaced in a dedicated UI); recurrence end-conditions (until/count), nth-weekday-of-month,
and other full-RRULE features; light mode and Sentry (Phase 3).

---

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Recurrence power | Presets + simple custom (`every N units`, weekly weekday picker, monthly same-day, yearly). No end conditions. |
| Completion behavior | **Snapshot + advance** — a completed copy is recorded for history, then the original advances. |
| Next-date basis | **Scheduled due date** (calendar-anchored), not completion date. |
| Label model | **By name** — `tasks.labels` is a JSON string array of names; the `labels` table holds color/metadata. |
| Unknown `@label` | **Auto-create** with an auto-assigned color. |
| Web label nav | **Inline collapsible Labels section** in the sidebar (mirrors Projects). |
| Label management | **Dedicated Manage Labels page** (name + color + edit/delete). |
| Completed history UI | **Deferred to 2C** — snapshots sync now, no browse UI in 2B. |
| Recurrence rule format | **Hand-rolled RRULE subset** in `packages/core` (no new dependencies). |

---

## Architecture

Both features live mostly in shared packages; the apps add thin UI.

```
packages/core   →  recurrence engine (pure TS) + NLP recurrence parsing
packages/db     →  PowerSync labels table, label CRUD, recurrence-aware completeTask
packages/ui     →  LabelChip / recurrence badge (NativeWind, mobile)
apps/web        →  sidebar Labels section, Manage Labels page, label view,
                   RecurrencePicker, label chips on rows
apps/mobile     →  drawer Labels section, ManageLabelsScreen, LabelScreen,
                   RecurrencePicker (RN), label chips on rows
```

**No Supabase migration is required.** The server schema (`20260620000001_initial_schema.sql`)
already has the `labels` table, `tasks.recurrence_rule` / `tasks.recurrence_start` columns,
the `tasks.labels` jsonb column + GIN index, and the PowerSync sync rules
(`powersync/sync-rules.yaml`) already sync `labels`. The only client-side gap is the
PowerSync `AppSchema`.

---

## Data Layer

### PowerSync client schema (`packages/db/src/schema.ts`)

Add a `labels` table to `AppSchema` and include it in the exported types:

```ts
const labels = new Table(
  {
    user_id:    column.text,
    name:       column.text,
    color:      column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { by_name: ['name'] } }
);

export const AppSchema = new Schema({ tasks, projects, labels });
export type LabelRecord = Database['labels'];
```

(`saved_filters`, `reminders`, `attachments` remain out of the client schema until their
phases.)

### Recurrence rule representation

Stored as an RRULE-subset string in the existing `tasks.recurrence_rule` text column:

| Pattern | Stored string |
|---|---|
| Daily | `FREQ=DAILY` |
| Every weekday | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |
| Weekly on Mon/Wed | `FREQ=WEEKLY;BYDAY=MO,WE` |
| Monthly (same day) | `FREQ=MONTHLY` |
| Yearly | `FREQ=YEARLY` |
| Every N units | append `;INTERVAL=N` (omitted when N=1) |

- `tasks.recurrence_start` holds the anchor date (`YYYY-MM-DD`) = the first occurrence's
  due date. Used to keep weekly-interval and monthly math stable across advances.
- `tasks.labels` stays a JSON string array of names, e.g. `["groceries","urgent"]`.

---

## Recurrence Engine (`packages/core/src/recurrence/`)

Pure, dependency-light TypeScript (date math via `date-fns`, already a dependency).
Shared by both apps and by `packages/db`.

```ts
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: Freq;
  interval: number;        // >= 1
  byDay?: Weekday[];       // only for weekly
}

parseRule(s: string): RecurrenceRule | null;   // RRULE subset → object (null if unparseable)
serializeRule(r: RecurrenceRule): string;       // object → RRULE subset
describeRule(r: RecurrenceRule): string;         // human label, e.g. "Every 2 weeks on Mon, Wed"
computeNext(
  r: RecurrenceRule,
  fromDate: string,   // 'YYYY-MM-DD' — the occurrence being completed (scheduled due date)
  anchor: string,     // 'YYYY-MM-DD' — recurrence_start
): string;            // next occurrence 'YYYY-MM-DD' strictly after fromDate
```

**Semantics:**
- `daily` / `every N days`: `fromDate + interval` days.
- `weekly` with `byDay`: next weekday in the set; when crossing into a new week, advance by
  `interval` weeks measured from `anchor`'s week. `weekly` without `byDay` → same weekday as
  `anchor`, `interval` weeks later.
- `every weekday`: weekly with `byDay = MO..FR`, `interval = 1`.
- `monthly` / `every N months`: same day-of-month, `interval` months later; **clamp** to the
  last day for short months (e.g. the 31st in a 30-day month → the 30th). Documented behavior.
- `yearly` / `every N years`: same month/day, `interval` years later; Feb 29 → Feb 28 in
  non-leap years.

**Tests** (`recurrence.test.ts`): round-trip parse/serialize for every pattern; `computeNext`
across all freqs and intervals; multi-weekday ordering; month-end clamping; leap-year yearly.
This is a hard gate before 2B is done.

---

## NLP Recurrence Parsing (`packages/core/src/nlp/parser.ts`)

Extend `NlpParseResult` with `recurrenceRule: string | null`. Extract recurrence **before**
the chrono date pass so phrases like "every monday" aren't swallowed as a one-off date.

Recognized phrases (case-insensitive, whole-token):
- `daily` / `every day` → `FREQ=DAILY`
- `weekdays` / `every weekday` → `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`
- `weekly` / `every week` → `FREQ=WEEKLY` (anchored to today's weekday)
- `every monday` … `every sunday`, including comma/and lists (`every mon, wed`) →
  `FREQ=WEEKLY;BYDAY=…`
- `monthly` / `every month` → `FREQ=MONTHLY`
- `yearly` / `annually` / `every year` → `FREQ=YEARLY`
- `every N days|weeks|months|years` → corresponding `FREQ` + `INTERVAL=N`

If a recurrence is detected but no explicit due date is present, the due date is set to the
**first matching occurrence** (today for daily/weekly-no-day; the next matching weekday/
date otherwise); `recurrence_start` = that due date. Recurrence tokens are stripped from the
title. Tests added to `parser.test.ts`.

---

## DB Write Helpers (`packages/db`)

### Tasks (`queries/tasks.ts`)

- **`createTask`** — accept optional `recurrenceRule`; when present, write `recurrence_rule`
  and set `recurrence_start = dueDate`. (Also add the two columns to the INSERT.)
- **`completeTask`** — becomes recurrence-aware, wrapped in a `writeTransaction`:
  - **No recurrence rule:** unchanged — `status='completed'`.
  - **Has recurrence rule:**
    1. Insert a **snapshot** copy: new id, `status='completed'`, same title/priority/
       project_id/labels, `due_date` = the occurrence just completed, `recurrence_rule=null`,
       `recurrence_start=null`, `parent_task_id=null`.
    2. Compute `next = computeNext(rule, due_date, recurrence_start)` (from `packages/core`).
    3. `UPDATE` the original task: `due_date = next` (keep `due_time`), status stays active.
    4. Reset the original's incomplete-tracking subtasks: any sub-tasks with
       `status='completed'` are set back to `active` (Todoist-style fresh checklist). Snapshots
       do **not** copy subtasks.
- **`updateTaskRecurrence(db, id, ruleStr | null, start | null)`** — set/clear recurrence.

`packages/db` imports the recurrence engine from `packages/core` (db → core dependency,
consistent with existing NLP usage).

### Labels (`queries/labels.ts` — new)

- `useLabels()` — reactive list, sorted by name.
- `useTasksByLabel(name)` — active tasks whose `labels` array contains `name`, via
  `EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)`.
- `createLabel(db, { userId, name, color? })` — `color` defaults via a deterministic palette
  pick (hash of name → fixed 8-color palette) for stable auto-colors.
- `ensureLabels(db, userId, names[])` — create any labels that don't yet exist (used by
  quick-capture). Idempotent; relies on the `(user_id, name)` uniqueness already enforced
  server-side.
- `updateLabel(db, id, { name?, color? })` — on **rename**, also bulk-update every task's
  `labels` JSON array to replace the old name (the accepted cost of the name-based model).
- `deleteLabel(db, id)` — soft-delete the label and remove its name from all tasks' `labels`
  arrays.

---

## Web UI (`apps/web`)

- **Sidebar** (`components/layout/Sidebar.tsx`): add a collapsible **Labels** section below
  Projects — reactive `useLabels`, colored dot + name, each links to `/labels/[name]`; a `+`
  routes to `/labels` (Manage Labels).
- **`app/labels/[name]/page.tsx`** — label-filtered task list (reuses `TaskList`/`TaskRow`).
- **`app/labels/page.tsx`** — Manage Labels page: list with color swatch, inline edit
  name/color, delete (with confirmation), and create-new.
- **`components/tasks/RecurrencePicker.tsx`** — preset dropdown (None / Daily / Every weekday
  / Weekly / Monthly / Yearly / Custom); Weekly reveals a weekday toggle row; Custom reveals
  `every [N] [unit]`. Serializes via `serializeRule`; shows `describeRule` summary.
- **`components/tasks/TaskDetailPanel.tsx`** — add a **Repeat** row using `RecurrencePicker`,
  wired to `updateTaskRecurrence`.
- **`components/tasks/LabelChip.tsx`** — colored chip; rendered on `TaskRow` alongside a
  recurring **↻** badge when `recurrence_rule` is set.
- **`components/tasks/QuickCaptureModal.tsx`** — already parses `@labels`; now also surface a
  recurrence pill when NLP detects one, call `ensureLabels`, and pass `recurrenceRule` to
  `createTask`.

COOP/COEP, auth, and the client-heavy `useQuery` model from 2A are unchanged.

## Mobile UI (`apps/mobile`)

Mirrors the web feature set using the existing drawer + screens:

- **`navigation/AppDrawer.tsx`** — add a Labels section (mirrors the projects list) → a new
  `LabelScreen`.
- **`screens/LabelScreen.tsx`** — label-filtered list (modeled on `ProjectScreen`).
- **`screens/ManageLabelsScreen.tsx`** — list + create/edit/delete.
- **`screens/TaskDetailScreen.tsx`** — add a Repeat row → RN `RecurrencePicker`
  (modal/action-sheet style) wired to `updateTaskRecurrence`.
- **Task rows** (`components/SwipeableTaskRow.tsx`): label chips + recurring badge.
- **`components/QuickCaptureModal.tsx`**: recurrence pill + `ensureLabels` (shared NLP).
- **`packages/ui`**: add a NativeWind `LabelChip` (and recurrence badge) for reuse.

The `RecurrencePicker` is platform-specific (web dropdown vs RN modal); all rule logic comes
from `packages/core`.

---

## Data Flow

- **Labels read:** `useLabels` / `useTasksByLabel` subscribe to local SQLite/OPFS — same
  reactive `useQuery` pattern as everything else; updates propagate automatically across
  platforms via PowerSync.
- **Quick capture:** NLP → `ensureLabels(names)` → `createTask({ labels, recurrenceRule, … })`.
  Writes hit local storage immediately and queue a background push.
- **Recurring completion:** `completeTask` runs the snapshot + advance transaction locally;
  both the snapshot and the advanced original sync up in the background.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `computeNext` given an unparseable rule | Treat as non-recurring: complete normally (no advance), log a console warning. |
| Auto-create label name collision (offline race) | `ensureLabels` is idempotent; the server `(user_id, name)` unique constraint is the backstop. Duplicate-by-case avoided by lowercasing names (matches the NLP parser). |
| Rename/delete label while offline | Local task-array rewrites queue and sync like any other write. |
| Monthly/yearly impossible date (e.g. 31st, Feb 29) | Clamp to last valid day / Feb 28, per engine semantics. |
| Deleting a recurring task | Soft-deletes the task (the live series); existing snapshots are unaffected history. |

---

## Testing

**`packages/core`**
- `recurrence.test.ts` — parse/serialize round-trips; `computeNext` for every freq/interval;
  multi-weekday ordering; month-end clamp; leap-year. (Hard gate.)
- `parser.test.ts` — recurrence-phrase extraction + due-date inference + title cleanup.

**`packages/db`**
- Label helpers: `createLabel` color assignment, `ensureLabels` idempotency, `updateLabel`
  rename propagation, `deleteLabel` array cleanup.
- `completeTask`: snapshot created + original advanced for recurring; unchanged for
  non-recurring; subtask reset. (Use the package's existing test harness; cover the pure
  rule/array logic where a live PowerSync DB isn't available.)

**`apps/web` (Vitest + RTL)**
- RecurrencePicker serializes the right rule; LabelChip renders; Manage Labels CRUD;
  completing a recurring task advances its due date in the list.
- **axe-core**: extend the existing scan gate to the Labels page and label view (zero WCAG
  AA violations).
- **Playwright**: (1) recurrence golden path — create a recurring task, complete it, verify it
  reappears with the advanced due date and a snapshot exists; (2) label flow — quick-add with
  `@label`, verify it appears in the sidebar Labels section and filters the list.

**`apps/mobile`**
- Component tests for RecurrencePicker + label chips; extend the e2e golden path with a
  label + recurrence step where practical.

---

## Out of Scope for 2B

- Completed/Logbook browse UI (2C — snapshots recorded now)
- Saved filters, keyboard shortcuts, accessibility audit (2C)
- Recurrence end-conditions (until/count), nth-weekday-of-month, multiple weekday sets
- Light mode toggle, Sentry (Phase 3)
- Manual label reordering (labels sort alphabetically)
