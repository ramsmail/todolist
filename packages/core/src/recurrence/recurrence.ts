// packages/core/src/recurrence/recurrence.ts
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  freq: Freq;
  interval: number;        // >= 1
  byDay?: Weekday[];       // weekly only, stored canonical Mon→Sun
}

export const WD_ORDER: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const FREQ_FROM: Record<string, Freq> = {
  DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly',
};

export function parseRule(s: string): RecurrenceRule | null {
  if (!s) return null;
  const parts: Record<string, string> = {};
  for (const seg of s.split(';')) {
    const [k, v] = seg.split('=');
    if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
  }
  const freq = FREQ_FROM[parts.FREQ];
  if (!freq) return null;
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1;
  if (!Number.isInteger(interval) || interval < 1) return null;
  const rule: RecurrenceRule = { freq, interval };
  if (parts.BYDAY) {
    const given = parts.BYDAY.split(',');
    const days = WD_ORDER.filter((d) => given.includes(d));
    if (days.length) rule.byDay = days;
  }
  return rule;
}

export function serializeRule(r: RecurrenceRule): string {
  const out = [`FREQ=${r.freq.toUpperCase()}`];
  if (r.interval > 1) out.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'weekly' && r.byDay && r.byDay.length) {
    out.push(`BYDAY=${WD_ORDER.filter((d) => r.byDay!.includes(d)).join(',')}`);
  }
  return out.join(';');
}
