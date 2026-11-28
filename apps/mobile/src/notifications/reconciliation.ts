import type { P1CardTask } from './p1CardContent';

export interface PendingReminder {
  id: string;
  task_id: string;
  remind_at_utc: string;
}

export interface NudgeSettings {
  enabled: boolean;
  time: string | null;
}

export interface P1CardSettings {
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
  getP1CardTasks: () => Promise<P1CardTask[]>;
  getP1CardSettings: () => Promise<P1CardSettings>;
  scheduleP1CardNotification: (task: P1CardTask, time: string) => Promise<string>;
}

export function createReconciler(deps: ReconciliationDeps) {
  const scheduledReminders = new Map<string, string>(); // reminderId -> scheduledNotificationId
  let scheduledNudgeId: string | null = null;
  const scheduledP1Cards = new Map<string, string>(); // taskId -> scheduledNotificationId

  async function reconcileReminders(): Promise<void> {
    const pending = await deps.getPendingReminders();
    const pendingIds = new Set(pending.map(r => r.id));

    for (const [reminderId, notificationId] of scheduledReminders) {
      if (!pendingIds.has(reminderId)) {
        try {
          await deps.cancelNotification(notificationId);
          scheduledReminders.delete(reminderId);
        } catch (err) {
          console.error('[reconciliation] failed to cancel notification for reminder', reminderId, err);
        }
      }
    }

    for (const reminder of pending) {
      if (!scheduledReminders.has(reminder.id)) {
        try {
          const notificationId = await deps.scheduleReminderNotification(reminder);
          scheduledReminders.set(reminder.id, notificationId);
        } catch (err) {
          console.error('[reconciliation] failed to schedule notification for reminder', reminder.id, err);
        }
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

  // Unlike reconcileReminders, this tears down and rebuilds every pass rather
  // than diffing. Two reasons: card content is frozen at schedule time (same
  // Expo constraint as the nudge), so a task whose title or due date changed
  // needs re-scheduling even though its id did not; and the qualifying set is
  // a LIMIT 3 window that reshuffles as due dates move.
  async function reconcileP1Cards(): Promise<void> {
    for (const [taskId, notificationId] of scheduledP1Cards) {
      try {
        await deps.cancelNotification(notificationId);
      } catch (err) {
        console.error('[reconciliation] failed to cancel P1 card for task', taskId, err);
      }
    }
    scheduledP1Cards.clear();

    const settings = await deps.getP1CardSettings();
    if (!settings.enabled || !settings.time) return;

    const tasks = await deps.getP1CardTasks();
    for (const task of tasks) {
      try {
        const notificationId = await deps.scheduleP1CardNotification(task, settings.time);
        scheduledP1Cards.set(task.id, notificationId);
      } catch (err) {
        console.error('[reconciliation] failed to schedule P1 card for task', task.id, err);
      }
    }
  }

  return { reconcileReminders, reconcileNudge, reconcileP1Cards };
}
