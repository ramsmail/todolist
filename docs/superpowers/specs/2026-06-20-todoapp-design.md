# TodoList App — Design Spec

**Date:** 2026-06-20
**Status:** Approved

---

## Overview

A personal task management app in the spirit of Todoist, running on both laptop (web) and mobile, with a bold & modern dark-first visual design. Single-user, fully offline-capable, with local-first storage and background cloud sync.

---

## Requirements Summary

| Requirement | Decision |
|---|---|
| Use case | Personal + work, unified |
| Collaboration | Single user only |
| Offline | Must work fully offline |
| Platforms | React Native (Expo) mobile + Next.js desktop web |
| Sync | Local-first with Supabase cloud sync |
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
| Local DB (mobile) | WatermelonDB |
| Backend / cloud | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) |
| NLP parsing | chrono-node + custom regex |
| Recurrence | iCal RRULE (rrule.js) |
| Error tracking | Sentry (web + mobile) |
| E2E testing | Detox (mobile), Playwright (web) |
| Unit testing | Vitest |

---

## Monorepo Structure

```
todolist/
├── apps/
│   ├── mobile/          # Expo (React Native) app
│   └── web/             # Next.js 14 app (App Router)
├── packages/
│   ├── core/            # Domain logic: tasks, projects, recurrence, NLP, filters
│   ├── db/              # WatermelonDB schema, models, sync adapter
│   ├── ui/              # Shared component library (NativeWind + Tailwind)
│   └── config/          # Shared TypeScript, ESLint, Tailwind configs
└── turbo.json
```

- `packages/core` — pure TypeScript, no React, no DB dependency. Contains all business logic.
- `packages/db` — WatermelonDB models and Supabase sync adapter. Used only in Expo.
- `packages/ui` — NativeWind components that render natively on mobile and as HTML on web.
- Web app talks directly to Supabase JS client; no WatermelonDB on web.

---

## Data Model

### Task
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | FK → auth.users |
| title | string | |
| description | string | Markdown, optional |
| status | enum | `inbox \| active \| completed \| cancelled` |
| priority | int | 1–4 (1 = urgent) |
| due_date | date | Optional |
| due_time | time | Optional |
| project_id | uuid | FK → Project, null = Inbox |
| parent_task_id | uuid | FK → Task, null = top-level |
| recurrence_rule | string | iCal RRULE string, optional |
| labels | string[] | JSON array of label names |
| sort_order | float | For drag-and-drop ordering |
| created_at | timestamp | Set by DB default |
| updated_at | timestamp | Updated on every write |
| synced_at | timestamp | Set by sync adapter |

### Project
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | string | |
| color | string | Hex color |
| icon | string | Emoji |
| is_archived | bool | |
| sort_order | float | |
| created_at | timestamp | |
| updated_at | timestamp | |

### Label
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | string | |
| color | string | Hex color |
| created_at | timestamp | |
| updated_at | timestamp | |

### SavedFilter
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | |
| name | string | |
| icon | string | Emoji |
| query | json | Serialized filter AST |
| sort_order | float | |
| created_at | timestamp | |
| updated_at | timestamp | |

### Reminder
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| task_id | uuid | FK → Task |
| user_id | uuid | For RLS policy |
| remind_at | timestamp | |
| notified | bool | |
| created_at | timestamp | |
| updated_at | timestamp | |

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
| updated_at | timestamp | |
| synced_at | timestamp | |

### SyncMeta (local only, not synced)
| Field | Type |
|---|---|
| last_pulled_at | timestamp |
| last_pushed_at | timestamp |

**Design notes:**
- Sub-tasks are self-referential on Task, one level deep only.
- Recurrence rule is stored as RRULE; on completion the engine computes the next occurrence rather than pre-creating future tasks.
- Labels are denormalized as a JSON array on Task for query simplicity; the Label table holds canonical definitions for the picker.
- `user_id` and `created_at` are set by DB defaults/triggers — never trusted from the client.

---

## Sync Architecture

### Task/Project/Label sync (WatermelonDB ↔ Supabase)
- WatermelonDB's built-in sync protocol (push/pull) runs on app foreground and on reconnect.
- Pull: fetch all rows with `updated_at > last_pulled_at` from Supabase.
- Push: send all locally-accumulated changes from WatermelonDB's change tracking.
- Conflict resolution: last write wins on `updated_at` (sufficient for single-user).
- Web app reads/writes directly via Supabase JS client; Supabase Realtime pushes changes to the browser in real time.

### Attachment sync (Supabase Storage)
- Attachment metadata is synced with the task sync cycle.
- File upload happens in background after task save — task is immediately available offline.
- Offline-captured attachments are queued in a local upload queue (persisted in WatermelonDB) and uploaded when connection resumes.
- Files are downloaded lazily on first open and cached at `local_uri`.
- Image thumbnails are generated on-device before upload.

### Offline indicators
- Both apps show a sync status indicator: last synced time, amber warning after 5 minutes without sync, red "offline" badge when disconnected.
- Sync failures are silent and auto-retried — the user is never blocked.

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
  - `#ProjectName` → assign to project (no spaces; multi-word projects use CamelCase or hyphen, e.g. `#side-project`)
  - `@labelname` → add label
  - `tomorrow 3pm`, `next monday`, `in 2 hours` → due date/time
- Example: `"Submit report p1 #work @waiting tomorrow 3pm"` → P1 task in Work, label "waiting", due tomorrow 15:00
- Unrecognised text falls back gracefully: becomes the task title with no metadata.

### Task Detail
- Inline-editable title
- Markdown description (rendered, with DOMPurify sanitisation on web)
- Due date + time picker
- Priority selector (P1–P4)
- Project picker
- Label picker (multi-select)
- Sub-tasks list (add, reorder, check off inline)
- Recurrence rule picker (presets + advanced RRULE builder)
- Reminders (one or more per task)
- Attachments strip (image thumbnails, audio waveform, file icon)

### Recurrence Engine (packages/core)
- Rules stored as iCal RRULE strings.
- On task completion, the engine advances the RRULE to produce the next due date — no pre-created future tasks.
- Human-readable summary always displayed ("Every weekday", "Every 2 weeks on Monday").

### Filters & Saved Views
- Filter expressions composed of: project, label(s), priority, due date range, status, has attachment.
- Operators: AND, OR, NOT — stored as a JSON AST in `SavedFilter.query`.
- Evaluated in `packages/core` against local data — fully offline.
- Built-in views (Today, Upcoming, Inbox) are pre-defined filter expressions, not special-cased code.

### Reminders
- Push notifications via Expo Notifications (mobile) and Web Push API (browser).
- A Supabase Edge Function checks due reminders every minute and sends push via Expo's push service.
- Local on-device notifications also scheduled as offline fallback.
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
- Dark mode default, optional light mode toggle.
- Typography: Inter (web), SF Pro / Roboto (mobile). Large, confident headings.
- Accent color: electric indigo `#6366F1`.
- Priority colors: P1 = `#EF4444` (red), P2 = `#F97316` (orange), P3 = `#3B82F6` (blue), P4 = `#6B7280` (grey).
- Spring animations on task completion: checkbox → strikethrough → fade.
- Swipe-to-complete and swipe-to-reschedule on mobile task rows.

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
- Next.js middleware validates session on every request before rendering protected pages.

### Database
- Row Level Security (RLS) on every table. All policies are `auth.uid() = user_id`.
- No table has a public policy.
- `user_id` and `created_at` set by DB defaults/triggers — not trusted from client payload.
- Supabase Edge Functions use service-role key server-side only — never exposed to client.

### Attachments
- Private Supabase Storage bucket — no public URLs.
- Access via signed URLs with 1-hour TTL, scoped to the requesting user's files only.
- MIME type + magic bytes validation on upload to prevent malicious files.
- 50MB per-file limit enforced at the storage policy level.

### Web security
- Content Security Policy headers block XSS.
- No `eval`. Markdown rendered via sanitised pipeline (DOMPurify).
- All sync traffic over HTTPS only.

### Mobile security
- Biometric lock option (Face ID / fingerprint).
- Sensitive data wiped from device on explicit logout.

---

## Testing

### packages/core (Vitest unit tests)
- NLP parser: date/time extraction, priority/project/label parsing, fallback behaviour
- Recurrence engine: RRULE advancement, human-readable summaries
- Filter evaluation: AND/OR/NOT combinations, edge cases
- Task state transitions

### packages/db (integration tests)
- WatermelonDB models: CRUD, relationships
- Supabase sync adapter: push, pull, conflict resolution — against local Supabase instance (`supabase start`)

### apps/web (React Testing Library)
- Task creation flow
- Project navigation
- Filter view rendering
- Auth flows

### apps/mobile (Detox E2E)
- Create task via quick capture (NLP)
- Complete a task
- Add image/audio attachment
- Go offline, create task, reconnect and verify sync
- Recurrence: complete recurring task, verify next occurrence

### apps/web (Playwright E2E)
- Golden path: login → create task → complete task
- Realtime: change on mobile reflected on web

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Sync failure | Silent retry; sync indicator turns amber/red after 5 min |
| Attachment upload failure | Queued for retry; retry badge shown on task |
| NLP parse failure | Text becomes task title; no metadata applied |
| Reminder delivery failure | Falls back to local on-device notification |
| Unhandled JS error (web) | Captured by Sentry with full context |
| Crash (mobile) | Captured by Expo crash reporting |
| Expired session | App prompts re-login without losing offline data |

---

## Out of Scope

- Multi-user collaboration, sharing, team workspaces
- OAuth / social login
- Calendar integrations
- AI task suggestions (beyond NLP parsing)
- Comments or activity feed
- Time tracking
