# TodoList App — Design Spec

**Date:** 2026-06-20
**Status:** Approved (revised after external review)

---

## Overview

A personal task management app in the spirit of Todoist, running on both laptop (web) and mobile, with a bold & modern dark-first visual design. Single-user, fully offline-capable on both platforms, with local-first storage and background cloud sync. Full feature set delivered across three testable phases.

---

## Requirements Summary

| Requirement | Decision |
|---|---|
| Use case | Personal + work, unified |
| Collaboration | Single user only |
| Offline | Must work fully offline — both web and mobile |
| Platforms | React Native (Expo) mobile + Next.js desktop web |
| Sync | Local-first via PowerSync + Supabase |
| Visual style | Bold & modern, dark mode default (Linear-inspired) |
| Multimedia | Images, voice notes, file attachments |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo |
| Mobile | Expo (React Native) |
| Web | Next.js 14 (App Router) |
| Shared logic | `packages/core` (TypeScript) |
| Shared UI | `packages/ui` (NativeWind + Tailwind) |
| Local DB (both) | PowerSync (SQLite via op-sqlite on mobile, OPFS on web) |
| Sync engine | PowerSync SDK + PowerSync Service (cloud-hosted) |
| Backend / cloud | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) |
| NLP parsing | chrono-node + custom regex |
| Recurrence | iCal RRULE (rrule.js) |
| Fractional ordering | fractional-indexing library |
| Error tracking | Sentry (web + mobile) |
| E2E testing | Detox (mobile), Playwright (web) |
| Unit / integration | Vitest |

---

## Why PowerSync (not WatermelonDB)

WatermelonDB provides only the client half of sync — the server half (a changes endpoint that returns created/updated/deleted rows since a cursor and accepts a push batch) is entirely custom Edge Function work. PowerSync ships both halves, handles tombstones correctly, runs identically in Expo and the browser (via OPFS), and connects natively to Supabase. This eliminates:

- The custom sync Edge Function
- Maintaining two separate data-access paths (WatermelonDB on mobile, Supabase JS on web)
- The web offline contradiction (Next.js middleware can't validate sessions offline — auth is handled locally by PowerSync's token cache instead)

---

## Monorepo Structure

```
todolist/
├── apps/
│   ├── mobile/          # Expo (React Native) app
│   └── web/             # Next.js 14 app (App Router)
├── packages/
│   ├── core/            # Domain logic: tasks, projects, recurrence, NLP, filters
│   ├── db/              # PowerSync schema, queries, hooks (shared by both apps)
│   ├── ui/              # Shared component library (NativeWind + Tailwind)
│   └── config/          # Shared TypeScript, ESLint, Tailwind configs
└── turbo.json
```

- `packages/core` — pure TypeScript, no React, no DB dependency. All business logic.
- `packages/db` — PowerSync schema definitions, typed query helpers, and React hooks. Used by both apps.
- `packages/ui` — NativeWind components that render natively on mobile and as HTML on web.

---

## Data Model

All synced tables carry `deleted_at` for soft deletes — PowerSync propagates deletions as `deleted_at IS NOT NULL` rows rather than hard deletes, which are invisible to the pull cursor. Hard deletes are never used on synced tables. `updated_at` is always server-authoritative (set by a DB trigger on every write), never trusted from the client.

### Task
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → auth.users; set by DB trigger |
| title | string | |
| description | string | Markdown, optional |
| status | enum | `inbox \| active \| completed \| cancelled` |
| priority | int | 1–4 (1 = urgent) |
| due_date | date | Optional |
| due_time | time | Optional; interpreted in user's timezone from UserSettings |
| timezone | string | IANA tz at time of creation (e.g. `Europe/London`) |
| project_id | uuid | FK → Project, null = Inbox |
| parent_task_id | uuid | FK → Task, null = top-level; one level deep only |
| recurrence_rule | string | iCal RRULE string, optional |
| recurrence_start | date | DTSTART anchor for RRULE; required when recurrence_rule is set |
| labels | string[] | JSON array of label names |
| sort_order | string | Fractional index string (fractional-indexing library) |
| created_at | timestamp | Set by DB default |
| updated_at | timestamp | Set by DB trigger on every write |
| deleted_at | timestamp | Soft delete; null = active |
| synced_at | timestamp | Set by PowerSync client |

### Project
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | string | |
| color | string | Hex color |
| icon | string | Emoji |
| is_archived | bool | |
| sort_order | string | Fractional index string |
| created_at | timestamp | |
| updated_at | timestamp | Set by DB trigger |
| deleted_at | timestamp | Soft delete |

### Label
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | string | Unique per user |
| color | string | Hex color |
| created_at | timestamp | |
| updated_at | timestamp | Set by DB trigger |
| deleted_at | timestamp | Soft delete |

### SavedFilter
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | string | |
| icon | string | Emoji |
| query | json | Serialized filter AST |
| sort_order | string | Fractional index string |
| created_at | timestamp | |
| updated_at | timestamp | Set by DB trigger |
| deleted_at | timestamp | Soft delete |

### Reminder
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| task_id | uuid | FK → Task |
| user_id | uuid | For RLS policy |
| remind_at_local | timestamp | Local time as entered by user |
| remind_at_utc | timestamp | Resolved UTC instant; used by Edge Function |
| notified_mobile | bool | Tracks mobile notification delivery separately |
| notified_web | bool | Tracks web notification delivery separately |
| created_at | timestamp | |
| updated_at | timestamp | Set by DB trigger |
| deleted_at | timestamp | Soft delete |

### Attachment
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| task_id | uuid | FK → Task |
| user_id | uuid | |
| type | enum | `image \| audio \| file` |
| filename | string | |
| mime_type | string | |
| size_bytes | int | Max 50MB enforced at storage policy |
| storage_path | string | Supabase Storage path |
| local_uri | string | On-device cache path |
| thumbnail_uri | string | Local thumbnail for images (optional) |
| duration_seconds | float | For audio (optional) |
| created_at | timestamp | |
| updated_at | timestamp | Set by DB trigger |
| deleted_at | timestamp | Soft delete |
| synced_at | timestamp | Set by PowerSync client |

### UserSettings
| Field | Type | Notes |
|---|---|---|
| id | uuid | Same as auth.uid() |
| timezone | string | IANA tz string (e.g. `Europe/London`) |
| expo_push_token | string | Expo push token for mobile notifications |
| web_push_subscription | json | Web Push API subscription object |
| theme | enum | `dark \| light` |
| created_at | timestamp | |
| updated_at | timestamp | Set by DB trigger |

**Design notes:**
- Sub-tasks are self-referential on Task, one level deep only.
- Recurrence rule stored as RRULE with `recurrence_start` as DTSTART anchor. On task completion the engine advances from `recurrence_start` + RRULE to produce the next due date — no pre-created future tasks.
- Labels are denormalized as a JSON array on Task for query simplicity; renaming or deleting a Label triggers a background job that rewrites affected tasks' `labels` array (cascade on rename/delete). A GIN index on `labels` in Postgres supports efficient filtering.
- `sort_order` uses fractional-indexing strings (e.g. `"a0"`, `"a1"`, `"a0V"`) which never exhaust precision and require no periodic rebalance.
- `user_id` and `created_at` set by DB defaults/triggers — never trusted from client payload.
- Dual `notified_mobile` / `notified_web` booleans prevent duplicate notifications across devices and channels.

---

## Sync Architecture

### PowerSync + Supabase
PowerSync runs on both Expo (via op-sqlite) and the browser (via OPFS). It maintains a local SQLite database on each device and syncs bidirectionally with Supabase Postgres via the PowerSync Service.

- **Pull:** PowerSync Service streams Supabase changes to each client in real time, filtered by `user_id`. Clients receive only their own rows.
- **Push:** Local writes are queued and pushed to Supabase when online. Queued writes persist across app restarts.
- **Offline:** Both apps are fully functional offline. Reads hit local SQLite. Writes queue locally. No network required.
- **Tombstones:** Deletions set `deleted_at`; PowerSync propagates the soft-delete row to all clients. The UI filters out rows where `deleted_at IS NOT NULL`.
- **Conflict resolution:** Last write wins on `updated_at` (server-authoritative). Acceptable for single-user; the risk of field-level collision (e.g. editing description on phone while changing priority on laptop while offline) is low and accepted.
- **Timestamp authority:** `updated_at` is always set by a Postgres trigger (`BEFORE UPDATE SET updated_at = now()`), never by the client. This eliminates clock-skew bugs.
- **Session offline:** PowerSync caches the Supabase JWT locally. The web app does not require middleware session validation on every request — auth state is read from the local PowerSync cache, falling back to re-auth only when the cached token expires and the user is online.

### Attachment sync (Supabase Storage)
- Attachment metadata syncs via PowerSync with other task data.
- File upload queued locally after task save; uploaded in background when online.
- Offline-captured attachments persist in the local upload queue and upload on reconnect.
- Files downloaded lazily on first open and cached at `local_uri`.
- Image thumbnails generated on-device before upload.

### Sync status indicator
- Both apps show: last synced time, amber warning after 5 minutes without sync, red "offline" badge when disconnected.
- Sync failures auto-retry with exponential backoff — user is never blocked.

### Sync spike (Week 1 of Phase 1)
Before building any UI, build a throwaway spike: one table, create/update/delete, two devices, airplane mode. This validates the PowerSync setup and surfaces any Supabase configuration issues early.

---

## Core Features

### Navigation (both platforms)
- **Inbox** — uncategorized quick-capture tasks
- **Today** — tasks due today + overdue
- **Upcoming** — next 7 days, grouped by date
- **Projects** — sidebar (web) / drawer (mobile) listing all projects
- **Filters & Labels** — saved views + label-based filtering
- **Search** — full-text search across all tasks

Web: collapsible left sidebar. Mobile: bottom tab bar + slide-out drawer for projects.

### Quick Capture
- Triggered by FAB (mobile) or keyboard shortcut `Q` (web).
- Natural language input via `chrono-node` (date/time) + custom regex:
  - `p1`/`!1` → Priority 1
  - `#project-name` → assign to project (slugified, no spaces; fuzzy-matched against existing projects by slug similarity — closest match wins, or creates new project if no match above 80% similarity)
  - `@labelname` → add label (exact match against existing labels; unrecognised `@foo` creates a new label named `foo`)
  - `tomorrow 3pm`, `next monday`, `in 2 hours` → due date/time (parsed in user's timezone from UserSettings)
- Example: `"Submit report p1 #work @waiting tomorrow 3pm"` → P1 task in Work project, label "waiting", due tomorrow 15:00 local time
- Unrecognised text becomes the task title; no metadata applied. Never silently drops input.

### Task Detail
- Inline-editable title
- Markdown description (rendered; sanitised via DOMPurify on web)
- Due date + time picker (timezone-aware; displays in user's local timezone)
- Priority selector (P1–P4)
- Project picker
- Label picker (multi-select; creates new label inline)
- Sub-tasks list (add, reorder, check off inline)
- Recurrence rule picker (presets + advanced RRULE builder with human-readable summary)
- Reminders (one or more per task; time entry converts to UTC on save)
- Attachments strip (image thumbnails, audio waveform, file icon)

### Recurrence Engine (packages/core)
- Rules stored as RRULE string + `recurrence_start` (DTSTART anchor).
- On task completion, engine computes next occurrence from DTSTART + RRULE.
- **Overdue catch-up:** completing an overdue recurring task advances to the next future occurrence from today, not from the missed due date. ("Skip" semantics, not "catch-up".)
- **Termination:** RRULEs with COUNT or UNTIL are tracked; on the final occurrence, completing the task marks it `cancelled` rather than generating another.
- **Sub-tasks and recurrence:** sub-tasks are not carried forward on recurrence — they reset on each new occurrence (the sub-task template is stored on the parent; a new copy is generated each cycle).
- Human-readable summary always displayed ("Every weekday", "Every 2 weeks on Monday").

### Filters & Saved Views
- Filter expressions composed of: project, label(s), priority, due date range, status, has attachment.
- Operators: AND, OR, NOT — stored as a JSON AST in `SavedFilter.query`.
- Evaluated by `packages/core` against local PowerSync SQLite data — fully offline.
- Built-in views (Today, Upcoming, Inbox) are pre-defined filter expressions, not special-cased code.
- List virtualisation on both platforms; WatermelonDB-style indexed queries via PowerSync for performance at scale (5,000+ tasks). A perf test with a seeded dataset of 10,000 tasks is part of the test plan.

### Reminders
- Push notifications via Expo Notifications (mobile) and Web Push API (browser, requires VAPID keys + service worker + subscription stored in `UserSettings.web_push_subscription`).
- A Supabase Edge Function polls `Reminder` every minute, filtering `remind_at_utc <= now() AND notified_mobile = false` (or `notified_web = false`) and fires the appropriate channel, then sets the flag.
- Local on-device notifications also scheduled as offline fallback (mobile only).
- `notified_mobile` and `notified_web` are tracked separately — each channel marks itself done independently, preventing duplicate delivery.
- Options: at due time, 10 min before, 30 min before, 1 hour before, custom.

### Keyboard Shortcuts (web)
| Shortcut | Action |
|---|---|
| `Q` | Quick capture |
| `G T` | Go to Today |
| `G I` | Go to Inbox |
| `G P` | Go to Projects |
| `E` | Edit selected task |
| `D` | Set due date |
| `P` | Set priority |
| `1`–`4` | Priority shortcut |
| `?` | Show shortcuts panel |

### Visual Design
- Dark mode default, optional light mode toggle (stored in `UserSettings.theme`).
- Typography: Inter (web), SF Pro / Roboto (mobile). Large, confident headings.
- Accent color: electric indigo `#6366F1`.
- Priority colors: P1 = `#EF4444` (red), P2 = `#F97316` (orange), P3 = `#3B82F6` (blue), P4 = `#9CA3AF` (grey — meets WCAG AA contrast on dark background).
- Spring animations on task completion: checkbox → strikethrough → fade.
- Swipe-to-complete and swipe-to-reschedule on mobile task rows.

---

## Accessibility

Accessibility is treated as a first-class requirement, not an afterthought.

- **Contrast:** All text/background combinations meet WCAG AA (4.5:1 for body, 3:1 for large text). P4 grey updated to `#9CA3AF` (was `#6B7280` which fails on dark backgrounds).
- **Screen readers:** All interactive elements have accessible labels. Task list items expose title, due date, priority, and project as VoiceOver/TalkBack labels.
- **Keyboard navigation (web):** Full keyboard nav — tab order is logical, focus rings visible, modals trap focus, Escape closes. All features reachable without a mouse.
- **Dynamic Type (mobile):** All text respects iOS Dynamic Type and Android font scaling.
- **Reduced motion:** Animations respect `prefers-reduced-motion` (web) and the system accessibility setting (mobile).
- Accessibility is included in the test plan (axe-core for web, Detox accessibility checks for mobile).

---

## Security

### Authentication
- Supabase Auth with email/password.
- Password requirements: minimum 12 characters, mixed case, number, symbol.
- Built-in brute-force protection and rate limiting on login attempts.
- Refresh token rotation — each refresh issues a new token and invalidates the old one.
- Sessions expire after 30 days of inactivity.

### Token storage
- Mobile: Expo SecureStore (backed by iOS Keychain / Android Keystore). Never AsyncStorage.
- Web: httpOnly, Secure, SameSite=Strict cookie — not accessible to JavaScript.
- PowerSync caches the JWT locally for offline auth — no middleware session check required on every page load.

### Database
- Row Level Security (RLS) on every table. All policies enforce `auth.uid() = user_id`.
- No table has a public policy.
- `user_id` and `created_at` set by DB defaults/triggers — never trusted from client payload.
- `updated_at` set exclusively by DB trigger — never trusted from client.
- Supabase Edge Functions use service-role key server-side only — never exposed to client.
- PowerSync Service connects to Supabase via a dedicated read-replica role with minimal permissions.

### Attachments
- Private Supabase Storage bucket — no public URLs ever.
- Access via signed URLs with 1-hour TTL, scoped to the requesting user's files only.
- MIME type + magic bytes validation on upload to prevent malicious files.
- 50MB per-file limit enforced at the storage policy level, not only client-side.

### Web security
- Content Security Policy headers **mitigate** XSS (DOMPurify is the primary defense for user-generated content).
- No `eval`. Markdown rendered through a sanitised pipeline (marked + DOMPurify).
- All traffic over HTTPS only.
- VAPID private key for Web Push stored as an Edge Function secret, never in client code.

### Mobile security
- Biometric lock option (Face ID / fingerprint) via Expo LocalAuthentication.
- Sensitive data wiped from PowerSync local database and SecureStore on explicit logout.

---

## Delivery Phases

The full feature set is built across three phases, each independently testable and usable.

### Phase 1 — Core mobile (ship in weeks)
**Goal:** A working task manager on mobile you use daily.

- Expo mobile app only
- PowerSync sync spike (week 1, throwaway — validates the stack)
- Tasks: create, complete, delete, reorder (drag-and-drop)
- Projects: create, assign tasks
- Views: Inbox, Today, Upcoming
- Quick capture with NLP (date/time, priority, project)
- Sub-tasks
- Dark mode UI, spring animations, swipe gestures
- Auth (email/password, SecureStore)
- Offline-first with sync status indicator

**Does not include:** Web app, labels, saved filters, recurrence, attachments, reminders, biometrics.

### Phase 2 — Web app + structuring features
**Goal:** Full feature parity on laptop; power-user organisation tools.

- Next.js web app (offline-capable via PowerSync + OPFS)
- Labels + label filtering
- Saved filters (filter AST builder)
- Recurrence engine (RRULE picker, overdue/termination handling)
- Keyboard shortcuts
- Accessibility audit and fixes
- Realtime (web sees mobile changes without refresh)

### Phase 3 — Attachments, reminders, polish
**Goal:** The higher-effort, lower-frequency features.

- Image / audio / file attachments
- Push reminders (Expo Notifications + Web Push, VAPID setup)
- Biometric lock (mobile)
- Perf test with 10,000-task dataset; add indexes if needed
- Sentry integration (web + mobile)
- Light mode toggle

---

## Testing

### packages/core (Vitest unit tests)
- NLP parser: date/time extraction (timezone-aware), priority/project/label parsing, fuzzy project match, unknown label creation, fallback behaviour
- Recurrence engine: RRULE advancement, overdue skip semantics, termination (COUNT/UNTIL), human-readable summaries, sub-task reset
- Filter evaluation: AND/OR/NOT combinations, edge cases, performance with large datasets
- Task state transitions; soft-delete visibility

### packages/db (Vitest integration tests)
- PowerSync schema: CRUD, soft deletes, sort_order
- Sync round-trip against local Supabase instance (`supabase start`) + PowerSync dev instance

### apps/web (React Testing Library + axe-core)
- Task creation flow, project navigation, filter view rendering, auth flows
- Accessibility: axe-core scan on all major views; zero violations at WCAG AA

### apps/mobile (Detox E2E)
- Create task via quick capture (NLP)
- Complete a recurring task; verify next occurrence
- Go offline, create task, reconnect and verify sync
- Add image and audio attachment (Phase 3)
- Biometric lock (Phase 3)
- Detox accessibility checks on key screens

### apps/web (Playwright E2E)
- Golden path: login → create task → complete task
- Offline: disconnect network, create task, reconnect, verify sync
- Realtime: change from mobile reflected on web without refresh (Phase 2)

### Performance
- Seeded dataset: 10,000 tasks, 50 projects, 20 labels
- Filter evaluation must complete in < 100ms on a mid-range device
- List scroll at 60fps with virtualisation enabled

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Sync failure | Silent retry with backoff; indicator turns amber/red after 5 min |
| Attachment upload failure | Queued for retry; retry badge shown on task |
| NLP parse failure | Text becomes task title; no metadata applied; never drops input |
| Reminder delivery failure | Falls back to local on-device notification (mobile); web retries next minute |
| Duplicate reminder | `notified_mobile` / `notified_web` flags prevent re-delivery per channel |
| Unhandled JS error (web) | Captured by Sentry with full context |
| Crash (mobile) | Captured by Expo crash reporting + Sentry |
| Expired session (online) | Re-auth prompt; offline data intact |
| Expired session (offline) | App remains fully functional; re-auth deferred until online |

---

## Out of Scope

- Multi-user collaboration, sharing, team workspaces
- OAuth / social login
- Calendar integrations (import/export)
- AI task suggestions (beyond NLP parsing)
- Comments or activity feed
- Time tracking
- Sub-tasks more than one level deep
