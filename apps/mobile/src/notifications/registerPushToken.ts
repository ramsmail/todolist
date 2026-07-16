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
