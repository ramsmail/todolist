# Task Search — Design

**Date:** 2026-11-28
**Status:** Approved in brainstorming
**Scope:** Web + mobile. No schema change (no migration, no sync-rule change).

## Context and goal

Web has a basic `/search` page: one substring match on `title`/`description`, completed
tasks excluded, no highlighting or filters. Mobile has no search. Goal: fast, global,
keyboard-first task search on web and a first-class search screen on mobile, sharing one
query engine.

Out of scope: FTS5/typo tolerance, note search on mobile (no mobile notes UI yet),
saved searches, search operators (`project:x`), server-side search.

## 1. Shared logic

### `packages/core` (pure, no DB/React)

- `tokenizeQuery(term): string[]` — trim, split on whitespace, drop empties, lowercase,
  cap at 8 tokens.
- `splitHighlight(text, term): { text: string; match: boolean }[]` — case-insensitive,
  splits `text` into segments, marking segments matching any token. Overlapping matches
  merge. Empty term returns one non-match segment. Must not use unescaped regex input.

### `packages/db` (`queries/search.ts`)

`useTaskSearch(term, filters)` replaces the current two-argument form
(`useTaskSearch(term)` callers keep working because `filters` defaults to `{}`).

```ts
interface TaskSearchFilters {
  includeCompleted?: boolean;   // default false: excludes completed + cancelled
  projectId?: string | null;    // undefined = any
  label?: string;               // matches the tasks.labels JSON array
  priority?: 1 | 2 | 3 | 4;
}
```

- **Matching:** every token must match `title` OR `description` (`LIKE ? ESCAPE '\'`),
  so word order does not matter. Reuse `escapeLike`.
- **Ranking:** `ORDER BY` title-starts-with-first-token (0), title-contains-all-tokens
  (1), description-only (2), then open before completed, then `updated_at DESC`. `LIMIT 50`.
- **Snippet:** the query returns `description`; a pure helper `makeSnippet(description,
  term, max=80)` in core returns a window around the first match with ellipses.
- **Query building:** SQL is assembled from fixed fragments; all user input goes through
  bound parameters (never string-interpolated). Label filter uses the same JSON match
  pattern as existing label queries (verify against `queries/labels.ts` before writing).
- No manual `deleted_at` filter beyond what existing task queries already do
  (`deleted_at IS NULL` is already used by `TASK_SEARCH_QUERY`; keep that line unchanged).
- Row type `TaskSearchRow` gains `description` and `project_id`.

### Recent searches (device-local)

Interface `RecentSearchStore { list(): string[]; add(term): void; clear(): void }`,
max 8, de-duplicated case-insensitively, most recent first, terms shorter than 2
characters ignored. Pure list logic in `packages/core` (`addRecent(list, term)`);
persistence is per platform (web `localStorage`, mobile `AsyncStorage`). Not synced, so
no schema or sync-rule involvement. A term is saved when the user opens a result or
presses Enter, not on every keystroke.

## 2. Web

### Quick search palette (`components/search/SearchPalette.tsx`)

- Opened by **Ctrl/Cmd+K** from anywhere (registered in `KeyboardShortcuts.tsx`,
  `preventDefault`, works even when an input is focused; toggles closed on repeat).
  Added to the shortcuts help list.
- Modal dialog (`role="dialog"`, `aria-modal`, focus trap, returns focus on close).
  Combobox pattern: input + `role="listbox"` results, `aria-activedescendant`.
- Empty input: recent searches (with "Clear"). Typed input: top 8 results live (local
  SQLite, so no debounce beyond React's own batching; use `useDeferredValue`).
- Keys: ↑/↓ move, Enter opens the task in `TaskDetailPanel`'s host or navigates, Esc
  closes, Cmd/Ctrl+Enter or the "See all results" row goes to `/search?q=<term>`.
- Rows: highlighted title, snippet if the match is in the description, project name,
  due date, priority dot; completed results are muted with a "Completed" tag.
- Opening a task: `TaskDetailPanel` is currently mounted per page, with page-local
  state. The palette therefore navigates to `/search?q=<term>&task=<id>`, and the
  `/search` page opens the panel for the `task` param (and removes it on close). This
  keeps the palette independent of any page and needs no new global context.

### `/search` page upgrade

- Query synced to the URL (`?q=`), initialised from it; uses `router.replace`.
- Filter chips: Open | All (includes completed), project select, label select,
  priority. Active filters are visible and clearable; "Clear filters" when any set.
- Highlighted titles and snippets, completed rows muted with the existing **Reopen**
  button (`TaskRow` `onReopen`).
- States: empty query → recent searches; no results → "No tasks match “x”" with a hint
  to remove filters or include completed (button); results count in an `aria-live`
  region.
- Notes scope behaviour unchanged.

### Sidebar

Search entry shows a `⌘K` / `Ctrl K` hint (platform-detected, hidden on small widths).

## 3. Mobile

- **Search tab** added to `(tabs)/_layout.tsx` (`Search` icon from `lucide-react-native`),
  screen `(tabs)/search.tsx`. A search icon button in the Today and Tasks headers
  navigates to it (`router.navigate`).
- **Screen:** auto-focused `TextInput` with clear (×) button, `returnKeyType="search"`,
  `autoCorrect={false}`. Horizontally scrolling filter chips (Open/All, priority, project,
  label) opening the existing picker-sheet patterns where a choice list is needed.
- States: empty → recent searches (tap to run, long-press or "Clear" to remove);
  typed with results → `FlatList` of rows (highlighted title, snippet, project, due date),
  `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`;
  no results → message with "Include completed" action when relevant.
- Tap a result → `task/[id]`, saves the term to recents.
- Uses `splitHighlight` for `<Text>` nesting; minimum 44pt touch targets; respects
  existing `homeColors` theme.
- Search state is local to the screen; debounce 120 ms on the input before querying to
  avoid re-running on every keystroke on slower devices.

## 4. Security and reliability

- All reads go through `packages/db` local SQLite; no direct Supabase calls (per
  CLAUDE.md). RLS and sync rules already cover `tasks`; nothing new is synced.
- User input is only ever a bound parameter. `%`, `_`, `\` are escaped via `escapeLike`.
- Highlight/snippet helpers never build regexes from raw input.
- `packages/core` must not import `packages/db`.
- Silent-failure guard: tests assert that the generated SQL contains the
  `deleted_at IS NULL` clause once and that each filter changes the bound params.

## 5. Testing

- `packages/core`: `tokenizeQuery`, `splitHighlight` (case, overlap, special chars,
  empty), `makeSnippet`, `addRecent` (dedupe, cap, short terms).
- `packages/db`: SQL/params for tokens (AND semantics), each filter, ranking order
  clause, `%`/`_` escaping, limit.
- Web: palette (opens on Ctrl/Cmd+K, arrow/Enter/Esc flow, recents, see-all link, focus
  return); `/search` page (URL sync, filters, highlight, Reopen on completed row, empty
  states).
- Mobile: screen test if the Jest/RTL-native setup exists in `apps/mobile`; otherwise
  extract the screen's logic into a hook tested in isolation and verify the UI on a
  device build (state this explicitly in the final report).
- Done = typecheck + test output shown for core, db, web; mobile typecheck limited to
  the files touched (the repo has unrelated pre-existing mobile type errors).

## 6. Build order

core helpers → db query → web page upgrade → web palette + shortcut → mobile screen →
mobile entry points.
