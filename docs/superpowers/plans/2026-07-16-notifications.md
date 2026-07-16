# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-committed `Reminder` schema real (Edge Function + local fallback + reconciliation) and add a purely local daily inbox-triage nudge, per `docs/superpowers/specs/2026-07-15-notifications-design.md`.

**Architecture:** Server-primary due-time reminders (Postgres `reminders` table → `pg_cron`-triggered Edge Function → Expo Push), with a mobile-only local-notification fallback kept in sync by a reconciliation loop (PowerSync sync events + app foreground/background). The daily nudge is a fully separate, local-only mechanism computed from the on-device inbox count. Both share Android notification channels/categories and one deep-link handler.

**Tech Stack:** Supabase Postgres + Edge Functions (Deno) + `pg_cron`/`pg_net`/Vault, `expo-notifications`, PowerSync (`@powersync/react-native`), Vitest.

---

## Before You Start

This plan was written in a dedicated worktree (`worktree-notifications` branch, based on `master`) to keep it isolated from unrelated in-progress work on `feat/mobile-home-dashboard`. Work in that worktree; open a PR against `master` when done.

Confirm the baseline is green before starting:
```bash
pnpm --filter @todolist/db test -- --run
pnpm --filter @todolist/mobile test -- --run
```
Expected: all pass (packages/db: 4 files / 37 tests as of this writing).

---

## Task 1: Migration — nudge settings + cron dispatch schedule

**Files:**
- Create: `supabase/migrations/20260716000001_notification_settings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Notification settings: nudge preferences on user_settings, plus the cron
-- schedule that drives the dispatch-reminders Edge Function. See
-- docs/superpowers/specs/2026-07-15-notifications-design.md.

alter table user_settings add column nudge_enabled boolean not null default false;
alter table user_settings add column nudge_time text;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- One-time manual setup (NOT run by this migration — these are secrets and
-- don't belong in a file checked into git). Run once in the Supabase SQL
-- editor before this cron job can succeed:
--   select vault.create_secret('https://hqbzlplghdpelxkhsaqi.supabase.co', 'project_url');
--   select vault.create_secret('<a long random string>', 'dispatch_reminders_secret');
-- Then set the same secret as an Edge Function secret and deploy
-- (see Task 4):
--   supabase secrets set DISPATCH_REMINDERS_SECRET=<the same long random string>
--   supabase functions deploy dispatch-reminders --no-verify-jwt

select cron.schedule(
  'dispatch-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/dispatch-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_reminders_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  ) as request_id;
  $$
);
```

- [ ] **Step 2: Verify it applies cleanly against the live project**

Run: `supabase db push --linked`
Expected: migration `20260716000001_notification_settings.sql` applies with no errors. Per `docs/SCHEMA_SYNC_STRATEGY.md`'s schema-first discipline, confirm the columns actually exist afterward:

Run: `supabase db execute --linked "select column_name from information_schema.columns where table_name = 'user_settings'"`
Expected: output includes `nudge_enabled` and `nudge_time`.

- [ ] **Step 3: Note the one-time Vault/secret setup as a manual follow-up**

This migration's cron job will fail (silently, per pg_net's fire-and-forget model) until the two Vault secrets referenced above are seeded and the Edge Function is deployed with a matching `DISPATCH_REMINDERS_SECRET`. This is a manual, one-time operational step (not code) — do it once after Task 4 is deployed, using the exact commands in the migration's comment.

- [ ] **Step 4: No sync-rule change needed**

`powersync/sync-rules.yaml`'s existing rule is `SELECT * FROM user_settings WHERE id = auth.user_id()` — new columns sync automatically. Confirm by inspecting the file; no edit required.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716000001_notification_settings.sql
git commit -m "feat(db): add nudge settings columns and dispatch-reminders cron schedule"
```

---

## Task 2: `packages/db` — reminder query functions

**Files:**
- Create: `packages/db/src/queries/reminders.ts`
- Create: `packages/db/src/queries/reminders.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/db/src/queries/reminders.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createReminder, updateReminderTime, deleteReminder, snoozeReminder, getPendingReminders } from './reminders';

function makeMockDb(overrides: Partial<Record<string, any>> = {}) {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    getOptional: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
}

describe('createReminder', () => {
  it('inserts a row with notified flags reset to 0 and returns a UUID', async () => {
    const db = makeMockDb();
    const id = await createReminder(db, 'task-1', 'user-1', '2026-07-20 09:00', '2026-07-20T03:30:00.000Z');
    expect(id).toHaveLength(36);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO reminders');
    expect(params).toEqual([id, 'task-1', 'user-1', '2026-07-20 09:00', '2026-07-20T03:30:00.000Z', 0, 0, expect.any(String), expect.any(String)]);
  });
});

describe('updateReminderTime', () => {
  it('updates the time and resets both notified flags', async () => {
    const db = makeMockDb();
    await updateReminderTime(db, 'rem-1', '2026-07-21 09:00', '2026-07-21T03:30:00.000Z');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('notified_mobile = 0');
    expect(sql).toContain('notified_web = 0');
    expect(params).toEqual(['2026-07-21 09:00', '2026-07-21T03:30:00.000Z', expect.any(String), 'rem-1']);
  });
});

describe('deleteReminder', () => {
  it('soft-deletes by setting deleted_at', async () => {
    const db = makeMockDb();
    await deleteReminder(db, 'rem-1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('deleted_at = ?');
    expect(params[params.length - 1]).toBe('rem-1');
  });
});

describe('snoozeReminder', () => {
  it('does nothing if the reminder no longer exists', async () => {
    const db = makeMockDb({ getOptional: vi.fn().mockResolvedValue(null) });
    await snoozeReminder(db, 'rem-1', 60);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('advances remind_at_utc by the given minutes and resets both notified flags', async () => {
    const db = makeMockDb({
      getOptional: vi.fn().mockResolvedValue({
        id: 'rem-1',
        remind_at_utc: '2026-07-20T03:30:00.000Z',
        remind_at_local: '2026-07-20 09:00',
      }),
    });
    await snoozeReminder(db, 'rem-1', 60);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('notified_mobile = 0');
    expect(sql).toContain('notified_web = 0');
    expect(params[1]).toBe('2026-07-20T04:30:00.000Z');
  });
});

describe('getPendingReminders', () => {
  it('queries for un-notified, non-deleted, past-due reminders for the given user', async () => {
    const db = makeMockDb();
    await getPendingReminders(db, 'user-1');
    const [sql, params] = db.getAll.mock.calls[0];
    expect(sql).toContain("notified_mobile = 0");
    expect(sql).toContain('deleted_at IS NULL');
    expect(params[0]).toBe('user-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/db exec vitest run reminders`
Expected: FAIL — `reminders.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// packages/db/src/queries/reminders.ts
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { ReminderRecord } from '../schema';

export function useTaskReminder(taskId: string) {
  return useQuery<ReminderRecord>(
    `SELECT * FROM reminders WHERE task_id = ? AND deleted_at IS NULL ORDER BY remind_at_utc DESC LIMIT 1`,
    [taskId]
  );
}

export async function createReminder(
  db: AbstractPowerSyncDatabase,
  taskId: string,
  userId: string,
  remindAtLocal: string,
  remindAtUtc: string
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO reminders
       (id, task_id, user_id, remind_at_local, remind_at_utc, notified_mobile, notified_web, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, taskId, userId, remindAtLocal, remindAtUtc, 0, 0, now, now]
  );
  return id;
}

export async function updateReminderTime(
  db: AbstractPowerSyncDatabase,
  reminderId: string,
  remindAtLocal: string,
  remindAtUtc: string
): Promise<void> {
  await db.execute(
    `UPDATE reminders
     SET remind_at_local = ?, remind_at_utc = ?, notified_mobile = 0, notified_web = 0, updated_at = ?
     WHERE id = ?`,
    [remindAtLocal, remindAtUtc, new Date().toISOString(), reminderId]
  );
}

export async function deleteReminder(db: AbstractPowerSyncDatabase, reminderId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, reminderId]
  );
}

function toLocalDisplay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// Advances a reminder by `minutes` and resets both notified flags, re-entering
// both delivery paths (Edge Function poll + local reconciliation) exactly like
// a fresh reminder — no separate snooze-specific delivery code needed.
export async function snoozeReminder(
  db: AbstractPowerSyncDatabase,
  reminderId: string,
  minutes: number
): Promise<void> {
  const row = await db.getOptional<ReminderRecord>(
    `SELECT * FROM reminders WHERE id = ? AND deleted_at IS NULL`,
    [reminderId]
  );
  if (!row) return;

  const nextInstant = new Date(new Date(row.remind_at_utc).getTime() + minutes * 60000);
  await db.execute(
    `UPDATE reminders
     SET remind_at_local = ?, remind_at_utc = ?, notified_mobile = 0, notified_web = 0, updated_at = ?
     WHERE id = ?`,
    [toLocalDisplay(nextInstant), nextInstant.toISOString(), new Date().toISOString(), reminderId]
  );
}

// Reconciliation source-of-truth query: reminders that still need a local
// fallback notification scheduled (push not yet confirmed delivered, not
// deleted, still in the future).
export async function getPendingReminders(
  db: AbstractPowerSyncDatabase,
  userId: string
): Promise<Pick<ReminderRecord, 'id' | 'task_id' | 'remind_at_utc'>[]> {
  return db.getAll(
    `SELECT id, task_id, remind_at_utc FROM reminders
     WHERE user_id = ? AND notified_mobile = 0 AND deleted_at IS NULL AND remind_at_utc > ?`,
    [userId, new Date().toISOString()]
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @todolist/db exec vitest run reminders`
Expected: PASS (6 tests)

- [ ] **Step 5: Export from the package entrypoint**

In `packages/db/src/index.ts`, add:
```ts
export * from './queries/attachments';
export * from './queries/reminders';
```
(add the `reminders` line right after the existing `attachments` line)

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/reminders.ts packages/db/src/queries/reminders.test.ts packages/db/src/index.ts
git commit -m "feat(db): add reminder CRUD, snooze, and pending-reminder query"
```

---

## Task 3: `packages/db` — user settings query functions + inbox count

**Files:**
- Create: `packages/db/src/queries/userSettings.ts`
- Create: `packages/db/src/queries/userSettings.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/db/src/queries/userSettings.test.ts
import { describe, it, expect, vi } from 'vitest';
import { upsertUserSettings } from './userSettings';

function makeMockDb(existing: { id: string } | null = null) {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    getOptional: vi.fn().mockResolvedValue(existing),
  } as any;
}

describe('upsertUserSettings', () => {
  it('inserts a new row when none exists for this user', async () => {
    const db = makeMockDb(null);
    await upsertUserSettings(db, 'user-1', { nudge_enabled: 1, nudge_time: '09:00' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO user_settings');
    expect(params).toContain('user-1');
    expect(params).toContain(1);
    expect(params).toContain('09:00');
  });

  it('updates only the provided fields when a row already exists', async () => {
    const db = makeMockDb({ id: 'user-1' });
    await upsertUserSettings(db, 'user-1', { expo_push_token: 'ExponentPushToken[abc]' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE user_settings');
    expect(sql).toContain('expo_push_token = ?');
    expect(sql).not.toContain('nudge_time = ?');
    expect(params).toContain('ExponentPushToken[abc]');
  });

  it('does nothing on update when no fields are provided', async () => {
    const db = makeMockDb({ id: 'user-1' });
    await upsertUserSettings(db, 'user-1', {});
    expect(db.execute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/db exec vitest run userSettings`
Expected: FAIL — `userSettings.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// packages/db/src/queries/userSettings.ts
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { UserSettingsRecord } from '../schema';

// user_settings has at most one row: the current (locally synced) user's own
// row, per the `id = auth.user_id()` sync rule — no WHERE clause needed.
export function useUserSettings() {
  return useQuery<UserSettingsRecord>(`SELECT * FROM user_settings LIMIT 1`);
}

export async function getUserSettings(db: AbstractPowerSyncDatabase): Promise<UserSettingsRecord | null> {
  return db.getOptional<UserSettingsRecord>(`SELECT * FROM user_settings LIMIT 1`);
}

type WritableFields = Partial<Pick<UserSettingsRecord, 'timezone' | 'expo_push_token' | 'nudge_enabled' | 'nudge_time'>>;

export async function upsertUserSettings(
  db: AbstractPowerSyncDatabase,
  userId: string,
  fields: WritableFields
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.getOptional<{ id: string }>(`SELECT id FROM user_settings WHERE id = ?`, [userId]);

  if (existing) {
    const keys = Object.keys(fields) as (keyof WritableFields)[];
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`);
    const values = keys.map(k => fields[k]);
    await db.execute(
      `UPDATE user_settings SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
      [...values, now, userId]
    );
  } else {
    await db.execute(
      `INSERT INTO user_settings (id, timezone, expo_push_token, nudge_enabled, nudge_time, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [userId, fields.timezone ?? null, fields.expo_push_token ?? null, fields.nudge_enabled ?? 0, fields.nudge_time ?? null, now, now]
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @todolist/db exec vitest run userSettings`
Expected: PASS (3 tests)

- [ ] **Step 5: Add `getInboxCount` next to the existing `INBOX_QUERY`**

In `packages/db/src/index.ts`, add this function right after `useInboxTasks` (around line 76):
```ts
// Plain (non-hook) inbox count for use outside component render — e.g. the
// notification reconciliation service, which runs in a useEffect, not a
// component body, so useInboxTasks (a hook) can't be called there.
export async function getInboxCount(db: AbstractPowerSyncDatabase): Promise<number> {
  const rows = await db.getAll(INBOX_QUERY);
  return rows.length;
}
```

- [ ] **Step 6: Write a test for `getInboxCount`**

Add to a new `packages/db/src/index.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { getInboxCount } from './index';

describe('getInboxCount', () => {
  it('returns the number of rows the inbox query returns', async () => {
    const db = { getAll: vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]) } as any;
    expect(await getInboxCount(db)).toBe(2);
  });

  it('returns 0 for an empty inbox', async () => {
    const db = { getAll: vi.fn().mockResolvedValue([]) } as any;
    expect(await getInboxCount(db)).toBe(0);
  });
});
```

Run: `pnpm --filter @todolist/db exec vitest run index.test`
Expected: PASS (2 tests)

- [ ] **Step 7: Export `userSettings` queries from the package entrypoint**

In `packages/db/src/index.ts`, add (next to the `reminders` line added in Task 2):
```ts
export * from './queries/userSettings';
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/queries/userSettings.ts packages/db/src/queries/userSettings.test.ts packages/db/src/index.ts packages/db/src/index.test.ts
git commit -m "feat(db): add user_settings upsert, and a plain getInboxCount for non-component callers"
```

---

## Task 4: Edge Function — `dispatch-reminders`

**Files:**
- Create: `supabase/functions/dispatch-reminders/index.ts`

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/dispatch-reminders/index.ts
//
// Cron-triggered dispatcher for the Reminder table's server-primary delivery
// path (see docs/superpowers/specs/2026-07-15-notifications-design.md).
// Scheduled every minute by pg_cron (supabase/migrations/20260716000001_notification_settings.sql).
// Not called by any client — deployed with --no-verify-jwt, and instead checks
// a shared secret header set by the cron job itself (see that migration).
//
// Auth: uses the service-role key (auto-injected as SUPABASE_SERVICE_ROLE_KEY)
// to bypass RLS — this is a system job dispatching reminders across all users,
// not a per-user request scoped by a caller's JWT (contrast with enrich-url).
//
// Deploy:
//   supabase secrets set DISPATCH_REMINDERS_SECRET=<value seeded into Vault>
//   supabase functions deploy dispatch-reminders --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2';

const DISPATCH_SECRET = Deno.env.get('DISPATCH_REMINDERS_SECRET');

interface ReminderRow {
  id: string;
  task_id: string;
  user_id: string;
  notified_mobile: boolean;
  notified_web: boolean;
}

interface UserSettingsRow {
  id: string;
  expo_push_token: string | null;
  web_push_subscription: string | null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (DISPATCH_SECRET && req.headers.get('x-dispatch-secret') !== DISPATCH_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const nowIso = new Date().toISOString();
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id, task_id, user_id, notified_mobile, notified_web')
    .lte('remind_at_utc', nowIso)
    .is('deleted_at', null)
    .or('notified_mobile.eq.false,notified_web.eq.false');

  if (error) {
    console.error('[dispatch-reminders] query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const rows = (reminders ?? []) as ReminderRow[];
  let dispatched = 0;

  for (const reminder of rows) {
    // Web push is out of scope for this function's first version (see the
    // design spec's Out of Scope) — only act on the mobile branch.
    if (reminder.notified_mobile) continue;

    const { data: settings } = await supabase
      .from('user_settings')
      .select('id, expo_push_token, web_push_subscription')
      .eq('id', reminder.user_id)
      .maybeSingle<UserSettingsRow>();

    if (!settings?.expo_push_token) continue;

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: settings.expo_push_token,
          title: 'Reminder',
          body: 'A task is due',
          categoryId: 'reminder',
          data: {
            url: `/task/${reminder.task_id}`,
            taskId: reminder.task_id,
            type: 'reminder',
            reminderId: reminder.id,
          },
        }),
      });

      if (!res.ok) {
        console.error('[dispatch-reminders] Expo push failed:', reminder.id, await res.text());
        continue; // not retried this run — next minute's poll picks it up, flag untouched
      }

      const { error: updateError } = await supabase
        .from('reminders')
        .update({ notified_mobile: true, updated_at: new Date().toISOString() })
        .eq('id', reminder.id);

      if (updateError) {
        console.error('[dispatch-reminders] flag update failed:', reminder.id, updateError.message);
        continue;
      }

      dispatched++;
    } catch (err) {
      console.error('[dispatch-reminders] send failed:', reminder.id, err);
    }
  }

  return new Response(JSON.stringify({ ok: true, dispatched, checked: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 2: Deploy and verify against the live project**

Run: `supabase functions deploy dispatch-reminders --no-verify-jwt`
Expected: deploy succeeds.

Then complete the one-time Vault/secret setup noted in Task 1 Step 3 (seed `project_url` and `dispatch_reminders_secret` into Vault via the SQL editor, then `supabase secrets set DISPATCH_REMINDERS_SECRET=<same value>`).

Verify the cron job is actually firing:
Run: `supabase db execute --linked "select * from cron.job_run_details order by start_time desc limit 5"`
Expected: rows appear roughly once a minute after deploy, with `status = 'succeeded'`.

- [ ] **Step 3: Manual end-to-end check**

Create a test reminder row directly (e.g. via the SQL editor) with `remind_at_utc` a minute in the past and a real `expo_push_token` for a device you control (obtainable after Task 8 ships and you set a reminder once from the app), then confirm within ~60s: (a) a push notification arrives on-device, and (b) `notified_mobile` flips to `true` on that row. This is the only way to verify this function per `docs/SCHEMA_SYNC_STRATEGY.md`'s schema-first discipline — don't trust the migration file matches deployed state without checking.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/dispatch-reminders/index.ts
git commit -m "feat(functions): add dispatch-reminders cron-triggered Edge Function"
```

---

## Task 5: Mobile dependency — `expo-notifications`

**Files:**
- Modify: `apps/mobile/package.json` (via install command, not hand-edited)
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Install with Expo's version pin**

Run: `cd apps/mobile && npx expo install expo-notifications`
Expected: `expo-notifications` added to `apps/mobile/package.json` dependencies at the SDK-56-compatible version.

- [ ] **Step 2: Register the config plugin**

In `apps/mobile/app.json`, add `"expo-notifications"` to the `plugins` array, after `"@react-native-community/datetimepicker"` and before the `expo-speech-recognition` entry:
```json
"plugins": [
  "expo-secure-store",
  "expo-router",
  [
    "expo-share-intent",
    { "androidIntentFilters": ["text/*", "image/*", "*/*"], "androidMultiIntentFilters": ["image/*", "*/*"] }
  ],
  "@react-native-community/datetimepicker",
  "expo-notifications",
  [
    "expo-speech-recognition",
    { "microphonePermission": "Allow TodoList to use the microphone for voice capture.", "speechRecognitionPermission": "Allow TodoList to use speech recognition for voice capture." }
  ]
]
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd apps/mobile && npx expo-doctor`
Expected: no new errors related to the plugin or dependency.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json pnpm-lock.yaml
git commit -m "chore(mobile): add expo-notifications dependency and config plugin"
```

---

## Task 6: Mobile — reminder offset math (pure, testable)

**Files:**
- Create: `apps/mobile/src/lib/reminderOffsets.ts`
- Create: `apps/mobile/__tests__/reminderOffsets.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/mobile/__tests__/reminderOffsets.test.ts
import { describe, it, expect } from 'vitest';
import { REMINDER_OFFSET_MINUTES, computeReminderFromOffset, computeReminderFromCustomDate, formatReminderLocal } from '../src/lib/reminderOffsets';

describe('REMINDER_OFFSET_MINUTES', () => {
  it('maps each named offset to its minute value', () => {
    expect(REMINDER_OFFSET_MINUTES.due).toBe(0);
    expect(REMINDER_OFFSET_MINUTES['10min']).toBe(10);
    expect(REMINDER_OFFSET_MINUTES['30min']).toBe(30);
    expect(REMINDER_OFFSET_MINUTES['1hour']).toBe(60);
  });
});

describe('computeReminderFromOffset', () => {
  it('subtracts the offset from the due date/time', () => {
    const { remindAtLocal, remindAtUtc } = computeReminderFromOffset('2026-07-20', '09:00', 30);
    expect(remindAtLocal).toBe('2026-07-20 08:30');
    expect(new Date(remindAtUtc).getTime()).toBe(new Date(2026, 6, 20, 8, 30).getTime());
  });

  it('an offset of 0 (at due time) returns the due instant unchanged', () => {
    const { remindAtLocal } = computeReminderFromOffset('2026-07-20', '09:00', 0);
    expect(remindAtLocal).toBe('2026-07-20 09:00');
  });

  it('crossing a day boundary backwards works correctly', () => {
    const { remindAtLocal } = computeReminderFromOffset('2026-07-20', '00:15', 30);
    expect(remindAtLocal).toBe('2026-07-19 23:45');
  });
});

describe('computeReminderFromCustomDate', () => {
  it('formats a picked Date directly as local + UTC', () => {
    const date = new Date(2026, 6, 25, 14, 30);
    const { remindAtLocal, remindAtUtc } = computeReminderFromCustomDate(date);
    expect(remindAtLocal).toBe('2026-07-25 14:30');
    expect(remindAtUtc).toBe(date.toISOString());
  });
});

describe('formatReminderLocal', () => {
  it('pads single-digit hours and minutes', () => {
    const date = new Date(2026, 0, 5, 9, 5);
    expect(formatReminderLocal(date)).toBe('2026-01-05 09:05');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/mobile exec vitest run reminderOffsets`
Expected: FAIL — `reminderOffsets.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/src/lib/reminderOffsets.ts

export const REMINDER_OFFSET_MINUTES = {
  due: 0,
  '10min': 10,
  '30min': 30,
  '1hour': 60,
} as const;

export type ReminderOffsetKey = keyof typeof REMINDER_OFFSET_MINUTES;

export function formatReminderLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// dueDate: 'YYYY-MM-DD', dueTime: 'HH:mm', both interpreted as local wall-clock
// time on this device (single-device personal app — see design spec's data
// model notes on `timezone`). offsetMinutes is subtracted from the due instant.
export function computeReminderFromOffset(
  dueDate: string,
  dueTime: string,
  offsetMinutes: number
): { remindAtLocal: string; remindAtUtc: string } {
  const [year, month, day] = dueDate.split('-').map(Number);
  const [hour, minute] = dueTime.split(':').map(Number);
  const dueInstant = new Date(year, month - 1, day, hour, minute);
  const remindInstant = new Date(dueInstant.getTime() - offsetMinutes * 60000);
  return {
    remindAtLocal: formatReminderLocal(remindInstant),
    remindAtUtc: remindInstant.toISOString(),
  };
}

export function computeReminderFromCustomDate(date: Date): { remindAtLocal: string; remindAtUtc: string } {
  return {
    remindAtLocal: formatReminderLocal(date),
    remindAtUtc: date.toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @todolist/mobile exec vitest run reminderOffsets`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/reminderOffsets.ts apps/mobile/__tests__/reminderOffsets.test.ts
git commit -m "feat(mobile): add pure reminder-offset time math"
```

---

## Task 7: Mobile — push token registration

**Files:**
- Create: `apps/mobile/src/notifications/registerPushToken.ts`

- [ ] **Step 1: Write the module**

```ts
// apps/mobile/src/notifications/registerPushToken.ts
//
// Requests notification permission and, if granted, fetches this device's
// Expo push token and stores it on user_settings so dispatch-reminders can
// find it. Called in-context the first time either applies: the user sets a
// reminder (task/[id].tsx) or enables the daily nudge (settings.tsx) —
// whichever comes first (see design spec's "Permission + registration").
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { upsertUserSettings } from '@todolist/db';

export async function ensurePushRegistered(
  db: AbstractPowerSyncDatabase,
  userId: string
): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== 'granted') return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return false;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await upsertUserSettings(db, userId, { expo_push_token: token.data });
  return true;
}
```

This is a thin wrapper around native/Expo APIs — typecheck + on-device verification only, per this codebase's established constraint on RN-native-import files (same as `DueDateField.tsx`).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/notifications/registerPushToken.ts
git commit -m "feat(mobile): add push token registration"
```

---

## Task 8: Mobile — reminder UI on the task detail screen

**Files:**
- Create: `apps/mobile/src/components/ReminderPickerSheet.tsx`
- Create: `apps/mobile/src/components/ReminderField.tsx`
- Modify: `apps/mobile/src/app/task/[id].tsx`

- [ ] **Step 1: Write the offset-picker bottom sheet**

```tsx
// apps/mobile/src/components/ReminderPickerSheet.tsx
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography } from '@todolist/ui';
import type { ReminderOffsetKey } from '../lib/reminderOffsets';

interface Props {
  visible: boolean;
  hasDueTime: boolean;
  onPickOffset: (key: ReminderOffsetKey) => void;
  onPickCustom: () => void;
  onClose: () => void;
}

const OFFSET_LABELS: { key: ReminderOffsetKey; label: string }[] = [
  { key: 'due', label: 'At due time' },
  { key: '10min', label: '10 minutes before' },
  { key: '30min', label: '30 minutes before' },
  { key: '1hour', label: '1 hour before' },
];

export function ReminderPickerSheet({ visible, hasDueTime, onPickOffset, onPickCustom, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.heading}>Remind me</Text>
          {hasDueTime && OFFSET_LABELS.map(({ key, label }) => (
            <Pressable key={key} style={styles.option} onPress={() => onPickOffset(key)}>
              <Text style={styles.optionText}>{label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.option} onPress={onPickCustom}>
            <Text style={styles.optionText}>Custom…</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  heading: { ...typography.heading3, color: colors.textMuted, marginBottom: 8 },
  option: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optionText: { ...typography.body, color: colors.textPrimary },
});
```

- [ ] **Step 2: Write the field component**

Android's imperative date/time picker does not support a combined `datetime` mode (iOS-only) — the "Custom…" path opens a date picker, then chains into a time picker on Android, while iOS uses the single combined declarative picker.

```tsx
// apps/mobile/src/components/ReminderField.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, typography } from '@todolist/ui';
import {
  REMINDER_OFFSET_MINUTES, computeReminderFromOffset, computeReminderFromCustomDate,
  type ReminderOffsetKey,
} from '../lib/reminderOffsets';
import { ReminderPickerSheet } from './ReminderPickerSheet';

interface Props {
  dueDate: string | null;
  dueTime: string | null;
  reminderLocal: string | null;
  onSet: (remindAtLocal: string, remindAtUtc: string) => void;
  onRemove: () => void;
}

export function ReminderField({ dueDate, dueTime, reminderLocal, onSet, onRemove }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [showIosPicker, setShowIosPicker] = useState(false);

  const openSheet = useCallback(() => setSheetVisible(true), []);
  const closeSheet = useCallback(() => setSheetVisible(false), []);

  const pickOffset = useCallback((key: ReminderOffsetKey) => {
    if (!dueDate || !dueTime) return;
    const { remindAtLocal, remindAtUtc } = computeReminderFromOffset(dueDate, dueTime, REMINDER_OFFSET_MINUTES[key]);
    onSet(remindAtLocal, remindAtUtc);
    closeSheet();
  }, [dueDate, dueTime, onSet, closeSheet]);

  const applyCustom = useCallback((date: Date) => {
    const { remindAtLocal, remindAtUtc } = computeReminderFromCustomDate(date);
    onSet(remindAtLocal, remindAtUtc);
  }, [onSet]);

  const pickCustom = useCallback(() => {
    closeSheet();
    if (Platform.OS === 'android') {
      const base = new Date();
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        display: 'default',
        onValueChange: (_e, selectedDate) => {
          if (!selectedDate) return;
          DateTimePickerAndroid.open({
            value: selectedDate,
            mode: 'time',
            display: 'default',
            onValueChange: (_e2, selectedTime) => {
              if (!selectedTime) return;
              const combined = new Date(selectedDate);
              combined.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
              applyCustom(combined);
            },
          });
        },
      });
    } else {
      setShowIosPicker(true);
    }
  }, [applyCustom, closeSheet]);

  const handleIosChange = useCallback((_e: unknown, selectedDate?: Date) => {
    setShowIosPicker(false);
    if (selectedDate) applyCustom(selectedDate);
  }, [applyCustom]);

  return (
    <View style={styles.row}>
      <Pressable onPress={openSheet}>
        <Text style={styles.value}>{reminderLocal ?? 'No reminder'}</Text>
      </Pressable>
      {reminderLocal && (
        <Pressable onPress={onRemove}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      )}

      <ReminderPickerSheet
        visible={sheetVisible}
        hasDueTime={!!(dueDate && dueTime)}
        onPickOffset={pickOffset}
        onPickCustom={pickCustom}
        onClose={closeSheet}
      />

      {showIosPicker && (
        <DateTimePicker
          value={new Date()}
          mode="datetime"
          display="default"
          onValueChange={handleIosChange}
          onDismiss={() => setShowIosPicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { ...typography.body, color: colors.textSecondary },
  clear: { ...typography.caption, color: colors.accent, fontWeight: '600' },
});
```

- [ ] **Step 3: Wire into the task detail screen**

In `apps/mobile/src/app/task/[id].tsx`:

Add imports:
```tsx
import { useTaskReminder, createReminder, updateReminderTime, deleteReminder } from '@todolist/db';
import { useAuth } from '../../auth/AuthContext';
import { ensurePushRegistered } from '../../notifications/registerPushToken';
import { ReminderField } from '../../components/ReminderField';
```

Add state/handlers inside `TaskDetailScreen`, near the other handlers (after `handleDueDate`):
```tsx
  const { session } = useAuth();
  const { data: reminderRows } = useTaskReminder(taskId);
  const reminder = reminderRows?.[0] ?? null;

  const handleSetReminder = useCallback(async (remindAtLocal: string, remindAtUtc: string) => {
    const userId = session?.user.id;
    if (!userId) return;
    if (reminder) {
      await updateReminderTime(db as any, reminder.id, remindAtLocal, remindAtUtc);
    } else {
      await createReminder(db as any, taskId, userId, remindAtLocal, remindAtUtc);
    }
    ensurePushRegistered(db as any, userId).catch(console.error);
  }, [db, taskId, session, reminder]);

  const handleRemoveReminder = useCallback(async () => {
    if (!reminder) return;
    await deleteReminder(db as any, reminder.id);
  }, [db, reminder]);
```

Add the field to the JSX, right after the Due date section (after the closing `</View>` for `DUE DATE`):
```tsx
        {/* Reminder */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REMINDER</Text>
          <ReminderField
            dueDate={task.due_date}
            dueTime={task.due_time}
            reminderLocal={reminder?.remind_at_local ?? null}
            onSet={handleSetReminder}
            onRemove={handleRemoveReminder}
          />
        </View>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no new errors.

- [ ] **Step 5: On-device verification**

Since this is RN component JSX (same established constraint as `DueDateField.tsx`), verify manually: open a task with a due date and time set, tap the Reminder row, pick "10 minutes before", confirm it shows the computed local time and a "Clear" button appears; tap "Custom…" and confirm the Android date-then-time chaining (or iOS combined picker) works; tap Clear and confirm it reverts to "No reminder".

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/ReminderPickerSheet.tsx apps/mobile/src/components/ReminderField.tsx apps/mobile/src/app/task/[id].tsx
git commit -m "feat(mobile): add reminder picker to the task detail screen"
```

---

## Task 9: Mobile — notification categories, Android channels, foreground handler

**Files:**
- Create: `apps/mobile/src/notifications/setup.ts`

- [ ] **Step 1: Write the module**

```ts
// apps/mobile/src/notifications/setup.ts
//
// One-time startup registration: notification categories (action buttons),
// Android channels, and the foreground display handler. Safe to call before
// permission is granted — registering channels/categories doesn't require it.
// Called once from _layout.tsx (see Task 12).
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerNotificationInfrastructure(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  await Notifications.setNotificationCategoryAsync('reminder', [
    { identifier: 'complete', buttonTitle: 'Complete', options: { opensAppToForeground: false } },
    { identifier: 'snooze_1h', buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync('nudge', []);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('triage', {
      name: 'Triage',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/notifications/setup.ts
git commit -m "feat(mobile): register notification categories, Android channels, foreground handler"
```

---

## Task 10: Mobile — deep link handling

**Files:**
- Create: `apps/mobile/src/notifications/deepLinkHandler.ts`
- Create: `apps/mobile/__tests__/deepLinkHandler.test.ts`
- Create: `apps/mobile/src/notifications/deepLink.ts`

- [ ] **Step 1: Write the failing tests for the pure handler**

```ts
// apps/mobile/__tests__/deepLinkHandler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleNotificationResponse, DEFAULT_ACTION_IDENTIFIER } from '../src/notifications/deepLinkHandler';

function makeDeps() {
  return {
    completeTask: vi.fn().mockResolvedValue(undefined),
    snoozeReminder: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
  };
}

describe('handleNotificationResponse', () => {
  it('completes the task on the "complete" action and does not navigate', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('complete', { taskId: 'task-1', url: '/task/task-1' }, deps);
    expect(deps.completeTask).toHaveBeenCalledWith('task-1');
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('snoozes the reminder by 60 minutes on the "snooze_1h" action and does not navigate', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('snooze_1h', { reminderId: 'rem-1', url: '/task/task-1' }, deps);
    expect(deps.snoozeReminder).toHaveBeenCalledWith('rem-1', 60);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the data url on a plain tap (default action)', async () => {
    const deps = makeDeps();
    await handleNotificationResponse(DEFAULT_ACTION_IDENTIFIER, { url: '/tasks' }, deps);
    expect(deps.navigate).toHaveBeenCalledWith('/tasks');
    expect(deps.completeTask).not.toHaveBeenCalled();
  });

  it('does nothing if the action is unrecognized', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('some-unknown-action', { url: '/tasks' }, deps);
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.completeTask).not.toHaveBeenCalled();
    expect(deps.snoozeReminder).not.toHaveBeenCalled();
  });

  it('a plain tap with no url does nothing', async () => {
    const deps = makeDeps();
    await handleNotificationResponse(DEFAULT_ACTION_IDENTIFIER, {}, deps);
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/mobile exec vitest run deepLinkHandler`
Expected: FAIL — `deepLinkHandler.ts` does not exist yet.

- [ ] **Step 3: Write the pure handler**

Kept free of any `expo-notifications` import so it's fully unit-testable (same split as `dueDateFormat.ts` / `DueDateField.tsx`) — `expo-notifications` pulls in native bindings that don't run under Vitest's node environment.

```ts
// apps/mobile/src/notifications/deepLinkHandler.ts

// Expo's own constant for a plain notification tap (as opposed to a named
// action button identifier like 'complete' or 'snooze_1h'). Hardcoded here
// (rather than imported from expo-notifications) to keep this file import-free
// of native modules — see file comment.
export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';

export interface NotificationResponseData {
  url?: string;
  taskId?: string;
  reminderId?: string;
}

export interface DeepLinkDeps {
  completeTask: (taskId: string) => Promise<void>;
  snoozeReminder: (reminderId: string, minutes: number) => Promise<void>;
  navigate: (url: string) => void;
}

export async function handleNotificationResponse(
  actionIdentifier: string,
  data: NotificationResponseData,
  deps: DeepLinkDeps
): Promise<void> {
  if (actionIdentifier === 'complete' && data.taskId) {
    await deps.completeTask(data.taskId);
    return;
  }
  if (actionIdentifier === 'snooze_1h' && data.reminderId) {
    await deps.snoozeReminder(data.reminderId, 60);
    return;
  }
  if (actionIdentifier === DEFAULT_ACTION_IDENTIFIER && data.url) {
    deps.navigate(data.url);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @todolist/mobile exec vitest run deepLinkHandler`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the thin RN wiring (not unit-tested — on-device verification only)**

```ts
// apps/mobile/src/notifications/deepLink.ts
import * as Notifications from 'expo-notifications';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { completeTask, snoozeReminder } from '@todolist/db';
import { handleNotificationResponse, type NotificationResponseData } from './deepLinkHandler';

function makeDeps(db: AbstractPowerSyncDatabase, navigate: (url: string) => void) {
  return {
    completeTask: (taskId: string) => completeTask(db, taskId),
    snoozeReminder: (reminderId: string, minutes: number) => snoozeReminder(db, reminderId, minutes),
    navigate,
  };
}

// Warm taps/actions — app already running.
export function registerDeepLinkListener(
  db: AbstractPowerSyncDatabase,
  navigate: (url: string) => void
): () => void {
  const deps = makeDeps(db, navigate);
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationResponseData;
    handleNotificationResponse(response.actionIdentifier, data, deps).catch(console.error);
  });
  return () => subscription.remove();
}

// Cold start — app was launched by tapping a notification. The case that's
// easy to forget (see design spec).
export async function handleColdStartNotification(
  db: AbstractPowerSyncDatabase,
  navigate: (url: string) => void
): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;
  const deps = makeDeps(db, navigate);
  const data = response.notification.request.content.data as NotificationResponseData;
  await handleNotificationResponse(response.actionIdentifier, data, deps);
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/notifications/deepLinkHandler.ts apps/mobile/__tests__/deepLinkHandler.test.ts apps/mobile/src/notifications/deepLink.ts
git commit -m "feat(mobile): add notification deep-link handling (warm + cold start)"
```

---

## Task 11: Mobile — reconciliation logic (pure, testable)

**Files:**
- Create: `apps/mobile/src/notifications/reconciliation.ts`
- Create: `apps/mobile/__tests__/reconciliation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/mobile/__tests__/reconciliation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createReconciler } from '../src/notifications/reconciliation';

function makeDeps(overrides: Partial<Record<string, any>> = {}) {
  return {
    getPendingReminders: vi.fn().mockResolvedValue([]),
    scheduleReminderNotification: vi.fn().mockResolvedValue('notif-1'),
    cancelNotification: vi.fn().mockResolvedValue(undefined),
    getInboxCount: vi.fn().mockResolvedValue(0),
    getNudgeSettings: vi.fn().mockResolvedValue({ enabled: false, time: null }),
    scheduleNudgeNotification: vi.fn().mockResolvedValue('nudge-1'),
    ...overrides,
  };
}

describe('reconcileReminders', () => {
  it('schedules a notification for a pending reminder not yet scheduled', async () => {
    const deps = makeDeps({
      getPendingReminders: vi.fn().mockResolvedValue([{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }]),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    expect(deps.scheduleReminderNotification).toHaveBeenCalledTimes(1);
    expect(deps.scheduleReminderNotification).toHaveBeenCalledWith({ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' });
  });

  it('does not re-schedule a reminder that is already scheduled', async () => {
    const pending = [{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }];
    const deps = makeDeps({ getPendingReminders: vi.fn().mockResolvedValue(pending) });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    await reconciler.reconcileReminders();
    expect(deps.scheduleReminderNotification).toHaveBeenCalledTimes(1);
  });

  it('cancels a scheduled notification whose reminder is no longer pending (deleted, completed, re-synced, or already delivered)', async () => {
    const pending = [{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }];
    const deps = makeDeps({
      getPendingReminders: vi.fn()
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce([]), // second pass: gone (e.g. another device completed the task)
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    await reconciler.reconcileReminders();
    expect(deps.cancelNotification).toHaveBeenCalledWith('notif-1');
  });

  it('schedules newly-pending reminders and cancels stale ones in the same pass', async () => {
    const deps = makeDeps({
      getPendingReminders: vi.fn()
        .mockResolvedValueOnce([{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }])
        .mockResolvedValueOnce([{ id: 'rem-2', task_id: 'task-2', remind_at_utc: '2026-07-21T09:00:00.000Z' }]),
      scheduleReminderNotification: vi.fn()
        .mockResolvedValueOnce('notif-1')
        .mockResolvedValueOnce('notif-2'),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    await reconciler.reconcileReminders();
    expect(deps.cancelNotification).toHaveBeenCalledWith('notif-1');
    expect(deps.scheduleReminderNotification).toHaveBeenCalledTimes(2);
  });
});

describe('reconcileNudge', () => {
  it('does nothing (no schedule call) when disabled', async () => {
    const deps = makeDeps();
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    expect(deps.scheduleNudgeNotification).not.toHaveBeenCalled();
  });

  it('stays silent when enabled but the inbox is empty', async () => {
    const deps = makeDeps({ getNudgeSettings: vi.fn().mockResolvedValue({ enabled: true, time: '08:00' }), getInboxCount: vi.fn().mockResolvedValue(0) });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    expect(deps.scheduleNudgeNotification).not.toHaveBeenCalled();
  });

  it('schedules with the current count when enabled and the inbox is non-empty', async () => {
    const deps = makeDeps({ getNudgeSettings: vi.fn().mockResolvedValue({ enabled: true, time: '08:00' }), getInboxCount: vi.fn().mockResolvedValue(7) });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    expect(deps.scheduleNudgeNotification).toHaveBeenCalledWith(7, '08:00');
  });

  it('replaces rather than stacks: a second reconcile cancels the previous nudge notification before rescheduling', async () => {
    const deps = makeDeps({
      getNudgeSettings: vi.fn().mockResolvedValue({ enabled: true, time: '08:00' }),
      getInboxCount: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(5),
      scheduleNudgeNotification: vi.fn().mockResolvedValueOnce('nudge-1').mockResolvedValueOnce('nudge-2'),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    await reconciler.reconcileNudge();
    expect(deps.cancelNotification).toHaveBeenCalledWith('nudge-1');
    expect(deps.scheduleNudgeNotification).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @todolist/mobile exec vitest run reconciliation`
Expected: FAIL — `reconciliation.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Dependency-injected so it needs no `expo-notifications` or PowerSync import — same pattern as the existing `uploadQueue.ts`. The DB is source of truth; the scheduled-notification map is a derived cache (per the design spec).

```ts
// apps/mobile/src/notifications/reconciliation.ts

export interface PendingReminder {
  id: string;
  task_id: string;
  remind_at_utc: string;
}

export interface NudgeSettings {
  enabled: boolean;
  time: string | null;
}

export interface ReconciliationDeps {
  getPendingReminders: () => Promise<PendingReminder[]>;
  scheduleReminderNotification: (reminder: PendingReminder) => Promise<string>;
  cancelNotification: (notificationId: string) => Promise<void>;
  getInboxCount: () => Promise<number>;
  getNudgeSettings: () => Promise<NudgeSettings>;
  scheduleNudgeNotification: (count: number, time: string) => Promise<string>;
}

export function createReconciler(deps: ReconciliationDeps) {
  const scheduledReminders = new Map<string, string>(); // reminderId -> scheduledNotificationId
  let scheduledNudgeId: string | null = null;

  async function reconcileReminders(): Promise<void> {
    const pending = await deps.getPendingReminders();
    const pendingIds = new Set(pending.map(r => r.id));

    for (const [reminderId, notificationId] of scheduledReminders) {
      if (!pendingIds.has(reminderId)) {
        await deps.cancelNotification(notificationId);
        scheduledReminders.delete(reminderId);
      }
    }

    for (const reminder of pending) {
      if (!scheduledReminders.has(reminder.id)) {
        const notificationId = await deps.scheduleReminderNotification(reminder);
        scheduledReminders.set(reminder.id, notificationId);
      }
    }
  }

  // Nudge content is fixed at schedule time (Expo local notifications can't
  // compute fresh content at fire time) — reschedule aggressively on every
  // call and accept residual staleness between reschedule and fire, per the
  // design spec's trade-off.
  async function reconcileNudge(): Promise<void> {
    if (scheduledNudgeId) {
      await deps.cancelNotification(scheduledNudgeId);
      scheduledNudgeId = null;
    }

    const settings = await deps.getNudgeSettings();
    if (!settings.enabled || !settings.time) return;

    const count = await deps.getInboxCount();
    if (count === 0) return; // silent when the inbox is empty

    scheduledNudgeId = await deps.scheduleNudgeNotification(count, settings.time);
  }

  return { reconcileReminders, reconcileNudge };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @todolist/mobile exec vitest run reconciliation`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/notifications/reconciliation.ts apps/mobile/__tests__/reconciliation.test.ts
git commit -m "feat(mobile): add notification reconciliation diffing logic"
```

---

## Task 12: Mobile — reconciliation hook + startup wiring

**Files:**
- Create: `apps/mobile/src/hooks/useNotificationReconciliation.ts`
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Write the hook**

Mirrors the `useOfflineAttachmentSync` pattern already in this codebase (PowerSync `statusChanged` listener), plus `AppState` foreground/background triggers (new to this codebase — no precedent, verified on-device).

```ts
// apps/mobile/src/hooks/useNotificationReconciliation.ts
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePowerSync } from '@powersync/react';
import { getPendingReminders, getUserSettings, getInboxCount } from '@todolist/db';
import { useAuth } from '../auth/AuthContext';
import { createReconciler } from '../notifications/reconciliation';

function nextOccurrence(time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next;
}

export function useNotificationReconciliation() {
  const db = usePowerSync();
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    const reconciler = createReconciler({
      getPendingReminders: () => getPendingReminders(db, userId),

      scheduleReminderNotification: (reminder) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Reminder',
            body: 'A task is due',
            categoryIdentifier: 'reminder',
            data: {
              url: `/task/${reminder.task_id}`,
              taskId: reminder.task_id,
              type: 'reminder',
              reminderId: reminder.id,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(reminder.remind_at_utc),
            channelId: 'reminders',
          },
        }),

      cancelNotification: (id) => Notifications.cancelScheduledNotificationAsync(id),

      getInboxCount: () => getInboxCount(db),

      getNudgeSettings: async () => {
        const settings = await getUserSettings(db);
        return { enabled: !!settings?.nudge_enabled, time: settings?.nudge_time ?? null };
      },

      scheduleNudgeNotification: (count, time) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Inbox triage',
            body: `${count} item${count === 1 ? '' : 's'} to process`,
            categoryIdentifier: 'nudge',
            data: { url: '/tasks', type: 'nudge' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: nextOccurrence(time),
            channelId: 'triage',
          },
        }),
    });

    const reconcileAll = () => {
      reconciler.reconcileReminders().catch(console.error);
      reconciler.reconcileNudge().catch(console.error);
    };

    reconcileAll();

    const syncUnsub = db.registerListener({ statusChanged: () => reconcileAll() });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') reconcileAll();
      if (nextState === 'background') reconciler.reconcileNudge().catch(console.error);
    });

    return () => {
      syncUnsub();
      appStateSub.remove();
    };
  }, [db, session]);
}
```

- [ ] **Step 2: Wire startup registration, reconciliation, and deep links into the root layout**

In `apps/mobile/src/app/_layout.tsx`, add imports:
```tsx
import { usePowerSync } from '@powersync/react';
import { useNotificationReconciliation } from '../hooks/useNotificationReconciliation';
import { registerNotificationInfrastructure } from '../notifications/setup';
import { registerDeepLinkListener, handleColdStartNotification } from '../notifications/deepLink';
```

Inside `RootLayoutNav`, add `const db = usePowerSync();` near the top (alongside the existing `session`/`router` destructuring), and add these effects right after the existing `useOfflineAttachmentSync();` line:
```tsx
  useOfflineAttachmentSync();
  useNotificationReconciliation();

  useEffect(() => {
    registerNotificationInfrastructure().catch(console.error);
  }, []);

  useEffect(() => {
    handleColdStartNotification(db, (url) => router.push(url)).catch(console.error);
    return registerDeepLinkListener(db, (url) => router.push(url));
  }, [db, router]);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no new errors.

- [ ] **Step 4: On-device verification**

Set a reminder a few minutes out, background the app, confirm the local fallback notification fires and tapping it opens the task; force-quit the app, tap a still-scheduled notification, confirm cold start lands on the right screen; complete the task from another path before the notification fires and confirm the next foreground reconciliation cancels the stale scheduled notification (no notification appears).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/hooks/useNotificationReconciliation.ts apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): wire notification setup, reconciliation, and deep links into app startup"
```

---

## Task 13: Mobile — nudge settings screen

**Files:**
- Create: `apps/mobile/src/app/settings.tsx`
- Modify: `apps/mobile/src/app/(tabs)/index.tsx`

The design spec's nudge feature ("enables the nudge in settings") needs an actual settings screen to toggle it — none exists anywhere in the app yet. This adds the minimal one: a single toggle + time picker, reachable from a small icon on the Home tab.

- [ ] **Step 1: Write the settings screen**

```tsx
// apps/mobile/src/app/settings.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { usePowerSync } from '@powersync/react';
import { useUserSettings, upsertUserSettings } from '@todolist/db';
import { useAuth } from '../auth/AuthContext';
import { ensurePushRegistered } from '../notifications/registerPushToken';
import { homeColors } from '../components/home/homeTheme';

function parseTime(time: string | null): Date {
  const date = new Date();
  const [h, m] = (time ?? '09:00').split(':').map(Number);
  date.setHours(h, m, 0, 0);
  return date;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function SettingsScreen() {
  const db = usePowerSync();
  const router = useRouter();
  const { session } = useAuth();
  const { data: rows } = useUserSettings();
  const settings = rows?.[0] ?? null;
  const [showIosPicker, setShowIosPicker] = useState(false);

  const userId = session?.user.id ?? '';
  const nudgeEnabled = !!settings?.nudge_enabled;
  const nudgeTime = settings?.nudge_time ?? '09:00';

  const handleToggle = useCallback(async (value: boolean) => {
    if (!userId) return;
    if (value) {
      const granted = await ensurePushRegistered(db as any, userId);
      if (!granted) return;
    }
    await upsertUserSettings(db as any, userId, { nudge_enabled: value ? 1 : 0, nudge_time: nudgeTime });
  }, [db, userId, nudgeTime]);

  const applyTime = useCallback((date: Date) => {
    if (!userId) return;
    upsertUserSettings(db as any, userId, { nudge_time: formatTime(date) }).catch(console.error);
  }, [db, userId]);

  const openTimePicker = useCallback(() => {
    const value = parseTime(nudgeTime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value, mode: 'time', display: 'default',
        onValueChange: (_e, selectedDate) => { if (selectedDate) applyTime(selectedDate); },
      });
    } else {
      setShowIosPicker(true);
    }
  }, [nudgeTime, applyTime]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Daily inbox nudge</Text>
        <Switch value={nudgeEnabled} onValueChange={handleToggle} />
      </View>

      {nudgeEnabled && (
        <Pressable style={styles.row} onPress={openTimePicker}>
          <Text style={styles.label}>Time</Text>
          <Text style={styles.value}>{nudgeTime}</Text>
        </Pressable>
      )}

      {showIosPicker && (
        <DateTimePicker
          value={parseTime(nudgeTime)}
          mode="time"
          display="default"
          onValueChange={(_e, selectedDate) => { setShowIosPicker(false); if (selectedDate) applyTime(selectedDate); }}
          onDismiss={() => setShowIosPicker(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: homeColors.page, padding: 20 },
  back: { marginBottom: 12 },
  backText: { fontSize: 15, color: homeColors.accent, fontWeight: '600' },
  heading: { fontSize: 24, fontWeight: '700', color: homeColors.textPrimary, marginBottom: 20 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: homeColors.cardBorder,
  },
  label: { fontSize: 15, color: homeColors.textPrimary },
  value: { fontSize: 15, color: homeColors.textMuted },
});
```

- [ ] **Step 2: Add a settings entry point to the Home tab**

In `apps/mobile/src/app/(tabs)/index.tsx`, add the import:
```tsx
import { Settings } from 'lucide-react-native';
```

Replace:
```tsx
        <GreetingHeader />
```
with:
```tsx
        <View style={styles.headerRow}>
          <GreetingHeader />
          <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
            <Settings size={22} color={homeColors.textMuted} strokeWidth={2} />
          </Pressable>
        </View>
```

Add to the `styles` object:
```tsx
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
```

`Pressable` is already imported in this file's `react-native` import — no other import changes needed.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @todolist/mobile typecheck`
Expected: no new errors.

- [ ] **Step 4: On-device verification**

From the Home tab, tap the settings icon, confirm it navigates to `/settings`; toggle the nudge on (grants permission the first time), set a time, back out and back in to confirm it persisted; toggle it off.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/settings.tsx apps/mobile/src/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): add nudge settings screen and Home tab entry point"
```

---

## Task 14: Full verification pass

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 2: Typecheck everything**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: all pass, including the new suites from Tasks 2, 3, 6, 10, 11.

- [ ] **Step 4: Full Turbo build**

Run: `pnpm build`
Expected: succeeds (per `CLAUDE.md`: run before any deploy-relevant change is marked done).

- [ ] **Step 5: Node version check**

Run: `npm run check-versions`
Expected: no drift.

- [ ] **Step 6: Re-confirm the live Edge Function + cron loop** (see Task 4 Step 3) if not already verified.

---

## Out of Scope (unchanged from the design spec)

- Web Push client wiring
- Recurring-task surfacing as a distinct notification type (rides the reminders pipeline automatically)
- Exact-alarm scheduling
- Nudge day-of-week configuration
- Quiet hours / do-not-disturb windows
- An "upcoming reminders" list view
