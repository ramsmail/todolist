import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePowerSync } from '@powersync/react';
import { getPendingReminders, getUserSettings, getInboxCount, getP1CardTasks, useUserSettings } from '@todolist/db';
import { formatP1CardBody } from '../notifications/p1CardContent';
import { formatDueDateForStorage } from '../lib/dueDateFormat';
import { useAuth } from '../auth/AuthContext';
import { createReconciler, type PendingReminder } from '../notifications/reconciliation';
import { normalizeCheckinTime } from '../notifications/checkinContent';
import { buildCheckinRequest } from '../notifications/checkinRequest';
import { registerNotificationInfrastructure } from '../notifications/setup';

// Repeating daily trigger for the nudge and P1 cards. A one-shot DATE trigger
// only fires once, so the next day's alert depended on the app happening to
// reconcile again. DAILY lets the OS deliver it every day at the same time.
function dailyTrigger(time: string, channelId: string) {
  const [hour, minute] = time.split(':').map(Number);
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
    channelId,
  };
}

export function useNotificationReconciliation() {
  const db = usePowerSync();
  const { session } = useAuth();
  const reconcilerRef = useRef<ReturnType<typeof createReconciler> | null>(null);
  const { data: settingsRows } = useUserSettings();
  const checkinEnabled = !!settingsRows?.[0]?.checkin_enabled;
  const checkinTime = normalizeCheckinTime(settingsRows?.[0]?.checkin_time);

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
            trigger: dailyTrigger(time, 'triage'),
          }),

        getP1CardTasks: () => getP1CardTasks(db),

        // P1 cards share nudge_time with the inbox nudge but have their own
        // on/off column, so a user can run either one alone. The 09:00 fallback
        // covers a user who enables cards without ever having set a nudge time.
        getP1CardSettings: async () => {
          const settings = await getUserSettings(db);
          return {
            enabled: !!settings?.p1_cards_enabled,
            time: settings?.nudge_time ?? '09:00',
          };
        },

        scheduleP1CardNotification: (task, time) =>
          Notifications.scheduleNotificationAsync({
            // Deterministic id so a card can be cancelled without consulting
            // Expo's scheduled-notification list.
            identifier: `p1:${task.id}`,
            content: {
              title: task.title,
              body: formatP1CardBody(task, formatDueDateForStorage(new Date())),
              categoryIdentifier: 'p1_card',
              data: {
                url: `/task/${task.id}`,
                taskId: task.id,
                type: 'p1_card',
              },
            },
            trigger: dailyTrigger(time, 'triage'),
          }),

        getCheckinSettings: async () => {
          const settings = await getUserSettings(db);
          return {
            enabled: !!settings?.checkin_enabled,
            time: normalizeCheckinTime(settings?.checkin_time),
          };
        },

        scheduleCheckinNotification: (time, body) =>
          Notifications.scheduleNotificationAsync(buildCheckinRequest(time, body)),
      });
      reconcilerRef.current = reconciler;

      const reconcileAll = () => {
        reconciler.reconcileReminders().catch(console.error);
        reconciler.reconcileNudge().catch(console.error);
        reconciler.reconcileP1Cards().catch(console.error);
        reconciler.reconcileCheckin().catch(console.error);
      };

      reconcileAll();

      const syncUnsub = db.registerListener({ statusChanged: () => reconcileAll() });

      const appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') reconcileAll();
        if (nextState === 'background') {
          reconciler.reconcileNudge().catch(console.error);
          reconciler.reconcileP1Cards().catch(console.error);
          reconciler.reconcileCheckin().catch(console.error);
        }
      });

      cleanup = () => {
        syncUnsub();
        appStateSub.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      reconcilerRef.current = null;
    };
  }, [db, session]);

  // Settings edits made while the app is open must reschedule the check-in
  // immediately; otherwise the old OS notification keeps firing. Kept out of
  // the main effect so a settings change does not re-run the full reconcile.
  useEffect(() => {
    reconcilerRef.current?.reconcileCheckin().catch(console.error);
  }, [checkinEnabled, checkinTime, session]);
}
