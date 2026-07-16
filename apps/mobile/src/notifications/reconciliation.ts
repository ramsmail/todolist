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
