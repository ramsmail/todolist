import { describe, it, expect } from 'vitest';
import { computeStreak } from './streak';

describe('computeStreak', () => {
  it('returns count=0 and all-false days when no completions', () => {
    const today = '2026-06-23';
    const result = computeStreak(new Set(), today);
    expect(result.count).toBe(0);
    expect(result.days.every(d => d === false)).toBe(true);
    expect(result.days).toHaveLength(7);
  });

  it('counts 1 for a single completion today', () => {
    const today = '2026-06-23';
    const result = computeStreak(new Set(['2026-06-23']), today);
    expect(result.count).toBe(1);
    expect(result.days[6]).toBe(true);
  });

  it('counts consecutive days ending today', () => {
    const today = '2026-06-23';
    const daySet = new Set(['2026-06-21', '2026-06-22', '2026-06-23']);
    const result = computeStreak(daySet, today);
    expect(result.count).toBe(3);
  });

  it('breaks streak on a gap', () => {
    const today = '2026-06-23';
    // gap on the 21st
    const daySet = new Set(['2026-06-20', '2026-06-22', '2026-06-23']);
    const result = computeStreak(daySet, today);
    expect(result.count).toBe(2);
  });

  it('returns 7-element days array with oldest first', () => {
    const today = '2026-06-23';
    const daySet = new Set(['2026-06-23']);
    const result = computeStreak(daySet, today);
    expect(result.days).toHaveLength(7);
    expect(result.days[6]).toBe(true);   // today
    expect(result.days[5]).toBe(false);  // yesterday
  });
});
