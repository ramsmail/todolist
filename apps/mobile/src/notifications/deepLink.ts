import * as Notifications from 'expo-notifications';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { completeTask, snoozeReminder, updateTaskDue } from '@thinkdo/db';
import { formatDueDateForStorage } from '../lib/dueDateFormat';
import { handleNotificationResponse, type NotificationResponseData } from './deepLinkHandler';

function makeDeps(db: AbstractPowerSyncDatabase, navigate: (url: string) => void) {
  return {
    completeTask: (taskId: string) => completeTask(db, taskId),
    snoozeReminder: (reminderId: string, minutes: number) => snoozeReminder(db, reminderId, minutes),
    // formatDueDateForStorage, not toISOString().split('T')[0] — the latter is
    // UTC and lands on the wrong day for anyone east of Greenwich in the
    // evening, which is exactly when a "push it to tomorrow" tap happens.
    rescheduleTaskTomorrow: (taskId: string) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return updateTaskDue(db, taskId, formatDueDateForStorage(tomorrow), null);
    },
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
  await handleNotificationResponse(response.actionIdentifier, data, deps).catch(console.error);
}
