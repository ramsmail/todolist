// packages/core/src/recurrence/recurrence.test.ts
import { describe, it, expect } from 'vitest';
import { parseRule, serializeRule, describeRule } from './recurrence';

describe('parseRule / serializeRule', () => {
  it('round-trips daily', () => {
    expect(parseRule('FREQ=DAILY')).toEqual({ freq: 'daily', interval: 1 });
    expect(serializeRule({ freq: 'daily', interval: 1 })).toBe('FREQ=DAILY');
  });

  it('round-trips every 2 weeks on Mon/Wed in canonical order', () => {
    const rule = parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,MO');
    expect(rule).toEqual({ freq: 'weekly', interval: 2, byDay: ['MO', 'WE'] });
    expect(serializeRule(rule!)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE');
  });

  it('omits INTERVAL when 1', () => {
    expect(serializeRule({ freq: 'monthly', interval: 1 })).toBe('FREQ=MONTHLY');
  });

  it('returns null for empty or unknown freq', () => {
    expect(parseRule('')).toBeNull();
    expect(parseRule('FREQ=HOURLY')).toBeNull();
    expect(parseRule('INTERVAL=2')).toBeNull();
  });
});

describe('describeRule', () => {
  it('describes presets', () => {
    expect(describeRule({ freq: 'daily', interval: 1 })).toBe('Every day');
    expect(describeRule({ freq: 'monthly', interval: 1 })).toBe('Every month');
  });
  it('describes weekdays preset', () => {
    expect(describeRule({ freq: 'weekly', interval: 1, byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] }))
      .toBe('Every weekday');
  });
  it('describes interval + weekdays', () => {
    expect(describeRule({ freq: 'weekly', interval: 2, byDay: ['MO', 'WE'] }))
      .toBe('Every 2 weeks on Mon, Wed');
  });
});

import { computeNext, firstOccurrence } from './recurrence';

describe('computeNext (anchored to scheduled due date)', () => {
  it('daily + interval', () => {
    expect(computeNext({ freq: 'daily', interval: 1 }, '2026-06-23', '2026-06-23')).toBe('2026-06-24');
    expect(computeNext({ freq: 'daily', interval: 3 }, '2026-06-23', '2026-06-23')).toBe('2026-06-26');
  });

  it('weekly with byDay finds next day in same week', () => {
    // 2026-06-22 is a Monday; rule Mon/Wed → next is Wed 2026-06-24
    expect(computeNext({ freq: 'weekly', interval: 1, byDay: ['MO', 'WE'] }, '2026-06-22', '2026-06-22'))
      .toBe('2026-06-24');
  });

  it('weekly jumps interval weeks after last day in set', () => {
    // From Wed 2026-06-24 with Mon/Wed, interval 2 → Mon two weeks later 2026-07-06
    expect(computeNext({ freq: 'weekly', interval: 2, byDay: ['MO', 'WE'] }, '2026-06-24', '2026-06-22'))
      .toBe('2026-07-06');
  });

  it('weekly without byDay uses anchor weekday', () => {
    // anchor Mon 2026-06-22, weekly → next Mon
    expect(computeNext({ freq: 'weekly', interval: 1 }, '2026-06-22', '2026-06-22')).toBe('2026-06-29');
  });

  it('monthly clamps to last day for short months', () => {
    // anchor on the 31st; from Jan 31 → Feb 28 (2026 not leap)
    expect(computeNext({ freq: 'monthly', interval: 1 }, '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    // next from clamped Feb 28 restores to Mar 31 via anchor
    expect(computeNext({ freq: 'monthly', interval: 1 }, '2026-02-28', '2026-01-31')).toBe('2026-03-31');
  });

  it('yearly handles Feb 29 anchor in non-leap years', () => {
    expect(computeNext({ freq: 'yearly', interval: 1 }, '2024-02-29', '2024-02-29')).toBe('2025-02-28');
  });
});

describe('firstOccurrence (on or after)', () => {
  it('returns today for daily/monthly/yearly', () => {
    const d = new Date('2026-06-23T10:00:00');
    expect(firstOccurrence({ freq: 'daily', interval: 1 }, d)).toBe('2026-06-23');
  });
  it('returns next matching weekday for weekly byDay', () => {
    // 2026-06-23 is a Tuesday; rule Mon → next Mon 2026-06-29
    const d = new Date('2026-06-23T10:00:00');
    expect(firstOccurrence({ freq: 'weekly', interval: 1, byDay: ['MO'] }, d)).toBe('2026-06-29');
  });
});
