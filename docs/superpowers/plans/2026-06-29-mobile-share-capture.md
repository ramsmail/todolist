# Mobile Share Capture + Attachments Implementation Plan

> **For agentic workers:** Implement task-by-task, in phase order. Steps use checkbox (`- [ ]`) syntax for tracking. Do **not** reorder phases — Phase 0 stabilizes a foundation the later phases depend on. After every phase, run `pnpm typecheck` and the relevant tests, and **confirm synced rows actually arrive on a client** (not just that a write succeeded) — silent sync failures are this stack's #1 risk.

**Goal:** Turn the Expo mobile app into a real, installable Android client (leaving Expo Go) that registers a native **share target**, so Safari/Chrome/Notes/etc. can share a URL, text, image, or file into the app. Shared content lands as a task in an **Inbox**, with file/image bytes stored in Supabase Storage, and appears on the web frontend within seconds via PowerSync. iOS is explicitly deferred to a later, optional phase.

**Architecture:**
- Web (Next.js) stays the canonical "cockpit." Mobile is the capture + daily-driver client. No React-Native rewrite of web.
- Shared **leaf** components live in `packages/ui` (NativeWind). Navigation, data hooks, and app shells stay platform-specific.
- The `attachments`, `reminders`, and `user_settings` tables **already exist in Postgres + RLS + sync rules** but are missing from `packages/db`'s `AppSchema`, so they never reach clients. This plan closes that drift rather than redesigning the model.
- File/image **bytes** go to Supabase Storage; only attachment **metadata** rows sync via PowerSync. `attachments.local_uri` (offline staging) → upload → `attachments.storage_path` is the upload-queue pattern.
- Android share = `ACTION_SEND`/`ACTION_SEND_MULTIPLE` via `expo-share-intent` config plugin. Because Android launches the real app process, no separate-process constraints apply (those are iOS-only, Phase 5).

**Tech Stack:** Expo SDK 56 + Expo Router 56, React Native 0.76, `@powersync/react-native` + `@powersync/op-sqlite`, `expo-share-intent`, Supabase (Postgres + Storage + RLS), NativeWind 4, EAS Build.

---

## Schema reality (read before Phase 1)

Already in Postgres + RLS + `powersync/sync-rules.yaml`, **missing from `packages/db`**:

```
attachments(id, task_id, user_id, type ∈ image|audio|file, filename, mime_type,
            size_bytes, storage_path, local_uri, thumbnail_uri, duration_seconds,
            created_at, updated_at, deleted_at)
reminders(id, task_id, user_id, remind_at_local, remind_at_utc,
          notified_mobile, notified_web, created_at, updated_at, deleted_at)
user_settings(id, timezone, expo_push_token, web_push_subscription, theme,
              created_at, updated_at)
```

No new migration or sync-rule change is needed for these three — the gap is purely the client `AppSchema`. **Do not add a `deleted_at IS NULL` filter inside sync rules** (tombstones are handled). A new Storage bucket + bucket RLS *is* net-new (Phase 2).

---

## File Map

| Action | Path | Phase |
|--------|------|-------|
| Modify | `apps/mobile/package.json` (expo `~52`→`56`, add deps) | 0 |
| Delete | `apps/mobile/src/navigation/*`, stale `src/App.tsx`/`src/index.tsx`, duplicate `src/lib/auth.tsx`, `src/lib/supabase.ts` | 0 |
| Modify | `apps/mobile/src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/login.tsx` (Expo Router shell) | 0 |
| Modify | `apps/mobile/src/powersync/database.ts` (op-sqlite adapter) | 0 |
| Modify | `apps/mobile/app.json` (router plugin, real package id, share-intent plugin) | 0/3 |
| Modify | `packages/db/src/schema.ts` (add 3 tables to `AppSchema`) | 1 |
| Create | `packages/db/src/queries/attachments.ts` | 1 |
| Create | `supabase/migrations/2026XXXX_attachments_storage_bucket.sql` | 2 |
| Create | `apps/mobile/src/lib/uploadQueue.ts` | 2 |
| Create | `apps/mobile/src/share/handleShareIntent.ts`, `src/app/share.tsx` (capture sheet) | 3 |
| Create | `supabase/functions/enrich-url/index.ts` (URL→title) | 3 |
| Modify | `packages/ui` — shared `TaskRow`/attachment chip | 4 |
| Modify | `apps/mobile/src/app/index.tsx` (Inbox default), web Inbox/attachment views | 4 |
| Create | `eas.json` + EAS project config | 3 |

---

## Phase 0 — Stabilize the mobile foundation

No new features. Goal: one router, a PowerSync that actually runs, no duplicate plumbing, correct SDK version.

### Task 0.1 — Correct Expo SDK version
- [ ] In `apps/mobile/package.json`, set `"expo": "~56.0.0"` and align Expo-owned packages (`expo-status-bar`, `expo-secure-store`, etc.) to their SDK-56 ranges. Use `npx expo install --check` / `npx expo install --fix` to let Expo pin compatible versions instead of hand-editing.
- [ ] Run `npm run check-versions` and `pnpm --filter @todolist/mobile typecheck`.

### Task 0.2 — Standardize on Expo Router, delete React Navigation scaffolding
- [ ] Confirm `expo-router` is the entry: `package.json` `"main": "expo-router/entry"` (replacing `src/index.tsx`). Add the `expo-router` plugin in `app.json`.
- [ ] Delete `src/navigation/RootNavigator.tsx`, `AppDrawer.tsx`, `AppTabs.tsx`, `AuthStack.tsx`, and the stale `src/App.tsx` / `src/index.tsx`.
- [ ] Remove now-unused `@react-navigation/*` deps from `package.json`.
- [ ] Rebuild the shell under `src/app/` with Expo Router file-based routing:
  - `src/app/_layout.tsx` — root: wrap in `PowerSyncProvider` + auth gate; redirect to `/login` when unauthenticated.
  - `src/app/(tabs)/_layout.tsx` — `Tabs` with **Inbox** and **Today** (keep it to 2–3 tabs).
  - Move existing `src/screens/*` content into the matching route files; keep `TaskDetailScreen` as a `src/app/task/[id].tsx` route.
- [ ] Verify the existing `SwipeableTaskRow`, `FAB`, `QuickCaptureModal`, `SubTaskList` still mount under the new shell.

### Task 0.3 — Make PowerSync actually run (op-sqlite adapter)
- [ ] Add the current PowerSync RN SQLite adapter: `pnpm --filter @todolist/mobile add @powersync/op-sqlite @op-engineering/op-sqlite`.
- [ ] Update `src/powersync/database.ts` to pass the op-sqlite factory to `PowerSyncDatabase` (mirror the adapter's documented `database:` factory form for `@powersync/op-sqlite`). Confirm exact API against PowerSync docs at implementation time.
- [ ] **Verification:** run the app on an Android device/emulator, sign in, create a task on mobile, confirm it appears on web within seconds, and edit it on web and confirm it reflects on mobile. This proves the foundation before any feature work.

### Task 0.4 — Consolidate duplicate auth/supabase modules
- [ ] Pick one supabase client (`src/supabase/client.ts`) and one auth provider (`src/auth/AuthContext.tsx`); delete `src/lib/supabase.ts` and `src/lib/auth.tsx`. Update all imports.
- [ ] Confirm auth tokens persist via `expo-secure-store` (already a dep) so a relaunch stays signed in — this matters for the share flow, which assumes an authenticated session.

### Task 0.5 — Real app identity
- [ ] Replace `com.yourname.todolist` in `app.json` (`android.package`, `ios.bundleIdentifier`) with a real reverse-DNS id, e.g. `com.<yourorg>.todolist`. This is permanent once published — choose deliberately.

**Phase 0 done when:** one router, no duplicate modules, `check-versions` clean, and a task round-trips device ↔ web on a real PowerSync.

---

## Phase 1 — Close the schema drift (clients can see attachments)

### Task 1.1 — Add the three tables to `AppSchema`
- [ ] In `packages/db/src/schema.ts`, add `attachments`, `reminders`, and `user_settings` as `new Table(...)` definitions mirroring the existing `tasks`/`projects` style, with columns matching the migration exactly (see "Schema reality" above). Include them in the exported `AppSchema`.
- [ ] **Type↔Postgres check:** verify every column name/type against `supabase/migrations/20260620000001_initial_schema.sql` — TypeScript can't catch a missing/renamed column here.

### Task 1.2 — Attachment queries
- [ ] Create `packages/db/src/queries/attachments.ts` with `useAttachmentsForTask(taskId)` and a `createAttachment(...)` write helper (through the PowerSync write path, like existing task writes). Export from `packages/db/src/index.ts`.

### Task 1.3 — Verify replication end-to-end
- [ ] Insert an `attachments` row directly in Supabase for the signed-in user, then confirm it **arrives** in the mobile/web local DB (query it). This proves the sync rule + new `AppSchema` entry line up. If it doesn't arrive, fix before proceeding — this is the silent-failure checkpoint.

---

## Phase 2 — Supabase Storage + offline upload queue

### Task 2.1 — Storage bucket + RLS (net-new migration)
- [ ] Create `supabase/migrations/2026XXXX_attachments_storage_bucket.sql`: a private `attachments` bucket and Storage RLS policies so a user can only read/write objects under their own `user_id/...` path prefix. (Storage RLS is the real boundary — app-layer paths are not enough.)
- [ ] Keep this migration self-contained to Storage; the `attachments` table already exists. Do not split Storage policy and any table change across unrelated commits.

### Task 2.2 — Upload queue
- [ ] Create `apps/mobile/src/lib/uploadQueue.ts`:
  - On capture: copy bytes into app storage, write the `attachments` row immediately with `local_uri` set and `storage_path` empty (offline-safe; row syncs right away).
  - Background task: upload bytes to the `attachments` bucket at `${user_id}/${attachment_id}/${filename}`, then set `storage_path` (+ `thumbnail_uri` for images).
  - Retry on reconnect; idempotent by `attachment_id`. Surface failures in UI (don't fail silently).
- [ ] **Verification:** capture a file while airplane-mode is on, confirm the task+attachment row appears (local), then re-enable network and confirm `storage_path` fills and the image renders on web.

---

## Phase 3 — Dev Build + Android share target

### Task 3.1 — EAS setup (do this once)
- [ ] Create a free Expo account at https://expo.dev (this is the EAS account).
- [ ] `npm i -g eas-cli` (or use `npx eas-cli`), then `eas login`.
- [ ] From `apps/mobile/`, run `eas init` — links the project and writes a `projectId` into `app.json` (`extra.eas.projectId`).
- [ ] `eas build:configure` — generates `eas.json`. Ensure a `development` profile exists with `"developmentClient": true` and `"distribution": "internal"`.
- [ ] Add `expo-dev-client`: `pnpm --filter @todolist/mobile add expo-dev-client`.
- [ ] Android signing: let EAS manage the keystore automatically on first build (`eas build --platform android --profile development` will prompt to generate one). No manual keystore needed.
- [ ] Build the dev client: `eas build --profile development --platform android`. Install the resulting APK on a device. From now on, `npx expo start --dev-client` connects to this build (Expo Go is retired for this app).
- [ ] **Verification:** the dev-client app launches, signs in, and syncs — same round-trip as Phase 0 but on the standalone build.

### Task 3.2 — Register the Android share target
- [ ] Add `expo-share-intent`: `pnpm --filter @todolist/mobile add expo-share-intent`.
- [ ] In `app.json`, add the `expo-share-intent` config plugin configured for Android `text/plain`, `image/*`, and `*/*`, including `ACTION_SEND_MULTIPLE` for batches. Confirm the exact plugin options against the library's current docs at implementation time.
- [ ] Rebuild the dev client (native config changed → new `eas build`). Verify the app now appears in Android's share sheet from Chrome (URL), a browser text selection, and the gallery (image).

### Task 3.3 — Handle the shared payload
- [ ] Create `src/share/handleShareIntent.ts` using `expo-share-intent`'s hook to read incoming text/URL/files.
- [ ] **Critical:** for shared files, copy the `content://` bytes into app storage **immediately** on receipt (the URI grant is temporary and dies on backgrounding). Then hand off to `uploadQueue`.
- [ ] Map payload → task: text/URL → task title (URL stored on the task / enriched in 3.5); files/images → task + `attachments` row(s). New tasks get `status = 'inbox'`.

### Task 3.4 — Capture confirmation sheet
- [ ] Create `src/app/share.tsx` — a lightweight route the share intent routes into: shows "Saved to Inbox ✓", a thumbnail for media, and one optional inline edit (title, optional due-date chip), then auto-dismisses back. Do **not** drop the user into the full task list. Reuse `QuickCaptureModal` styling for consistency.

### Task 3.5 — URL → title enrichment (server-side)
- [ ] Create `supabase/functions/enrich-url/index.ts`: given a task id + URL, fetch OG/`<title>` and update the task title to a readable form (e.g. `Read: <title>`), keeping the raw URL on the task. Do enrichment server-side, never on-device.
- [ ] Trigger it fire-and-forget after the share write; the title updates and re-syncs to all clients.

---

## Phase 4 — Inbox/triage + attachment display (web + mobile)

### Task 4.1 — Mobile Inbox as default
- [ ] Make **Inbox** the default tab/landing route. Inbox = tasks with `status = 'inbox'`. Show attachment thumbnails on rows.
- [ ] Swipe-to-complete and a simple triage affordance (set due date / move out of Inbox). Keep Projects/labels management off mobile for now — display tags read-only.

### Task 4.2 — Shared leaf components
- [ ] Extract/confirm a shared `TaskRow` and an attachment-chip/thumbnail component in `packages/ui` (NativeWind only, plain props + callbacks, no data fetching, no routing — respect the package boundary). Both web and mobile consume them; each platform supplies its own data hook and gesture handling.

### Task 4.3 — Web Inbox + attachment rendering
- [ ] Add an Inbox/triage view on web (mirror the `/projects` dashboard pattern) backed by the now-synced `attachments` table.
- [ ] Render attachment thumbnails/links on web task rows; signed Storage URLs for private bucket objects.
- [ ] **Verification:** share a URL, an image, and a file from an Android device; confirm all three appear on web as Inbox tasks with correct titles/thumbnails within seconds.

---

## Phase 5 — iOS (later, optional)

Out of scope for now. When pursued: an iOS **Share Extension** target (separate process, ~120 MB limit), **App Group** shared container as the capture queue, and a **Keychain Access Group** to share the Supabase session with the extension (no interactive login in an extension). Requires an Apple Developer account ($99/yr). The backend (Storage, tables, enrichment, Inbox) built in Phases 1–4 is reused unchanged; only the iOS receiver is new. `expo-share-intent` also covers the iOS side, or `expo-share-extension` if a custom extension UI is needed.

---

## Cross-cutting verification checklist (run before calling any phase done)
- [ ] `pnpm typecheck` and `pnpm lint` clean.
- [ ] `pnpm test` (and mobile tests) pass.
- [ ] For any sync-touching change: a row **arrives** on a second client, not just "write succeeded."
- [ ] Schema changes verified against `supabase/migrations/`, not just TS compilation.
- [ ] No direct Supabase *table* writes from client code outside the established PowerSync path (Storage uploads are the sanctioned exception, since binaries don't sync through PowerSync).
- [ ] `npm run check-versions` clean before any push.

## Open risks
- **op-sqlite native build:** the adapter pulls native code; first `eas build` is the real test. If the local dev client can't open the DB, fix before features.
- **Share-intent + Expo Router routing:** confirm `expo-share-intent`'s cold-start vs warm-start delivery both route into `share.tsx`.
- **Token expiry on share:** if the stored session is expired when a share fires, the upload must refresh-or-queue, not drop silently.
