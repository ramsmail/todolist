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
  rescheduleTaskTomorrow: (taskId: string) => Promise<void>;
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
  // P1 card "Reschedule": moves the task's due date, matching the Today tab's
  // swipe-right, rather than snoozing the notification. Returns before the
  // navigate branch so the action completes without opening the app.
  if (actionIdentifier === 'reschedule_tomorrow' && data.taskId) {
    await deps.rescheduleTaskTomorrow(data.taskId);
    return;
  }
  if (actionIdentifier === DEFAULT_ACTION_IDENTIFIER && data.url) {
    deps.navigate(data.url);
  }
}
