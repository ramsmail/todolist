import { describe, it, expect } from 'vitest';
import { CHECKIN_LINES, pickCheckinLine, normalizeCheckinTime } from '../src/notifications/checkinContent';

describe('pickCheckinLine', () => {
  it('returns the same line for the same calendar day, regardless of time', () => {
    expect(pickCheckinLine(new Date(2026, 10, 19, 0, 5))).toBe(pickCheckinLine(new Date(2026, 10, 19, 23, 55)));
  });

  it('returns a different line on consecutive days', () => {
    expect(pickCheckinLine(new Date(2026, 10, 19))).not.toBe(pickCheckinLine(new Date(2026, 10, 20)));
  });

  it('always returns one of the defined non-empty lines', () => {
    for (let d = 1; d <= 40; d++) {
      const line = pickCheckinLine(new Date(2026, 0, d));
      expect(CHECKIN_LINES).toContain(line);
      expect(line.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeCheckinTime', () => {
  it('passes through a valid HH:MM', () => {
    expect(normalizeCheckinTime('07:45')).toBe('07:45');
  });

  it('falls back to 10:00 for null, empty, or malformed values', () => {
    expect(normalizeCheckinTime(null)).toBe('10:00');
    expect(normalizeCheckinTime('')).toBe('10:00');
    expect(normalizeCheckinTime('25:00')).toBe('10:00');
    expect(normalizeCheckinTime('9am')).toBe('10:00');
  });
});
