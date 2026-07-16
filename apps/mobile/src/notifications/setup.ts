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
