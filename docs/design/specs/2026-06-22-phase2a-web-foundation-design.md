# Phase 2A — Web App Foundation Design Spec

**Date:** 2026-06-22
**Status:** Approved

---

## Overview

Phase 2A adds a Next.js web app to the monorepo, giving the todolist app full offline-capable feature parity with the Phase 1 mobile app — on a desktop browser. This is the first sub-phase of Phase 2 ("Web app + structuring features").

**Scope (in):** Next.js app, PowerSync OPFS, Supabase auth, Inbox / Today / Upcoming / Projects / Quick Capture, slide-in task detail panel, Vercel deployment.

**Scope (out):** Search, keyboard shortcuts (2C), labels (2B), recurrence (2B), saved filters (2C), accessibility audit (2C).

---

## Phase 2 Decomposition

| Sub-phase | Scope |
|---|---|
| **2A (this spec)** | Web app foundation — Next.js + PowerSync OPFS + auth + core views |
| **2B** | Labels + recurrence — both platforms (mobile gets them too) |
| **2C** | Saved filters + keyboard shortcuts + accessibility audit |

---

## Architecture

### Rendering model

The web app is **client-side heavy**. All data is read from PowerSync's local SQLite via `useQuery` hooks — no server-side data fetching. Next.js App Router provides routing and the HTML shell. Almost all pages are `'use client'`.

No React Server Components are used for data access. RSC is only used for the root layout and static shell.

### Shared packages (reused as-is)

| Package | What it provides |
|---|---|
| `packages/core` | NLP parser, task types, recurrence engine (pure TS — no platform code) |
| `packages/db` | PowerSync schema, `useQuery` hooks, `createTask` / `completeTask` / all write helpers |
| `packages/config` | Shared Tailwind config with design tokens (colors, typography scales) |

`packages/ui` (NativeWind / React Native) is **not** used by the web app. Web components are plain Tailwind CSS, using the same design tokens from `packages/config`.

### UI component strategy

| Layer | Mobile | Web |
|---|---|---|
| Design tokens | `packages/config` (shared Tailwind config) | `packages/config` (same) |
| Business logic | `packages/core` | `packages/core` |
| DB / queries | `packages/db` | `packages/db` |
| UI components | `packages/ui` (NativeWind) | `apps/web/components` (Tailwind CSS) |

### PowerSync + OPFS

PowerSync's web SDK stores SQLite in the browser's Origin Private File System (OPFS), which requires `SharedArrayBuffer`. Two HTTP response headers are mandatory and must be set in `next.config.js` (respected by Vercel):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The `PowerSyncProvider` wraps the entire app client-side (same pattern as mobile). The web connector is a thin class that fetches a JWT from an internal API route.

### Auth flow

Supabase SSR (`@supabase/ssr`) manages the session in an **httpOnly, Secure, SameSite=Strict cookie**. The JWT is never accessible to JavaScript directly.

PowerSync's web connector fetches its token from `/api/auth/token` — a Next.js API route that reads the session server-side and returns the JWT. This is the web equivalent of mobile's SecureStore token adapter.

`middleware.ts` guards all routes and redirects unauthenticated requests to `/login`.

**Auth API routes:**
- `POST /api/auth/signout` — signs out server-side, clears cookie
- `GET /api/auth/token` — returns current JWT for PowerSync connector
- `GET /api/auth/callback` — Supabase OAuth callback handler (for future use)

---

## Layout & Navigation

### Shell

Fixed left sidebar (240px) + scrollable main content area. Desktop-first; no responsive collapse in 2A.

**Sidebar (top to bottom):**
1. App logo + name
2. Nav links: Inbox · Today · Upcoming
3. Projects section: reactive list from PowerSync; "+ New project" at the bottom
4. Spacer (flex-grow)
5. Sync status indicator (green/amber/red dot + last synced time)
6. User email + Sign out button

### Routes

```
/                    → redirect to /inbox
/login               → login / register page
/inbox
/today
/upcoming
/projects/[id]
/search              → placeholder ("Search coming soon")
```

### Task detail

A **slide-in right panel** (~480px, overlays the task list) — the Linear pattern. Clicking a task row opens it; Escape or clicking the overlay closes it. The panel contains:
- Inline-editable title
- Priority picker (P1–P4)
- Due date picker (basic date + time; recurrence rule picker deferred to 2B)
- Project picker (dropdown)
- Sub-tasks list (add inline, check off)
- Delete button (with confirmation)

Task detail does not use a separate route — it's panel state managed in the view component.

---

## File Structure

```
apps/web/
├── app/
│   ├── layout.tsx                  # Root layout — PowerSyncProvider + sidebar shell
│   ├── page.tsx                    # Redirect → /inbox
│   ├── login/
│   │   └── page.tsx
│   ├── inbox/
│   │   └── page.tsx
│   ├── today/
│   │   └── page.tsx
│   ├── upcoming/
│   │   └── page.tsx
│   ├── projects/
│   │   └── [id]/
│   │       └── page.tsx
│   ├── search/
│   │   └── page.tsx            # Placeholder — "Search coming soon"
│   └── api/
│       └── auth/
│           ├── token/route.ts      # Returns JWT for PowerSync connector
│           ├── callback/route.ts   # Supabase auth callback
│           └── signout/route.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── SyncStatusIndicator.tsx
│   ├── tasks/
│   │   ├── TaskRow.tsx
│   │   ├── TaskList.tsx            # @tanstack/virtual for large lists
│   │   ├── TaskDetailPanel.tsx     # Slide-in right panel
│   │   └── QuickCaptureModal.tsx
│   └── projects/
│       ├── CreateProjectModal.tsx
│       └── ProjectPicker.tsx
├── hooks/
│   └── useSyncStatus.ts            # Same logic as mobile; derives SyncStatus from PowerSync state
├── lib/
│   ├── powersync/
│   │   ├── database.ts             # PowerSync singleton (web)
│   │   ├── PowerSyncProvider.tsx   # Context provider
│   │   └── WebConnector.ts         # Fetches JWT from /api/auth/token
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       └── server.ts               # Server Supabase client (for API routes + middleware)
├── middleware.ts                   # Auth guard — redirects to /login
├── next.config.js                  # COOP/COEP headers + package transpilation
├── tailwind.config.js              # Extends packages/config/tailwind
└── tsconfig.json
```

---

## Data Flow

**Reads:** `useQuery` hooks from `@todolist/db` subscribe to PowerSync local SQLite. Components re-render automatically when data changes — same pattern as mobile.

**Writes:** `createTask`, `completeTask`, `updateTaskTitle`, `updateTaskPriority`, `updateTaskProject`, `deleteTask`, `createProject` from `@todolist/db`. Writes hit local SQLite immediately and queue a background push to Supabase.

**Realtime:** Automatic. The web app subscribes to the same PowerSync sync stream as mobile. Changes from mobile appear on web within seconds — no polling or Supabase Realtime subscription needed.

**Sync status:** `useSyncStatus` hook (same logic as mobile) — derives `synced | syncing | stale | offline` from PowerSync's `currentStatus`. Displayed in the sidebar.

---

## Visual Design

Inherits the design system from the overall spec:
- Dark mode default (no light toggle in 2A — deferred to Phase 3)
- Background: `#0A0A0A`, surface: `#111111`, sidebar: `#0D0D0D`
- Accent: `#6366F1` (electric indigo)
- Priority: P1 `#EF4444`, P2 `#F97316`, P3 `#3B82F6`, P4 `#9CA3AF`
- Typography: Inter (via `next/font`)
- Task rows: hover state reveals action icons (complete checkbox, priority badge)
- Spring animations on task completion: checkbox → strikethrough → fade (CSS transitions)

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| OPFS not supported (old browser) | Full-page banner: "Offline storage requires Chrome/Edge/Firefox 111+. Please update your browser." App does not load. |
| `/api/auth/token` fails (expired session) | PowerSync connector redirects to `/login`; offline data is intact |
| Sync stale > 5 min | Sidebar indicator turns amber |
| Disconnected | Indicator turns red; app fully functional offline |
| Task write fails | PowerSync queues locally and retries silently |
| Unhandled JS error | Console only in 2A; Sentry added in Phase 3 |

---

## Testing

### Vitest + React Testing Library
- Task creation flow (QuickCaptureModal → NLP parse → createTask called with correct args)
- Project navigation (sidebar link → correct project tasks shown)
- Auth redirect (unauthenticated → `/login`)

### axe-core
- Run on all major views (Inbox, Today, Upcoming, Projects, Login, Task Detail panel)
- Zero WCAG AA violations required before 2A is considered done

### Playwright E2E
Two tests ship with 2A:

1. **Golden path:** login → open Quick Capture → type task with NLP → submit → task appears in list → click task → verify panel opens → complete task → task disappears
2. **Offline sync:** disconnect network (Playwright devtools) → create task → reconnect → verify task syncs to Supabase within 10s

---

## Deployment

**Host:** Vercel (Hobby tier — free, deploys on git push to `master`)

**Required environment variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_POWERSYNC_URL
SUPABASE_SERVICE_ROLE_KEY      # server-side only — API routes
```

**COOP/COEP headers** (required for OPFS/SharedArrayBuffer) set in `next.config.js`:
```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
    ],
  }];
}
```

**Browser support:** Chrome 86+, Edge 86+, Firefox 111+, Safari 15.2+. OPFS unsupported in older versions → blocked with an error banner.

---

## Out of Scope for 2A

- Search (deferred — placeholder route only)
- Keyboard shortcuts (deferred to 2C)
- Labels (deferred to 2B)
- Recurrence (deferred to 2B)
- Saved filters (deferred to 2C)
- Accessibility audit (deferred to 2C; axe-core scan is a gate, not a full audit)
- Light mode toggle (deferred to Phase 3)
- Sentry (deferred to Phase 3)
- Mobile responsive layout (desktop-first; not a requirement)
