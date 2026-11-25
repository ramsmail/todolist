# Phase 2A — Web App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 14 web app that gives the todolist full offline-capable feature parity with the Phase 1 mobile app — Inbox, Today, Upcoming, Projects, Quick Capture, and Task Detail — deployed on Vercel.

**Architecture:** Client-side heavy (PowerSync local SQLite via `@powersync/web` + OPFS); Next.js App Router for routing and shell only. Supabase SSR (`@supabase/ssr`) for auth via cookies. Shared business logic from `@todolist/core` and `@todolist/db`. Platform-specific UI components in plain Tailwind CSS. Before building the web app, `packages/db` must be made platform-agnostic (it currently imports from `@powersync/react-native`).

**Tech Stack:** Next.js 14 (App Router), `@powersync/web`, `@powersync/react`, `@supabase/ssr`, `@supabase/supabase-js`, `@tanstack/react-virtual`, Tailwind CSS, `@todolist/core`, `@todolist/db`, Vitest, React Testing Library, axe-core, Playwright.

**Design spec:** `docs/design/specs/2026-06-22-phase2a-web-foundation-design.md`

---

## Prerequisites

- Phase 1B merged to master (auth and navigation — ✅ done)
- Phase 1C merged (or branched from `feature/phase1c` for this work)
- Supabase project live with RLS and PowerSync sync rules in place (from Phase 1A)

---

## File Map

```
packages/db/src/
  schema.ts                          MODIFY — import from @powersync/common
  queries/tasks.ts                   MODIFY — import AbstractPowerSyncDatabase
  queries/projects.ts                MODIFY — import AbstractPowerSyncDatabase

apps/web/
  package.json                       CREATE
  tsconfig.json                      CREATE
  next.config.js                     CREATE — COOP/COEP headers, transpilePackages
  tailwind.config.js                 CREATE — design tokens
  postcss.config.js                  CREATE
  middleware.ts                      CREATE — auth guard
  app/
    layout.tsx                       CREATE — root layout with PowerSyncProvider + sidebar
    page.tsx                         CREATE — redirect to /inbox
    globals.css                      CREATE
    login/page.tsx                   CREATE — login + register forms
    inbox/page.tsx                   CREATE
    today/page.tsx                   CREATE
    upcoming/page.tsx                CREATE
    search/page.tsx                  CREATE — placeholder
    projects/[id]/page.tsx           CREATE
    api/auth/
      token/route.ts                 CREATE — returns JWT for PowerSync
      signout/route.ts               CREATE
      callback/route.ts              CREATE
  components/
    layout/
      Sidebar.tsx                    CREATE
      SyncStatusIndicator.tsx        CREATE
    tasks/
      TaskRow.tsx                    CREATE
      TaskList.tsx                   CREATE — @tanstack/react-virtual
      QuickCaptureModal.tsx          CREATE
      TaskDetailPanel.tsx            CREATE — slide-in right panel
    projects/
      CreateProjectModal.tsx         CREATE
      ProjectPicker.tsx              CREATE
  hooks/
    useSyncStatus.ts                 CREATE
  lib/
    powersync/
      database.ts                    CREATE — PowerSync singleton (web)
      PowerSyncProvider.tsx          CREATE
      WebConnector.ts                CREATE
    supabase/
      client.ts                      CREATE — browser client
      server.ts                      CREATE — server client factory
  __tests__/
    QuickCaptureModal.test.tsx       CREATE
    TaskRow.test.tsx                 CREATE
    auth-redirect.test.tsx           CREATE
  e2e/
    golden-path.test.ts              CREATE
    offline-sync.test.ts             CREATE
  playwright.config.ts               CREATE
  vitest.config.ts                   CREATE
  vitest.setup.ts                    CREATE
```

---

## Task 1: Fix packages/db for web compatibility

`packages/db` currently imports from `@powersync/react-native` which has native module dependencies and cannot load in a browser. The schema and type imports must switch to `@powersync/common` which exports the same `column`, `Schema`, `Table`, and `AbstractPowerSyncDatabase` API.

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/queries/tasks.ts`
- Modify: `packages/db/src/queries/projects.ts`
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add @powersync/common, remove @powersync/react-native from packages/db deps**

```bash
cd packages/db
pnpm add @powersync/common
pnpm remove @powersync/react-native
```

Then update `packages/db/package.json` — the result should have `@powersync/common` instead of `@powersync/react-native`:

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
    "@powersync/common": "^1.55.0",
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

- [ ] **Step 2: Update packages/db/src/schema.ts**

```typescript
import { column, Schema, Table } from '@powersync/common';

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
    labels:           column.text,
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

- [ ] **Step 3: Update packages/db/src/queries/tasks.ts — fix type import**

Replace the first line only:
```typescript
import type { AbstractPowerSyncDatabase } from '@powersync/common';
```

Then replace every occurrence of `PowerSyncDatabase` (the type) in that file with `AbstractPowerSyncDatabase`. There are 7 occurrences in function signatures. The full updated function signatures are:

```typescript
export async function createTask(
  db: AbstractPowerSyncDatabase,
  fields: { ... }
): Promise<string>

export async function completeTask(db: AbstractPowerSyncDatabase, id: string): Promise<void>
export async function updateTaskTitle(db: AbstractPowerSyncDatabase, id: string, title: string): Promise<void>
export async function updateTaskDue(db: AbstractPowerSyncDatabase, id: string, dueDate: string | null, dueTime: string | null): Promise<void>
export async function updateTaskPriority(db: AbstractPowerSyncDatabase, id: string, priority: number): Promise<void>
export async function updateTaskProject(db: AbstractPowerSyncDatabase, id: string, projectId: string | null): Promise<void>
export async function deleteTask(db: AbstractPowerSyncDatabase, id: string): Promise<void>
```

- [ ] **Step 4: Update packages/db/src/queries/projects.ts — fix type import**

Replace first line with:
```typescript
import type { AbstractPowerSyncDatabase } from '@powersync/common';
```

Replace `PowerSyncDatabase` with `AbstractPowerSyncDatabase` in both function signatures:
```typescript
export async function createProject(
  db: AbstractPowerSyncDatabase,
  fields: { userId: string; name: string; color?: string; icon?: string; afterSortOrder?: string | null }
): Promise<string>

export async function deleteProject(db: AbstractPowerSyncDatabase, id: string): Promise<void>
```

- [ ] **Step 5: Fix apps/mobile — it imports PowerSyncDatabase from @powersync/react-native**

The mobile app's `SupabaseConnector.ts` and `database.ts` import from `@powersync/react-native`, which is correct for mobile. No change needed there. But verify mobile still builds:

```bash
pnpm --filter @todolist/db build
```

Expected: `dist/index.js` and `dist/index.d.ts` generated with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "fix(db): switch from @powersync/react-native to @powersync/common for web compatibility"
```

---

## Task 2: Bootstrap apps/web

Create the Next.js 14 app with Tailwind, TypeScript, and COOP/COEP headers for OPFS.

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@todolist/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@powersync/react": "^1.4.0",
    "@powersync/web": "^1.0.0",
    "@journeyapps/wa-sqlite": "*",
    "@supabase/supabase-js": "^2.44.0",
    "@supabase/ssr": "^0.5.0",
    "@tanstack/react-virtual": "^3.10.0",
    "@todolist/core": "workspace:*",
    "@todolist/db": "workspace:*",
    "fractional-indexing": "^3.2.0",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@todolist/config": "workspace:*",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "axe-core": "^4.10.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create apps/web/tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "e2e"]
}
```

- [ ] **Step 3: Create apps/web/next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@todolist/core',
    '@todolist/db',
    '@powersync/web',
    '@journeyapps/wa-sqlite',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

module.exports = nextConfig;
```

- [ ] **Step 4: Create apps/web/tailwind.config.js**

Design tokens match `packages/ui/src/tokens.ts`.

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent:        '#6366F1',
        'accent-dark': '#4F46E5',
        p1:            '#EF4444',
        p2:            '#F97316',
        p3:            '#3B82F6',
        p4:            '#9CA3AF',
        bg:            '#0A0A0A',
        surface:       '#141414',
        'surface-alt': '#1C1C1C',
        border:        '#272727',
        'text-primary':   '#F9FAFB',
        'text-secondary': '#9CA3AF',
        'text-muted':     '#6B7280',
        success:       '#22C55E',
        warning:       '#F59E0B',
        error:         '#EF4444',
        sidebar:       '#0D0D0D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Create apps/web/postcss.config.js**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create apps/web/app/globals.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #0A0A0A; }
```

- [ ] **Step 7: Install deps and copy PowerSync worker assets**

```bash
cd /path/to/todolist
pnpm install
pnpm --filter @todolist/web exec powersync-web copy-assets --output ./public/powersync
```

Expected: `apps/web/public/powersync/` directory created with WASM and worker JS files.

Add this as a `postinstall` step so it runs automatically:
```json
// In apps/web/package.json scripts:
"postinstall": "powersync-web copy-assets --output ./public/powersync"
```

- [ ] **Step 8: Verify Next.js starts**

```bash
pnpm --filter @todolist/web dev
```

Expected: Next.js starts on port 3000. `http://localhost:3000` returns a 404 or blank page (no routes yet). No build errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.js apps/web/tailwind.config.js apps/web/postcss.config.js apps/web/app/globals.css
git commit -m "feat(web): bootstrap Next.js 14 app with Tailwind, COOP/COEP headers, PowerSync assets"
```

---

## Task 3: Supabase clients + auth API routes

Create the browser and server Supabase clients, plus the three API routes used for auth.

**Files:**
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/app/api/auth/token/route.ts`
- Create: `apps/web/app/api/auth/signout/route.ts`
- Create: `apps/web/app/api/auth/callback/route.ts`

- [ ] **Step 1: Create apps/web/lib/supabase/client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Create apps/web/lib/supabase/server.ts**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create apps/web/app/api/auth/token/route.ts**

PowerSync's web connector calls this to get a fresh JWT. The server reads the session from the cookie and returns the access token.

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ token: session.access_token });
}
```

- [ ] **Step 4: Create apps/web/app/api/auth/signout/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
}
```

- [ ] **Step 5: Create apps/web/app/api/auth/callback/route.ts**

Handles the Supabase OAuth redirect (for future social login; not actively used yet but wires the standard Supabase callback flow):

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/inbox`);
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/ apps/web/app/api/
git commit -m "feat(web): add Supabase browser/server clients and auth API routes"
```

---

## Task 4: Auth middleware + login page

- [ ] **Step 1: Create apps/web/middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/api/auth');
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/inbox', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|powersync).*)'],
};
```

- [ ] **Step 2: Create apps/web/app/login/page.tsx**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push('/inbox');
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-text-primary text-2xl font-bold mb-2">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-text-muted text-sm mb-8">
          {mode === 'login' ? 'Sign in to continue.' : 'Start organizing your tasks.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-xs font-medium mb-1.5">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-text-secondary text-xs font-medium mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={12}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-semibold rounded-xl py-3 text-sm hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(null); }}
          className="mt-6 w-full text-text-muted text-sm hover:text-text-secondary transition-colors"
        >
          {mode === 'login' ? 'No account? Create one' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify auth redirect**

Start the dev server. Visit `http://localhost:3000`. Expected: redirected to `/login`. Sign in with Supabase credentials. Expected: redirected to `/inbox` (404 for now — routes not built yet).

- [ ] **Step 4: Commit**

```bash
git add apps/web/middleware.ts apps/web/app/login/
git commit -m "feat(web): add auth middleware and login/register page"
```

---

## Task 5: PowerSync web setup

**Files:**
- Create: `apps/web/lib/powersync/WebConnector.ts`
- Create: `apps/web/lib/powersync/database.ts`
- Create: `apps/web/lib/powersync/PowerSyncProvider.tsx`

- [ ] **Step 1: Create apps/web/lib/powersync/WebConnector.ts**

The connector is nearly identical to the mobile `SupabaseConnector.ts` — it fetches the JWT via the browser Supabase client and uploads local mutations to Supabase via the REST API.

```typescript
import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/web';
import { createClient } from '@/lib/supabase/client';

const FATAL_CODES = [/^22/, /^23/];

export class WebConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated — cannot fetch PowerSync credentials');
    }
    return {
      endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL!,
      token:    session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const supabase = createClient();

    try {
      for (const op of transaction.crud) {
        const table = supabase.from(op.table);
        let result: { error: any };

        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData ?? {}).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            result = await table
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', op.id);
            break;
          default:
            throw new Error(`Unknown UpdateType: ${(op as any).op}`);
        }

        if (result!.error) throw result!.error;
      }

      await transaction.complete();
    } catch (ex: any) {
      const code = ex?.code ?? '';
      if (FATAL_CODES.some(re => re.test(String(code)))) {
        console.error('Fatal upload error, discarding transaction:', ex);
        await transaction.complete();
      } else {
        throw ex;
      }
    }
  }
}
```

- [ ] **Step 2: Create apps/web/lib/powersync/database.ts**

Module-level singleton — only instantiated on the client (file is only bundled for the browser via `'use client'` or dynamic import).

```typescript
import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from '@todolist/db';

let instance: PowerSyncDatabase | undefined;

export function getPowerSyncDb(): PowerSyncDatabase {
  if (!instance) {
    instance = new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: 'todolist.db' },
    });
  }
  return instance;
}
```

- [ ] **Step 3: Create apps/web/lib/powersync/PowerSyncProvider.tsx**

```typescript
'use client';

import { PropsWithChildren, useEffect, useRef } from 'react';
import { PowerSyncContext } from '@powersync/react';
import { getPowerSyncDb } from './database';
import { WebConnector } from './WebConnector';

export function PowerSyncProvider({ children }: PropsWithChildren) {
  const db        = useRef(getPowerSyncDb());
  const connector = useRef(new WebConnector());

  useEffect(() => {
    db.current.connect(connector.current);
    return () => { db.current.disconnect(); };
  }, []);

  return (
    <PowerSyncContext.Provider value={db.current}>
      {children}
    </PowerSyncContext.Provider>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/powersync/
git commit -m "feat(web): add PowerSync web connector, database singleton, and provider"
```

---

## Task 6: Root layout + sidebar

**Files:**
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/components/layout/Sidebar.tsx`
- Create: `apps/web/hooks/useSyncStatus.ts`

- [ ] **Step 1: Create apps/web/hooks/useSyncStatus.ts**

Same logic as mobile — reads PowerSync connection state.

```typescript
'use client';

import { useEffect, useState } from 'react';
import { usePowerSync } from '@powersync/react';

export type SyncStatus = 'synced' | 'syncing' | 'stale' | 'offline';

const STALE_MS = 5 * 60 * 1000;

export function useSyncStatus(): { status: SyncStatus; lastSyncedAt: Date | null } {
  const db = usePowerSync();
  const [status,      setStatus]      = useState<SyncStatus>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => {
      const s = db.currentStatus;
      if (!s.connected) { setStatus('offline'); return; }
      if (s.dataFlowStatus?.downloading) { setStatus('syncing'); return; }
      const last = s.lastSyncedAt ? new Date(s.lastSyncedAt) : null;
      setLastSyncedAt(last);
      setStatus(last && Date.now() - last.getTime() > STALE_MS ? 'stale' : 'synced');
    };
    update();
    const unsub = db.registerListener({ statusChanged: update });
    return () => unsub();
  }, [db]);

  return { status, lastSyncedAt };
}
```

- [ ] **Step 2: Create apps/web/components/layout/SyncStatusIndicator.tsx**

```typescript
'use client';

import { useSyncStatus } from '@/hooks/useSyncStatus';

const dotColor: Record<string, string> = {
  synced:  'bg-success',
  syncing: 'bg-accent animate-pulse',
  stale:   'bg-warning',
  offline: 'bg-error',
};

const label: Record<string, string> = {
  synced:  'Synced',
  syncing: 'Syncing…',
  stale:   'Sync stale',
  offline: 'Offline',
};

export function SyncStatusIndicator() {
  const { status, lastSyncedAt } = useSyncStatus();
  const time = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[status]}`} />
      <span className="text-text-muted text-xs">
        {label[status]}{status === 'synced' && time ? ` ${time}` : ''}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Create apps/web/components/layout/Sidebar.tsx**

```typescript
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProjects } from '@todolist/db';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

const NAV = [
  { href: '/inbox',    label: 'Inbox',    icon: '📥' },
  { href: '/today',    label: 'Today',    icon: '☀️' },
  { href: '/upcoming', label: 'Upcoming', icon: '📅' },
  { href: '/search',   label: 'Search',   icon: '🔍' },
];

interface Props {
  onNewProject: () => void;
}

export function Sidebar({ onNewProject }: Props) {
  const pathname        = usePathname();
  const router          = useRouter();
  const { data: projects } = useProjects();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav
      className="w-60 flex-shrink-0 bg-sidebar border-r border-border flex flex-col h-screen sticky top-0"
      aria-label="Main navigation"
    >
      {/* App name */}
      <div className="px-4 py-5 border-b border-border">
        <span className="text-text-primary font-bold text-lg tracking-tight">TodoList</span>
      </div>

      {/* Core nav */}
      <ul className="mt-2 space-y-0.5 px-2" role="list">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${active
                    ? 'bg-surface text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                  }`}
                aria-current={active ? 'page' : undefined}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Projects */}
      <div className="mt-4 px-2 flex-1 overflow-y-auto">
        <p className="px-3 pb-1 text-xs font-semibold text-text-muted uppercase tracking-wider">
          Projects
        </p>
        <ul className="space-y-0.5" role="list">
          {projects.map(p => {
            const active = pathname === `/projects/${p.id}`;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                    ${active
                      ? 'bg-surface text-text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color ?? '#6366F1' }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{p.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-surface transition-colors mt-1"
        >
          + New project
        </button>
      </div>

      {/* Bottom: sync + sign out */}
      <div className="border-t border-border pb-2">
        <SyncStatusIndicator />
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full text-left px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Create apps/web/app/layout.tsx**

```typescript
import type { Metadata } from 'next';
import './globals.css';
import { ClientLayout } from './ClientLayout';

export const metadata: Metadata = {
  title: 'TodoList',
  description: 'Personal task management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create apps/web/components/projects/CreateProjectModal.tsx (stub)**

`ClientLayout.tsx` needs this import to compile. Create a stub now — Task 10 replaces it with the full implementation.

```typescript
// Stub — replaced in Task 10
export function CreateProjectModal(_: { open: boolean; onClose: () => void }) {
  return null;
}
```

- [ ] **Step 6: Create apps/web/app/ClientLayout.tsx**

The sidebar and PowerSyncProvider must be client components. Wrapping them in a separate client component keeps the root layout as a server component.

```typescript
'use client';

import { PropsWithChildren, useState } from 'react';
import { PowerSyncProvider } from '@/lib/powersync/PowerSyncProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { usePathname } from 'next/navigation';

export function ClientLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isLogin  = pathname === '/login';
  const [showCreate, setShowCreate] = useState(false);

  if (isLogin) return <>{children}</>;

  return (
    <PowerSyncProvider>
      <div className="flex h-screen bg-bg overflow-hidden">
        <Sidebar onNewProject={() => setShowCreate(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </PowerSyncProvider>
  );
}
```

- [ ] **Step 7: Create apps/web/app/page.tsx**

```typescript
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/inbox');
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/ClientLayout.tsx apps/web/app/page.tsx apps/web/components/layout/ apps/web/components/projects/CreateProjectModal.tsx apps/web/hooks/
git commit -m "feat(web): add root layout, sidebar, sync status indicator, CreateProjectModal stub"
```

---

## Task 7: Task components — TaskRow and TaskList

**Files:**
- Create: `apps/web/components/tasks/TaskRow.tsx`
- Create: `apps/web/components/tasks/TaskList.tsx`

- [ ] **Step 1: Create apps/web/components/tasks/TaskRow.tsx**

```typescript
import { memo } from 'react';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

export interface TaskRowItem {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
}

interface Props {
  task:       TaskRowItem;
  onPress:    (id: string) => void;
  onComplete: (id: string) => void;
}

function isOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().split('T')[0];
}

export const TaskRow = memo(function TaskRow({ task, onPress, onComplete }: Props) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 border-b border-border hover:bg-surface-alt/40 group cursor-pointer transition-colors"
      role="listitem"
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onComplete(task.id); }}
        className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
        style={{ borderColor: PRIORITY_COLOR[task.priority] ?? '#9CA3AF' }}
        aria-label={`Complete ${task.title}`}
      />

      {/* Content */}
      <button
        onClick={() => onPress(task.id)}
        className="flex-1 text-left min-w-0 focus:outline-none"
        aria-label={`Open task: ${task.title}`}
      >
        <p className="text-text-primary text-sm truncate">{task.title}</p>
        {task.due_date && (
          <p className={`text-xs mt-0.5 ${isOverdue(task.due_date) ? 'text-p1' : 'text-text-muted'}`}>
            {task.due_date}
          </p>
        )}
      </button>

      {/* Priority badge */}
      <span
        className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
        style={{ color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}20` }}
        aria-label={`Priority ${task.priority}`}
      >
        P{task.priority}
      </span>
    </div>
  );
});
```

- [ ] **Step 2: Create apps/web/components/tasks/TaskList.tsx**

Uses `@tanstack/react-virtual` for efficient rendering of large lists.

```typescript
'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TaskRow, type TaskRowItem } from './TaskRow';

interface Props {
  tasks:      TaskRowItem[];
  onPress:    (id: string) => void;
  onComplete: (id: string) => void;
}

export function TaskList({ tasks, onPress, onComplete }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count:         tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize:  () => 56,
    overscan:      5,
  });

  if (tasks.length === 0) return null;

  return (
    <div ref={parentRef} className="overflow-auto" style={{ height: '100%' }}>
      <div
        role="list"
        aria-label="Tasks"
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map(vi => (
          <div
            key={vi.key}
            style={{
              position:  'absolute',
              top:       0,
              left:      0,
              width:     '100%',
              transform: `translateY(${vi.start}px)`,
            }}
          >
            <TaskRow
              task={tasks[vi.index]}
              onPress={onPress}
              onComplete={onComplete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/tasks/TaskRow.tsx apps/web/components/tasks/TaskList.tsx
git commit -m "feat(web): add TaskRow and virtualised TaskList components"
```

---

## Task 8: Quick Capture Modal

**Files:**
- Create: `apps/web/components/tasks/QuickCaptureModal.tsx`

- [ ] **Step 1: Create apps/web/components/tasks/QuickCaptureModal.tsx**

```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePowerSync } from '@powersync/react';
import { parseTaskInput } from '@todolist/core';
import { createTask } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

interface Props {
  open:       boolean;
  projectId?: string | null;
  onClose:    () => void;
}

export function QuickCaptureModal({ open, projectId, onClose }: Props) {
  const db      = usePowerSync();
  const [input,  setInput]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const parsed = parseTaskInput(trimmed, { now: new Date() });
      await createTask(db as any, {
        userId:    user.id,
        title:     parsed.title,
        priority:  parsed.priority,
        dueDate:   parsed.dueDate,
        dueTime:   parsed.dueTime,
        timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId: projectId ?? null,
        labels:    parsed.labels,
        status:    'inbox',
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }, [db, input, projectId, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="New task"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-xl bg-surface-alt rounded-2xl p-6 shadow-2xl">
        <h2 className="text-text-primary font-semibold text-lg mb-1">New task</h2>
        <p className="text-text-muted text-xs mb-4">
          Tip: "Submit report p1 #work @waiting tomorrow 3pm"
        </p>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          placeholder="What needs to be done?"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent mb-4"
        />

        {error && <p className="text-error text-xs mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-border rounded-xl py-2.5 text-text-secondary text-sm hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!input.trim() || saving}
            className="flex-2 bg-accent text-white font-semibold rounded-xl py-2.5 px-6 text-sm hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/tasks/QuickCaptureModal.tsx
git commit -m "feat(web): add QuickCaptureModal with NLP parsing"
```

---

## Task 9: Inbox, Today, and Upcoming pages

**Files:**
- Create: `apps/web/app/inbox/page.tsx`
- Create: `apps/web/app/today/page.tsx`
- Create: `apps/web/app/upcoming/page.tsx`
- Create: `apps/web/app/search/page.tsx`

- [ ] **Step 1: Create apps/web/app/inbox/page.tsx**

```typescript
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useInboxTasks, completeTask } from '@todolist/db';
import { TaskList } from '@/components/tasks/TaskList';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function InboxPage() {
  const db               = usePowerSync();
  const { data: tasks }  = useInboxTasks();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h1 className="text-text-primary text-xl font-bold">Inbox</h1>
          <button
            onClick={() => setCapture(true)}
            className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
            aria-label="Add task"
          >
            + Add task
          </button>
        </div>

        {/* Task list or empty */}
        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-text-primary font-semibold text-lg">Inbox is clear</p>
            <p className="text-text-muted text-sm">Click "+ Add task" to capture something</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TaskList
              tasks={tasks as any}
              onPress={setDetailId}
              onComplete={handleComplete}
            />
          </div>
        )}
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />

      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Create apps/web/app/today/page.tsx**

```typescript
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useTodayTasks, completeTask } from '@todolist/db';
import { TaskRow } from '@/components/tasks/TaskRow';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function TodayPage() {
  const db              = usePowerSync();
  const { data: tasks } = useTodayTasks();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const today   = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.due_date && t.due_date < today);
  const dueToday = tasks.filter(t => t.due_date === today);

  const handleComplete = async (id: string) => { await completeTask(db as any, id); };

  const renderSection = (title: string, items: typeof tasks, titleClass = '') => (
    items.length > 0 && (
      <section aria-labelledby={`section-${title}`}>
        <h2
          id={`section-${title}`}
          className={`px-6 py-2 text-xs font-semibold uppercase tracking-wider border-b border-border ${titleClass || 'text-text-muted'}`}
        >
          {title}
        </h2>
        <div role="list">
          {items.map(task => (
            <TaskRow
              key={task.id}
              task={task as any}
              onPress={setDetailId}
              onComplete={handleComplete}
            />
          ))}
        </div>
      </section>
    )
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h1 className="text-text-primary text-xl font-bold">Today</h1>
          <button
            onClick={() => setCapture(true)}
            className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
          >
            + Add task
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-text-primary font-semibold text-lg">All done for today 🎉</p>
              <p className="text-text-muted text-sm">Nothing due today or overdue</p>
            </div>
          ) : (
            <>
              {renderSection('Overdue', overdue, 'text-p1')}
              {renderSection('Today', dueToday)}
            </>
          )}
        </div>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </div>
  );
}
```

- [ ] **Step 3: Create apps/web/app/upcoming/page.tsx**

```typescript
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useUpcomingTasks, completeTask } from '@todolist/db';
import { TaskRow } from '@/components/tasks/TaskRow';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

function groupByDate(tasks: any[]): { date: string; tasks: any[] }[] {
  const map = new Map<string, any[]>();
  for (const t of tasks) {
    const d = t.due_date ?? 'No date';
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(t);
  }
  return Array.from(map.entries()).map(([date, tasks]) => ({ date, tasks }));
}

function formatDate(iso: string) {
  if (iso === 'No date') return iso;
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export default function UpcomingPage() {
  const db              = usePowerSync();
  const { data: tasks } = useUpcomingTasks();
  const [detailId, setDetailId] = useState<string | null>(null);
  const groups = groupByDate(tasks);

  const handleComplete = async (id: string) => { await completeTask(db as any, id); };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-border">
          <h1 className="text-text-primary text-xl font-bold">Upcoming</h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-text-primary font-semibold text-lg">Nothing upcoming</p>
              <p className="text-text-muted text-sm">Tasks due in the next 7 days appear here</p>
            </div>
          ) : (
            groups.map(({ date, tasks: groupTasks }) => (
              <section key={date} aria-labelledby={`date-${date}`}>
                <h2
                  id={`date-${date}`}
                  className="px-6 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border"
                >
                  {formatDate(date)}
                </h2>
                <div role="list">
                  {groupTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onPress={setDetailId}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
```

- [ ] **Step 4: Create apps/web/app/search/page.tsx**

```typescript
export default function SearchPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <p className="text-text-primary font-semibold text-lg">Search coming soon</p>
      <p className="text-text-muted text-sm">Full-text search arrives in Phase 2C</p>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/inbox/ apps/web/app/today/ apps/web/app/upcoming/ apps/web/app/search/
git commit -m "feat(web): add Inbox, Today, Upcoming, and Search placeholder pages"
```

---

## Task 10: Project pages and CreateProjectModal

**Files:**
- Create: `apps/web/components/projects/CreateProjectModal.tsx`
- Create: `apps/web/components/projects/ProjectPicker.tsx`
- Create: `apps/web/app/projects/[id]/page.tsx`

- [ ] **Step 1: Create apps/web/components/projects/CreateProjectModal.tsx**

```typescript
'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { createProject } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

const COLORS = ['#6366F1','#EF4444','#F97316','#22C55E','#3B82F6','#EC4899','#F59E0B'];
const ICONS  = ['📁','⭐','🏠','💼','🎯','📚','🏋️','🛒','💡'];

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function CreateProjectModal({ open, onClose }: Props) {
  const db         = usePowerSync();
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon,  setIcon]  = useState(ICONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await createProject(db as any, { userId: user.id, name: name.trim(), color, icon });
      setName(''); setColor(COLORS[0]); setIcon(ICONS[0]);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      role="dialog" aria-modal="true" aria-label="New project"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-surface-alt rounded-2xl p-6 shadow-2xl">
        <h2 className="text-text-primary font-semibold text-lg mb-4">New project</h2>

        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Name</label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Project name"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent mb-4"
        />

        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Color</label>
        <div className="flex gap-2 mb-4">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-alt scale-110' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            />
          ))}
        </div>

        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Icon</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {ICONS.map(i => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={`text-xl p-1.5 rounded-lg border transition-colors ${icon === i ? 'border-accent bg-surface' : 'border-transparent hover:bg-surface'}`}
              aria-label={`Icon ${i}`}
              aria-pressed={icon === i}
            >
              {i}
            </button>
          ))}
        </div>

        {error && <p className="text-error text-xs mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-border rounded-xl py-2.5 text-text-secondary text-sm hover:bg-surface transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="flex-[2] bg-accent text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create apps/web/components/projects/ProjectPicker.tsx**

Used in TaskDetailPanel to reassign a task's project.

```typescript
'use client';

import { useRef, useState, useEffect } from 'react';
import { useProjects } from '@todolist/db';

interface Props {
  value:    string | null;
  onChange: (projectId: string | null) => void;
}

export function ProjectPicker({ value, onChange }: Props) {
  const { data: projects } = useProjects();
  const [open, setOpen]    = useState(false);
  const ref                = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const current = projects.find(p => p.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: current.color }} />
            {current.name}
          </>
        ) : (
          <span className="text-text-muted">No project</span>
        )}
        <span className="text-text-muted text-xs">▾</span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-48 bg-surface-alt border border-border rounded-xl shadow-lg z-10 py-1"
          role="listbox"
          aria-label="Select project"
        >
          <button
            role="option"
            aria-selected={value === null}
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-text-muted hover:bg-surface transition-colors"
          >
            No project
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              role="option"
              aria-selected={value === p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create apps/web/app/projects/[id]/page.tsx**

```typescript
'use client';

import { useState } from 'react';
import { use } from 'react';
import { usePowerSync } from '@powersync/react';
import { useProjectTasks, useProjects, completeTask } from '@todolist/db';
import { TaskList } from '@/components/tasks/TaskList';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }            = use(params);
  const db                = usePowerSync();
  const { data: tasks }   = useProjectTasks(id);
  const { data: projects} = useProjects();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const project = projects.find(p => p.id === id);
  const handleComplete = async (taskId: string) => { await completeTask(db as any, taskId); };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            {project && (
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color }}
                aria-hidden="true"
              />
            )}
            <h1 className="text-text-primary text-xl font-bold">
              {project?.name ?? 'Project'}
            </h1>
          </div>
          <button
            onClick={() => setCapture(true)}
            className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
          >
            + Add task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-text-primary font-semibold text-lg">No tasks yet</p>
            <p className="text-text-muted text-sm">Add the first task to this project</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TaskList tasks={tasks as any} onPress={setDetailId} onComplete={handleComplete} />
          </div>
        )}
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} projectId={id} onClose={() => setCapture(false)} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/projects/ apps/web/app/projects/
git commit -m "feat(web): add project pages, CreateProjectModal, and ProjectPicker"
```

---

## Task 11: Task Detail Panel

**Files:**
- Create: `apps/web/components/tasks/TaskDetailPanel.tsx`

- [ ] **Step 1: Create apps/web/components/tasks/TaskDetailPanel.tsx**

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  useTask, useSubtasks,
  updateTaskTitle, updateTaskPriority, updateTaskProject,
  updateTaskDue, deleteTask, createTask, completeTask,
} from '@todolist/db';
import { ProjectPicker } from '@/components/projects/ProjectPicker';
import { createClient } from '@/lib/supabase/client';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

interface Props {
  taskId:  string | null;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: Props) {
  const db             = usePowerSync();
  const { data: rows } = useTask(taskId ?? '');
  const { data: subs } = useSubtasks(taskId ?? '');
  const task           = rows?.[0];

  const [titleDraft,    setTitleDraft]    = useState('');
  const [editingTitle,  setEditingTitle]  = useState(false);
  const [newSubTitle,   setNewSubTitle]   = useState('');
  const [addingSub,     setAddingSub]     = useState(false);

  useEffect(() => {
    if (task) setTitleDraft(task.title);
  }, [task?.id, task?.title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveTitle = useCallback(async () => {
    if (!task || !titleDraft.trim()) return;
    setEditingTitle(false);
    if (titleDraft.trim() !== task.title) {
      await updateTaskTitle(db as any, task.id, titleDraft.trim());
    }
  }, [db, task, titleDraft]);

  const handlePriority = useCallback(async (p: number) => {
    if (!task) return;
    await updateTaskPriority(db as any, task.id, p);
  }, [db, task]);

  const handleProject = useCallback(async (projectId: string | null) => {
    if (!task) return;
    await updateTaskProject(db as any, task.id, projectId);
  }, [db, task]);

  const handleDueDate = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task) return;
    await updateTaskDue(db as any, task.id, e.target.value || null, null);
  }, [db, task]);

  const handleDelete = useCallback(async () => {
    if (!task || !confirm('Delete this task?')) return;
    await deleteTask(db as any, task.id);
    onClose();
  }, [db, task, onClose]);

  const handleAddSub = useCallback(async () => {
    const title = newSubTitle.trim();
    if (!title || !task) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await createTask(db as any, {
      userId: user.id, title, parentTaskId: task.id, status: 'active', priority: 4,
    });
    setNewSubTitle('');
  }, [db, task, newSubTitle]);

  const handleCompleteSub = useCallback(async (id: string) => {
    await completeTask(db as any, id);
  }, [db]);

  if (!taskId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 h-full w-[480px] bg-surface-alt border-l border-border z-40 flex flex-col shadow-2xl overflow-y-auto"
        role="complementary"
        aria-label="Task detail"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">Task</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors text-lg"
            aria-label="Close panel"
          >
            ×
          </button>
        </div>

        {!task ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-sm">Loading…</p>
          </div>
        ) : (
          <div className="flex-1 p-6 space-y-6">
            {/* Title */}
            {editingTitle ? (
              <textarea
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); } }}
                className="w-full bg-surface border border-accent rounded-xl px-4 py-3 text-text-primary text-lg font-semibold resize-none focus:outline-none"
                rows={2}
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="w-full text-left text-text-primary text-lg font-semibold hover:opacity-80 transition-opacity"
                aria-label="Edit task title"
              >
                {task.title}
              </button>
            )}

            {/* Priority */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Priority</p>
              <div className="flex gap-2">
                {([1, 2, 3, 4] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePriority(p)}
                    aria-pressed={task.priority === p}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                    style={{
                      borderColor: PRIORITY_COLOR[p],
                      color:       task.priority === p ? '#fff' : PRIORITY_COLOR[p],
                      backgroundColor: task.priority === p ? PRIORITY_COLOR[p] : 'transparent',
                    }}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Due date</p>
              <input
                type="date"
                value={task.due_date ?? ''}
                onChange={handleDueDate}
                className="bg-surface border border-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {/* Project */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Project</p>
              <ProjectPicker value={task.project_id ?? null} onChange={handleProject} />
            </div>

            {/* Sub-tasks */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Sub-tasks</p>
              <div className="space-y-2">
                {subs.map(sub => (
                  <div key={sub.id} className="flex items-center gap-3">
                    <button
                      onClick={() => handleCompleteSub(sub.id)}
                      className="w-4 h-4 rounded-full border border-p4 flex-shrink-0 hover:bg-success/20 transition-colors"
                      aria-label={`Complete ${sub.title}`}
                    />
                    <span className={`text-sm flex-1 ${sub.status === 'completed' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>

              {addingSub ? (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    autoFocus
                    type="text"
                    value={newSubTitle}
                    onChange={e => setNewSubTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSub();
                      if (e.key === 'Escape') { setAddingSub(false); setNewSubTitle(''); }
                    }}
                    placeholder="Sub-task title"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent"
                  />
                  <button onClick={handleAddSub} className="text-accent text-sm font-medium">Add</button>
                  <button onClick={() => { setAddingSub(false); setNewSubTitle(''); }} className="text-text-muted text-sm">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSub(true)}
                  className="mt-2 text-accent text-sm hover:opacity-80 transition-opacity"
                >
                  + Add sub-task
                </button>
              )}
            </div>

            {/* Delete */}
            <div className="pt-4 border-t border-border">
              <button
                onClick={handleDelete}
                className="w-full border border-error text-error rounded-xl py-2.5 text-sm font-medium hover:bg-error/10 transition-colors"
              >
                Delete task
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/tasks/TaskDetailPanel.tsx
git commit -m "feat(web): add slide-in TaskDetailPanel with all edit fields and sub-tasks"
```

---

## Task 12: Vitest + RTL + axe-core tests

**Files:**
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/vitest.setup.ts`
- Create: `apps/web/__tests__/QuickCaptureModal.test.tsx`
- Create: `apps/web/__tests__/TaskRow.test.tsx`
- Create: `apps/web/__tests__/axe.test.tsx`

- [ ] **Step 1: Create apps/web/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles:  ['./vitest.setup.ts'],
    globals:     true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 2: Create apps/web/vitest.setup.ts**

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Write failing TaskRow test**

Create `apps/web/__tests__/TaskRow.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from '@/components/tasks/TaskRow';

const TASK = { id: '1', title: 'Buy milk', priority: 2, due_date: null, status: 'inbox' };

test('renders task title', () => {
  render(<TaskRow task={TASK} onPress={vi.fn()} onComplete={vi.fn()} />);
  expect(screen.getByText('Buy milk')).toBeInTheDocument();
});

test('calls onPress when content area clicked', () => {
  const onPress = vi.fn();
  render(<TaskRow task={TASK} onPress={onPress} onComplete={vi.fn()} />);
  fireEvent.click(screen.getByLabelText('Open task: Buy milk'));
  expect(onPress).toHaveBeenCalledWith('1');
});

test('calls onComplete when checkbox clicked', () => {
  const onComplete = vi.fn();
  render(<TaskRow task={TASK} onPress={vi.fn()} onComplete={onComplete} />);
  fireEvent.click(screen.getByLabelText('Complete Buy milk'));
  expect(onComplete).toHaveBeenCalledWith('1');
});

test('shows overdue date in red', () => {
  const overdue = { ...TASK, due_date: '2020-01-01' };
  render(<TaskRow task={overdue} onPress={vi.fn()} onComplete={vi.fn()} />);
  const dateEl = screen.getByText('2020-01-01');
  expect(dateEl).toHaveClass('text-p1');
});
```

- [ ] **Step 4: Run to see it fail**

```bash
pnpm --filter @todolist/web test
```

Expected: FAIL — `TaskRow` not yet imported correctly or jsdom issues. Fix any import resolution issues (the `@/` alias should resolve via vitest config).

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm --filter @todolist/web test
```

Expected: 4 passing.

- [ ] **Step 6: Write QuickCaptureModal tests**

Create `apps/web/__tests__/QuickCaptureModal.test.tsx`.

These tests mock PowerSync and Supabase to test just the component behaviour:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';

// Mock PowerSync
vi.mock('@powersync/react', () => ({
  usePowerSync: () => ({ execute: vi.fn() }),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

// Mock @todolist/db createTask
vi.mock('@todolist/db', async () => {
  const actual = await vi.importActual<any>('@todolist/db');
  return { ...actual, createTask: vi.fn().mockResolvedValue('new-id') };
});

import { createTask } from '@todolist/db';

test('does not render when closed', () => {
  render(<QuickCaptureModal open={false} onClose={vi.fn()} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('renders when open', () => {
  render(<QuickCaptureModal open={true} onClose={vi.fn()} />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument();
});

test('calls onClose when Cancel clicked', () => {
  const onClose = vi.fn();
  render(<QuickCaptureModal open={true} onClose={onClose} />);
  fireEvent.click(screen.getByText('Cancel'));
  expect(onClose).toHaveBeenCalled();
});

test('parses NLP and calls createTask on submit', async () => {
  const onClose = vi.fn();
  render(<QuickCaptureModal open={true} onClose={onClose} />);
  fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), {
    target: { value: 'Buy milk p1' },
  });
  fireEvent.click(screen.getByText('Add task'));
  await waitFor(() => expect(createTask).toHaveBeenCalled());
  const call = (createTask as any).mock.calls[0][1];
  expect(call.title).toBe('Buy milk');
  expect(call.priority).toBe(1);
});
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @todolist/web test
```

Expected: all tests pass.

- [ ] **Step 8: Write axe accessibility tests**

Create `apps/web/__tests__/axe.test.tsx`:

```typescript
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { TaskRow } from '@/components/tasks/TaskRow';

const TASK = { id: '1', title: 'Test task', priority: 3, due_date: '2026-12-01', status: 'inbox' };

test('TaskRow has no axe violations', async () => {
  const { container } = render(
    <ul>
      <TaskRow task={TASK} onPress={vi.fn()} onComplete={vi.fn()} />
    </ul>
  );
  const results = await axe.run(container);
  expect(results.violations).toHaveLength(0);
});
```

- [ ] **Step 9: Run axe tests**

```bash
pnpm --filter @todolist/web test
```

Expected: axe violation count = 0. If violations appear, fix the component before continuing.

- [ ] **Step 10: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/vitest.setup.ts apps/web/__tests__/
git commit -m "test(web): add Vitest + RTL + axe tests for TaskRow and QuickCaptureModal"
```

---

## Task 13: Playwright E2E tests

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/golden-path.test.ts`
- Create: `apps/web/e2e/offline-sync.test.ts`

- [ ] **Step 1: Install Playwright browsers**

```bash
pnpm --filter @todolist/web exec playwright install chromium
```

- [ ] **Step 2: Create apps/web/playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:   './e2e',
  timeout:   30_000,
  retries:   1,
  reporter:  'html',
  use: {
    baseURL:     'http://localhost:3000',
    trace:       'on-first-retry',
    screenshot:  'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url:     'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Create E2E test users in Supabase**

In Supabase dashboard → Authentication → Users → Add user:
- Email: `e2e@test.com`
- Password: `E2eTestPass123!`

Set env var `E2E_EMAIL=e2e@test.com` and `E2E_PASSWORD=E2eTestPass123!` in `.env.local`.

- [ ] **Step 4: Create apps/web/e2e/golden-path.test.ts**

```typescript
import { test, expect } from '@playwright/test';

const EMAIL    = process.env.E2E_EMAIL    ?? 'e2e@test.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eTestPass123!';

test.describe('Golden path', () => {
  test('login → quick capture → complete task', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/inbox', { timeout: 10_000 });

    // Quick capture
    await page.click('button[aria-label="Add task"]');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.fill('input[placeholder="What needs to be done?"]', 'E2E golden path task p2');
    await page.click('button:has-text("Add task")');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Task appears in list
    await expect(page.getByText('E2E golden path task')).toBeVisible({ timeout: 8_000 });

    // Open task detail
    await page.click(`button[aria-label="Open task: E2E golden path task"]`);
    await expect(page.getByRole('complementary', { name: 'Task detail' })).toBeVisible();
    await expect(page.getByText('P2')).toBeVisible();

    // Complete the task
    await page.keyboard.press('Escape');
    await page.click(`button[aria-label="Complete E2E golden path task"]`);
    await expect(page.getByText('E2E golden path task')).not.toBeVisible({ timeout: 5_000 });
  });

  test('sign out and redirect to login', async ({ page }) => {
    await page.goto('/inbox');
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL('/login', { timeout: 5_000 });
  });
});
```

- [ ] **Step 5: Create apps/web/e2e/offline-sync.test.ts**

```typescript
import { test, expect } from '@playwright/test';

const EMAIL    = process.env.E2E_EMAIL    ?? 'e2e@test.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eTestPass123!';

test('offline: create task while disconnected, verify sync on reconnect', async ({ page, context }) => {
  // Login first
  await page.goto('/login');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/inbox', { timeout: 10_000 });

  // Wait for initial sync
  await page.waitForTimeout(3_000);

  // Go offline
  await context.setOffline(true);

  // Sidebar should show "Offline"
  await expect(page.getByText('Offline')).toBeVisible({ timeout: 8_000 });

  // Create task while offline
  await page.click('button[aria-label="Add task"]');
  await page.fill('input[placeholder="What needs to be done?"]', 'Offline task test');
  await page.click('button:has-text("Add task")');
  await expect(page.getByText('Offline task test')).toBeVisible({ timeout: 5_000 });

  // Reconnect
  await context.setOffline(false);

  // Sync indicator should return to synced
  await expect(page.getByText('Synced')).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 6: Run E2E tests**

```bash
cd apps/web
E2E_EMAIL=e2e@test.com E2E_PASSWORD=E2eTestPass123! pnpm test:e2e
```

Expected:
```
✓ Golden path › login → quick capture → complete task
✓ Golden path › sign out and redirect to login
✓ offline: create task while disconnected, verify sync on reconnect
3 passed
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e/
git commit -m "test(web): add Playwright E2E golden-path and offline-sync tests"
```

---

## Task 14: Vercel deployment

- [ ] **Step 1: Create apps/web/.env.local (gitignored)**

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_POWERSYNC_URL=https://<your-instance>.powersync.journeyapps.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
E2E_EMAIL=e2e@test.com
E2E_PASSWORD=E2eTestPass123!
```

Add to root `.gitignore` if not already:
```
apps/web/.env.local
```

- [ ] **Step 2: Production build passes locally**

```bash
pnpm --filter @todolist/web build
```

Expected: Next.js build succeeds. No TypeScript errors. COOP/COEP headers visible in build output.

- [ ] **Step 3: Connect Vercel**

1. Push the branch to GitHub
2. Go to `vercel.com` → New Project → Import the `todolist` repo
3. Set **Root Directory** to `apps/web`
4. Add environment variables (same as `.env.local` above, but `NEXT_PUBLIC_APP_URL` = the Vercel URL)
5. Deploy

- [ ] **Step 4: Verify COOP/COEP headers on Vercel**

In browser DevTools → Network → pick any request from the deployed URL → check response headers:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If missing, verify `next.config.js` headers block is correct.

- [ ] **Step 5: Smoke test the deployed app**

1. Open the Vercel URL
2. Sign in with the real Supabase account
3. Create a task via Quick Capture
4. Navigate to Today and Upcoming
5. Verify sync indicator shows "Synced"

- [ ] **Step 6: Commit .gitignore update**

```bash
git add .gitignore
git commit -m "chore: add apps/web/.env.local to gitignore"
```

---

## Completion Checklist

Before declaring Phase 2A done, verify all of the following:

- [ ] `pnpm --filter @todolist/db build` passes — no TypeScript errors after the `@powersync/common` migration
- [ ] `pnpm --filter @todolist/mobile` still builds correctly (no regressions from db package change)
- [ ] `pnpm --filter @todolist/web dev` starts without errors
- [ ] Login page visible at `/login`; redirects to `/inbox` after signing in
- [ ] Unauthenticated visits to `/inbox` redirect to `/login`
- [ ] Sidebar shows Inbox, Today, Upcoming, Search links
- [ ] Projects list in sidebar is reactive (create a project → it appears immediately)
- [ ] Inbox shows live tasks; completes on checkbox click; task disappears
- [ ] Today groups tasks into Overdue and Today sections
- [ ] Upcoming groups tasks by date for next 7 days
- [ ] Quick Capture: type "Buy milk p1 tomorrow" → task created with P1 and tomorrow's due date
- [ ] TaskDetailPanel slides in; title edit saves on blur; priority buttons work; date picker works; sub-tasks add and complete; delete with confirmation
- [ ] Sync status indicator: green when online; red after airplane mode; returns to green on reconnect
- [ ] Vitest unit tests: all passing
- [ ] axe-core: zero WCAG AA violations on TaskRow
- [ ] Playwright E2E: 3 tests passing (golden path × 2 + offline sync)
- [ ] Production build passes (`pnpm --filter @todolist/web build`)
- [ ] Vercel deployment live with COOP/COEP headers verified
