# Task Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fast, global, keyboard-first task search on web (Ctrl/Cmd+K palette + upgraded `/search` page) and a first-class search screen on mobile, all on one shared query engine.

**Architecture:** Pure helpers (tokenize, highlight, snippet, recents list) live in `packages/core`. `packages/db` builds one parameterised SQL query (AND-of-tokens, ranked, filterable) behind `useTaskSearch(term, filters)`. Web and mobile render results with highlighting. No schema change, so no migration or sync-rule work; recent searches are device-local.

**Tech Stack:** TypeScript, Vitest (core, db, web jsdom, mobile node), React Testing Library, Next.js 14 App Router (`next/navigation`), Expo Router, PowerSync `useQuery`, `expo-secure-store`.

**Spec:** `docs/superpowers/specs/2026-11-28-task-search-design.md`

**Conventions for every task**
- After changing `packages/core` or `packages/db`, run `pnpm --filter @todolist/<pkg> build` before web/mobile tests or typecheck (apps consume `dist/`).
- Web tests: `cd apps/web && npx vitest run <file>`. Core/db: `pnpm --filter @todolist/<pkg> test`.
- Known pre-existing noise to ignore: 2 TS errors in `apps/web/__tests__/CreateLabelModal.test.tsx`; unrelated mobile typecheck errors (`_layout.tsx`, `SubTaskList.tsx`, `SwipeableTaskRow.tsx`, `ProgressRing.tsx`). Compare against these, do not "fix" them here.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- `packages/core` must never import `packages/db`.

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/search/searchText.ts` (new) | `tokenizeQuery`, `splitHighlight`, `makeSnippet` |
| `packages/core/src/search/recent.ts` (new) | `addRecent` (pure recent-list logic) |
| `packages/db/src/queries/search.ts` (modify) | `buildTaskSearch`, `TaskSearchFilters`, new `useTaskSearch` |
| `apps/web/lib/search/recentSearches.ts` (new) | localStorage persistence for recents |
| `apps/web/components/search/Highlight.tsx` (new) | `<mark>` rendering of `splitHighlight` |
| `apps/web/components/tasks/TaskRow.tsx` (modify) | `highlight`, `snippet`, `projectName` props |
| `apps/web/app/search/page.tsx` (rewrite) | filters, URL sync, highlight, recents, states |
| `apps/web/components/search/SearchPalette.tsx` (new) | Ctrl/Cmd+K command palette |
| `apps/web/lib/shortcuts/ShortcutContext.tsx` (modify) | `searchOpen` state |
| `apps/web/components/layout/KeyboardShortcuts.tsx` (modify) | Ctrl/Cmd+K binding |
| `apps/web/components/layout/ShortcutsOverlay.tsx`, `Sidebar.tsx`, `app/ClientLayout.tsx` (modify) | help row, hint, mount palette |
| `apps/mobile/src/lib/recentSearches.ts` (new) | SecureStore persistence for recents |
| `apps/mobile/src/components/search/HighlightedText.tsx`, `SearchResultRow.tsx` (new) | result rendering |
| `apps/mobile/src/app/(tabs)/search.tsx` (new), `(tabs)/_layout.tsx`, `(tabs)/tasks.tsx` (modify) | screen, tab, header entry |

---

### Task 1: Core search helpers

**Files:**
- Create: `packages/core/src/search/searchText.ts`
- Create: `packages/core/src/search/recent.ts`
- Create: `packages/core/src/search/searchText.test.ts`
- Create: `packages/core/src/search/recent.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/search/searchText.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tokenizeQuery, splitHighlight, makeSnippet } from './searchText';

describe('tokenizeQuery', () => {
  it('lowercases, trims and splits on whitespace', () => {
    expect(tokenizeQuery('  Buy   MILK ')).toEqual(['buy', 'milk']);
  });
  it('returns [] for empty or blank input', () => {
    expect(tokenizeQuery('')).toEqual([]);
    expect(tokenizeQuery('   ')).toEqual([]);
  });
  it('caps at 8 tokens', () => {
    expect(tokenizeQuery('a b c d e f g h i j')).toHaveLength(8);
  });
});

describe('splitHighlight', () => {
  it('marks matches case-insensitively and keeps original casing', () => {
    expect(splitHighlight('Buy Milk today', 'milk')).toEqual([
      { text: 'Buy ', match: false },
      { text: 'Milk', match: true },
      { text: ' today', match: false },
    ]);
  });
  it('highlights every token, in any order', () => {
    const segs = splitHighlight('Buy milk', 'milk buy');
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual(['Buy', 'milk']);
  });
  it('merges overlapping and touching matches', () => {
    expect(splitHighlight('abcd', 'ab bc')).toEqual([
      { text: 'abc', match: true },
      { text: 'd', match: false },
    ]);
  });
  it('treats regex characters literally', () => {
    expect(splitHighlight('a.b (c)', '.*')).toEqual([{ text: 'a.b (c)', match: false }]);
    expect(splitHighlight('a.b', '.')).toEqual([
      { text: 'a', match: false },
      { text: '.', match: true },
      { text: 'b', match: false },
    ]);
  });
  it('returns one plain segment for an empty term and [] for empty text', () => {
    expect(splitHighlight('Hello', '')).toEqual([{ text: 'Hello', match: false }]);
    expect(splitHighlight('', 'x')).toEqual([]);
  });
});

describe('makeSnippet', () => {
  it('returns null when there is no description or no match', () => {
    expect(makeSnippet(null, 'milk')).toBeNull();
    expect(makeSnippet('', 'milk')).toBeNull();
    expect(makeSnippet('nothing relevant here', 'milk')).toBeNull();
  });
  it('returns short descriptions whole, without ellipses', () => {
    expect(makeSnippet('Remember the milk', 'milk')).toBe('Remember the milk');
  });
  it('windows long text around the first match with ellipses', () => {
    const text = `${'word '.repeat(40)}milk${' word'.repeat(40)}`;
    const s = makeSnippet(text, 'milk', 80)!;
    expect(s).toContain('milk');
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(82);
  });
  it('collapses whitespace and newlines', () => {
    expect(makeSnippet('line one\n\n  milk   two', 'milk')).toBe('line one milk two');
  });
});
```

`packages/core/src/search/recent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { addRecent } from './recent';

describe('addRecent', () => {
  it('puts the newest term first and trims it', () => {
    expect(addRecent(['a1'], '  milk ')).toEqual(['milk', 'a1']);
  });
  it('de-duplicates case-insensitively, moving the term to the front', () => {
    expect(addRecent(['milk', 'bread'], 'BREAD')).toEqual(['BREAD', 'milk']);
  });
  it('ignores terms shorter than 2 characters', () => {
    expect(addRecent(['milk'], 'a')).toEqual(['milk']);
    expect(addRecent(['milk'], '   ')).toEqual(['milk']);
  });
  it('keeps at most 8 entries', () => {
    const list = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
    const next = addRecent(list, 'new1');
    expect(next).toHaveLength(8);
    expect(next[0]).toBe('new1');
    expect(next).not.toContain('a8');
  });
  it('does not mutate its input', () => {
    const list = ['milk'];
    addRecent(list, 'bread');
    expect(list).toEqual(['milk']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @todolist/core test -- search`
Expected: FAIL (modules `./searchText` and `./recent` not found).

- [ ] **Step 3: Implement**

`packages/core/src/search/searchText.ts`:

```ts
const MAX_TOKENS = 8;

/** Lowercased, whitespace-split search words. Empty input gives []. */
export function tokenizeQuery(term: string): string[] {
  return term.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Split `text` into segments, marking those that match any word of `term`.
 * Case-insensitive; overlapping/touching matches merge. Uses indexOf, never a
 * regex built from user input.
 */
export function splitHighlight(text: string, term: string): HighlightSegment[] {
  if (!text) return [];
  const tokens = tokenizeQuery(term);
  const plain = [{ text, match: false }];
  if (tokens.length === 0) return plain;

  const lower = text.toLowerCase();
  // Some characters change length when lowercased; offsets would then be wrong.
  if (lower.length !== text.length) return plain;

  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(token, from);
      if (i === -1) break;
      ranges.push([i, i + token.length]);
      from = i + token.length;
    }
  }
  if (ranges.length === 0) return plain;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const out: HighlightSegment[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: text.slice(pos, s), match: false });
    out.push({ text: text.slice(s, e), match: true });
    pos = e;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false });
  return out;
}

/**
 * A short window of `description` around the first match of any word in `term`.
 * Returns null when there is nothing to show (no description, or no match).
 */
export function makeSnippet(description: string | null | undefined, term: string, max = 80): string | null {
  if (!description) return null;
  const text = description.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const tokens = tokenizeQuery(term);
  if (tokens.length === 0) return null;

  const lower = text.toLowerCase();
  if (lower.length !== text.length) return null;

  let first = -1;
  for (const token of tokens) {
    const i = lower.indexOf(token);
    if (i !== -1 && (first === -1 || i < first)) first = i;
  }
  if (first === -1) return null;
  if (text.length <= max) return text;

  let start = Math.max(0, first - 20);
  const end = Math.min(text.length, start + max);
  start = Math.max(0, end - max);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
```

`packages/core/src/search/recent.ts`:

```ts
const MAX_RECENT = 8;
const MIN_LENGTH = 2;

/** Pure recent-searches list update: newest first, case-insensitive de-dupe, capped. */
export function addRecent(list: readonly string[], term: string): string[] {
  const t = term.trim();
  if (t.length < MIN_LENGTH) return [...list];
  const lower = t.toLowerCase();
  return [t, ...list.filter((x) => x.toLowerCase() !== lower)].slice(0, MAX_RECENT);
}
```

Append to `packages/core/src/index.ts`:

```ts
export * from './search/searchText';
export * from './search/recent';
```

- [ ] **Step 4: Run to verify pass, then build**

Run: `pnpm --filter @todolist/core test && pnpm --filter @todolist/core build`
Expected: all core tests PASS, tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/search packages/core/src/index.ts
git commit -m "feat(core): add search tokenize, highlight, snippet and recents helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Task search query with filters and ranking

**Files:**
- Modify: `packages/db/src/queries/search.ts`
- Modify: `packages/db/src/queries/search.test.ts`

Callers of `useTaskSearch`: `apps/web/app/search/page.tsx` and `apps/web/components/notes/LinkedTasksPanel.tsx` (via its picker). `filters` defaults to `{}` so the panel keeps its current behaviour (open tasks only).

- [ ] **Step 1: Confirm nothing else uses the constant being removed**

Run: `grep -rn "TASK_SEARCH_QUERY" packages apps --include=*.ts --include=*.tsx | grep -v node_modules | grep -v dist`
Expected: only `search.ts` and `search.test.ts`.

- [ ] **Step 2: Replace the `TASK_SEARCH_QUERY` test block with failing tests**

In `packages/db/src/queries/search.test.ts`, change the import line to
`import { escapeLike, toLikePattern, NOTE_SEARCH_QUERY, buildTaskSearch } from './search';`
and replace the whole `describe('TASK_SEARCH_QUERY', ...)` block with:

```ts
describe('buildTaskSearch', () => {
  it('matches nothing for an empty term', () => {
    expect(buildTaskSearch('').sql).toContain('1 = 0');
    expect(buildTaskSearch('   ').sql).toContain('1 = 0');
  });

  it('requires every word to match title or description (AND, any order)', () => {
    const { sql, params } = buildTaskSearch('buy milk');
    expect(sql.match(/\(title LIKE \? ESCAPE '\\' OR description LIKE \? ESCAPE '\\'\)/g)).toHaveLength(2);
    expect(params.slice(0, 4)).toEqual(['%buy%', '%buy%', '%milk%', '%milk%']);
  });

  it('escapes LIKE wildcards in user input and never interpolates it into SQL', () => {
    const { sql, params } = buildTaskSearch("50%_off'; DROP TABLE tasks");
    expect(params[0]).toBe('%50\\%\\_off\'%');
    expect(sql).not.toContain('DROP');
    expect(sql).not.toContain('50%');
  });

  it('hides completed and cancelled tasks by default', () => {
    expect(buildTaskSearch('x').sql).toContain("status NOT IN ('completed', 'cancelled')");
  });

  it('includes completed tasks when asked, but never cancelled ones', () => {
    const { sql } = buildTaskSearch('x', { includeCompleted: true });
    expect(sql).toContain("status != 'cancelled'");
    expect(sql).not.toContain("NOT IN ('completed'");
  });

  it('filters deleted rows exactly once', () => {
    expect(buildTaskSearch('x').sql.match(/deleted_at IS NULL/g)).toHaveLength(1);
  });

  it('adds project, label and priority filters as bound params in SQL order', () => {
    const { sql, params } = buildTaskSearch('milk', { projectId: 'p1', label: 'home', priority: 2 });
    expect(sql).toContain('project_id = ?');
    expect(sql).toContain('json_each(tasks.labels) WHERE value = ?');
    expect(sql).toContain('priority = ?');
    expect(params).toEqual(['%milk%', '%milk%', 'p1', 'home', 2, 'milk%', '%milk%']);
  });

  it('ranks title-prefix, then all-in-title, then the rest; open before completed', () => {
    const { sql } = buildTaskSearch('milk');
    expect(sql).toMatch(/ORDER BY CASE WHEN title LIKE \? ESCAPE '\\' THEN 0 WHEN title LIKE \? ESCAPE '\\' THEN 1 ELSE 2 END,/);
    expect(sql).toContain("CASE WHEN status = 'completed' THEN 1 ELSE 0 END");
    expect(sql).toContain('updated_at DESC');
  });

  it('selects the columns the UI renders and caps results', () => {
    const { sql } = buildTaskSearch('x');
    for (const col of ['id', 'title', 'description', 'priority', 'due_date', 'project_id', 'status', 'labels', 'updated_at']) {
      expect(sql).toMatch(new RegExp(`SELECT[^]*\\b${col}\\b[^]*FROM tasks`));
    }
    expect(sql).toContain('LIMIT 50');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @todolist/db test -- search`
Expected: FAIL (`buildTaskSearch` is not exported).

- [ ] **Step 4: Implement**

In `packages/db/src/queries/search.ts`: add `import { tokenizeQuery } from '@todolist/core';` at the top, delete the `TASK_SEARCH_QUERY` constant, replace the `TaskSearchRow` type and `useTaskSearch` function, and add the builder. The notes parts of the file stay as they are.

```ts
export interface TaskSearchFilters {
  /** Default false: completed tasks are hidden. Cancelled tasks are never shown. */
  includeCompleted?: boolean;
  projectId?: string;
  label?: string;
  priority?: 1 | 2 | 3 | 4;
}

type SqlParam = string | number;

/**
 * One parameterised query for task search. User input only ever reaches SQL as
 * bound parameters, with LIKE wildcards escaped. Every word must match title or
 * description (any order). Ranking: title starts with the first word, then all
 * words in the title, then description-only; open tasks before completed; newest first.
 */
export function buildTaskSearch(
  term: string,
  filters: TaskSearchFilters = {}
): { sql: string; params: SqlParam[] } {
  const tokens = tokenizeQuery(term);
  const where: string[] = ['deleted_at IS NULL'];
  const params: SqlParam[] = [];

  where.push(
    filters.includeCompleted ? `status != 'cancelled'` : `status NOT IN ('completed', 'cancelled')`
  );

  if (tokens.length === 0) where.push('1 = 0');
  for (const token of tokens) {
    const pattern = toLikePattern(token);
    where.push(`(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')`);
    params.push(pattern, pattern);
  }
  if (filters.projectId) {
    where.push('project_id = ?');
    params.push(filters.projectId);
  }
  if (filters.label) {
    where.push('EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)');
    params.push(filters.label);
  }
  if (filters.priority) {
    where.push('priority = ?');
    params.push(filters.priority);
  }

  let rank = '0';
  if (tokens.length > 0) {
    const allInTitle = tokens.map(() => `title LIKE ? ESCAPE '\\'`).join(' AND ');
    rank = `CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 WHEN ${allInTitle} THEN 1 ELSE 2 END`;
    params.push(`${escapeLike(tokens[0])}%`, ...tokens.map(toLikePattern));
  }

  const sql = `
  SELECT id, title, description, priority, due_date, due_time, project_id, status, sort_order, labels, recurrence_rule, updated_at
  FROM tasks
  WHERE ${where.join('\n    AND ')}
  ORDER BY ${rank}, CASE WHEN status = 'completed' THEN 1 ELSE 0 END, updated_at DESC
  LIMIT 50
`;
  return { sql, params };
}

export type TaskSearchRow = Pick<
  TaskRecord,
  'title' | 'description' | 'priority' | 'due_date' | 'due_time' | 'project_id' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule' | 'updated_at'
> & { id: string };

export function useTaskSearch(term: string, filters: TaskSearchFilters = {}) {
  const { sql, params } = buildTaskSearch(term, filters);
  return useQuery<TaskSearchRow>(sql, params);
}
```

Note: the params array order must match placeholder order in the SQL text: WHERE placeholders first (tokens, project, label, priority), then the ORDER BY placeholders. The code above pushes in that order.

- [ ] **Step 5: Run to verify pass, typecheck, build**

Run: `pnpm --filter @todolist/db test && pnpm --filter @todolist/db build`
Expected: all db tests PASS; tsc exits 0 (if `TaskRecord` lacks `description`/`project_id`/`updated_at`, fix the `Pick` to the real column names in `packages/db/src/schema.ts`).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/search.ts packages/db/src/queries/search.test.ts
git commit -m "feat(db): rank and filter task search (AND words, status/project/label/priority)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Web recent searches store and Highlight component

**Files:**
- Create: `apps/web/lib/search/recentSearches.ts`
- Create: `apps/web/components/search/Highlight.tsx`
- Create: `apps/web/__tests__/searchPrimitives.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/__tests__/searchPrimitives.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { Highlight } from '@/components/search/Highlight';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '@/lib/search/recentSearches';

describe('Highlight', () => {
  it('wraps matches in <mark>', () => {
    const { container } = render(<p><Highlight text="Pay the bill" term="bill" /></p>);
    expect(container.querySelector('mark')?.textContent).toBe('bill');
    expect(container.textContent).toBe('Pay the bill');
  });
  it('renders plain text when there is no term or no match', () => {
    const a = render(<p><Highlight text="Pay the bill" /></p>);
    expect(a.container.querySelector('mark')).toBeNull();
    const b = render(<p><Highlight text="Pay the bill" term="zzz" /></p>);
    expect(b.container.querySelector('mark')).toBeNull();
  });
});

describe('recentSearches', () => {
  beforeEach(() => localStorage.clear());

  it('saves newest first and de-duplicates', () => {
    saveRecentSearch('milk');
    saveRecentSearch('bread');
    saveRecentSearch('MILK');
    expect(getRecentSearches()).toEqual(['MILK', 'bread']);
  });
  it('ignores one-character terms', () => {
    saveRecentSearch('a');
    expect(getRecentSearches()).toEqual([]);
  });
  it('survives corrupt storage', () => {
    localStorage.setItem('todolist.recentSearches', '{not json');
    expect(getRecentSearches()).toEqual([]);
  });
  it('clears', () => {
    saveRecentSearch('milk');
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && npx vitest run __tests__/searchPrimitives.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`apps/web/lib/search/recentSearches.ts`:

```ts
import { addRecent } from '@todolist/core';

const KEY = 'todolist.recentSearches';

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(term: string): string[] {
  const next = addRecent(getRecentSearches(), term);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or unavailable: recents are a convenience, never an error */
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
```

`apps/web/components/search/Highlight.tsx`:

```tsx
import { splitHighlight } from '@todolist/core';

interface Props {
  text: string;
  term?: string;
}

export function Highlight({ text, term }: Props) {
  if (!term) return <>{text}</>;
  const segments = splitHighlight(text, term);
  if (!segments.some((s) => s.match)) return <>{text}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <mark key={i} className="bg-accent/20 text-text-primary rounded-sm px-0.5">{s.text}</mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/web && npx vitest run __tests__/searchPrimitives.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/search apps/web/components/search/Highlight.tsx apps/web/__tests__/searchPrimitives.test.tsx
git commit -m "feat(web): add recent-searches store and match highlighter

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: TaskRow highlight, snippet and project name

**Files:**
- Modify: `apps/web/components/tasks/TaskRow.tsx`
- Modify: `apps/web/__tests__/TaskRow.test.tsx`

- [ ] **Step 1: Add failing tests** (append inside the existing `describe('TaskRow', ...)` block, before its closing `});`)

```tsx
  it('highlights the search term in the title and shows snippet and project', () => {
    const { container } = render(
      <TaskRow
        task={TASK}
        onPress={vi.fn()}
        onComplete={vi.fn()}
        highlight="milk"
        snippet="…remember the milk…"
        projectName="Home"
      />
    );
    expect(container.querySelector('mark')?.textContent).toBe('milk');
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText(/remember the/)).toBeInTheDocument();
  });

  it('renders the plain title when there is no highlight', () => {
    const { container } = render(<TaskRow task={TASK} onPress={vi.fn()} onComplete={vi.fn()} />);
    expect(container.querySelector('mark')).toBeNull();
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && npx vitest run __tests__/TaskRow.test.tsx`
Expected: the first new test FAILS (no `<mark>`); the second passes.

- [ ] **Step 3: Implement** in `apps/web/components/tasks/TaskRow.tsx`

Add import after the `LabelChip` import:

```tsx
import { Highlight } from '@/components/search/Highlight';
```

In `Props`, after `completedAt?: string;` add:

```tsx
  /** Search term to highlight in the title/snippet. */
  highlight?:   string;
  /** Short description excerpt shown under the title (search results). */
  snippet?:     string | null;
  projectName?: string | null;
```

Change the destructuring text `completedAt, tabIndex, draggable = false,` to `completedAt, highlight, snippet, projectName, tabIndex, draggable = false,`.

Replace
`<p className="text-text-primary text-sm truncate">{task.title}</p>`
with:

```tsx
        <p className="text-text-primary text-sm truncate"><Highlight text={task.title} term={highlight} /></p>
        {snippet && (
          <p className="text-xs text-text-muted mt-0.5 truncate"><Highlight text={snippet} term={highlight} /></p>
        )}
        {projectName && <p className="text-xs text-text-muted mt-0.5 truncate">{projectName}</p>}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/web && npx vitest run __tests__/TaskRow.test.tsx __tests__/Logbook.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/tasks/TaskRow.tsx apps/web/__tests__/TaskRow.test.tsx
git commit -m "feat(web): TaskRow supports search highlight, snippet and project name

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Upgrade the `/search` page

**Files:**
- Rewrite: `apps/web/app/search/page.tsx`
- Rewrite: `apps/web/__tests__/SearchPage.test.tsx`

Design notes: `?q=` and `?task=` in the URL are the source of truth for the query and the open detail panel. `useSearchParams` must sit under a `Suspense` boundary or `next build` fails for statically rendered client pages. The notes scope keeps its current behaviour.

- [ ] **Step 1: Write the failing tests** (replace the whole file)

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let search = '';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@powersync/react', () => ({ usePowerSync: () => ({}) }));
vi.mock('@/components/tasks/TaskDetailPanel', () => ({
  TaskDetailPanel: ({ taskId }: { taskId: string | null }) => <div data-testid="panel">{taskId}</div>,
}));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useTaskSearch: vi.fn(),
  useNoteSearch: vi.fn(),
  useProjects: () => ({ data: [{ id: 'p1', name: 'Home' }] }),
  useLabels: () => ({ data: [{ id: 'l1', name: 'urgent', color: '#f00' }] }),
  completeTask: vi.fn(),
  reopenTask: vi.fn(),
}));

import { reopenTask, useNoteSearch, useTaskSearch } from '@todolist/db';
import SearchPage from '@/app/search/page';

const openTask = { id: 't1', title: 'Pay the bill', description: null, priority: 2, due_date: null, status: 'active', project_id: 'p1', labels: '[]', updated_at: '2026-11-25T10:00:00.000Z' };
const doneTask = { ...openTask, id: 't2', title: 'Old bill', status: 'completed' };
const noteRow = {
  id: 'n1', title: 'Budget ideas', body: '', link_title: null, link_excerpt: null, link_image_url: null,
  link_site_name: null, source_url: null, link_status: null, is_archived: 0, is_processed: 0,
  project_id: null, labels: '[]', conflict_of: null, updated_at: '2026-11-25T10:00:00.000Z',
};

const type = (value: string) => fireEvent.change(screen.getByLabelText('Search'), { target: { value } });

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = '';
    localStorage.clear();
    (useTaskSearch as any).mockReturnValue({ data: [openTask] });
    (useNoteSearch as any).mockReturnValue({ data: [noteRow] });
  });

  it('asks for a query before showing anything', () => {
    render(<SearchPage />);
    expect(screen.getByText('Type to search')).toBeInTheDocument();
    expect(screen.queryByText('Pay the bill')).toBeNull();
  });

  it('starts from ?q= in the URL', () => {
    search = 'q=rent';
    render(<SearchPage />);
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('rent');
    expect(useTaskSearch).toHaveBeenLastCalledWith('rent', {});
  });

  it('searches tasks as you type, highlights the match and writes ?q=', () => {
    const { container } = render(<SearchPage />);
    type('bill');
    expect(useTaskSearch).toHaveBeenLastCalledWith('bill', {});
    expect(container.querySelector('mark')?.textContent).toBe('bill');
    expect(replace).toHaveBeenLastCalledWith('/search?q=bill', { scroll: false });
    expect(screen.queryByText('Budget ideas')).toBeNull();
  });

  it('shows recent searches when empty and re-runs one on click', () => {
    localStorage.setItem('todolist.recentSearches', JSON.stringify(['milk']));
    render(<SearchPage />);
    fireEvent.click(screen.getByRole('button', { name: 'milk' }));
    expect(useTaskSearch).toHaveBeenLastCalledWith('milk', {});
    expect(replace).toHaveBeenLastCalledWith('/search?q=milk', { scroll: false });
  });

  it('applies and clears filters', () => {
    render(<SearchPage />);
    type('bill');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(useTaskSearch).toHaveBeenLastCalledWith('bill', { includeCompleted: true });
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'p1' } });
    expect(useTaskSearch).toHaveBeenLastCalledWith('bill', { includeCompleted: true, projectId: 'p1' });
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'urgent' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: '2' } });
    expect(useTaskSearch).toHaveBeenLastCalledWith('bill', { includeCompleted: true, projectId: 'p1', label: 'urgent', priority: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(useTaskSearch).toHaveBeenLastCalledWith('bill', {});
  });

  it('lets you reopen a completed result', () => {
    (useTaskSearch as any).mockReturnValue({ data: [doneTask] });
    render(<SearchPage />);
    type('bill');
    fireEvent.click(screen.getByRole('button', { name: 'Reopen Old bill' }));
    expect(reopenTask).toHaveBeenCalledWith({}, 't2');
  });

  it('explains an empty result and offers to include completed tasks', () => {
    (useTaskSearch as any).mockReturnValue({ data: [] });
    render(<SearchPage />);
    type('zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Include completed' }));
    expect(useTaskSearch).toHaveBeenLastCalledWith('zzz', { includeCompleted: true });
  });

  it('opens the detail panel for ?task= and closing removes it from the URL', () => {
    search = 'q=bill&task=t1';
    render(<SearchPage />);
    expect(screen.getByTestId('panel').textContent).toBe('t1');
  });

  it('opening a result writes ?task= and saves the term as recent', () => {
    render(<SearchPage />);
    type('bill');
    fireEvent.click(screen.getByLabelText('Open task: Pay the bill'));
    expect(replace).toHaveBeenLastCalledWith('/search?q=bill&task=t1', { scroll: false });
    expect(JSON.parse(localStorage.getItem('todolist.recentSearches')!)).toEqual(['bill']);
  });

  it('switches to notes and includes archived only when asked', () => {
    render(<SearchPage />);
    type('budget');
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByText('Budget ideas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Project')).toBeNull();
    fireEvent.click(screen.getByLabelText('Include archived'));
    expect(useNoteSearch).toHaveBeenLastCalledWith('budget', true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/web && npx vitest run __tests__/SearchPage.test.tsx`
Expected: FAIL (page has no filters, URL sync or recents).

- [ ] **Step 3: Implement** (replace `apps/web/app/search/page.tsx`)

```tsx
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePowerSync } from '@powersync/react';
import { makeSnippet } from '@todolist/core';
import {
  completeTask, reopenTask, useLabels, useNoteSearch, useProjects, useTaskSearch,
  type TaskSearchFilters,
} from '@todolist/db';
import { NoteRow } from '@/components/notes/NoteRow';
import { TaskRow, type TaskRowItem } from '@/components/tasks/TaskRow';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '@/lib/search/recentSearches';

type Scope = 'tasks' | 'notes';

const SELECT_CLASS =
  'bg-surface border border-border rounded-lg px-2 py-1 text-sm text-text-secondary focus:outline-none focus:border-accent';

function SearchView() {
  const db = usePowerSync();
  const router = useRouter();
  const params = useSearchParams();
  const urlTerm = params.get('q') ?? '';
  const detailId = params.get('task');

  const [term, setTerm] = useState(urlTerm);
  const [scope, setScope] = useState<Scope>('tasks');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filters, setFilters] = useState<TaskSearchFilters>({});
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => { setRecents(getRecentSearches()); }, []);

  // Follow external URL changes (e.g. the palette's "See all results") without
  // fighting the user's typing: our own writes always equal the trimmed term.
  useEffect(() => {
    if (urlTerm !== term.trim()) setTerm(urlTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTerm]);

  const writeParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  }, [params, router]);

  const changeTerm = (value: string) => {
    setTerm(value);
    writeParams({ q: value.trim() || null });
  };

  const query = term.trim();
  const { data: tasks } = useTaskSearch(query, filters);
  const { data: notes } = useNoteSearch(query, includeArchived);
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const setFilter = <K extends keyof TaskSearchFilters>(key: K, value: TaskSearchFilters[K] | undefined) =>
    setFilters((f) => {
      const next = { ...f };
      if (value === undefined || value === '' || value === false) delete next[key];
      else next[key] = value;
      return next;
    });

  const hasFilters = Object.keys(filters).length > 0;
  const empty = scope === 'tasks' ? tasks.length === 0 : notes.length === 0;

  const openTask = (id: string) => {
    if (query) setRecents(saveRecentSearch(query));
    writeParams({ task: id });
  };
  const closeTask = () => writeParams({ task: null });

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-border space-y-3">
          <h1 className="text-text-primary text-2xl font-bold">Search</h1>
          <input
            autoFocus
            aria-label="Search"
            placeholder="Search tasks and notes…"
            value={term}
            onChange={(e) => changeTerm(e.target.value)}
            className="w-full max-w-xl bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Search scope" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
              {(['tasks', 'notes'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1 ${scope === s ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
                >
                  {s === 'tasks' ? 'Tasks' : 'Notes'}
                </button>
              ))}
            </div>

            {scope === 'tasks' && (
              <>
                <div role="group" aria-label="Task status" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
                  {[{ label: 'Open', all: false }, { label: 'All', all: true }].map(({ label, all }) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={!!filters.includeCompleted === all}
                      onClick={() => setFilter('includeCompleted', all)}
                      className={`px-3 py-1 ${!!filters.includeCompleted === all ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select aria-label="Project" className={SELECT_CLASS} value={filters.projectId ?? ''}
                  onChange={(e) => setFilter('projectId', e.target.value || undefined)}>
                  <option value="">Any project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select aria-label="Label" className={SELECT_CLASS} value={filters.label ?? ''}
                  onChange={(e) => setFilter('label', e.target.value || undefined)}>
                  <option value="">Any label</option>
                  {labels.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
                <select aria-label="Priority" className={SELECT_CLASS} value={filters.priority ?? ''}
                  onChange={(e) => setFilter('priority', e.target.value ? (Number(e.target.value) as 1 | 2 | 3 | 4) : undefined)}>
                  <option value="">Any priority</option>
                  {[1, 2, 3, 4].map((p) => <option key={p} value={p}>P{p}</option>)}
                </select>
                {hasFilters && (
                  <button type="button" onClick={() => setFilters({})} className="text-sm text-accent hover:underline">
                    Clear filters
                  </button>
                )}
              </>
            )}
            {scope === 'notes' && (
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
                Include archived
              </label>
            )}
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {query ? `${scope === 'tasks' ? tasks.length : notes.length} results` : ''}
        </p>

        {query === '' ? (
          recents.length > 0 ? (
            <div className="px-6 py-6 max-w-xl">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent searches</h2>
                <button type="button" className="text-xs text-accent hover:underline"
                  onClick={() => { clearRecentSearches(); setRecents([]); }}>
                  Clear
                </button>
              </div>
              <ul className="flex flex-wrap gap-2" role="list">
                {recents.map((r) => (
                  <li key={r}>
                    <button type="button" onClick={() => changeTerm(r)}
                      className="px-3 py-1 rounded-full border border-border text-sm text-text-secondary hover:bg-surface">
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-text-muted text-sm">Type to search</p>
            </div>
          )
        ) : empty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-text-primary font-semibold">No results</p>
            <p className="text-text-muted text-sm">
              Nothing matches “{query}”{scope === 'tasks' && hasFilters ? ' with these filters' : ''}. Try fewer words.
            </p>
            {scope === 'tasks' && !filters.includeCompleted && (
              <button type="button" onClick={() => setFilter('includeCompleted', true)}
                className="text-sm text-accent hover:underline">
                Include completed
              </button>
            )}
          </div>
        ) : scope === 'tasks' ? (
          <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
            <ul className="max-w-3xl space-y-2" role="list">
              {tasks.map((t) => {
                const done = t.status === 'completed';
                return (
                  <li key={t.id}>
                    <TaskRow
                      task={t as TaskRowItem}
                      onPress={openTask}
                      onComplete={(id) => { void completeTask(db as any, id); }}
                      onReopen={done ? (id) => { void reopenTask(db as any, id); } : undefined}
                      readOnly={done}
                      completedAt={done ? t.updated_at : undefined}
                      highlight={query}
                      snippet={makeSnippet(t.description, query)}
                      projectName={t.project_id ? projectName.get(t.project_id) : null}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
            <ul className="max-w-3xl space-y-2" role="list">
              {notes.map((n) => (
                <li key={n.id}>
                  <NoteRow note={n} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <TaskDetailPanel taskId={detailId} onClose={closeTask} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/web && npx vitest run __tests__/SearchPage.test.tsx __tests__/TaskRow.test.tsx`
Expected: PASS. If the `?task=` close/open URL assertion differs only in param order, fix the page (not the test): the intended order is `q` then `task`.

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | tail -8`
Expected: only the 2 known `CreateLabelModal.test.tsx` errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/search/page.tsx apps/web/__tests__/SearchPage.test.tsx
git commit -m "feat(web): search page with filters, highlight, recents and URL state

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Quick-search palette (Ctrl/Cmd+K)

**Files:**
- Modify: `apps/web/lib/shortcuts/ShortcutContext.tsx`
- Create: `apps/web/components/search/SearchPalette.tsx`
- Create: `apps/web/__tests__/SearchPalette.test.tsx`
- Modify: `apps/web/components/layout/KeyboardShortcuts.tsx`
- Modify: `apps/web/__tests__/KeyboardShortcuts.test.tsx`
- Modify: `apps/web/components/layout/ShortcutsOverlay.tsx`, `apps/web/components/layout/Sidebar.tsx`, `apps/web/app/ClientLayout.tsx`

- [ ] **Step 1: Extend the shortcut context**

In `apps/web/lib/shortcuts/ShortcutContext.tsx`:

Add to `ShortcutContextType`:

```ts
  searchOpen:   boolean;
  openSearch:   () => void;
  closeSearch:  () => void;
  toggleSearch: () => void;
```

In `ShortcutProvider`, after the `shortcutsOpen` state line add `const [searchOpen, setSearchOpen] = useState(false);` and add to the provider `value` object:

```ts
      searchOpen,
      openSearch:   () => setSearchOpen(true),
      closeSearch:  () => setSearchOpen(false),
      toggleSearch: () => setSearchOpen(p => !p),
```

- [ ] **Step 2: Write the failing palette tests**

`apps/web/__tests__/SearchPalette.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();
const closeSearch = vi.fn();
let searchOpen = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/shortcuts/ShortcutContext', () => ({
  useShortcuts: () => ({ searchOpen, closeSearch }),
}));
vi.mock('@todolist/db', async () => ({
  ...(await vi.importActual<any>('@todolist/db')),
  useTaskSearch: vi.fn(),
  useProjects: () => ({ data: [{ id: 'p1', name: 'Home' }] }),
}));

import { useTaskSearch } from '@todolist/db';
import { SearchPalette } from '@/components/search/SearchPalette';

const t1 = { id: 't1', title: 'Buy milk', description: null, priority: 2, due_date: null, status: 'active', project_id: 'p1' };
const t2 = { id: 't2', title: 'Milk the cow', description: 'before the milk runs out', priority: 3, due_date: '2026-12-01', status: 'completed', project_id: null };

const input = () => screen.getByRole('combobox');
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });

describe('SearchPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchOpen = true;
    localStorage.clear();
    (useTaskSearch as any).mockReturnValue({ data: [t1, t2] });
  });

  it('renders nothing when closed', () => {
    searchOpen = false;
    const { container } = render(<SearchPalette />);
    expect(container.firstChild).toBeNull();
  });

  it('focuses the input when open', () => {
    render(<SearchPalette />);
    expect(document.activeElement).toBe(input());
  });

  it('shows recent searches before typing', () => {
    localStorage.setItem('todolist.recentSearches', JSON.stringify(['milk']));
    render(<SearchPalette />);
    fireEvent.click(screen.getByRole('button', { name: 'milk' }));
    expect((input() as HTMLInputElement).value).toBe('milk');
  });

  it('searches including completed tasks and highlights matches', () => {
    render(<SearchPalette />);
    type('milk');
    expect(useTaskSearch).toHaveBeenLastCalledWith('milk', { includeCompleted: true });
    expect(screen.getAllByRole('option').length).toBe(3); // 2 tasks + "See all results"
    expect(document.querySelector('mark')?.textContent).toBe('Milk');
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('Enter opens the active task on /search', () => {
    render(<SearchPalette />);
    type('milk');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/search?q=milk&task=t1');
    expect(closeSearch).toHaveBeenCalled();
  });

  it('arrow keys move the selection (wrapping) and update aria-activedescendant', () => {
    render(<SearchPalette />);
    type('milk');
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(input().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/search?q=milk&task=t2');
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('Ctrl+Enter and the last row go to all results', () => {
    render(<SearchPalette />);
    type('milk');
    fireEvent.keyDown(input(), { key: 'Enter', ctrlKey: true });
    expect(push).toHaveBeenLastCalledWith('/search?q=milk');
    fireEvent.click(screen.getByText(/See all results/));
    expect(push).toHaveBeenLastCalledWith('/search?q=milk');
  });

  it('saves the term as a recent search when a result is opened', () => {
    render(<SearchPalette />);
    type('milk');
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('todolist.recentSearches')!)).toEqual(['milk']);
  });

  it('Escape closes, and Enter with an empty box does nothing', () => {
    render(<SearchPalette />);
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(closeSearch).toHaveBeenCalled();
  });

  it('says when nothing matches', () => {
    (useTaskSearch as any).mockReturnValue({ data: [] });
    render(<SearchPalette />);
    type('zzz');
    expect(screen.getByText(/No tasks match/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd apps/web && npx vitest run __tests__/SearchPalette.test.tsx`
Expected: FAIL (component not found).

- [ ] **Step 4: Implement the palette**

`apps/web/components/search/SearchPalette.tsx`:

```tsx
'use client';

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { makeSnippet } from '@todolist/core';
import { useProjects, useTaskSearch } from '@todolist/db';
import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '@/lib/search/recentSearches';
import { Highlight } from './Highlight';

const PRIORITY_COLOR: Record<number, string> = { 1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF' };
const MAX_RESULTS = 8;

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const query = useDeferredValue(term.trim());

  const { data: tasks } = useTaskSearch(query, { includeCompleted: true });
  const { data: projects } = useProjects();
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const results = tasks.slice(0, MAX_RESULTS);
  const total = results.length + (query ? 1 : 0); // + "See all results"

  useEffect(() => { setRecents(getRecentSearches()); }, []);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const goTask = (id: string) => {
    saveRecentSearch(query);
    onClose();
    router.push(`/search?q=${encodeURIComponent(query)}&task=${id}`);
  };
  const goAll = () => {
    if (!query) return;
    saveRecentSearch(query);
    onClose();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };
  const choose = (i: number) => (i < results.length ? goTask(results[i].id) : goAll());

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (total) setActive((i) => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (total) setActive((i) => (i - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!query) return;
      if (e.metaKey || e.ctrlKey) goAll();
      else if (total) choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // focus stays in the input; options are reached with arrows
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl mx-4 rounded-xl border border-border bg-bg shadow-2xl overflow-hidden">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={total > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={total > 0 ? `${listId}-${active}` : undefined}
          aria-label="Search tasks"
          placeholder="Search tasks…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent px-4 py-3 text-sm text-text-primary border-b border-border focus:outline-none"
        />

        {!query ? (
          recents.length > 0 ? (
            <div className="p-3">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recent</span>
                <button type="button" className="text-xs text-accent hover:underline"
                  onClick={() => { clearRecentSearches(); setRecents([]); }}>
                  Clear
                </button>
              </div>
              <ul className="flex flex-wrap gap-2" role="list">
                {recents.map((r) => (
                  <li key={r}>
                    <button type="button" onClick={() => { setTerm(r); inputRef.current?.focus(); }}
                      className="px-3 py-1 rounded-full border border-border text-sm text-text-secondary hover:bg-surface">
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Type to search your tasks</p>
          )
        ) : (
          <ul id={listId} role="listbox" aria-label="Results" className="max-h-96 overflow-y-auto scrollable py-1">
            {results.length === 0 && (
              <li role="presentation" className="px-4 py-3 text-sm text-text-muted">No tasks match “{query}”</li>
            )}
            {results.map((t, i) => {
              const done = t.status === 'completed';
              const snippet = makeSnippet(t.description, query);
              return (
                <li
                  key={t.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={`flex items-start gap-3 px-4 py-2 cursor-pointer ${i === active ? 'bg-surface' : ''} ${done ? 'opacity-60' : ''}`}
                >
                  <span aria-hidden="true" className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: PRIORITY_COLOR[t.priority] ?? '#9CA3AF' }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text-primary truncate"><Highlight text={t.title} term={query} /></span>
                    {snippet && <span className="block text-xs text-text-muted truncate"><Highlight text={snippet} term={query} /></span>}
                    <span className="block text-xs text-text-muted truncate">
                      {[t.project_id ? projectName.get(t.project_id) : null, t.due_date].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {done && <span className="text-xs text-text-muted flex-shrink-0">Completed</span>}
                </li>
              );
            })}
            <li
              id={`${listId}-${results.length}`}
              role="option"
              aria-selected={active === results.length}
              onMouseEnter={() => setActive(results.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={goAll}
              className={`px-4 py-2 text-sm text-accent cursor-pointer border-t border-border ${active === results.length ? 'bg-surface' : ''}`}
            >
              See all results for “{query}” <span className="text-text-muted text-xs">(Ctrl+Enter)</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

/** Mounted once in ClientLayout. Dialog state resets on every open. */
export function SearchPalette() {
  const { searchOpen, closeSearch } = useShortcuts();
  if (!searchOpen) return null;
  return <PaletteDialog onClose={closeSearch} />;
}
```

- [ ] **Step 5: Run palette tests to verify pass**

Run: `cd apps/web && npx vitest run __tests__/SearchPalette.test.tsx`
Expected: PASS (9 tests). If the "no matches" case also shows the "See all results" row, that is intended (it lets the user search notes on the full page).

- [ ] **Step 6: Wire the shortcut (test first)**

Append to `apps/web/__tests__/KeyboardShortcuts.test.tsx`:

```tsx
describe('KeyboardShortcuts: Cmd/Ctrl+K toggles quick search', () => {
  it('calls toggleSearch even while typing in an input', () => {
    render(<KeyboardShortcuts onOpenQuickCapture={vi.fn()}><input aria-label="x" /></KeyboardShortcuts>);
    const el = document.querySelector('input')!;
    el.focus();
    fireEvent.keyDown(el, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(el, { key: 'K', metaKey: true });
    expect(toggleSearch).toHaveBeenCalledTimes(2);
  });
});
```

At the top of that file change the context mock to
`vi.mock('@/lib/shortcuts/ShortcutContext', () => ({ useShortcuts: () => ({ openShortcuts: vi.fn(), toggleSearch }) }));`
and add `const toggleSearch = vi.fn();` next to `const newNote = vi.fn();`. Also add `toggleSearch.mockClear();` is unnecessary because the new test is the only user, but keep `vi.clearAllMocks()` in existing `beforeEach` as is.

Run: `cd apps/web && npx vitest run __tests__/KeyboardShortcuts.test.tsx`
Expected: FAIL (`toggleSearch` never called).

In `apps/web/components/layout/KeyboardShortcuts.tsx`:
- change `const { openShortcuts } = useShortcuts();` to `const { openShortcuts, toggleSearch } = useShortcuts();`
- add this block after the Cmd+/ block inside `handleKeyDown`:

```ts
      // Cmd+K / Ctrl+K toggles quick search (works while typing, like most palettes)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleSearch();
      }
```
- change the deps array `[onOpenQuickCapture, openShortcuts, newNote]` to `[onOpenQuickCapture, openShortcuts, toggleSearch, newNote]`.

Run again. Expected: PASS.

- [ ] **Step 7: Mount, document and hint**

`apps/web/app/ClientLayout.tsx`: add `import { SearchPalette } from '@/components/search/SearchPalette';` after the `ShortcutsOverlay` import, and add `<SearchPalette />` on the line after `<ShortcutsOverlay />`.

`apps/web/components/layout/ShortcutsOverlay.tsx`: inside the `space-y-4` div, after the "New note" row, add:

```tsx
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-700">Quick search</span>
            <kbd className="px-2 py-1 bg-gray-200 rounded">Cmd+K</kbd>
          </div>
```

`apps/web/components/layout/Sidebar.tsx`: directly after `{label}` (line with `{label}` after the `<span aria-hidden="true">{icon}</span>`), add:

```tsx
                {label === 'Search' && (
                  <kbd className="ml-auto hidden lg:inline text-[10px] text-text-muted border border-border rounded px-1">
                    Ctrl K
                  </kbd>
                )}
```

(The hint says "Ctrl K" on all platforms: Cmd or Ctrl both work, so no platform detection is needed.)

- [ ] **Step 8: Full web check**

Run: `cd apps/web && npx vitest run 2>&1 | tail -8 && npx tsc --noEmit 2>&1 | tail -5`
Expected: all tests pass; only the 2 known `CreateLabelModal.test.tsx` TS errors. Also run `cd apps/web && npx vitest run __tests__/axe.test.tsx` (it renders shared layout pieces); expected PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web
git commit -m "feat(web): Ctrl/Cmd+K quick-search palette

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Mobile search screen

**Files:**
- Create: `apps/mobile/src/lib/recentSearches.ts`
- Create: `apps/mobile/src/components/search/HighlightedText.tsx`
- Create: `apps/mobile/src/components/search/SearchResultRow.tsx`
- Create: `apps/mobile/src/app/(tabs)/search.tsx`
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/src/app/(tabs)/tasks.tsx`
- Modify: `docs/superpowers/specs/2026-11-28-task-search-design.md` (record the two deviations, see Step 6)

Mobile tests run in a `node` environment with no React Native renderer, so the logic worth testing (tokenize, highlight, snippet, recents list, SQL) is already covered in core/db. This task is verified by typecheck of the touched files and a manual device run (Step 5). Say so in the final report.

Recents use `expo-secure-store`, which is already linked in the dev/preview builds, so no native rebuild is needed (AsyncStorage would require a new EAS build). Eight short terms are far below SecureStore's size limit.

- [ ] **Step 1: Recents persistence**

`apps/mobile/src/lib/recentSearches.ts`:

```ts
import * as SecureStore from 'expo-secure-store';
import { addRecent } from '@todolist/core';

const KEY = 'todolist.recentSearches';

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveRecentSearch(term: string): Promise<string[]> {
  const next = addRecent(await getRecentSearches(), term);
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    /* recents are a convenience, never an error */
  }
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: Result rendering**

`apps/mobile/src/components/search/HighlightedText.tsx`:

```tsx
import React from 'react';
import { Text, type TextProps } from 'react-native';
import { splitHighlight } from '@todolist/core';
import { homeColors } from '../home/homeTheme';

interface Props extends TextProps {
  text: string;
  term: string;
}

export function HighlightedText({ text, term, style, ...rest }: Props) {
  const segments = splitHighlight(text, term);
  return (
    <Text style={style} {...rest}>
      {segments.map((s, i) =>
        s.match ? (
          <Text key={i} style={{ backgroundColor: homeColors.accentSoft, color: homeColors.accent, fontWeight: '600' }}>
            {s.text}
          </Text>
        ) : (
          s.text
        )
      )}
    </Text>
  );
}
```

`apps/mobile/src/components/search/SearchResultRow.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { makeSnippet } from '@todolist/core';
import { typography } from '@todolist/ui';
import { homeColors, homePriorityColor } from '../home/homeTheme';
import { HighlightedText } from './HighlightedText';

export interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  due_date: string | null;
  status: string;
  project_id: string | null;
}

interface Props {
  task: SearchResult;
  term: string;
  projectName?: string | null;
  onPress: (id: string) => void;
}

export function SearchResultRow({ task, term, projectName, onPress }: Props) {
  const done = task.status === 'completed';
  const snippet = makeSnippet(task.description, term);
  const meta = [projectName, task.due_date, done ? 'Completed' : null].filter(Boolean).join(' · ');
  const color = homePriorityColor[(task.priority as 1 | 2 | 3 | 4)] ?? homePriorityColor[4];

  return (
    <Pressable
      onPress={() => onPress(task.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open task: ${task.title}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, done && styles.done]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.body}>
        <HighlightedText text={task.title} term={term} style={styles.title} numberOfLines={2} />
        {snippet ? <HighlightedText text={snippet} term={term} style={styles.snippet} numberOfLines={2} /> : null}
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 56,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: homeColors.cardBorder,
  },
  pressed: { backgroundColor: homeColors.sectionBg },
  done: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  body: { flex: 1 },
  title: { ...typography.body, color: homeColors.textPrimary },
  snippet: { ...typography.caption, fontSize: 13, color: homeColors.textSecondary, marginTop: 2 },
  meta: { ...typography.caption, color: homeColors.textMuted, marginTop: 2 },
});
```

- [ ] **Step 3: The screen**

`apps/mobile/src/app/(tabs)/search.tsx`:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useLabels, useProjects, useTaskSearch, type TaskSearchFilters } from '@todolist/db';
import { typography } from '@todolist/ui';
import { homeColors } from '../../components/home/homeTheme';
import { SearchResultRow, type SearchResult } from '../../components/search/SearchResultRow';
import { useTaskActions } from '../../hooks/useTaskActions';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from '../../lib/recentSearches';

const DEBOUNCE_MS = 120;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { handlePress } = useTaskActions();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<TaskSearchFilters>({});
  const [recents, setRecents] = useState<string[]>([]);

  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const { data: rows } = useTaskSearch(term, filters);
  const results = (rows ?? []) as unknown as SearchResult[];

  const projectName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects ?? []) if (p.name) map.set(p.id, p.name);
    return map;
  }, [projects]);

  // Debounce so slower devices don't re-run the query on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setTerm(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [text]);

  // Focus the field whenever the tab is shown, and refresh recents.
  useFocusEffect(
    useCallback(() => {
      void getRecentSearches().then(setRecents);
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }, [])
  );

  const toggle = <K extends keyof TaskSearchFilters>(key: K, value: NonNullable<TaskSearchFilters[K]>) =>
    setFilters((f) => {
      const next = { ...f };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });

  const hasFilters = Object.keys(filters).length > 0;

  const open = useCallback((id: string) => {
    if (term) void saveRecentSearch(term).then(setRecents);
    Keyboard.dismiss();
    handlePress(id);
  }, [term, handlePress]);

  const renderItem = useCallback(({ item }: { item: SearchResult }) => (
    <SearchResultRow
      task={item}
      term={term}
      projectName={item.project_id ? projectName.get(item.project_id) : null}
      onPress={open}
    />
  ), [term, projectName, open]);

  const showRecents = text.trim() === '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.searchBar}>
        <SearchIcon size={18} color={homeColors.textMuted} />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder="Search tasks"
          placeholderTextColor={homeColors.textMuted}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          accessibilityLabel="Search tasks"
          onSubmitEditing={() => { if (term) void saveRecentSearch(term).then(setRecents); }}
        />
        {text.length > 0 && (
          <Pressable
            onPress={() => { setText(''); setTerm(''); inputRef.current?.focus(); }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
          >
            <X size={18} color={homeColors.textMuted} />
          </Pressable>
        )}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
          <Chip label="Include completed" active={!!filters.includeCompleted} onPress={() => toggle('includeCompleted', true)} />
          {[1, 2, 3, 4].map((p) => (
            <Chip key={p} label={`P${p}`} active={filters.priority === p} onPress={() => toggle('priority', p as 1 | 2 | 3 | 4)} />
          ))}
          {(projects ?? []).map((p) => (
            <Chip key={p.id} label={p.name} active={filters.projectId === p.id} onPress={() => toggle('projectId', p.id)} />
          ))}
          {(labels ?? []).map((l) => (
            <Chip key={l.id} label={`#${l.name}`} active={filters.label === l.name} onPress={() => toggle('label', l.name)} />
          ))}
          {hasFilters && <Chip label="Clear" active={false} onPress={() => setFilters({})} />}
        </ScrollView>
      </View>

      {showRecents ? (
        recents.length > 0 ? (
          <View style={styles.recents}>
            <View style={styles.recentsHeader}>
              <Text style={styles.sectionLabel}>Recent searches</Text>
              <Pressable onPress={() => { void clearRecentSearches(); setRecents([]); }} accessibilityRole="button" hitSlop={12}>
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            </View>
            {recents.map((r) => (
              <Pressable key={r} onPress={() => setText(r)} accessibilityRole="button" style={styles.recentRow}>
                <Text style={styles.recentText}>{r}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>Find any task by title or notes.</Text>
        )
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={results.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            term ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsTitle}>No results</Text>
                <Text style={styles.empty}>
                  Nothing matches “{term}”{hasFilters ? ' with these filters' : ''}. Try fewer words.
                </Text>
                {!filters.includeCompleted && (
                  <Pressable onPress={() => toggle('includeCompleted', true)} accessibilityRole="button">
                    <Text style={styles.clear}>Include completed</Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: homeColors.page },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48,
    marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: homeColors.card, borderWidth: 1, borderColor: homeColors.cardBorder,
  },
  input: { flex: 1, ...typography.body, color: homeColors.textPrimary, paddingVertical: 10 },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: homeColors.sectionBg,
  },
  chipActive: { backgroundColor: homeColors.accent },
  chipText: { ...typography.caption, fontSize: 13, color: homeColors.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  recents: { paddingHorizontal: 16, paddingTop: 8 },
  recentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionLabel: { ...typography.caption, color: homeColors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  clear: { ...typography.caption, fontSize: 13, color: homeColors.accent },
  recentRow: { minHeight: 44, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: homeColors.cardBorder },
  recentText: { ...typography.body, color: homeColors.textPrimary },
  emptyContainer: { flex: 1 },
  noResults: { alignItems: 'center', marginTop: 64, gap: 8, paddingHorizontal: 32 },
  noResultsTitle: { ...typography.heading3, color: homeColors.textPrimary },
  empty: { ...typography.body, color: homeColors.textMuted, textAlign: 'center', marginTop: 48 },
});
```

Note: the `.empty` style has `marginTop: 48` for the standalone hint; inside `noResults` the extra margin is harmless but if it looks too loose on device, override with `style={[styles.empty, { marginTop: 0 }]}` at that call site.

- [ ] **Step 4: Entry points**

`apps/mobile/src/app/(tabs)/_layout.tsx`: change the import to `import { CheckSquare, LayoutGrid, Search } from 'lucide-react-native';` and add, after the `tasks` `Tabs.Screen`:

```tsx
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} strokeWidth={2} />,
        }}
      />
```

`apps/mobile/src/app/(tabs)/tasks.tsx`:
- add imports: `import { Pressable } from 'react-native';` (merge into the existing `react-native` import list), `import { useRouter } from 'expo-router';`, `import { Search } from 'lucide-react-native';`
- inside `TasksScreen`, after `const db = usePowerSync();` add `const router = useRouter();`
- in the header `<View style={styles.header}>`, between the `title` and `count` Text elements, add:

```tsx
        <Pressable
          onPress={() => router.navigate('/search')}
          accessibilityRole="button"
          accessibilityLabel="Search tasks"
          hitSlop={12}
          style={styles.searchButton}
        >
          <Search size={20} color={homeColors.textSecondary} />
        </Pressable>
```

- add to `StyleSheet.create`: `searchButton: { padding: 8, marginRight: 8 },`

- [ ] **Step 5: Typecheck and device check**

Run: `pnpm --filter @todolist/core build && pnpm --filter @todolist/db build && cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E "search|recentSearches|SearchResultRow|HighlightedText|\(tabs\)/(tasks|_layout)" || echo "no errors in touched files"`
Expected: `no errors in touched files` (errors in other mobile files are the known pre-existing set).

Manual device check (cannot be automated here; report it as "not run" if skipped): start the app, open the Search tab, confirm: keyboard opens automatically; typing "milk buy" finds "Buy milk" with highlights; filter chips toggle and "Clear" resets; tapping a result opens the task; a completed task appears only with "Include completed"; recents appear when the box is empty and survive an app restart; the search icon in the Tasks header opens the tab.

- [ ] **Step 6: Record deviations in the spec and commit**

In `docs/superpowers/specs/2026-11-28-task-search-design.md` section 3 (Mobile), replace the sentences about the Today header icon and picker sheets with: "A search icon button in the **Tasks** header navigates to it (Today relies on the tab, since its header is a composite component). Filter chips are a single horizontally scrolling row (Include completed, priority, every project, every label) toggled inline, instead of opening picker sheets."

```bash
git add apps/mobile docs/superpowers/specs/2026-11-28-task-search-design.md
git commit -m "feat(mobile): task search screen, tab and Tasks header entry

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run everything and read the output**

```bash
pnpm --filter @todolist/core test
pnpm --filter @todolist/db test
cd apps/web && npx vitest run 2>&1 | tail -8
cd apps/web && npx tsc --noEmit 2>&1 | tail -5
cd apps/web && npx next build 2>&1 | tail -25
```

Expected: core and db tests pass; web tests pass; web `tsc` shows only the 2 known `CreateLabelModal.test.tsx` errors; `next build` succeeds. A "useSearchParams() should be wrapped in a suspense boundary" error means the `Suspense` wrapper in `app/search/page.tsx` is missing. `next build` needs the web `.env.local` (in the main checkout, not the worktree); if it fails only because env vars are missing, report that instead of claiming the build passed.

- [ ] **Step 2: Web manual check** (`pnpm dev`)

Ctrl+K from Today opens the palette with the input focused; typing shows highlighted results; arrows/Enter open the task panel on `/search`; Esc closes and focus returns; Ctrl+Enter goes to `/search?q=…`; reload `/search?q=milk` keeps the query; "All" shows completed tasks with a working Reopen; the shortcuts overlay (Ctrl+/) lists Quick search.

- [ ] **Step 3: Report**

State plainly which of Steps 1–2 and the mobile device check were run and which were not, with the actual output for those that were.

---

## Self-Review (spec coverage)

| Spec requirement | Task |
|---|---|
| `tokenizeQuery`, `splitHighlight`, `makeSnippet`, `addRecent` in core | 1 |
| `useTaskSearch(term, filters)`: AND tokens, ranking, status/project/label/priority, bound params, `deleted_at` once | 2 |
| Recents device-local (web localStorage, mobile SecureStore) | 3, 7 |
| Highlight + snippet + project in web rows | 3, 4 |
| `/search` URL sync, filters, highlight, recents, empty states, Reopen, `?task=` panel | 5 |
| Ctrl/Cmd+K palette: combobox a11y, arrows/Enter/Esc/Ctrl+Enter, recents, see-all, focus return | 6 |
| Shortcuts help row, sidebar hint | 6 |
| Mobile screen, tab, Tasks header entry, debounce, filters, recents, states | 7 |
| Verification (typecheck, tests, build) with honest reporting | 8 |

Deviations from the spec are recorded in Task 7, Step 6 (Tasks-header-only icon, inline filter chips instead of picker sheets). Mobile UI is verified by typecheck and a device run, not automated tests, because the mobile test environment has no React Native renderer.
