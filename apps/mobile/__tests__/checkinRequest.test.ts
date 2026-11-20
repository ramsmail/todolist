import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

import {
  buildCheckinRequest,
  CHECKIN_IDENTIFIER,
  CHECKIN_CHANNEL_ID,
  CHECKIN_CATEGORY_ID,
} from '../src/notifications/checkinRequest';

describe('buildCheckinRequest', () => {
  const req = buildCheckinRequest('07:30', 'Time to plan your day');

  it('uses the fixed identifier', () => {
    expect(req.identifier).toBe('checkin');
    expect(req.identifier).toBe(CHECKIN_IDENTIFIER);
  });

  it('schedules on the checkin channel', () => {
    expect(req.trigger.channelId).toBe('checkin');
    expect(req.trigger.channelId).toBe(CHECKIN_CHANNEL_ID);
  });

  it('uses the checkin category', () => {
    expect(req.content.categoryIdentifier).toBe('checkin');
    expect(req.content.categoryIdentifier).toBe(CHECKIN_CATEGORY_ID);
  });

  it('routes taps to the home screen with checkin type', () => {
    expect(req.content.data.url).toBe('/');
    expect(req.content.data.type).toBe('checkin');
  });

  it('sets the iOS sound file and passes the body through', () => {
    expect(req.content.sound).toBe('checkin.wav');
    expect(req.content.body).toBe('Time to plan your day');
    expect(req.content.title).toBe('Daily check-in');
  });

  it('parses hour and minute from HH:MM', () => {
    expect(req.trigger.hour).toBe(7);
    expect(req.trigger.minute).toBe(30);
  });

  it('uses the DAILY trigger type', () => {
    expect(req.trigger.type).toBe('daily');
  });
});
