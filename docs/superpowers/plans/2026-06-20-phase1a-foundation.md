# Phase 1A — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Turborepo monorepo, shared packages (config, core, db, ui), Supabase database schema, and validate end-to-end PowerSync sync with a throwaway spike before writing any product UI.

**Architecture:** Turborepo workspace with four shared packages. `packages/core` is pure TypeScript domain logic (NLP parser, types). `packages/db` wraps the PowerSync SDK schema and typed queries shared by both apps. `packages/ui` holds NativeWind design tokens and base components. Supabase hosts Postgres + Auth; PowerSync Service handles bidirectional SQLite sync.

**Tech Stack:** Node 20+, pnpm workspaces, Turborepo 2, TypeScript 5, Vitest, PowerSync React Native SDK, Supabase JS v2, NativeWind v5, chrono-node, date-fns, fractional-indexing

---

## Prerequisites

Before starting:
- Install: `node >= 20`, `pnpm >= 9`, `supabase CLI` (`npm i -g supabase`)
- Create a free account at https://supabase.com and note your project URL + anon key
- Create a free account at https://www.powersync.com and create a new instance — note the instance URL
- In PowerSync dashboard → Credentials, connect it to your Supabase project

---

## File Map

```
todolist/
├── package.json                          # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
├── .env.example
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260620000001_initial_schema.sql
│       ├── 20260620000002_rls_policies.sql
│       └── 20260620000003_triggers.sql
├── powersync/
│   └── sync-rules.yaml                  # deployed to PowerSync dashboard
├── packages/
│   ├── config/
│   │   ├── package.json
│   │   ├── tsconfig.base.json
│   │   └── eslint-config/
│   │       └── index.js
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts
│   │       └── nlp/
│   │           ├── parser.ts
│   │           └── parser.test.ts
│   ├── db/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── schema.ts
│   │       └── queries/
│   │           ├── tasks.ts
│   │           └── projects.ts
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── tokens.ts
│           ├── TaskCheckbox.tsx
│           ├── TaskRow.tsx
│           ├── PriorityBadge.tsx
│           └── SyncStatusIndicator.tsx
└── apps/
    └── spike/                           # throwaway PowerSync spike (deleted after Task 6)
        ├── package.json
        └── src/
            └── index.ts
```

---

## Task 1: Scaffold Turborepo monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "todolist",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "dev": "turbo dev"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.turbo/
.env
.env.local
*.db
*.db-shm
*.db-wal
```

- [ ] **Step 5: Create .env.example**

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
```

- [ ] **Step 6: Install root dependencies**

Run: `pnpm install`
Expected: `node_modules/` created at root, no errors.

- [ ] **Step 7: Create directory structure**

```bash
mkdir -p packages/config/eslint-config
mkdir -p packages/core/src/nlp
mkdir -p packages/db/src/queries
mkdir -p packages/ui/src
mkdir -p apps/spike/src
mkdir -p supabase/migrations
mkdir -p powersync
```

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .env.example
git commit -m "chore: scaffold Turborepo monorepo"
```

---

## Task 2: packages/config — shared TypeScript and ESLint

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.base.json`
- Create: `packages/config/eslint-config/index.js`

- [ ] **Step 1: Create packages/config/package.json**

```json
{
  "name": "@todolist/config",
  "version": "0.0.1",
  "private": true,
  "exports": {
    "./typescript": "./tsconfig.base.json",
    "./eslint": "./eslint-config/index.js"
  }
}
```

- [ ] **Step 2: Create packages/config/tsconfig.base.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create packages/config/eslint-config/index.js**

```js
module.exports = {
  extends: ['eslint:recommended'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/config/
git commit -m "chore: add packages/config with shared TS and ESLint configs"
```

---

## Task 3: packages/core — domain types

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@todolist/core",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "chrono-node": "^2.7.6",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@todolist/config": "workspace:*",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "@todolist/config/typescript",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/core/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
});
```

- [ ] **Step 4: Create packages/core/src/types.ts**

```typescript
export type Priority = 1 | 2 | 3 | 4;
export type TaskStatus = 'inbox' | 'active' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;   // 'YYYY-MM-DD'
  dueTime: string | null;   // 'HH:MM'
  timezone: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  recurrenceRule: string | null;
  recurrenceStart: string | null;
  labels: string[];
  sortOrder: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
  sortOrder: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

- [ ] **Step 5: Create packages/core/src/index.ts**

```typescript
export * from './types';
export * from './nlp/parser';
```

- [ ] **Step 6: Install core dependencies**

Run: `pnpm --filter @todolist/core install`
Expected: `chrono-node` and `date-fns` installed.

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add domain types and package scaffold"
```

---

## Task 4: packages/core — NLP parser (TDD)

**Files:**
- Create: `packages/core/src/nlp/parser.ts`
- Create: `packages/core/src/nlp/parser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/nlp/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseTaskInput } from './parser';

describe('parseTaskInput', () => {
  const now = new Date('2026-06-20T10:00:00.000Z');

  it('returns plain title with defaults when input has no tokens', () => {
    expect(parseTaskInput('Buy milk', { now })).toEqual({
      title: 'Buy milk',
      priority: 4,
      projectSlug: null,
      labels: [],
      dueDate: null,
      dueTime: null,
    });
  });

  it('extracts p1 priority and strips token from title', () => {
    expect(parseTaskInput('Buy milk p1', { now })).toMatchObject({
      title: 'Buy milk',
      priority: 1,
    });
  });

  it('extracts p3 priority', () => {
    expect(parseTaskInput('Buy milk p3', { now })).toMatchObject({ priority: 3 });
  });

  it('extracts !2 bang-priority syntax', () => {
    expect(parseTaskInput('Buy milk !2', { now })).toMatchObject({ priority: 2 });
  });

  it('extracts project slug from #token', () => {
    expect(parseTaskInput('Submit report #work', { now })).toMatchObject({
      title: 'Submit report',
      projectSlug: 'work',
    });
  });

  it('handles hyphenated project slug', () => {
    expect(parseTaskInput('Task #side-project', { now })).toMatchObject({
      projectSlug: 'side-project',
    });
  });

  it('extracts a single label from @token', () => {
    expect(parseTaskInput('Review PR @waiting', { now })).toMatchObject({
      labels: ['waiting'],
    });
  });

  it('extracts multiple labels', () => {
    expect(parseTaskInput('Task @waiting @urgent', { now })).toMatchObject({
      labels: ['waiting', 'urgent'],
    });
  });

  it('extracts due date from "tomorrow" (date only, no time)', () => {
    const result = parseTaskInput('Meeting tomorrow', { now });
    expect(result.dueDate).toBe('2026-06-21');
    expect(result.dueTime).toBeNull();
  });

  it('extracts due date and time', () => {
    const result = parseTaskInput('Meeting tomorrow 3pm', { now });
    expect(result.dueDate).toBe('2026-06-21');
    expect(result.dueTime).toBe('15:00');
  });

  it('extracts all metadata from a complex input', () => {
    expect(
      parseTaskInput('Submit report p1 #work @waiting tomorrow 3pm', { now })
    ).toMatchObject({
      title: 'Submit report',
      priority: 1,
      projectSlug: 'work',
      labels: ['waiting'],
      dueDate: '2026-06-21',
      dueTime: '15:00',
    });
  });

  it('falls back gracefully on unrecognised input — title preserved, no data lost', () => {
    const result = parseTaskInput('Just a plain task ??? 123', { now });
    expect(result.title).toBe('Just a plain task ??? 123');
    expect(result.priority).toBe(4);
    expect(result.projectSlug).toBeNull();
    expect(result.labels).toEqual([]);
  });

  it('uses full original input as title when all tokens are stripped but nothing remains', () => {
    const result = parseTaskInput('p1 #work @label', { now });
    expect(result.title).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests — verify they all fail**

Run: `pnpm --filter @todolist/core test`
Expected: All tests FAIL with "Cannot find module './parser'"

- [ ] **Step 3: Implement the NLP parser**

Create `packages/core/src/nlp/parser.ts`:

```typescript
import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import type { Priority } from '../types';

export interface NlpParseResult {
  title: string;
  priority: Priority;
  projectSlug: string | null;
  labels: string[];
  dueDate: string | null;
  dueTime: string | null;
}

export interface NlpParseOptions {
  now?: Date;
  timezone?: string;
}

// Matches: p1, p2, p3, p4, !1, !2, !3, !4 as standalone tokens
const PRIORITY_RE = /(?<!\S)(?:p([1-4])|!([1-4]))(?!\S)/gi;
// Matches: #slug or #slug-with-hyphens (no spaces)
const PROJECT_RE = /#([a-z0-9][a-z0-9-]*)/gi;
// Matches: @label or @label-with-hyphens
const LABEL_RE = /@([a-z0-9][a-z0-9-]*)/gi;

export function parseTaskInput(
  input: string,
  options: NlpParseOptions = {}
): NlpParseResult {
  const { now = new Date() } = options;
  let text = input.trim();

  // Extract priority — keep last match wins (rightmost p1 beats p2 if both present)
  let priority: Priority = 4;
  text = text.replace(PRIORITY_RE, (_, p, bang) => {
    priority = parseInt(p ?? bang, 10) as Priority;
    return ' ';
  });

  // Extract project (first #token wins)
  let projectSlug: string | null = null;
  text = text.replace(PROJECT_RE, (_, slug) => {
    if (!projectSlug) projectSlug = slug.toLowerCase();
    return ' ';
  });

  // Extract labels (all @tokens)
  const labels: string[] = [];
  text = text.replace(LABEL_RE, (_, label) => {
    labels.push(label.toLowerCase());
    return ' ';
  });

  // Extract date/time via chrono-node (first match only)
  const parsed = chrono.parse(text, now, { forwardDate: true });
  let dueDate: string | null = null;
  let dueTime: string | null = null;

  if (parsed.length > 0) {
    const ref = parsed[0];
    text = text.slice(0, ref.index) + ' ' + text.slice(ref.index + ref.text.length);
    const date = ref.start.date();
    dueDate = format(date, 'yyyy-MM-dd');
    if (ref.start.isCertain('hour')) {
      dueTime = format(date, 'HH:mm');
    }
  }

  // Clean up extra whitespace; fall back to original input if nothing remains
  const title = text.replace(/\s+/g, ' ').trim() || input.trim();
  return { title, priority, projectSlug, labels, dueDate, dueTime };
}
```

- [ ] **Step 4: Run tests — verify they all pass**

Run: `pnpm --filter @todolist/core test`
Expected: All 12 tests PASS

- [ ] **Step 5: Build the package**

Run: `pnpm --filter @todolist/core build`
Expected: `packages/core/dist/` created, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): add NLP parser with full test suite"
```

---

## Task 5: Supabase — database schema, RLS, triggers

**Files:**
- Create: `supabase/migrations/20260620000001_initial_schema.sql`
- Create: `supabase/migrations/20260620000002_rls_policies.sql`
- Create: `supabase/migrations/20260620000003_triggers.sql`

- [ ] **Step 1: Create migration 001 — tables**

Create `supabase/migrations/20260620000001_initial_schema.sql`:

```sql
create extension if not exists "uuid-ossp";

-- User settings (one row per user, id = auth.uid())
create table user_settings (
  id         uuid primary key references auth.users(id) on delete cascade,
  timezone   text        not null default 'UTC',
  expo_push_token       text,
  web_push_subscription jsonb,
  theme      text        not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects
create table projects (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  color       text        not null default '#6366F1',
  icon        text        not null default '📁',
  is_archived boolean     not null default false,
  sort_order  text        not null default 'a0',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Labels
create table labels (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  color      text        not null default '#6366F1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint labels_user_name_unique unique (user_id, name)
);

-- Tasks
create table tasks (
  id               uuid        primary key default uuid_generate_v4(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  title            text        not null,
  description      text,
  status           text        not null default 'inbox'
                               check (status in ('inbox','active','completed','cancelled')),
  priority         integer     not null default 4
                               check (priority between 1 and 4),
  due_date         date,
  due_time         time,
  timezone         text,
  project_id       uuid        references projects(id) on delete set null,
  parent_task_id   uuid        references tasks(id) on delete cascade,
  recurrence_rule  text,
  recurrence_start date,
  labels           jsonb       not null default '[]',
  sort_order       text        not null default 'a0',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index tasks_user_id_idx    on tasks (user_id);
create index tasks_project_id_idx on tasks (project_id);
create index tasks_due_date_idx   on tasks (due_date);
create index tasks_labels_gin_idx on tasks using gin (labels);

-- Saved filters (Phase 2 — created now so sync rules cover it)
create table saved_filters (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  icon       text,
  query      jsonb       not null,
  sort_order text        not null default 'a0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Reminders (Phase 3)
create table reminders (
  id              uuid        primary key default uuid_generate_v4(),
  task_id         uuid        not null references tasks(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  remind_at_local timestamptz not null,
  remind_at_utc   timestamptz not null,
  notified_mobile boolean     not null default false,
  notified_web    boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Attachments (Phase 3)
create table attachments (
  id               uuid        primary key default uuid_generate_v4(),
  task_id          uuid        not null references tasks(id) on delete cascade,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  type             text        not null check (type in ('image','audio','file')),
  filename         text        not null,
  mime_type        text        not null,
  size_bytes       integer     not null,
  storage_path     text        not null,
  local_uri        text,
  thumbnail_uri    text,
  duration_seconds float,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
```

- [ ] **Step 2: Create migration 002 — RLS policies**

Create `supabase/migrations/20260620000002_rls_policies.sql`:

```sql
alter table user_settings  enable row level security;
alter table projects        enable row level security;
alter table labels          enable row level security;
alter table tasks           enable row level security;
alter table saved_filters   enable row level security;
alter table reminders       enable row level security;
alter table attachments     enable row level security;

-- Single policy per table: all operations scoped to authenticated owner.
-- user_settings: id IS the user id
create policy "own_settings"      on user_settings  for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own_projects"      on projects        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_labels"        on labels          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_tasks"         on tasks           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_saved_filters" on saved_filters   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_reminders"     on reminders       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_attachments"   on attachments     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 3: Create migration 003 — triggers**

Create `supabase/migrations/20260620000003_triggers.sql`:

```sql
-- Function: always set updated_at to now() on any UPDATE
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at        before update on tasks        for each row execute function set_updated_at();
create trigger projects_updated_at     before update on projects     for each row execute function set_updated_at();
create trigger labels_updated_at       before update on labels       for each row execute function set_updated_at();
create trigger user_settings_updated_at before update on user_settings for each row execute function set_updated_at();
create trigger saved_filters_updated_at before update on saved_filters for each row execute function set_updated_at();
create trigger reminders_updated_at    before update on reminders    for each row execute function set_updated_at();
create trigger attachments_updated_at  before update on attachments  for each row execute function set_updated_at();

-- Function: override user_id with the authenticated user on INSERT.
-- Prevents a client from inserting rows for another user even if they craft a payload.
create or replace function enforce_user_id()
returns trigger language plpgsql security definer as $$
begin
  new.user_id = auth.uid();
  return new;
end;
$$;

create trigger tasks_enforce_user_id       before insert on tasks       for each row execute function enforce_user_id();
create trigger projects_enforce_user_id    before insert on projects    for each row execute function enforce_user_id();
create trigger labels_enforce_user_id      before insert on labels      for each row execute function enforce_user_id();
create trigger reminders_enforce_user_id   before insert on reminders   for each row execute function enforce_user_id();
create trigger attachments_enforce_user_id before insert on attachments for each row execute function enforce_user_id();
```

- [ ] **Step 4: Link Supabase CLI to your project**

```bash
# Replace <project-ref> with your Supabase project reference ID (found in project settings)
supabase link --project-ref <project-ref>
```

Expected: "Linked to project <project-ref>"

- [ ] **Step 5: Push migrations to Supabase**

Run: `supabase db push`
Expected: All three migrations applied. Visit Supabase dashboard → Table Editor to confirm all 7 tables exist.

- [ ] **Step 6: Verify RLS is active**

In Supabase dashboard → Authentication → Policies, confirm each table shows policies.
Then in SQL Editor run:
```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
order by tablename;
```
Expected: All tables show `rowsecurity = true`.

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat(db): add Supabase schema, RLS policies, and updated_at triggers"
```

---

## Task 6: PowerSync sync rules + throwaway sync spike

This task validates the entire sync pipeline before writing any product UI. **The `apps/spike` directory is deleted after this task.**

**Files:**
- Create: `powersync/sync-rules.yaml`
- Create: `apps/spike/package.json`
- Create: `apps/spike/src/index.ts`

- [ ] **Step 1: Create PowerSync sync rules**

Create `powersync/sync-rules.yaml`:

```yaml
# PowerSync Sync Rules
# Deploy this file in the PowerSync dashboard → Sync Rules tab.
# Soft-deleted rows (deleted_at IS NOT NULL) are included so clients can
# remove them from local views. The client filters deleted_at IS NULL in queries.

bucket_definitions:
  user_data:
    parameters:
      - name: user_id
        value: token_parameters.user_id
    data:
      - SELECT * FROM tasks           WHERE user_id = bucket.user_id
      - SELECT * FROM projects        WHERE user_id = bucket.user_id
      - SELECT * FROM labels          WHERE user_id = bucket.user_id
      - SELECT * FROM saved_filters   WHERE user_id = bucket.user_id
      - SELECT * FROM reminders       WHERE user_id = bucket.user_id
      - SELECT * FROM attachments     WHERE user_id = bucket.user_id
      - SELECT * FROM user_settings   WHERE id       = bucket.user_id
```

- [ ] **Step 2: Deploy sync rules to PowerSync**

In PowerSync dashboard → your instance → Sync Rules tab:
- Paste the contents of `powersync/sync-rules.yaml`
- Click "Deploy"

Expected: PowerSync shows "Sync rules deployed successfully"

- [ ] **Step 3: Create the spike package**

Create `apps/spike/package.json`:

```json
{
  "name": "@todolist/spike",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@powersync/node": "^1.0.0",
    "@supabase/supabase-js": "^2.44.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0"
  }
}
```

- [ ] **Step 4: Write the spike — create a task, go offline, verify local read, reconnect**

Create `apps/spike/src/index.ts`:

```typescript
import { PowerSyncDatabase } from '@powersync/node';
import { column, Schema, Table } from '@powersync/node';
import { createClient } from '@supabase/supabase-js';
import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/node';

// Minimal 1-table schema for the spike
const tasks = new Table({ title: column.text, status: column.text });
const SpikeSchema = new Schema({ tasks });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const POWERSYNC_URL = process.env.POWERSYNC_URL!;
const SUPABASE_EMAIL = process.env.SUPABASE_EMAIL!;
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class SpikeConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: SUPABASE_EMAIL,
      password: SUPABASE_PASSWORD,
    });
    if (error || !session) throw new Error(`Auth failed: ${error?.message}`);
    return { endpoint: POWERSYNC_URL, token: session.access_token };
  }

  async uploadData(db: AbstractPowerSyncDatabase) {
    const tx = await db.getNextCrudTransaction();
    if (!tx) return;
    for (const op of tx.crud) {
      await supabase.from(op.table).upsert({ ...op.opData, id: op.id });
    }
    await tx.complete();
  }
}

async function main() {
  const db = new PowerSyncDatabase({ schema: SpikeSchema, database: { dbFilename: '/tmp/spike.db' } });
  await db.connect(new SpikeConnector());

  console.log('Connected. Waiting 2s for initial sync...');
  await new Promise(r => setTimeout(r, 2000));

  // 1. INSERT a task locally
  const id = crypto.randomUUID();
  await db.execute('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)', [id, 'Spike task', 'inbox']);
  console.log('Task inserted locally');

  // 2. Verify local read
  const local = await db.getAll<{ id: string; title: string }>('SELECT id, title FROM tasks WHERE id = ?', [id]);
  console.assert(local.length === 1, 'Local read failed');
  console.log('Local read OK:', local[0].title);

  // 3. Verify upload propagated to Supabase
  await new Promise(r => setTimeout(r, 3000));
  const { data } = await supabase.from('tasks').select('id, title').eq('id', id);
  console.assert(data && data.length === 1, 'Supabase read failed');
  console.log('Supabase read OK:', data?.[0]?.title);

  // 4. UPDATE in Supabase, verify it syncs down
  await supabase.from('tasks').update({ title: 'Updated remotely' }).eq('id', id);
  await new Promise(r => setTimeout(r, 3000));
  const synced = await db.getAll<{ title: string }>('SELECT title FROM tasks WHERE id = ?', [id]);
  console.assert(synced[0]?.title === 'Updated remotely', 'Sync-down failed');
  console.log('Sync-down OK:', synced[0].title);

  console.log('\n✓ Spike passed — PowerSync ↔ Supabase sync is working');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 5: Install spike dependencies**

```bash
pnpm --filter @todolist/spike install
```

- [ ] **Step 6: Run the spike**

Create a test user in Supabase dashboard → Authentication → Users first.
Then:

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_ANON_KEY=your-anon-key \
POWERSYNC_URL=https://your-instance.powersync.journeyapps.com \
SUPABASE_EMAIL=test@example.com \
SUPABASE_PASSWORD=testpassword123 \
pnpm --filter @todolist/spike start
```

Expected output:
```
Connected. Waiting 2s for initial sync...
Task inserted locally
Local read OK: Spike task
Supabase read OK: Spike task
Sync-down OK: Updated remotely

✓ Spike passed — PowerSync ↔ Supabase sync is working
```

If the spike fails, do NOT proceed. Debug the PowerSync connection (check instance URL, sync rules deployment, Supabase JWT configuration in PowerSync dashboard).

- [ ] **Step 7: Delete the spike directory**

```bash
rm -rf apps/spike
```

- [ ] **Step 8: Commit sync rules**

```bash
git add powersync/
git commit -m "feat(sync): add PowerSync sync rules (spike deleted after validation)"
```

---

## Task 7: packages/db — PowerSync schema and typed queries

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/tasks.ts`
- Create: `packages/db/src/queries/projects.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create packages/db/package.json**

```json
{
  "name": "@todolist/db",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@powersync/react-native": "^1.7.0",
    "@powersync/react": "^1.4.0",
    "fractional-indexing": "^3.2.0"
  },
  "devDependencies": {
    "@todolist/config": "workspace:*",
    "react": "^18.2.0"
  },
  "peerDependencies": {
    "react": ">=18"
  }
}
```

- [ ] **Step 2: Create packages/db/tsconfig.json**

```json
{
  "extends": "@todolist/config/typescript",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/db/src/schema.ts**

PowerSync automatically creates an `id` column — do NOT declare it.

```typescript
import { column, Schema, Table } from '@powersync/react-native';

const tasks = new Table(
  {
    user_id:          column.text,
    title:            column.text,
    description:      column.text,
    status:           column.text,
    priority:         column.integer,
    due_date:         column.text,
    due_time:         column.text,
    timezone:         column.text,
    project_id:       column.text,
    parent_task_id:   column.text,
    recurrence_rule:  column.text,
    recurrence_start: column.text,
    labels:           column.text,   // JSON array stored as text
    sort_order:       column.text,
    created_at:       column.text,
    updated_at:       column.text,
    deleted_at:       column.text,
  },
  {
    indexes: {
      by_project:  ['project_id'],
      by_parent:   ['parent_task_id'],
      by_status:   ['status'],
      by_due_date: ['due_date'],
    },
  }
);

const projects = new Table(
  {
    user_id:     column.text,
    name:        column.text,
    color:       column.text,
    icon:        column.text,
    is_archived: column.integer,
    sort_order:  column.text,
    created_at:  column.text,
    updated_at:  column.text,
    deleted_at:  column.text,
  },
  { indexes: { by_name: ['name'] } }
);

export const AppSchema = new Schema({ tasks, projects });

export type Database      = (typeof AppSchema)['types'];
export type TaskRecord    = Database['tasks'];
export type ProjectRecord = Database['projects'];
```

- [ ] **Step 4: Create packages/db/src/queries/tasks.ts**

```typescript
import type { PowerSyncDatabase } from '@powersync/react-native';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import type { TaskRecord } from '../schema';

// --- Read helpers (used in hooks) ---

export const INBOX_QUERY = `
  SELECT id, title, priority, due_date, due_time, status, sort_order, labels
  FROM tasks
  WHERE project_id IS NULL
    AND parent_task_id IS NULL
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY sort_order
`;

export const TODAY_QUERY = `
  SELECT id, title, priority, due_date, project_id, status
  FROM tasks
  WHERE due_date <= date('now')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY priority, sort_order
`;

export const UPCOMING_QUERY = `
  SELECT id, title, priority, due_date, project_id, status
  FROM tasks
  WHERE due_date > date('now')
    AND due_date <= date('now', '+7 days')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY due_date, priority
`;

// --- React hooks ---

export function useInboxTasks() {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'status' | 'sort_order' | 'labels'>>(INBOX_QUERY);
}

export function useTodayTasks() {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'project_id' | 'status'>>(TODAY_QUERY);
}

export function useUpcomingTasks() {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'project_id' | 'status'>>(UPCOMING_QUERY);
}

export function useProjectTasks(projectId: string) {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'status' | 'sort_order'>>(
    `SELECT id, title, priority, due_date, status, sort_order FROM tasks
     WHERE project_id = ?
       AND parent_task_id IS NULL
       AND status NOT IN ('completed', 'cancelled')
       AND deleted_at IS NULL
     ORDER BY sort_order`,
    [projectId]
  );
}

export function useSubtasks(parentTaskId: string) {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'status' | 'sort_order'>>(
    `SELECT id, title, status, sort_order FROM tasks
     WHERE parent_task_id = ?
       AND deleted_at IS NULL
     ORDER BY sort_order`,
    [parentTaskId]
  );
}

export function useTask(id: string) {
  return useQuery<TaskRecord>(
    `SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
}

// --- Write helpers (called directly with db instance) ---

export async function createTask(
  db: PowerSyncDatabase,
  fields: {
    userId: string;
    title: string;
    priority?: number;
    status?: string;
    dueDate?: string | null;
    dueTime?: string | null;
    timezone?: string | null;
    projectId?: string | null;
    parentTaskId?: string | null;
    labels?: string[];
    afterSortOrder?: string | null;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  await db.execute(
    `INSERT INTO tasks
       (id, user_id, title, status, priority, due_date, due_time, timezone,
        project_id, parent_task_id, labels, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      JSON.stringify(fields.labels ?? []),
      sortOrder,
      now,
      now,
    ]
  );
  return id;
}

export async function completeTask(db: PowerSyncDatabase, id: string): Promise<void> {
  await db.execute(
    `UPDATE tasks SET status = 'completed', updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

export async function updateTaskTitle(db: PowerSyncDatabase, id: string, title: string): Promise<void> {
  await db.execute(
    `UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?`,
    [title, new Date().toISOString(), id]
  );
}

export async function updateTaskDue(
  db: PowerSyncDatabase,
  id: string,
  dueDate: string | null,
  dueTime: string | null
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET due_date = ?, due_time = ?, updated_at = ? WHERE id = ?`,
    [dueDate, dueTime, new Date().toISOString(), id]
  );
}

export async function updateTaskPriority(
  db: PowerSyncDatabase,
  id: string,
  priority: number
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?`,
    [priority, new Date().toISOString(), id]
  );
}

export async function updateTaskProject(
  db: PowerSyncDatabase,
  id: string,
  projectId: string | null
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET project_id = ?, updated_at = ? WHERE id = ?`,
    [projectId, new Date().toISOString(), id]
  );
}

export async function deleteTask(db: PowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}
```

- [ ] **Step 5: Create packages/db/src/queries/projects.ts**

```typescript
import type { PowerSyncDatabase } from '@powersync/react-native';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import type { ProjectRecord } from '../schema';

export function useProjects() {
  return useQuery<Pick<ProjectRecord, 'id' | 'name' | 'color' | 'icon' | 'sort_order'>>(
    `SELECT id, name, color, icon, sort_order FROM projects
     WHERE is_archived = 0 AND deleted_at IS NULL
     ORDER BY sort_order`
  );
}

export async function createProject(
  db: PowerSyncDatabase,
  fields: { userId: string; name: string; color?: string; icon?: string; afterSortOrder?: string | null }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  await db.execute(
    `INSERT INTO projects (id, user_id, name, color, icon, is_archived, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,0,?,?,?)`,
    [id, fields.userId, fields.name, fields.color ?? '#6366F1', fields.icon ?? '📁', sortOrder, now, now]
  );
  return id;
}

export async function deleteProject(db: PowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}
```

- [ ] **Step 6: Create packages/db/src/index.ts**

```typescript
export { AppSchema } from './schema';
export type { Database, TaskRecord, ProjectRecord } from './schema';
export * from './queries/tasks';
export * from './queries/projects';
```

- [ ] **Step 7: Install db dependencies and build**

```bash
pnpm --filter @todolist/db install
pnpm --filter @todolist/db build
```

Expected: `packages/db/dist/` created, no TS errors.

- [ ] **Step 8: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add PowerSync schema and typed task/project query helpers"
```

---

## Task 8: packages/ui — design tokens and base components

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/tokens.ts`
- Create: `packages/ui/src/TaskCheckbox.tsx`
- Create: `packages/ui/src/TaskRow.tsx`
- Create: `packages/ui/src/PriorityBadge.tsx`
- Create: `packages/ui/src/SyncStatusIndicator.tsx`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Create packages/ui/package.json**

```json
{
  "name": "@todolist/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "react-native-reanimated": "^3.10.0"
  },
  "devDependencies": {
    "@todolist/config": "workspace:*",
    "@types/react": "^18.2.0",
    "@types/react-native": "^0.73.0",
    "react": "^18.2.0",
    "react-native": "^0.73.0"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-native": ">=0.73"
  }
}
```

- [ ] **Step 2: Create packages/ui/tsconfig.json**

```json
{
  "extends": "@todolist/config/typescript",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/ui/src/tokens.ts**

```typescript
export const colors = {
  // Brand
  accent:       '#6366F1',  // electric indigo
  accentDark:   '#4F46E5',

  // Priority
  p1:           '#EF4444',  // red
  p2:           '#F97316',  // orange
  p3:           '#3B82F6',  // blue
  p4:           '#9CA3AF',  // grey — WCAG AA on dark bg

  // Neutral
  bg:           '#0A0A0A',
  surface:      '#141414',
  surfaceAlt:   '#1C1C1C',
  border:       '#272727',
  textPrimary:  '#F9FAFB',
  textSecondary:'#9CA3AF',
  textMuted:    '#6B7280',

  // Status
  success:      '#22C55E',
  warning:      '#F59E0B',
  error:        '#EF4444',
} as const;

export type ColorKey = keyof typeof colors;

export const priorityColor: Record<1 | 2 | 3 | 4, string> = {
  1: colors.p1,
  2: colors.p2,
  3: colors.p3,
  4: colors.p4,
};

export const priorityLabel: Record<1 | 2 | 3 | 4, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'P4',
};

export const typography = {
  heading1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading2: { fontSize: 22, fontWeight: '600' as const },
  heading3: { fontSize: 18, fontWeight: '600' as const },
  body:     { fontSize: 15, fontWeight: '400' as const },
  caption:  { fontSize: 12, fontWeight: '400' as const },
} as const;
```

- [ ] **Step 4: Create packages/ui/src/TaskCheckbox.tsx**

```typescript
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { colors, priorityColor } from './tokens';

interface Props {
  priority: 1 | 2 | 3 | 4;
  checked?: boolean;
  onComplete: () => void;
}

export function TaskCheckbox({ priority, checked = false, onComplete }: Props) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.85, {}, () => {
      scale.value = withSpring(1);
      runOnJS(onComplete)();
    });
  }, [onComplete, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const borderColor = priorityColor[priority];

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <Animated.View style={[styles.box, { borderColor }, animatedStyle]}>
        {checked && <View style={[styles.fill, { backgroundColor: borderColor }]} />}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
```

- [ ] **Step 5: Create packages/ui/src/PriorityBadge.tsx**

```typescript
import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { priorityColor, priorityLabel } from './tokens';

interface Props {
  priority: 1 | 2 | 3 | 4;
}

export function PriorityBadge({ priority }: Props) {
  if (priority === 4) return null;  // P4 is default, don't clutter the row
  return (
    <View style={[styles.badge, { borderColor: priorityColor[priority] }]}>
      <Text style={[styles.label, { color: priorityColor[priority] }]}>
        {priorityLabel[priority]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
```

- [ ] **Step 6: Create packages/ui/src/SyncStatusIndicator.tsx**

```typescript
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from './tokens';

type SyncStatus = 'synced' | 'syncing' | 'stale' | 'offline';

interface Props {
  status: SyncStatus;
  lastSyncedAt: Date | null;
}

function statusColor(s: SyncStatus): string {
  if (s === 'synced') return colors.success;
  if (s === 'syncing') return colors.accent;
  if (s === 'stale') return colors.warning;
  return colors.error;
}

function statusLabel(s: SyncStatus, lastSyncedAt: Date | null): string {
  if (s === 'offline') return 'Offline';
  if (s === 'syncing') return 'Syncing…';
  if (s === 'stale' && lastSyncedAt) {
    const mins = Math.floor((Date.now() - lastSyncedAt.getTime()) / 60000);
    return `Not synced (${mins}m ago)`;
  }
  if (lastSyncedAt) {
    return `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return 'Synced';
}

export function SyncStatusIndicator({ status, lastSyncedAt }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
      <Text style={styles.label}>{statusLabel(status, lastSyncedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, color: colors.textMuted },
});
```

- [ ] **Step 7: Create packages/ui/src/TaskRow.tsx**

```typescript
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { TaskCheckbox } from './TaskCheckbox';
import { PriorityBadge } from './PriorityBadge';
import { colors, typography } from './tokens';

interface Props {
  id: string;
  title: string;
  priority: 1 | 2 | 3 | 4;
  dueDate: string | null;
  completed?: boolean;
  onPress: (id: string) => void;
  onComplete: (id: string) => void;
}

export function TaskRow({ id, title, priority, dueDate, completed = false, onPress, onComplete }: Props) {
  const isOverdue = dueDate && dueDate < new Date().toISOString().split('T')[0];

  return (
    <Pressable style={styles.row} onPress={() => onPress(id)}>
      <TaskCheckbox priority={priority} checked={completed} onComplete={() => onComplete(id)} />
      <View style={styles.content}>
        <Text
          style={[styles.title, completed && styles.titleDone]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {dueDate && (
          <Text style={[styles.due, isOverdue && styles.dueOverdue]}>
            {dueDate}
          </Text>
        )}
      </View>
      <PriorityBadge priority={priority} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  content: { flex: 1 },
  title: { ...typography.body, color: colors.textPrimary },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  due: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  dueOverdue: { color: colors.p1 },
});
```

- [ ] **Step 8: Create packages/ui/src/index.ts**

```typescript
export { TaskCheckbox }        from './TaskCheckbox';
export { TaskRow }             from './TaskRow';
export { PriorityBadge }       from './PriorityBadge';
export { SyncStatusIndicator } from './SyncStatusIndicator';
export * from './tokens';
```

- [ ] **Step 9: Build the package**

```bash
pnpm --filter @todolist/ui install
pnpm --filter @todolist/ui build
```

Expected: `packages/ui/dist/` created, no TS errors.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add design tokens and base components (TaskRow, Checkbox, PriorityBadge, SyncStatus)"
```

---

## Task 9: Run full build and test suite

- [ ] **Step 1: Run all tests from root**

```bash
pnpm test
```

Expected output (trimmed):
```
@todolist/core > test
✓ packages/core/src/nlp/parser.test.ts (12 tests)
Test Files  1 passed (1)
Tests       12 passed (12)
```

- [ ] **Step 2: Run full build from root**

```bash
pnpm build
```

Expected: All packages build successfully. `dist/` directories exist under `packages/core`, `packages/db`, `packages/ui`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify full monorepo build and test suite passes"
```

---

## Completion Checklist

Before declaring Phase 1A done, verify:

- [ ] `pnpm test` passes — 12 NLP parser tests all green
- [ ] `pnpm build` passes — all three packages build without TS errors
- [ ] Supabase dashboard shows all 7 tables with RLS enabled
- [ ] PowerSync sync rules deployed and showing as active
- [ ] Spike ran successfully (sync spike output showed "✓ Spike passed")
- [ ] `packages/core`, `packages/db`, `packages/ui` all have `dist/` directories
