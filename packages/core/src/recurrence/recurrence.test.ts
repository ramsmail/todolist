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
