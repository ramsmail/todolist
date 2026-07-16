import { describe, it, expect } from 'vitest';
import { REMINDER_OFFSET_MINUTES, computeReminderFromOffset, computeReminderFromCustomDate, formatReminderLocal } from '../src/lib/reminderOffsets';

describe('REMINDER_OFFSET_MINUTES', () => {
  it('maps each named offset to its minute value', () => {
    expect(REMINDER_OFFSET_MINUTES.due).toBe(0);
    expect(REMINDER_OFFSET_MINUTES['10min']).toBe(10);
    expect(REMINDER_OFFSET_MINUTES['30min']).toBe(30);
    expect(REMINDER_OFFSET_MINUTES['1hour']).toBe(60);
  });
});

describe('computeReminderFromOffset', () => {
  it('subtracts the offset from the due date/time', () => {
    const { remindAtLocal, remindAtUtc } = computeReminderFromOffset('2026-07-20', '09:00', 30);
    expect(remindAtLocal).toBe('2026-07-20 08:30');
    expect(new Date(remindAtUtc).getTime()).toBe(new Date(2026, 6, 20, 8, 30).getTime());
  });

  it('an offset of 0 (at due time) returns the due instant unchanged', () => {
    const { remindAtLocal } = computeReminderFromOffset('2026-07-20', '09:00', 0);
    expect(remindAtLocal).toBe('2026-07-20 09:00');
  });

  it('crossing a day boundary backwards works correctly', () => {
    const { remindAtLocal } = computeReminderFromOffset('2026-07-20', '00:15', 30);
    expect(remindAtLocal).toBe('2026-07-19 23:45');
  });
});

describe('computeReminderFromCustomDate', () => {
  it('formats a picked Date directly as local + UTC', () => {
    const date = new Date(2026, 6, 25, 14, 30);
    const { remindAtLocal, remindAtUtc } = computeReminderFromCustomDate(date);
    expect(remindAtLocal).toBe('2026-07-25 14:30');
    expect(remindAtUtc).toBe(date.toISOString());
  });
});

describe('formatReminderLocal', () => {
  it('pads single-digit hours and minutes', () => {
    const date = new Date(2026, 0, 5, 9, 5);
    expect(formatReminderLocal(date)).toBe('2026-01-05 09:05');
  });
});
