# PowerSync Web Sync — Troubleshooting Runbook

**READ THIS BEFORE DEBUGGING "the web app is always Offline" or "mobile captures don't appear on web."**

PowerSync on the web app (`apps/web`) failing to sync almost always presents the same way: the status listener logs `connected: false` forever and nothing reaches the inbox. The cause is rarely app logic — it's one of a small set of silent failures in the layers *around* the SDK. Every one of these fails by doing nothing rather than crashing, so work through them in order.

## TL;DR diagnostic order

When web PowerSync is "Offline", check in this order — each step gates the next:

1. **Worker assets return `200`, not a redirect to `/login`.**
2. **`POST /sync/stream` returns a stream, not `401`.**
3. **Only then** look at app code / rendering.

A green `connected: true` with `lastSyncedAt` advancing to a *current* timestamp is the only proof sync works. `hasSynced: true` alone can be stale OPFS cache from a previous (now-dead) instance — do not trust it.

---

## 1. Middleware must not intercept the PowerSync worker assets

**Symptom:** In the Network tab, `/@powersync/worker/WASQLiteDB.umd.js` and `SharedSyncImplementation.umd.js` sit at `(pending)` forever. The SDK never finishes initializing, so `connect()` never establishes a stream.

**Root cause:** The PowerSync web SDK needs pre-built UMD worker files served from `public/@powersync/worker/`. Next.js webpack cannot bundle SharedWorkers correctly, so we point `database.worker` / `sync.worker` at these static URLs. But those URLs live under `/@powersync/` (note the leading `@`). If `middleware.ts`'s matcher only excludes `powersync` (no `@`), the worker requests hit the auth middleware, get a `307` redirect to `/login`, and a SharedWorker cannot follow an HTML redirect — it just hangs.

**Fix:** Ensure the middleware matcher excludes **both** spellings:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|powersync|@powersync).*)'],
};
```

**Verify:**

```bash
curl -D - http://localhost:3000/@powersync/worker/WASQLiteDB.umd.js | head -3
# HEALTHY: HTTP/1.1 200 OK
# BROKEN:  HTTP/1.1 307 Temporary Redirect  +  location: /login
```

**Re-copy the worker assets** if they're missing (e.g. after `node_modules` reset):

```bash
cd apps/web && npx powersync-web copy-assets
# Populates public/@powersync/ with worker UMD files + *.wasm
```

---

## 2. PowerSync instance must be configured to validate Supabase JWTs

**Symptom:** Workers load fine (step 1 passes), `fetchCredentials` succeeds and logs a valid session, but status stays `connected: false`. A direct probe of the sync endpoint returns `401`.

**Root cause:** The PowerSync instance rejects every JWT because the **"Use Supabase Auth" checkbox is unchecked** in Client Auth (or it's checked but has no Supabase URL), so the instance has no JWKS to validate tokens against. This was the actual root cause on 2026-06-28 — the box was simply not ticked. It is *not* enabled by default when you create or redeploy an instance, so verify it explicitly.

**Fix (PowerSync dashboard, not code):**

1. Instance → **Client Auth**
2. **Tick the "Use Supabase Auth" checkbox** — this is the step most easily missed. If it's unchecked, every client gets a `401` no matter what the app sends.
3. Provide the Supabase project URL: `https://<project-ref>.supabase.co`
   (PowerSync derives JWKS automatically as `<url>/auth/v1/.well-known/jwks.json`)
4. **Save and Deploy** (the change does not take effect until deployed)

> ⚠️ Confirm the checkbox is actually **checked and saved** in the dashboard UI before debugging anything else in this section — an unchecked "Use Supabase Auth" box produces the exact same `401 PSYNC_S2106` as a misconfigured URL.

**Verify** — probe the real endpoint directly. The SDK uses **POST** (not GET) for `/sync/stream`:

```bash
# 401 = auth not configured (this section). Fix Client Auth.
curl -s -X POST https://<instance>.powersync.journeyapps.com/sync/stream \
  -H "Content-Type: application/json" -d '{}'
# {"error":{"code":"PSYNC_S2106",...,"name":"AuthorizationError"}}  -> 401, auth problem

# Confirm Supabase JWKS is reachable (should return a keys array):
curl -s https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json | head -c 200
```

> **Misleading 404 warning:** A `GET` to `/sync/stream` returns `404 PSYNC_S2002 "The path GET /sync/stream does not exist"`. This is **not** a real connection error — the endpoint only accepts POST. Do not chase it. (An old debug probe in `WebConnector.ts` did exactly this and produced confusing logs; it has since been removed.)

**Status code cheat sheet** for the POST probe:

| Result | Meaning |
| --- | --- |
| streaming response | working |
| `401 PSYNC_S2106` | Supabase Auth not configured on the instance (this section) |
| `404 PSYNC_S2002` | wrong path or wrong method (you used GET) |
| DNS / connection failure | instance deleted/expired — redeploy it from the dashboard |

---

## 3. The `database.worker` option needs a type cast

**Symptom:** `pnpm typecheck` fails in `apps/web/lib/powersync/database.ts`:

```
error TS2769: ... 'worker' does not exist in type 'DBAdapter | SQLOpenFactory | SQLOpenOptions'.
```

**Root cause:** The web SDK reads `options.database.worker` at runtime, but the public `PowerSyncDatabase` constructor types the `database` field as the common `SQLOpenOptions`, which has no `worker`. It works at runtime; TypeScript's object-literal excess-property check rejects it.

**Fix:** Assign the database options through the web type (`WebSQLOpenFactoryOptions`, exported from `@powersync/web`) so the literal isn't checked inline. `sync.worker` typechecks fine on its own — only `database.worker` needs this.

```ts
import { PowerSyncDatabase, type WebSQLOpenFactoryOptions } from '@powersync/web';

const databaseOptions: WebSQLOpenFactoryOptions = {
  dbFilename: 'todolist.db',
  worker: '/@powersync/worker/WASQLiteDB.umd.js',
};

new PowerSyncDatabase({
  schema: AppSchema,
  database: databaseOptions,
  sync: { worker: '/@powersync/worker/SharedSyncImplementation.umd.js' },
});
```

---

## 4. Rendering crash on synced data: `labels.map is not a function`

**Symptom:** Sync actually works (`connected: true`), but the inbox crashes with `TypeError: names.map is not a function` in `TaskRow.tsx`.

**Root cause:** `tasks.labels` is `jsonb` in Postgres but `column.text` in the PowerSync schema (`packages/db`), so it arrives on the client as a JSON **string**, not an array. Any component calling `.map()` on it directly will throw — and a malformed/`null` value makes a naive `JSON.parse` return a non-array.

**Fix:** Parse defensively and guard the result is an array:

```ts
const names: string[] = (() => {
  try {
    const parsed = JSON.parse(task.labels ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
})();
```

> General rule: any PowerSync column that is a JSON/array type in Postgres but `column.text` in the schema arrives as a string. Parse + `Array.isArray`-guard at the read site.

---

## Reference: the layers involved

```
browser tab
  └─ PowerSyncProvider → PowerSyncDatabase (apps/web/lib/powersync/)
       ├─ database.worker  → /@powersync/worker/WASQLiteDB.umd.js   (static, public/)   [step 1]
       ├─ sync.worker      → /@powersync/worker/SharedSyncImplementation.umd.js          [step 1]
       ├─ WebConnector.fetchCredentials → Supabase session JWT
       └─ POST <instance>.powersync.journeyapps.com/sync/stream  (validates JWT vs Supabase JWKS) [step 2]
```

Files: `apps/web/middleware.ts`, `apps/web/lib/powersync/{database,WebConnector,PowerSyncProvider}.tsx`, `apps/web/public/@powersync/`, PowerSync dashboard (Client Auth).
