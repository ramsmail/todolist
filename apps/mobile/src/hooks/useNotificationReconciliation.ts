import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePowerSync } from '@powersync/react';
import { getPendingReminders, getUserSettings, getInboxCount } from '@todolist/db';
import { useAuth } from '../auth/AuthContext';
import { createReconciler, type PendingReminder } from '../notifications/reconciliation';
import { registerNotificationInfrastructure } from '../notifications/setup';

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

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      // Ensure categories/channels exist before the first reconciliation pass
      // schedules anything that references them — avoids a same-commit race
      // between this hook's effect and setup registration.
      await registerNotificationInfrastructure().catch(console.error);
      if (cancelled) return;

      const reconciler = createReconciler({
        // Cast: PowerSync's column typing makes every column nullable regardless
        // of the Postgres constraint; reminders.task_id is `not null references
        // tasks(id)` at the DB level (supabase/migrations/20260620000001), so this
        // narrowing reflects a real invariant, not an assumption.
        getPendingReminders: () => getPendingReminders(db, userId) as Promise<PendingReminder[]>,

        scheduleReminderNotification: (reminder) =>
          Notifications.scheduleNotificationAsync({
            identifier: reminder.id,
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
            identifier: 'nudge',
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

      cleanup = () => {
        syncUnsub();
        appStateSub.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [db, session]);
}
