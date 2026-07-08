import { describe, it, expect } from 'vitest';
import { parseDueDate, formatDueDateForStorage } from '../src/lib/dueDateFormat';

describe('parseDueDate', () => {
  it('returns null for null input', () => {
    expect(parseDueDate(null)).toBeNull();
  });

  it('parses a YYYY-MM-DD string as local midnight on that day', () => {
    const date = parseDueDate('2026-07-15');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(6); // 0-indexed: July
    expect(date!.getDate()).toBe(15);
  });
});

describe('formatDueDateForStorage', () => {
  it('formats a Date as YYYY-MM-DD using local date parts', () => {
    const date = new Date(2026, 6, 15); // July 15, 2026, local midnight
    expect(formatDueDateForStorage(date)).toBe('2026-07-15');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
    expect(formatDueDateForStorage(date)).toBe('2026-01-05');
  });

  it('round-trips through parseDueDate without shifting the day', () => {
    const original = '2026-12-31';
    const parsed = parseDueDate(original);
    expect(formatDueDateForStorage(parsed!)).toBe(original);
  });

  it('does not shift the date near a UTC day boundary (late-evening local time)', () => {
    // A date constructed from local Y/M/D at a late hour must still format back
    // to the same calendar day — this is exactly the bug toISOString() would
    // cause for users behind UTC in the evening.
    const date = new Date(2026, 5, 30, 23, 30, 0);
    expect(formatDueDateForStorage(date)).toBe('2026-06-30');
  });
});
