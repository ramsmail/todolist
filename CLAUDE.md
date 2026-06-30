# TodoList — Project Notes for Claude

Productivity app. Monorepo (pnpm workspaces + Turbo) with Next.js 14 web app, Expo mobile app, and shared code in `packages/*`. Deployed on Vercel.

## Stack

- **Web:** Next.js 14 (App Router), `apps/web`
- **Mobile:** Expo (React Native), `apps/mobile`
- **Shared:** `packages/*` (pnpm workspaces + Turbo)
- **Backend:** Supabase (Postgres, auth, storage)
- **Sync:** PowerSync for offline-first sync; OPFS adapter on both web and mobile; local SQLite is the source of truth for reads
- **Styling:** NativeWind v4.0.36 on both platforms
- **Deployment:** Vercel; Node 24 pinned (`.nvmrc` + `package.json` engines + Vercel dashboard)

## Commands

```bash
pnpm dev              # Start web app (localhost:3000)
pnpm test             # Run unit tests (apps/web/__tests__)
pnpm test:watch       # Watch tests
pnpm test:e2e         # Playwright E2E tests (apps/web/e2e)
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript check (recommended after multi-file changes)
pnpm build            # Full Turbo build (run before any deploy-relevant change is marked done)
npm run check-versions # Verify Node version consistency
```

## Schema Changes — Read Before Touching Any Table

There are three representations of the data model that **must stay in sync**:

1. **`supabase/migrations/`** — Postgres schema (source of truth)
2. **`powersync/sync-rules.yaml`** — PowerSync sync rules (which columns/tables replicate to clients)
3. **`packages/db/`** — TypeScript schema + queries

**Workflow:** Update migrations first → sync rules → `packages/db` types, in that order.

⚠️ **Critical:** Never edit `packages/db` types without checking if sync rules also need updating. A missing sync rule means a column exists in Postgres but never reaches clients — fails silently.

See [`docs/SCHEMA_SYNC_STRATEGY.md`](docs/SCHEMA_SYNC_STRATEGY.md) for detailed change workflows with checklists.

## PowerSync-Specific Rules

- **Writes:** Go through PowerSync's local-first write path, not direct Supabase calls (except established patterns — check `packages/db` first)
- **Tombstones:** PowerSync automatically handles soft deletes — do NOT add manual `deleted_at` filters on top of it (double-filtering causes silent data loss, not errors)
- **Missing sync rules fail silently:** A new table that doesn't get a corresponding sync rule in `powersync/` exists in Postgres but never appears on-device. If a feature seems to "not save," check sync rules before blaming app code

## Security

- **Middleware checks presence; server components must verify.** `middleware.ts` is not an auth gate — every route handler and server component that uses `user.id` must independently call Supabase session verification. A missing verification call silently reopens the hole middleware was supposed to close.
- **Postgres RLS is the actual security boundary, not `packages/db` filters.** App-layer `WHERE user_id = ...` in query code is a UX convenience. If RLS is missing on a table, a query bug becomes a data leak, not a UI bug. Verify RLS policies before shipping any new table.
- **Sync rules are an authorization surface.** A permissive or missing `WHERE user_id = request.user_id()` clause in `powersync/sync-rules.yaml` silently ships other users' rows to every client — it doesn't look like an API route, so it's easy to miss in security review.
- **Server-side validation is the enforcement point for writes.** Client logic in `packages/core` can be bypassed by a modified client. Rely on Postgres constraints, RLS, or sync rule write filters for anything security-critical.

## Middleware

`apps/web/middleware.ts` does **cookie-presence checks only** — no JWT verification, no DB calls. Real auth verification happens in server components / route handlers. This is intentional, not an oversight. Do not add verification logic to middleware.

## Monorepo Boundaries

- **`packages/core`** — Business logic (recurrence, filters, task rules). No React, no DB client imports. If it starts importing `packages/db`, stop and reconsider.
- **`packages/db`** — Database schema + queries. Only package that imports PowerSync/Supabase. All app reads go through this.
- **`packages/ui`** — Shared components (both web and mobile). NativeWind classes only. No platform-specific imports.
- **`packages/config`** — Lint/tooling config only.
- **Don't cross-import:** No imports between `apps/web` ↔ `apps/mobile`. All shared code goes through `packages/*`.

## Folder Structure

- **`docs/design/`** — Phase specs and implementation plans (check for existing spec before starting a feature)
- **`docs/SCHEMA_SYNC_STRATEGY.md`** — How to safely add tables/columns
- **`docs/DISTRIBUTION.md`** — Build/EAS model and the developer-vs-end-user account split (one shared backend, per-user app sign-up)
- **Package-specific guides:** `packages/db/CLAUDE.md`, `packages/core/CLAUDE.md`, `packages/ui/CLAUDE.md` — read these before working in that package

## Workflow Expectations

- **Plan first:** For anything touching multiple files or the schema, plan first and wait for approval before implementing
- **Run checks before "done":** Don't just assert it works — show lint + typecheck + test output
- **Commit messages:** Conventional commits style (`feat:`, `fix:`, `chore:`, etc.) for potential changelog tooling
- **Verify against Postgres:** Schema/type changes must be verified against actual migrations, not just TS edits (types can be wrong and still compile)

## Reliability

- **Silent failures are the highest-risk bug class in this stack.** Missing sync rule, double-filtered tombstones, missing RLS, bypassed PowerSync path — all fail by doing nothing, not by crashing. When testing, confirm the expected row *actually arrived*; don't just check that the request succeeded.
- **Offline-first means conflict resolution must be designed, not assumed.** Two devices can write the same task while offline. Decide a strategy (last-write-wins, field-level merge) and write a test that exercises the conflict, not just the happy single-device path.
- **Turbo cache correctness matters for CI reliability.** Misconfigured `inputs`/`outputs` in `turbo.json` silently skip dependent builds. Verify cache scoping whenever new build targets are added.

## Deployment (Vercel) — READ BEFORE DEBUGGING DEPLOY ERRORS

### The __dirname / framework=null Bug

The Vercel **project framework preset MUST be `nextjs`**. If it's ever `null` ("Other"), Vercel ships the transpiled `middleware.ts` with a live `import 'next/server'` plus raw `node_modules/next`, instead of properly bundling it. At edge runtime, `ua-parser-js` executes `__nccwpck_require__.ab = __dirname + "/"` and crashes:

```
[ReferenceError: __dirname is not defined]   (source: edge-middleware)
MIDDLEWARE_INVOCATION_FAILED → HTTP 500 on every route
```

**This is a project-config bug, not code.** No polyfills fix it because Vercel isn't bundling the middleware at all.

**Fix:** Verify the preset is `nextjs`:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v9/projects/<projectId>?teamId=<teamId>" | jq .framework
# If null, PATCH it:
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "https://api.vercel.com/v9/projects/<projectId>?teamId=<teamId>" -d '{"framework":"nextjs"}'
```

**Reproduce locally:**
```bash
set -a; . apps/web/.env.local; set +a
vercel pull --yes --environment=production
vercel build --prod
# Healthy: .vercel/output/functions/middleware.func/index.js (~85 KB, no __dirname)
# Broken: .vercel/output/functions/middleware.func/apps/web/middleware.js + traced node_modules/
```

### Other Deploy Gotchas

- **Never upload `.worktrees/` to Vercel:** It's git-ignored, but CLI deploys without `.vercelignore` upload it anyway (~1.6 GB of node_modules + colliding `@todolist/web` package.json). The `.vercelignore` file excludes it; keep it.
- **`next build` hides deploy-only bugs:** `next build` always bundles middleware correctly locally. Use `vercel build` to see what actually ships to production.
- **Node version mismatch:** Run `npm run check-versions` before pushing to catch Node version drift between `.nvmrc` and `package.json`.

## What NOT to Do

- ❌ Don't add auth verification logic to middleware
- ❌ Don't bypass PowerSync to write directly to Supabase from client code
- ❌ Don't add top-level deps to `apps/web` or `apps/mobile` without checking if they belong in a shared `packages/*`
- ❌ Don't touch `supabase/migrations/` and `powersync/` in separate, unrelated commits — schema changes should touch both together
- ❌ Don't manually filter `deleted_at IS NULL` on PowerSync queries (PowerSync already excludes tombstones)
- ❌ Don't let `packages/core` import from `packages/db` (breaks the boundary)
- ❌ Don't query Supabase directly from a component "for fresh data" — adjust sync rules instead; direct calls defeat the offline-first read path and add latency that shouldn't exist
- ❌ Don't treat "it compiles" as evidence the schema is correct — TypeScript cannot see missing sync rules or missing Postgres columns
