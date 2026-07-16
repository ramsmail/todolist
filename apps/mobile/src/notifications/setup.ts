// apps/mobile/src/notifications/setup.ts
//
// Startup registration: notification categories (action buttons), Android
// channels, and the foreground display handler. Safe to call before
// permission is granted — registering channels/categories doesn't require it.
// Called from useNotificationReconciliation (see Task 12), awaited before
// that hook's first reconciliation pass. All calls here are idempotent, since
// the hook's effect re-runs whenever `session` changes (including token
// refreshes for an already-logged-in user), not strictly once per app life.
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

  // Sound is intentionally left at the Android default (on) for both channels
  // — shouldPlaySound: false above only silences the in-app foreground banner;
  // a due-time reminder firing while the app is backgrounded/killed should
  // still audibly alert, which is the point of HIGH importance here.
  //
  // Note: Android locks a channel's importance/sound once created — changing
  // these values here later won't affect existing installs' channels. A
  // future change would need a new channel id (e.g. 'reminders_v2').
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
