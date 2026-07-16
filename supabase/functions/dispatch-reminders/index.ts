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
const PUSH_TIMEOUT_MS = 8000;

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

  if (!DISPATCH_SECRET || req.headers.get('x-dispatch-secret') !== DISPATCH_SECRET) {
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
    .eq('notified_mobile', false);

  if (error) {
    console.error('[dispatch-reminders] query failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const rows = (reminders ?? []) as ReminderRow[];
  let dispatched = 0;

  for (const reminder of rows) {
    if (reminder.notified_mobile) continue;

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('id, expo_push_token, web_push_subscription')
      .eq('id', reminder.user_id)
      .maybeSingle<UserSettingsRow>();

    if (settingsError) {
      console.error('[dispatch-reminders] user_settings lookup failed:', reminder.id, settingsError.message);
      continue;
    }
    if (!settings?.expo_push_token) continue;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          signal: controller.signal,
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
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        console.error('[dispatch-reminders] Expo push failed:', reminder.id, await res.text());
        continue;
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
