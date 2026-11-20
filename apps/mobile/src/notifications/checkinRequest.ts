// apps/mobile/src/notifications/checkinRequest.ts
//
// Builds the scheduled-notification request for the daily check-in. Kept free
// of hook state so the payload (identifier, channel, category, data, trigger)
// can be unit-tested directly.

import { SchedulableTriggerInputTypes } from 'expo-notifications';

export const CHECKIN_IDENTIFIER = 'checkin';
export const CHECKIN_CHANNEL_ID = 'checkin';
export const CHECKIN_CATEGORY_ID = 'checkin';

export function buildCheckinRequest(time: string, body: string) {
  const [hour, minute] = time.split(':').map(Number);
  return {
    // Fixed identifier: rescheduling replaces the OS-level entry even after an
    // app restart, when the reconciler's in-memory id is gone.
    identifier: CHECKIN_IDENTIFIER,
    content: {
      title: 'Daily check-in',
      body,
      sound: 'checkin.wav', // iOS; Android plays the channel's sound
      categoryIdentifier: CHECKIN_CATEGORY_ID,
      data: { url: '/', type: 'checkin' },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHECKIN_CHANNEL_ID,
    },
  };
}
