# Phase 2B — Labels & Recurrence (Shared Core + DB + Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add labels (name-based, auto-created, colored, filterable) and recurring tasks (presets + simple custom, snapshot-on-complete) to the shared packages and the Next.js web app.

**Architecture:** A dependency-light recurrence engine and NLP recurrence parsing live in `packages/core`. The PowerSync client schema gains a `labels` table; `packages/db` gets label CRUD and a recurrence-aware `completeTask`. The web app adds a sidebar Labels section, a Manage Labels page, a per-label view, a recurrence picker, and label chips. Mobile is a separate follow-on plan that consumes these same packages.

**Tech Stack:** TypeScript, date-fns, chrono-node, PowerSync (`@powersync/common` / `@powersync/react`), Next.js 14 App Router, Vitest + React Testing Library, Playwright.

**Companion spec:** `docs/design/specs/2026-06-23-phase2b-labels-recurrence-design.md`

---

## File Structure

**`packages/core`**
- Create `src/recurrence/recurrence.ts` — rule type, `parseRule`, `serializeRule`, `describeRule`, `computeNext`, `firstOccurrence`.
- Create `src/recurrence/recurrence.test.ts` — engine tests.
- Modify `src/index.ts` — export the recurrence module.
- Modify `src/nlp/parser.ts` — recurrence extraction + due-date inference; add `recurrenceRule` to `NlpParseResult`.
- Modify `src/nlp/parser.test.ts` — update the full-shape assertion; add recurrence cases.

**`packages/db`**
- Modify `src/schema.ts` — add `labels` table; export `LabelRecord`.
- Create `src/queries/labelUtils.ts` — pure helpers (`pickLabelColor`, `renameInLabelArray`, `removeFromLabelArray`).
- Create `src/queries/labelUtils.test.ts` — unit tests for the pure helpers.
- Create `src/queries/labels.ts` — label hooks + CRUD.
- Modify `src/queries/tasks.ts` — `createTask` recurrence; `updateTaskRecurrence`; recurrence-aware `completeTask`; add `labels`/`recurrence_rule` to read selects.
- Modify `src/index.ts` — export labels + `LabelRecord`.
- Modify `package.json` — add `@todolist/core` dep, vitest dev dep, `test` script.
- Create `vitest.config.ts`.

**`apps/web`**
- Create `components/tasks/LabelChip.tsx` + `__tests__/LabelChip.test.tsx`.
- Create `components/tasks/RecurrencePicker.tsx` + `__tests__/RecurrencePicker.test.tsx`.
- Modify `components/tasks/TaskRow.tsx` — label chips + recurring badge.
- Modify `components/tasks/TaskDetailPanel.tsx` — Repeat row.
- Modify `components/tasks/QuickCaptureModal.tsx` — `ensureLabels` + recurrence.
- Modify `components/layout/Sidebar.tsx` — Labels section.
- Create `app/labels/[name]/page.tsx` — per-label view.
- Create `app/labels/page.tsx` — Manage Labels page.
- Modify `__tests__/axe.test.tsx` — cover new views.
- Create `e2e/labels-recurrence.test.ts` — Playwright flows.

---

## PHASE A — Shared Core

### Task 1: Recurrence rule type + parse/serialize

**Files:**
- Create: `packages/core/src/recurrence/recurrence.ts`
- Test: `packages/core/src/recurrence/recurrence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/src/recurrence/recurrence.test.ts
import { describe, it, expect } from 'vitest';
import { parseRule, serializeRule } from './recurrence';

describe('parseRule / serializeRule', () => {
  it('round-trips daily', () => {
    expect(parseRule('FREQ=DAILY')).toEqual({ freq: 'daily', interval: 1 });
    expect(serializeRule({ freq: 'daily', interval: 1 })).toBe('FREQ=DAILY');
  });

  it('round-trips every 2 weeks on Mon/Wed in canonical order', () => {
    const rule = parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,MO');
    expect(rule).toEqual({ freq: 'weekly', interval: 2, byDay: ['MO', 'WE'] });
    expect(serializeRule(rule!)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE');
  });

  it('omits INTERVAL when 1', () => {
    expect(serializeRule({ freq: 'monthly', interval: 1 })).toBe('FREQ=MONTHLY');
  });

  it('returns null for empty or unknown freq', () => {
    expect(parseRule('')).toBeNull();
    expect(parseRule('FREQ=HOURLY')).toBeNull();
    expect(parseRule('INTERVAL=2')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/core exec vitest run src/recurrence/recurrence.test.ts`
Expected: FAIL — `Failed to resolve import './recurrence'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/core/src/recurrence/recurrence.ts
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: Freq;
  interval: number;        // >= 1
  byDay?: Weekday[];       // weekly only, stored canonical Mon→Sun
}

export const WD_ORDER: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const FREQ_FROM: Record<string, Freq> = {
  DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly',
};

export function parseRule(s: string): RecurrenceRule | null {
  if (!s) return null;
  const parts: Record<string, string> = {};
  for (const seg of s.split(';')) {
    const [k, v] = seg.split('=');
    if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
  }
  const freq = FREQ_FROM[parts.FREQ];
  if (!freq) return null;
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1;
  if (!Number.isInteger(interval) || interval < 1) return null;
  const rule: RecurrenceRule = { freq, interval };
  if (parts.BYDAY) {
    const given = parts.BYDAY.split(',');
    const days = WD_ORDER.filter((d) => given.includes(d));
    if (days.length) rule.byDay = days;
  }
  return rule;
}

export function serializeRule(r: RecurrenceRule): string {
  const out = [`FREQ=${r.freq.toUpperCase()}`];
  if (r.interval > 1) out.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'weekly' && r.byDay && r.byDay.length) {
    out.push(`BYDAY=${WD_ORDER.filter((d) => r.byDay!.includes(d)).join(',')}`);
  }
  return out.join(';');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/core exec vitest run src/recurrence/recurrence.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/recurrence/recurrence.ts packages/core/src/recurrence/recurrence.test.ts
git commit -m "feat(core): recurrence rule parse/serialize"
```

---

### Task 2: describeRule (human label for UI)

**Files:**
- Modify: `packages/core/src/recurrence/recurrence.ts`
- Test: `packages/core/src/recurrence/recurrence.test.ts`

- [ ] **Step 1: Write the failing test (append to the file)**

```ts
import { describeRule } from './recurrence';

describe('describeRule', () => {
  it('describes presets', () => {
    expect(describeRule({ freq: 'daily', interval: 1 })).toBe('Every day');
    expect(describeRule({ freq: 'monthly', interval: 1 })).toBe('Every month');
  });
  it('describes weekdays preset', () => {
    expect(describeRule({ freq: 'weekly', interval: 1, byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] }))
      .toBe('Every weekday');
  });
  it('describes interval + weekdays', () => {
    expect(describeRule({ freq: 'weekly', interval: 2, byDay: ['MO', 'WE'] }))
      .toBe('Every 2 weeks on Mon, Wed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/core exec vitest run src/recurrence/recurrence.test.ts`
Expected: FAIL — `describeRule is not a function`.

- [ ] **Step 3: Write minimal implementation (append to recurrence.ts)**

```ts
const WD_LABEL: Record<Weekday, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};
const UNIT: Record<Freq, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

export function describeRule(r: RecurrenceRule): string {
  const isWeekdays =
    r.freq === 'weekly' &&
    r.byDay?.length === 5 &&
    (['MO', 'TU', 'WE', 'TH', 'FR'] as Weekday[]).every((d) => r.byDay!.includes(d));
  if (isWeekdays && r.interval === 1) return 'Every weekday';

  const base = r.interval === 1 ? `Every ${UNIT[r.freq]}` : `Every ${r.interval} ${UNIT[r.freq]}s`;
  if (r.freq === 'weekly' && r.byDay && r.byDay.length) {
    const days = WD_ORDER.filter((d) => r.byDay!.includes(d)).map((d) => WD_LABEL[d]).join(', ');
    return `${base} on ${days}`;
  }
  return base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/core exec vitest run src/recurrence/recurrence.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/recurrence/recurrence.ts packages/core/src/recurrence/recurrence.test.ts
git commit -m "feat(core): describeRule human labels"
```

---

### Task 3: computeNext + firstOccurrence

**Files:**
- Modify: `packages/core/src/recurrence/recurrence.ts`
- Test: `packages/core/src/recurrence/recurrence.test.ts`

- [ ] **Step 1: Write the failing test (append)**

```ts
import { computeNext, firstOccurrence } from './recurrence';

describe('computeNext (anchored to scheduled due date)', () => {
  it('daily + interval', () => {
    expect(computeNext({ freq: 'daily', interval: 1 }, '2026-06-23', '2026-06-23')).toBe('2026-06-24');
    expect(computeNext({ freq: 'daily', interval: 3 }, '2026-06-23', '2026-06-23')).toBe('2026-06-26');
  });

  it('weekly with byDay finds next day in same week', () => {
    // 2026-06-22 is a Monday; rule Mon/Wed → next is Wed 2026-06-24
    expect(computeNext({ freq: 'weekly', interval: 1, byDay: ['MO', 'WE'] }, '2026-06-22', '2026-06-22'))
      .toBe('2026-06-24');
  });

  it('weekly jumps interval weeks after last day in set', () => {
    // From Wed 2026-06-24 with Mon/Wed, interval 2 → Mon two weeks later 2026-07-06
    expect(computeNext({ freq: 'weekly', interval: 2, byDay: ['MO', 'WE'] }, '2026-06-24', '2026-06-22'))
      .toBe('2026-07-06');
  });

  it('weekly without byDay uses anchor weekday', () => {
    // anchor Mon 2026-06-22, weekly → next Mon
    expect(computeNext({ freq: 'weekly', interval: 1 }, '2026-06-22', '2026-06-22')).toBe('2026-06-29');
  });

  it('monthly clamps to last day for short months', () => {
    // anchor on the 31st; from Jan 31 → Feb 28 (2026 not leap)
    expect(computeNext({ freq: 'monthly', interval: 1 }, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    // next from clamped Feb 28 restores to Mar 31 via anchor
    expect(computeNext({ freq: 'monthly', interval: 1 }, '2026-02-28', '2026-01-31')).toBe('2026-03-31');
  });

  it('yearly handles Feb 29 anchor in non-leap years', () => {
    expect(computeNext({ freq: 'yearly', interval: 1 }, '2024-02-29', '2024-02-29')).toBe('2025-02-28');
  });
});

describe('firstOccurrence (on or after)', () => {
  it('returns today for daily/monthly/yearly', () => {
    const d = new Date('2026-06-23T10:00:00');
    expect(firstOccurrence({ freq: 'daily', interval: 1 }, d)).toBe('2026-06-23');
  });
  it('returns next matching weekday for weekly byDay', () => {
    // 2026-06-23 is a Tuesday; rule Mon → next Mon 2026-06-29
    const d = new Date('2026-06-23T10:00:00');
    expect(firstOccurrence({ freq: 'weekly', interval: 1, byDay: ['MO'] }, d)).toBe('2026-06-29');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/core exec vitest run src/recurrence/recurrence.test.ts`
Expected: FAIL — `computeNext is not a function`.

- [ ] **Step 3: Write minimal implementation (append)**

```ts
import { addDays, addWeeks, getDay, parseISO, format } from 'date-fns';

// date-fns getDay: 0=Sun..6=Sat → our index 0=Mon..6=Sun
const dayToIdx = (d: number) => (d + 6) % 7;

function ymd(year: number, month0: number, day: number): Date {
  const last = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, last));
}

export function computeNext(r: RecurrenceRule, fromDate: string, anchor: string): string {
  const from = parseISO(fromDate);
  switch (r.freq) {
    case 'daily':
      return format(addDays(from, r.interval), 'yyyy-MM-dd');

    case 'weekly': {
      const days =
        r.byDay && r.byDay.length ? r.byDay : [WD_ORDER[dayToIdx(getDay(parseISO(anchor)))]];
      const idxs = days.map((d) => WD_ORDER.indexOf(d)).sort((a, b) => a - b);
      const fromIdx = dayToIdx(getDay(from));
      const nextSame = idxs.find((i) => i > fromIdx);
      if (nextSame !== undefined) {
        return format(addDays(from, nextSame - fromIdx), 'yyyy-MM-dd');
      }
      const mondayOfWeek = addDays(from, -fromIdx);
      const target = addWeeks(mondayOfWeek, r.interval);
      return format(addDays(target, idxs[0]), 'yyyy-MM-dd');
    }

    case 'monthly': {
      const targetDay = parseISO(anchor).getDate();
      const total = from.getFullYear() * 12 + from.getMonth() + r.interval;
      return format(ymd(Math.floor(total / 12), total % 12, targetDay), 'yyyy-MM-dd');
    }

    case 'yearly': {
      const a = parseISO(anchor);
      return format(ymd(from.getFullYear() + r.interval, a.getMonth(), a.getDate()), 'yyyy-MM-dd');
    }
  }
}

export function firstOccurrence(r: RecurrenceRule, from: Date): string {
  if (r.freq === 'weekly' && r.byDay && r.byDay.length) {
    const idxs = r.byDay.map((d) => WD_ORDER.indexOf(d)).sort((a, b) => a - b);
    const fromIdx = dayToIdx(getDay(from));
    const same = idxs.find((i) => i >= fromIdx);
    const targetIdx = same !== undefined ? same : idxs[0] + 7;
    return format(addDays(from, targetIdx - fromIdx), 'yyyy-MM-dd');
  }
  return format(from, 'yyyy-MM-dd');
}
```

Move the `import { addDays, ... } from 'date-fns';` line to the top of the file with the other imports (do not leave it mid-file).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/core exec vitest run src/recurrence/recurrence.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/recurrence/recurrence.ts packages/core/src/recurrence/recurrence.test.ts
git commit -m "feat(core): computeNext + firstOccurrence date math"
```

---

### Task 4: Export recurrence from core index

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add the export**

```ts
// packages/core/src/index.ts
export * from './types';
export * from './nlp/parser';
export * from './recurrence/recurrence';
```

- [ ] **Step 2: Verify the package type-checks / builds**

Run: `pnpm --filter @todolist/core build`
Expected: `tsc` exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export recurrence module"
```

---

### Task 5: NLP recurrence parsing + due-date inference

**Files:**
- Modify: `packages/core/src/nlp/parser.ts`
- Modify: `packages/core/src/nlp/parser.test.ts`

- [ ] **Step 1: Update existing test + add recurrence cases**

In `parser.test.ts`, the first test uses `toEqual` with the full shape. Add `recurrenceRule: null` to that expected object:

```ts
  it('returns plain title with defaults when input has no tokens', () => {
    expect(parseTaskInput('Buy milk', { now })).toEqual({
      title: 'Buy milk',
      priority: 4,
      projectSlug: null,
      labels: [],
      dueDate: null,
      dueTime: null,
      recurrenceRule: null,
    });
  });
```

Append new cases at the end of the `describe` block (note `now` = `2026-06-20T10:00:00.000Z`, a Saturday):

```ts
  it('parses "every day" into a daily rule and infers due date = today', () => {
    expect(parseTaskInput('Water plants every day', { now })).toMatchObject({
      title: 'Water plants',
      recurrenceRule: 'FREQ=DAILY',
      dueDate: '2026-06-20',
    });
  });

  it('parses "every weekday"', () => {
    expect(parseTaskInput('Stand-up every weekday', { now })).toMatchObject({
      title: 'Stand-up',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    });
  });

  it('parses "every monday, wednesday" in canonical order', () => {
    expect(parseTaskInput('Gym every monday, wednesday', { now })).toMatchObject({
      title: 'Gym',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    });
  });

  it('parses "every 2 weeks"', () => {
    expect(parseTaskInput('Pay cleaner every 2 weeks', { now })).toMatchObject({
      title: 'Pay cleaner',
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2',
    });
  });

  it('keeps explicit due date alongside recurrence', () => {
    expect(parseTaskInput('Report every month', { now })).toMatchObject({
      recurrenceRule: 'FREQ=MONTHLY',
      dueDate: '2026-06-20',
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/core exec vitest run src/nlp/parser.test.ts`
Expected: FAIL — recurrence cases fail and the `toEqual` case fails on the missing `recurrenceRule` key.

- [ ] **Step 3: Implement recurrence extraction in parser.ts**

Add the import at the top:

```ts
import { parseRule, firstOccurrence, type Weekday } from '../recurrence/recurrence';
```

Add `recurrenceRule` to the result interface:

```ts
export interface NlpParseResult {
  title: string;
  priority: Priority;
  projectSlug: string | null;
  labels: string[];
  dueDate: string | null;
  dueTime: string | null;
  recurrenceRule: string | null;
}
```

Add this extractor function above `parseTaskInput`:

```ts
const DOW: Record<string, Weekday> = {
  monday: 'MO', mon: 'MO', tuesday: 'TU', tue: 'TU', tues: 'TU',
  wednesday: 'WE', wed: 'WE', thursday: 'TH', thu: 'TH', thurs: 'TH',
  friday: 'FR', fri: 'FR', saturday: 'SA', sat: 'SA', sunday: 'SU', sun: 'SU',
};
const WD_CANON: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function extractRecurrence(input: string): { rule: string | null; rest: string } {
  let text = input;

  const everyN = text.match(/\bevery\s+(\d+)\s+(days?|weeks?|months?|years?)\b/i);
  if (everyN) {
    const n = parseInt(everyN[1], 10);
    const u = everyN[2].toLowerCase();
    const freq = u.startsWith('day') ? 'DAILY' : u.startsWith('week') ? 'WEEKLY'
      : u.startsWith('month') ? 'MONTHLY' : 'YEARLY';
    const rule = `FREQ=${freq}` + (n > 1 ? `;INTERVAL=${n}` : '');
    return { rule, rest: text.replace(everyN[0], ' ') };
  }

  const weekdayRe = /\b(every\s+weekday|weekdays)\b/i;
  if (weekdayRe.test(text)) {
    return { rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', rest: text.replace(weekdayRe, ' ') };
  }

  const dowRe = /\bevery\s+((?:mon|tue|tues|wed|thu|thurs|fri|sat|sun)[a-z]*(?:\s*(?:,|and)\s*(?:mon|tue|tues|wed|thu|thurs|fri|sat|sun)[a-z]*)*)\b/i;
  const dow = text.match(dowRe);
  if (dow) {
    const tokens = dow[1].toLowerCase().split(/\s*(?:,|and)\s*/).map((t) => t.trim()).filter(Boolean);
    const days = tokens.map((t) => DOW[t]).filter(Boolean) as Weekday[];
    if (days.length) {
      const ordered = WD_CANON.filter((d) => days.includes(d));
      return { rule: `FREQ=WEEKLY;BYDAY=${ordered.join(',')}`, rest: text.replace(dow[0], ' ') };
    }
  }

  const simple: Array<[RegExp, string]> = [
    [/\b(daily|every\s+day)\b/i, 'FREQ=DAILY'],
    [/\b(weekly|every\s+week)\b/i, 'FREQ=WEEKLY'],
    [/\b(monthly|every\s+month)\b/i, 'FREQ=MONTHLY'],
    [/\b(yearly|annually|every\s+year)\b/i, 'FREQ=YEARLY'],
  ];
  for (const [re, rule] of simple) {
    if (re.test(text)) return { rule, rest: text.replace(re, ' ') };
  }
  return { rule: null, rest: text };
}
```

In `parseTaskInput`, after the labels extraction block and **before** the chrono date parse, add:

```ts
  // Extract recurrence before chrono so "every monday" isn't read as a one-off date
  const rec = extractRecurrence(text);
  const recurrenceRule = rec.rule;
  text = rec.rest;
```

After the chrono block computes `dueDate`/`dueTime`, add due-date inference before building the title:

```ts
  // If recurring with no explicit date, anchor to the first occurrence on/after now
  if (recurrenceRule && !dueDate) {
    const parsedRule = parseRule(recurrenceRule);
    if (parsedRule) dueDate = firstOccurrence(parsedRule, now);
  }
```

Finally include `recurrenceRule` in the returned object:

```ts
  return { title, priority, projectSlug, labels, dueDate, dueTime, recurrenceRule };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/core exec vitest run src/nlp/parser.test.ts`
Expected: PASS (existing + new cases).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/nlp/parser.ts packages/core/src/nlp/parser.test.ts
git commit -m "feat(core): NLP recurrence parsing + due-date inference"
```

---

## PHASE B — Shared DB

### Task 6: Add labels table to PowerSync schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add the table + types**

Add a `labels` table next to `projects`:

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
```

Update the schema construction and exported types:

```ts
export const AppSchema = new Schema({ tasks, projects, labels });

export type Database      = (typeof AppSchema)['types'];
export type TaskRecord    = Database['tasks'];
export type ProjectRecord = Database['projects'];
export type LabelRecord   = Database['labels'];
```

- [ ] **Step 2: Build the package to confirm types**

Run: `pnpm --filter @todolist/db build`
Expected: `tsc` exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add labels table to PowerSync schema"
```

---

### Task 7: Add core dependency + Vitest to packages/db

**Files:**
- Modify: `packages/db/package.json`
- Create: `packages/db/vitest.config.ts`

- [ ] **Step 1: Add the dependency, dev dep, and test script**

In `packages/db/package.json`, add `"@todolist/core": "workspace:*"` to `dependencies`, add `"vitest": "^1.6.0"` to `devDependencies` (create the block if absent), and add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create the vitest config**

```ts
// packages/db/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 3: Install workspace dependencies**

Run: `pnpm install`
Expected: lockfile updates; `@todolist/core` linked into `@todolist/db`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/package.json packages/db/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(db): add core dep + vitest setup"
```

---

### Task 8: Pure label-array helpers

**Files:**
- Create: `packages/db/src/queries/labelUtils.ts`
- Test: `packages/db/src/queries/labelUtils.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/src/queries/labelUtils.test.ts
import { describe, it, expect } from 'vitest';
import { pickLabelColor, renameInLabelArray, removeFromLabelArray } from './labelUtils';

describe('labelUtils', () => {
  it('pickLabelColor is deterministic and from the palette', () => {
    const a = pickLabelColor('groceries');
    const b = pickLabelColor('groceries');
    expect(a).toBe(b);
    expect(a).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('renameInLabelArray replaces and de-dupes', () => {
    expect(renameInLabelArray(['work', 'urgent'], 'work', 'job')).toEqual(['job', 'urgent']);
    expect(renameInLabelArray(['work', 'job'], 'work', 'job')).toEqual(['job']);
  });

  it('removeFromLabelArray drops the name', () => {
    expect(removeFromLabelArray(['work', 'urgent'], 'work')).toEqual(['urgent']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/labelUtils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/db/src/queries/labelUtils.ts
const PALETTE = [
  '#6366F1', '#10B981', '#EF4444', '#F59E0B',
  '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6',
];

export function pickLabelColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function renameInLabelArray(labels: string[], from: string, to: string): string[] {
  return Array.from(new Set(labels.map((l) => (l === from ? to : l))));
}

export function removeFromLabelArray(labels: string[], name: string): string[] {
  return labels.filter((l) => l !== name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/db exec vitest run src/queries/labelUtils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/labelUtils.ts packages/db/src/queries/labelUtils.test.ts
git commit -m "feat(db): pure label-array helpers"
```

---

### Task 9: Label hooks + CRUD

**Files:**
- Create: `packages/db/src/queries/labels.ts`

- [ ] **Step 1: Write the implementation**

```ts
// packages/db/src/queries/labels.ts
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { LabelRecord, TaskRecord } from '../schema';
import { pickLabelColor, renameInLabelArray, removeFromLabelArray } from './labelUtils';

export function useLabels() {
  return useQuery<LabelRecord>(
    `SELECT * FROM labels WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`
  );
}

export type LabelTaskRow = Pick<
  TaskRecord,
  'id' | 'title' | 'priority' | 'due_date' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'
>;

export function useTasksByLabel(name: string) {
  return useQuery<LabelTaskRow>(
    `SELECT id, title, priority, due_date, status, sort_order, labels, recurrence_rule
     FROM tasks
     WHERE deleted_at IS NULL
       AND status NOT IN ('completed', 'cancelled')
       AND EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)
     ORDER BY sort_order`,
    [name]
  );
}

export async function createLabel(
  db: AbstractPowerSyncDatabase,
  fields: { userId: string; name: string; color?: string }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = fields.name.trim().toLowerCase();
  await db.execute(
    `INSERT INTO labels (id, user_id, name, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, fields.userId, name, fields.color ?? pickLabelColor(name), now, now]
  );
  return id;
}

export async function ensureLabels(
  db: AbstractPowerSyncDatabase,
  userId: string,
  names: string[]
): Promise<void> {
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    const existing = await db.getOptional<{ id: string }>(
      `SELECT id FROM labels WHERE name = ? AND deleted_at IS NULL LIMIT 1`,
      [name]
    );
    if (!existing) await createLabel(db, { userId, name });
  }
}

export async function updateLabel(
  db: AbstractPowerSyncDatabase,
  id: string,
  fields: { name?: string; color?: string }
): Promise<void> {
  const now = new Date().toISOString();
  const current = await db.get<LabelRecord>(`SELECT * FROM labels WHERE id = ?`, [id]);
  const newName = fields.name !== undefined ? fields.name.trim().toLowerCase() : current.name;
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE labels SET name = ?, color = ?, updated_at = ? WHERE id = ?`,
      [newName, fields.color ?? current.color, now, id]
    );
    if (newName !== current.name) {
      const tasks = await tx.getAll<{ id: string; labels: string }>(
        `SELECT id, labels FROM tasks
         WHERE deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)`,
        [current.name]
      );
      for (const t of tasks) {
        const arr = renameInLabelArray(JSON.parse(t.labels || '[]'), current.name, newName);
        await tx.execute(`UPDATE tasks SET labels = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify(arr), now, t.id]);
      }
    }
  });
}

export async function deleteLabel(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  const current = await db.get<LabelRecord>(`SELECT * FROM labels WHERE id = ?`, [id]);
  await db.writeTransaction(async (tx) => {
    await tx.execute(`UPDATE labels SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
    const tasks = await tx.getAll<{ id: string; labels: string }>(
      `SELECT id, labels FROM tasks
       WHERE deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)`,
      [current.name]
    );
    for (const t of tasks) {
      const arr = removeFromLabelArray(JSON.parse(t.labels || '[]'), current.name);
      await tx.execute(`UPDATE tasks SET labels = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(arr), now, t.id]);
    }
  });
}
```

- [ ] **Step 2: Build to confirm types**

Run: `pnpm --filter @todolist/db build`
Expected: `tsc` exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/queries/labels.ts
git commit -m "feat(db): label hooks + CRUD with rename/delete propagation"
```

---

### Task 10: createTask recurrence + updateTaskRecurrence + read selects

**Files:**
- Modify: `packages/db/src/queries/tasks.ts`

- [ ] **Step 1: Extend `createTask`**

Add `recurrenceRule?: string | null;` to the `fields` type (next to `labels`). Replace the INSERT so it writes recurrence columns; the value list sets `recurrence_start = recurrenceRule ? dueDate : null`:

```ts
  const recurrenceRule = fields.recurrenceRule ?? null;
  const recurrenceStart = recurrenceRule ? (fields.dueDate ?? null) : null;
  await db.execute(
    `INSERT INTO tasks
       (id, user_id, title, status, priority, due_date, due_time, timezone,
        project_id, parent_task_id, recurrence_rule, recurrence_start,
        labels, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      fields.userId,
      fields.title,
      fields.status ?? 'inbox',
      fields.priority ?? 4,
      fields.dueDate ?? null,
      fields.dueTime ?? null,
      fields.timezone ?? null,
      fields.projectId ?? null,
      fields.parentTaskId ?? null,
      recurrenceRule,
      recurrenceStart,
      JSON.stringify(fields.labels ?? []),
      sortOrder,
      now,
      now,
    ]
  );
```

- [ ] **Step 2: Add `updateTaskRecurrence`** (place after `updateTaskDue`)

```ts
export async function updateTaskRecurrence(
  db: AbstractPowerSyncDatabase,
  id: string,
  rule: string | null,
  start: string | null
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET recurrence_rule = ?, recurrence_start = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [rule, start, new Date().toISOString(), id]
  );
}
```

- [ ] **Step 3: Add `labels` + `recurrence_rule` to the list read queries**

Update each read query SELECT and its hook `Pick` type so rows carry chips/badge data:

`TODAY_QUERY` → `SELECT id, title, priority, due_date, project_id, status, labels, recurrence_rule`
`UPCOMING_QUERY` → same added columns.
`INBOX_QUERY` → add `, recurrence_rule` (it already selects `labels`).
`useProjectTasks` query → add `, labels, recurrence_rule`.

Then extend the corresponding hook generics, e.g.:

```ts
export function useTodayTasks() {
  return useQuery<Pick<TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'project_id' | 'status' | 'labels' | 'recurrence_rule'>>(TODAY_QUERY);
}
```

Apply the same `'labels' | 'recurrence_rule'` additions to `useInboxTasks` (add `'recurrence_rule'`), `useUpcomingTasks`, and `useProjectTasks`.

- [ ] **Step 4: Build to confirm types**

Run: `pnpm --filter @todolist/db build`
Expected: `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/tasks.ts
git commit -m "feat(db): task recurrence write + recurrence columns in read selects"
```

---

### Task 11: Recurrence-aware completeTask (snapshot + advance)

**Files:**
- Modify: `packages/db/src/queries/tasks.ts`

- [ ] **Step 1: Add the import at the top**

```ts
import { parseRule, computeNext } from '@todolist/core';
```

- [ ] **Step 2: Replace `completeTask`**

```ts
export async function completeTask(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  const task = await db.getOptional<TaskRecord>(
    `SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (!task) return;

  const rule = task.recurrence_rule ? parseRule(task.recurrence_rule) : null;

  // Non-recurring (or undated): plain completion.
  if (!rule || !task.due_date) {
    await db.execute(
      `UPDATE tasks SET status = 'completed', updated_at = ? WHERE id = ?`,
      [now, id]
    );
    return;
  }

  // Recurring: snapshot the completed occurrence, then advance the original.
  const anchor = task.recurrence_start ?? task.due_date;
  const next = computeNext(rule, task.due_date, anchor);
  const snapshotId = crypto.randomUUID();

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO tasks
         (id, user_id, title, description, status, priority, due_date, due_time, timezone,
          project_id, parent_task_id, recurrence_rule, recurrence_start,
          labels, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        snapshotId, task.user_id, task.title, task.description ?? null, 'completed',
        task.priority, task.due_date, task.due_time, task.timezone,
        task.project_id, null, null, null,
        task.labels, task.sort_order, now, now,
      ]
    );
    await tx.execute(
      `UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?`,
      [next, now, id]
    );
    // Reset checked-off sub-tasks for the new occurrence.
    await tx.execute(
      `UPDATE tasks SET status = 'active', updated_at = ?
       WHERE parent_task_id = ? AND status = 'completed' AND deleted_at IS NULL`,
      [now, id]
    );
  });
}
```

- [ ] **Step 3: Build to confirm types**

Run: `pnpm --filter @todolist/db build`
Expected: `tsc` exits 0.

- [ ] **Step 4: Run the full shared test suites**

Run: `pnpm --filter @todolist/core test && pnpm --filter @todolist/db test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/tasks.ts
git commit -m "feat(db): recurrence-aware completeTask with snapshot + advance"
```

---

### Task 12: Export labels from db index

**Files:**
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add exports**

```ts
export { AppSchema } from './schema';
export type { Database, TaskRecord, ProjectRecord, LabelRecord } from './schema';
export * from './queries/tasks';
export * from './queries/projects';
export * from './queries/labels';
export * from './queries/labelUtils';
```

- [ ] **Step 2: Build**

Run: `pnpm --filter @todolist/db build`
Expected: `tsc` exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): export labels API"
```

---

## PHASE C — Web UI

### Task 13: LabelChip component

**Files:**
- Create: `apps/web/components/tasks/LabelChip.tsx`
- Test: `apps/web/__tests__/LabelChip.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/LabelChip.test.tsx
import { render, screen } from '@testing-library/react';
import { LabelChip } from '@/components/tasks/LabelChip';

describe('LabelChip', () => {
  it('renders the label name with a leading @', () => {
    render(<LabelChip name="groceries" color="#10B981" />);
    expect(screen.getByText('groceries')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/LabelChip.test.tsx`
Expected: FAIL — cannot find module `LabelChip`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/components/tasks/LabelChip.tsx
interface Props {
  name:  string;
  color: string;
}

export function LabelChip({ name, color }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {name}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/LabelChip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/tasks/LabelChip.tsx apps/web/__tests__/LabelChip.test.tsx
git commit -m "feat(web): LabelChip component"
```

---

### Task 14: RecurrencePicker component

**Files:**
- Create: `apps/web/components/tasks/RecurrencePicker.tsx`
- Test: `apps/web/__tests__/RecurrencePicker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/RecurrencePicker.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RecurrencePicker } from '@/components/tasks/RecurrencePicker';

describe('RecurrencePicker', () => {
  it('shows current rule summary', () => {
    render(<RecurrencePicker value="FREQ=DAILY" onChange={() => {}} />);
    expect(screen.getByText('Every day')).toBeInTheDocument();
  });

  it('emits a serialized rule when a preset is picked', () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'FREQ=MONTHLY' } });
    expect(onChange).toHaveBeenCalledWith('FREQ=MONTHLY');
  });

  it('emits null for None', () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value="FREQ=DAILY" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/RecurrencePicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/components/tasks/RecurrencePicker.tsx
'use client';

import { useState } from 'react';
import { parseRule, serializeRule, describeRule, WD_ORDER, type Weekday, type Freq } from '@todolist/core';

interface Props {
  value:    string | null;
  onChange: (rule: string | null) => void;
}

const PRESETS: Array<{ label: string; value: string }> = [
  { label: 'None',          value: '' },
  { label: 'Every day',     value: 'FREQ=DAILY' },
  { label: 'Every weekday', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly',        value: 'FREQ=WEEKLY' },
  { label: 'Monthly',       value: 'FREQ=MONTHLY' },
  { label: 'Yearly',        value: 'FREQ=YEARLY' },
  { label: 'Custom…',       value: 'CUSTOM' },
];

const WD_LABEL: Record<Weekday, string> = {
  MO: 'M', TU: 'T', WE: 'W', TH: 'T', FR: 'F', SA: 'S', SU: 'S',
};

export function RecurrencePicker({ value, onChange }: Props) {
  const rule = value ? parseRule(value) : null;
  const isPreset = PRESETS.some((p) => p.value === value);
  const [custom, setCustom] = useState(!isPreset && !!value);

  const select = (v: string) => {
    if (v === 'CUSTOM') { setCustom(true); onChange('FREQ=WEEKLY'); return; }
    setCustom(false);
    onChange(v === '' ? null : v);
  };

  const setFreq = (freq: Freq) => {
    const base = rule ?? { freq: 'weekly' as Freq, interval: 1 };
    onChange(serializeRule({ ...base, freq, byDay: freq === 'weekly' ? base.byDay : undefined }));
  };
  const setInterval = (n: number) => {
    if (!rule || !Number.isFinite(n) || n < 1) return;
    onChange(serializeRule({ ...rule, interval: n }));
  };
  const toggleDay = (d: Weekday) => {
    if (!rule) return;
    const cur = rule.byDay ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    onChange(serializeRule({ ...rule, byDay: WD_ORDER.filter((x) => next.includes(x)) }));
  };

  return (
    <div>
      <select
        aria-label="Repeat"
        value={custom ? 'CUSTOM' : (value ?? '')}
        onChange={(e) => select(e.target.value)}
        className="bg-surface border border-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
      >
        {PRESETS.map((p) => <option key={p.label} value={p.value}>{p.label}</option>)}
      </select>

      {custom && rule && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Every</span>
            <input
              type="number"
              min={1}
              value={rule.interval}
              onChange={(e) => setInterval(parseInt(e.target.value, 10))}
              className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-text-primary text-sm"
              aria-label="Interval"
            />
            <select
              aria-label="Unit"
              value={rule.freq}
              onChange={(e) => setFreq(e.target.value as Freq)}
              className="bg-surface border border-border rounded-lg px-2 py-1 text-text-primary text-sm"
            >
              <option value="daily">days</option>
              <option value="weekly">weeks</option>
              <option value="monthly">months</option>
              <option value="yearly">years</option>
            </select>
          </div>

          {rule.freq === 'weekly' && (
            <div className="flex gap-1" role="group" aria-label="Weekdays">
              {WD_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  aria-pressed={rule.byDay?.includes(d) ?? false}
                  className={`w-7 h-7 rounded-full text-xs ${
                    rule.byDay?.includes(d) ? 'bg-accent text-white' : 'bg-surface text-text-secondary'
                  }`}
                >
                  {WD_LABEL[d]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {rule && <p className="mt-2 text-xs text-text-muted">{describeRule(rule)}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/RecurrencePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/tasks/RecurrencePicker.tsx apps/web/__tests__/RecurrencePicker.test.tsx
git commit -m "feat(web): RecurrencePicker component"
```

---

### Task 15: TaskRow — label chips + recurring badge

**Files:**
- Modify: `apps/web/components/tasks/TaskRow.tsx`
- Modify: `apps/web/__tests__/TaskRow.test.tsx`

- [ ] **Step 1: Add a failing test (append to TaskRow.test.tsx)**

```tsx
import { LabelChip } from '@/components/tasks/LabelChip'; // ensure import resolves in suite

it('renders label chips and a recurring badge', () => {
  const task = {
    id: 't1', title: 'Water plants', priority: 4, due_date: null, status: 'active',
    labels: '["home"]', recurrence_rule: 'FREQ=DAILY',
  };
  render(<TaskRow task={task as any} onPress={() => {}} onComplete={() => {}} />);
  expect(screen.getByText('home')).toBeInTheDocument();
  expect(screen.getByLabelText('Recurring')).toBeInTheDocument();
});
```

(If the existing `TaskRow.test.tsx` lacks `render`/`screen` imports, add `import { render, screen } from '@testing-library/react';` at the top.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/TaskRow.test.tsx`
Expected: FAIL — "home" not found / no `Recurring` label.

- [ ] **Step 3: Update TaskRow.tsx**

Extend the item type and render chips/badge. Replace `TaskRowItem` and the content block:

```tsx
import { memo } from 'react';
import { useLabels } from '@todolist/db';
import { LabelChip } from './LabelChip';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

export interface TaskRowItem {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
  labels?:  string | null;          // JSON string array of names
  recurrence_rule?: string | null;
}
```

Inside the component, derive label colors and parse names:

```tsx
export const TaskRow = memo(function TaskRow({ task, onPress, onComplete }: Props) {
  const { data: allLabels } = useLabels();
  const colorOf = (name: string) =>
    allLabels.find((l) => l.name === name)?.color ?? '#9CA3AF';
  const names: string[] = task.labels ? JSON.parse(task.labels) : [];
```

In the content button, below the title `<p>`, add chips + badge:

```tsx
        <p className="text-text-primary text-sm truncate">{task.title}</p>
        {(names.length > 0 || task.recurrence_rule) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {task.recurrence_rule && (
              <span className="text-xs text-text-muted" aria-label="Recurring" title="Repeats">↻</span>
            )}
            {names.map((n) => <LabelChip key={n} name={n} color={colorOf(n)} />)}
          </div>
        )}
        {task.due_date && (
          <p className={`text-xs mt-0.5 ${isOverdue(task.due_date) ? 'text-p1' : 'text-text-muted'}`}>
            {task.due_date}
          </p>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/TaskRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/tasks/TaskRow.tsx apps/web/__tests__/TaskRow.test.tsx
git commit -m "feat(web): label chips + recurring badge on task rows"
```

---

### Task 16: TaskDetailPanel — Repeat row

**Files:**
- Modify: `apps/web/components/tasks/TaskDetailPanel.tsx`

- [ ] **Step 1: Add imports**

Add `updateTaskRecurrence` to the existing `@todolist/db` import, and import the picker:

```tsx
import { updateTaskRecurrence } from '@todolist/db';
import { RecurrencePicker } from './RecurrencePicker';
```

- [ ] **Step 2: Add a handler** (next to `handleDueDate`)

```tsx
  const handleRecurrence = useCallback(async (rule: string | null) => {
    if (!task) return;
    const start = rule ? (task.due_date ?? new Date().toISOString().split('T')[0]) : null;
    await updateTaskRecurrence(db as any, task.id, rule, start);
  }, [db, task]);
```

- [ ] **Step 3: Add the Repeat section** (immediately after the Due date `<div>` block)

```tsx
            {/* Repeat */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Repeat</p>
              <RecurrencePicker value={task.recurrence_rule ?? null} onChange={handleRecurrence} />
            </div>
```

- [ ] **Step 4: Verify the app type-checks**

Run: `pnpm --filter @todolist/web exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/tasks/TaskDetailPanel.tsx
git commit -m "feat(web): recurrence picker in task detail panel"
```

---

### Task 17: Sidebar — Labels section

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Import the labels hook**

```tsx
import { useProjects, useLabels } from '@todolist/db';
```

- [ ] **Step 2: Read labels in the component** (next to `useProjects`)

```tsx
  const { data: labels } = useLabels();
```

- [ ] **Step 3: Add a Labels section** (inside the scrolling `div`, after the Projects `<button>`)

```tsx
        <p className="px-3 pt-4 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
          Labels
        </p>
        <ul className="space-y-0.5" role="list">
          {labels.map((l) => {
            const active = pathname === `/labels/${encodeURIComponent(l.name)}`;
            return (
              <li key={l.id}>
                <Link
                  href={`/labels/${encodeURIComponent(l.name)}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: l.color ?? '#6366F1' }} aria-hidden="true" />
                  <span className="truncate">{l.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/labels"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
        >
          + Manage labels
        </Link>
```

- [ ] **Step 4: Verify type-check**

Run: `pnpm --filter @todolist/web exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx
git commit -m "feat(web): Labels section in sidebar"
```

---

### Task 18: Per-label view page

**Files:**
- Create: `apps/web/app/labels/[name]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// apps/web/app/labels/[name]/page.tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useTasksByLabel, completeTask } from '@todolist/db';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function LabelPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const db = usePowerSync();
  const { data: tasks } = useTasksByLabel(name);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col h-screen">
      <header className="px-6 py-5 border-b border-border">
        <h1 className="text-text-primary text-xl font-bold">@{name}</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        {tasks.length === 0 ? (
          <p className="p-6 text-text-muted text-sm">No tasks with this label.</p>
        ) : (
          <TaskList
            tasks={tasks}
            onPress={setSelected}
            onComplete={(id) => completeTask(db as any, id)}
          />
        )}
      </div>
      <TaskDetailPanel taskId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `pnpm --filter @todolist/web exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/labels/[name]/page.tsx
git commit -m "feat(web): per-label task view"
```

---

### Task 19: Manage Labels page

**Files:**
- Create: `apps/web/app/labels/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// apps/web/app/labels/page.tsx
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useLabels, createLabel, updateLabel, deleteLabel } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

const SWATCHES = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6'];

export default function ManageLabelsPage() {
  const db = usePowerSync();
  const { data: labels } = useLabels();
  const [newName, setNewName] = useState('');

  const create = async () => {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await createLabel(db as any, { userId: user.id, name });
    setNewName('');
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto">
      <header className="px-6 py-5 border-b border-border">
        <h1 className="text-text-primary text-xl font-bold">Manage labels</h1>
      </header>

      <div className="p-6 max-w-lg space-y-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            placeholder="New label name"
            aria-label="New label name"
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-accent"
          />
          <button onClick={create} className="bg-accent text-white font-semibold rounded-xl px-5 text-sm">
            Add
          </button>
        </div>

        <ul className="space-y-2" role="list">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
              <div className="flex gap-1" role="group" aria-label={`Color for ${l.name}`}>
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateLabel(db as any, l.id, { color: c })}
                    aria-label={`Set ${l.name} color ${c}`}
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: c, outline: l.color === c ? '2px solid white' : 'none' }}
                  />
                ))}
              </div>
              <input
                defaultValue={l.name}
                aria-label={`Rename ${l.name}`}
                onBlur={(e) => {
                  const v = e.target.value.trim().toLowerCase();
                  if (v && v !== l.name) updateLabel(db as any, l.id, { name: v });
                }}
                className="flex-1 bg-transparent text-text-primary text-sm focus:outline-none"
              />
              <button
                onClick={() => { if (confirm(`Delete label "${l.name}"?`)) deleteLabel(db as any, l.id); }}
                className="text-text-muted hover:text-error text-sm"
                aria-label={`Delete ${l.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `pnpm --filter @todolist/web exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/labels/page.tsx
git commit -m "feat(web): Manage Labels page"
```

---

### Task 20: QuickCaptureModal — ensureLabels + recurrence

**Files:**
- Modify: `apps/web/components/tasks/QuickCaptureModal.tsx`
- Modify: `apps/web/__tests__/QuickCaptureModal.test.tsx`

- [ ] **Step 1: Add a failing assertion**

In `QuickCaptureModal.test.tsx`, the existing test mocks `@todolist/db`. Add `ensureLabels` to that mock and assert it's called. If the test mocks `createTask`, extend the `vi.mock('@todolist/db', ...)` factory to also export `ensureLabels: vi.fn()`, then add:

```tsx
it('passes recurrenceRule and ensures labels on save', async () => {
  // ...render modal, type "Water plants @home every day", click Add (follow existing test's pattern)...
  await waitFor(() => {
    expect(createTaskMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recurrenceRule: 'FREQ=DAILY', labels: ['home'] })
    );
    expect(ensureLabelsMock).toHaveBeenCalledWith(expect.anything(), expect.any(String), ['home']);
  });
});
```

(Match the existing test file's helper names/imports; reuse its render + submit helpers rather than duplicating setup.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/QuickCaptureModal.test.tsx`
Expected: FAIL — `recurrenceRule`/`ensureLabels` not present.

- [ ] **Step 3: Update the modal**

Change the import and `handleSave`:

```tsx
import { createTask, ensureLabels } from '@todolist/db';
```

In `handleSave`, after computing `parsed` and resolving `user`:

```tsx
      const parsed = parseTaskInput(trimmed, { now: new Date() });
      if (parsed.labels.length) await ensureLabels(db as any, user.id, parsed.labels);
      await createTask(db as any, {
        userId:         user.id,
        title:          parsed.title,
        priority:       parsed.priority,
        dueDate:        parsed.dueDate,
        dueTime:        parsed.dueTime,
        timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId:      projectId ?? null,
        labels:         parsed.labels,
        recurrenceRule: parsed.recurrenceRule,
        status:         'inbox',
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/QuickCaptureModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/tasks/QuickCaptureModal.tsx apps/web/__tests__/QuickCaptureModal.test.tsx
git commit -m "feat(web): quick capture ensures labels + recurrence"
```

---

### Task 21: Extend axe-core scan to new views

**Files:**
- Modify: `apps/web/__tests__/axe.test.tsx`

- [ ] **Step 1: Add scans for the new UI**

Following the existing file's pattern (it renders a component and runs `axe`), add cases that render `ManageLabelsPage`-style markup, `LabelChip`, and `RecurrencePicker`, asserting zero violations. Mock `@todolist/db` hooks (`useLabels`) to return `{ data: [{ id: '1', name: 'home', color: '#10B981' }] }` so the components render. Example addition:

```tsx
import { LabelChip } from '@/components/tasks/LabelChip';
import { RecurrencePicker } from '@/components/tasks/RecurrencePicker';

it('LabelChip has no a11y violations', async () => {
  const { container } = render(<LabelChip name="home" color="#10B981" />);
  expect(await axe(container)).toHaveNoViolations();
});

it('RecurrencePicker has no a11y violations', async () => {
  const { container } = render(<RecurrencePicker value="FREQ=DAILY" onChange={() => {}} />);
  expect(await axe(container)).toHaveNoViolations();
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @todolist/web exec vitest run __tests__/axe.test.tsx`
Expected: PASS, zero violations.

- [ ] **Step 3: Commit**

```bash
git add apps/web/__tests__/axe.test.tsx
git commit -m "test(web): axe scan for label + recurrence UI"
```

---

### Task 22: Playwright e2e — labels + recurrence

**Files:**
- Create: `apps/web/e2e/labels-recurrence.test.ts`

- [ ] **Step 1: Write the e2e spec**

Model this on the existing `apps/web/e2e/golden-path.test.ts` (reuse its login/setup helpers and base URL config). Two flows:

```ts
// apps/web/e2e/labels-recurrence.test.ts
import { test, expect } from '@playwright/test';
// import { login } from helper used by golden-path.test.ts

test('label quick-add appears in sidebar and filters', async ({ page }) => {
  // await login(page);
  await page.goto('/inbox');
  await page.getByRole('button', { name: /new task|add/i }).first().click();
  await page.getByPlaceholder('What needs to be done?').fill('Buy soap @home');
  await page.getByRole('button', { name: /add task/i }).click();

  await expect(page.getByRole('link', { name: 'home' })).toBeVisible();        // sidebar Labels
  await page.getByRole('link', { name: 'home' }).click();
  await expect(page.getByText('Buy soap')).toBeVisible();                       // filtered view
});

test('recurring task advances on complete and stays', async ({ page }) => {
  // await login(page);
  await page.goto('/inbox');
  await page.getByRole('button', { name: /new task|add/i }).first().click();
  await page.getByPlaceholder('What needs to be done?').fill('Water plants every day');
  await page.getByRole('button', { name: /add task/i }).click();

  const row = page.getByText('Water plants');
  await expect(row).toBeVisible();
  await page.getByLabel('Complete Water plants').click();
  // Recurring task remains (advanced), not removed:
  await expect(page.getByText('Water plants')).toBeVisible();
});
```

Fill in the `login` import/usage to match `golden-path.test.ts`. Do not hardcode credentials — reuse the existing test's auth setup.

- [ ] **Step 2: Run the e2e suite**

Run: `pnpm --filter @todolist/web exec playwright test e2e/labels-recurrence.test.ts`
Expected: 2 passed. (If the local Supabase/PowerSync test env isn't running, start it the same way `golden-path` requires, per `apps/web` README/scripts.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/labels-recurrence.test.ts
git commit -m "test(web): e2e for labels + recurrence flows"
```

---

## Final verification

- [ ] **Run all shared + web tests**

Run: `pnpm --filter @todolist/core test && pnpm --filter @todolist/db test && pnpm --filter @todolist/web test`
Expected: all suites PASS.

- [ ] **Type-check the web app end-to-end**

Run: `pnpm --filter @todolist/web exec tsc --noEmit`
Expected: exits 0.

- [ ] **Manual smoke (optional, recommended)**

Run: `pnpm --filter @todolist/web dev`, then: quick-add `Report p1 @work every monday 9am` → confirm chip + ↻ badge, the label appears in the sidebar, the detail panel shows "Every week on Mon", and completing it advances the due date.
