# Phase 2C — Saved Filters, Keyboard Shortcuts, Logbook & Accessibility Design Spec

**Date:** 2026-06-23
**Status:** Approved

---

## Overview

Phase 2C adds four features to the web app, all building on the 2A/2B foundation:

1. **Saved filters** — user-defined filtered task views (priority + due date + labels + project), surfaced in the sidebar alongside Projects and Labels.
2. **Keyboard shortcuts** — full-power shortcut system (navigation chords, global actions, per-task shortcuts) via `tinykeys`, plus a `?` help overlay.
3. **Logbook** — a `/logbook` page surfacing the completed-task snapshots recorded since 2B, grouped by date bucket.
4. **Accessibility audit** — extend the existing axe-core scan gate to all new 2C components.

**Scope (in):** All of the above, web only.
**Scope (out):** Full-text search (Phase 3), mobile filters/logbook/shortcuts (later phase), manual screen reader testing, pagination for logbook, emoji picker library for filter icons, recurrence end-conditions.

---

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Filter criteria | Priority + due-date range + labels (OR) + project |
| Filter UI placement | Sidebar section → `/filters/[id]` pages (mirrors Labels/Projects pattern) |
| Filter builder | Modal with 4 criterion rows |
| Shortcut library | `tinykeys` (< 1 KB, chord support, suppresses inside inputs) |
| Task-level shortcuts | Focused row via `tabIndex={0}` + `data-task-id`; arrow keys move focus |
| Logbook query | `status='completed'`, ordered by `updated_at` desc, limit 200 |
| Logbook grouping | Today / This week / Earlier date buckets |
| Accessibility scope | Automated only — extend axe-core scan to 2C components/pages |
| Supabase migration | None needed — `saved_filters` table + RLS + sync rules already exist |

---

## Architecture

```
packages/core   →  FilterQuery type, serializeFilterQuery, parseFilterQuery
packages/db     →  saved_filters PowerSync table, CRUD hooks,
                    useFilteredTasks(), useLogbook()
apps/web        →  /filters/[id] page, /logbook page,
                    FilterBuilderModal, SavedFiltersSection in sidebar,
                    KeyboardShortcuts provider + ShortcutsOverlay
```

**No Supabase migration needed.** The `saved_filters` table, RLS policies, `updated_at` trigger, and PowerSync sync rule (`SELECT * FROM saved_filters WHERE user_id = auth.user_id()`) already exist. Only the client `AppSchema` needs a `saved_filters` table entry — same pattern as `labels` in 2B.

**One new dependency:** `tinykeys` in `apps/web` only.

---

## Data Layer

### PowerSync client schema (`packages/db/src/schema.ts`)

Add to `AppSchema`:

```ts
const saved_filters = new Table(
  {
    user_id:    column.text,
    name:       column.text,
    icon:       column.text,
    query:      column.text,   // JSON-serialised FilterQuery
    sort_order: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { by_sort: ['sort_order'] } }
);

export const AppSchema = new Schema({ tasks, projects, labels, saved_filters });
export type SavedFilterRecord = Database['saved_filters'];
```

### FilterQuery type (`packages/core/src/filters/`)

```ts
export interface FilterQuery {
  priority?:     (1 | 2 | 3 | 4)[];
  dueDateRange?: 'today' | 'this_week' | 'next_week' | 'overdue' | 'no_date';
  labels?:       string[];      // OR match — task must have any one of these
  projectId?:    string | null; // null = tasks with no project
}

export function serializeFilterQuery(q: FilterQuery): string;
export function parseFilterQuery(s: string): FilterQuery;
```

At least one criterion must be non-empty (validated at save time, not at the type level).
All present criteria are ANDed together.

### DB helpers (`packages/db/src/queries/savedFilters.ts`)

- `useSavedFilters()` — reactive list, sorted by `sort_order`, soft-deleted excluded.
- `useFilteredTasks(query: FilterQuery)` — evaluates criteria against local SQLite:
  - `priority`: `WHERE priority IN (…)`
  - `projectId`: `WHERE project_id = ?` or `WHERE project_id IS NULL`
  - `labels`: `WHERE EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value IN (…))`
  - `dueDateRange`: date arithmetic against `due_date` using rolling windows — today = current date only; this_week = due in the next 1–7 days; next_week = due in 8–14 days; overdue = due_date < today and not null; no_date = IS NULL
  - All criteria ANDed; `status != 'completed'` and `deleted_at IS NULL` always applied.
- `createSavedFilter(db, { userId, name, icon?, query })` — appends with new `sort_order`.
- `updateSavedFilter(db, id, { name?, icon?, query? })`.
- `deleteSavedFilter(db, id)` — soft-delete.

### Logbook query (`packages/db/src/queries/tasks.ts` addition)

```ts
export function useLogbook(): { data: TaskRecord[] }
// SELECT * FROM tasks WHERE status = 'completed' AND deleted_at IS NULL
// ORDER BY updated_at DESC LIMIT 200
```

`updated_at` on a completed task is a reliable completion timestamp: the server `set_updated_at` trigger fires on every UPDATE, including the status → 'completed' write.

---

## Web UI

### Sidebar (`components/layout/Sidebar.tsx`)

Add a **Filters** section between Labels and the bottom bar:
- Section header "Filters" in the same style as Projects/Labels.
- One row per saved filter: funnel icon (or the filter's `icon` if set) + name, linking to `/filters/[id]`.
- `+ New filter` button at the bottom opens `FilterBuilderModal` in create mode.

### `/filters/[id]/page.tsx`

Renders `useFilteredTasks(filter.query)` via `TaskList`. Header shows the filter name + an edit icon that opens `FilterBuilderModal` pre-populated with the existing criteria. Empty state: "No tasks match this filter."

### `FilterBuilderModal` (`components/filters/FilterBuilderModal.tsx`)

Modal with:
- **Name** — text input (required).
- **Icon** — plain text input for an emoji character (optional).
- **Priority** — multi-select chip row: Urgent / High / Normal / Low.
- **Due date** — single-select dropdown: Today / This week / Next week / Overdue / No date.
- **Labels** — multi-select chip row populated from `useLabels()`.
- **Project** — single-select dropdown from `useProjects()` + "No project" option.

Save is disabled until at least one criterion is set and name is non-empty. On save: `createSavedFilter` or `updateSavedFilter` then close.

### `/logbook/page.tsx`

Added to sidebar nav between Upcoming and Search with a `✓` icon.

Groups completed tasks from `useLogbook()` into three buckets by `updated_at`:
- **Today** — completed today.
- **This week** — completed in the last 7 days, excluding today.
- **Earlier** — everything older.

Each bucket is a labelled section using `TaskRow` in read-only mode (no complete/swipe action). A "completed on" date stamp replaces the due-date chip. Empty state: "Nothing completed yet — tasks you finish will appear here."

---

## Keyboard Shortcuts

### Implementation

`KeyboardShortcuts` component added to `ClientLayout.tsx`. Uses `tinykeys(window, bindings)` inside a `useEffect`. `tinykeys` suppresses firing when focus is inside `<input>`, `<textarea>`, or `[contenteditable]` — no custom suppression needed.

A `ShortcutContext` exposes `openShortcutsHelp: () => void` for the `?` overlay toggle.

### Shortcut map

**Navigation:**

| Keys | Action |
|------|--------|
| `g i` | Go to Inbox |
| `g t` | Go to Today |
| `g u` | Go to Upcoming |
| `g b` | Go to Logbook ("book") |
| `g l` | Go to Labels (Manage Labels page) |
| `g f` | Go to first saved filter (or open New Filter modal if none) |
| `g p` | Go to first project (or Projects root if none) |

**Global actions:**

| Keys | Action |
|------|--------|
| `q` | Open Quick Capture |
| `n` | Open Quick Capture (alias) |
| `/` | Focus the Search sidebar link (stub — full search in Phase 3) |
| `Escape` | Close any open modal / panel |
| `?` | Toggle keyboard shortcuts overlay |

**Task-level** (fires when a `[data-task-id]` element has focus):

| Keys | Action |
|------|--------|
| `Enter` | Open task detail panel |
| `e` | Edit task title inline |
| `c` | Complete task |
| `p 1` | Set priority Urgent |
| `p 2` | Set priority High |
| `p 3` | Set priority Normal |
| `p 4` | Set priority Low |
| `d` | Open due date picker |
| `Backspace` / `Delete` | Delete task (confirm dialog) |

**Row focus model:**
- `TaskRow` gets `tabIndex={0}` and `data-task-id={task.id}`.
- `TaskList` handles `↑` / `↓` arrow keys on the list container to move focus between rows.
- The shortcuts provider resolves the active task via `document.activeElement.closest('[data-task-id]')` before firing task-level actions.

### `ShortcutsOverlay` (`components/layout/ShortcutsOverlay.tsx`)

Full-screen semi-transparent modal (`role="dialog"`, `aria-label="Keyboard shortcuts"`, `aria-modal="true"`). Lists all shortcuts in grouped sections (Navigation / Global Actions / Task Actions) using a Tailwind grid. Closes on `Escape` or `?` again. Focus is trapped inside while open.

---

## Accessibility Audit

Extend `apps/web/__tests__/axe.test.tsx` to scan all new 2C components:

- `FilterBuilderModal` (rendered with mock criteria populated)
- `SavedFiltersSection` in sidebar (with mock filter list)
- `/filters/[id]` page (mock filter + task list)
- `/logbook` page (mock completed tasks in all three date buckets)
- `ShortcutsOverlay`

Gate: zero WCAG AA violations, same as existing axe gate.

---

## Testing

**`packages/core`**
- `filterQuery.test.ts` — round-trip `serializeFilterQuery` / `parseFilterQuery` for all criterion combinations; empty-query detection.

**`packages/db`**
- `savedFilters.test.ts` — create/update/delete CRUD; `useFilteredTasks` for each criterion type individually and in combination; `useLogbook` returns only completed tasks in `updated_at` desc order.

**`apps/web` (Vitest + RTL)**
- `FilterBuilderModal.test.tsx` — renders empty and pre-populated; save disabled with no criteria; submits correct `FilterQuery` shape.
- `KeyboardShortcuts.test.tsx` — navigation chords fire router.push; task shortcuts fire on focused row; `?` opens overlay; `Escape` closes it; no firing inside `<input>`.
- `Logbook.test.tsx` — correct date-bucket grouping; empty state renders.

**`apps/web` (Playwright)**
- Saved filter golden path: create a filter (high priority + this week) → appears in sidebar → navigate to it → task list matches criteria.
- Keyboard shortcut smoke: `q` opens quick capture, `g t` navigates to Today, `?` shows overlay.

**Axe gate** — extended to all 2C components/pages (zero violations).

---

## Out of Scope for 2C

- Full-text search (Phase 3)
- Mobile saved filters, logbook, keyboard shortcuts
- Manual screen reader / ARIA roles audit
- Logbook pagination (200-row limit sufficient for now)
- Emoji picker library (plain text input for filter icon)
- Recurrence end-conditions, light mode, Sentry (Phase 3)
