// apps/mobile/src/notifications/registerPushToken.ts
//
// Two separate concerns, deliberately not one function:
//
// - ensureNotificationPermission: OS permission only. This is all that local
//   scheduling needs (the daily nudge is purely local — see the design spec —
//   and must never depend on a remote push token).
// - ensurePushRegistered: permission + fetching this device's Expo push token
//   and storing it on user_settings so dispatch-reminders can find it. Only
//   reminders need this (server-dispatched push). Called when the user sets a
//   reminder (task/[id].tsx).
//
// getExpoPushTokenAsync makes a network call and can throw (missing/invalid
// FCM credentials, offline, etc. — Expo's own docs wrap this call in
// try/catch for exactly this reason). It's caught here so a push-registration
// failure degrades to "local fallback only" instead of surfacing as an
// unhandled rejection to the caller.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { upsertUserSettings } from '@todolist/db';

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  return status === 'granted';
}

export async function ensurePushRegistered(
  db: AbstractPowerSyncDatabase,
  userId: string
): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return false;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await upsertUserSettings(db, userId, { expo_push_token: token.data });
  } catch (err) {
    console.error('[registerPushToken] failed to fetch/store Expo push token:', err);
  }
  return true;
}
