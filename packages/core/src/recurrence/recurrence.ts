// packages/core/src/recurrence/recurrence.ts
import { addDays, addWeeks, getDay, parseISO, format } from 'date-fns';

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

const WD_LABEL: Record<Weekday, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};
const UNIT: Record<Freq, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

export function describeRule(r: RecurrenceRule): string {
  const isWeekdays =
    r.freq === 'weekly' &&
    r.byDay?.length === 5 &&
    (['MO', 'TU', 'WE', 'TH', 'FR'] as Weekday[]).every((d) => r.byDay!.includes(d));
  if (isWeekdays && r.interval === 1) return 'Every weekday';

  const base = r.interval === 1 ? `Every ${UNIT[r.freq]}` : `Every ${r.interval} ${UNIT[r.freq]}s`;
  if (r.freq === 'weekly' && r.byDay && r.byDay.length) {
    const days = WD_ORDER.filter((d) => r.byDay!.includes(d)).map((d) => WD_LABEL[d]).join(', ');
    return `${base} on ${days}`;
  }
  return base;
}

// date-fns getDay: 0=Sun..6=Sat → our index 0=Mon..6=Sun
const dayToIdx = (d: number) => (d + 6) % 7;

function ymd(year: number, month0: number, day: number): Date {
  const last = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, last));
}

export function computeNext(r: RecurrenceRule, fromDate: string, anchor: string): string {
  const from = parseISO(fromDate);
  switch (r.freq) {
    case 'daily':
      return format(addDays(from, r.interval), 'yyyy-MM-dd');

    case 'weekly': {
      const days =
        r.byDay && r.byDay.length ? r.byDay : [WD_ORDER[dayToIdx(getDay(parseISO(anchor)))]];
      const idxs = days.map((d) => WD_ORDER.indexOf(d)).sort((a, b) => a - b);
      const fromIdx = dayToIdx(getDay(from));
      const nextSame = idxs.find((i) => i > fromIdx);
      if (nextSame !== undefined) {
        return format(addDays(from, nextSame - fromIdx), 'yyyy-MM-dd');
      }
      const mondayOfWeek = addDays(from, -fromIdx);
      const target = addWeeks(mondayOfWeek, r.interval);
      return format(addDays(target, idxs[0]), 'yyyy-MM-dd');
    }

    case 'monthly': {
      const targetDay = parseISO(anchor).getDate();
      const total = from.getFullYear() * 12 + from.getMonth() + r.interval;
      return format(ymd(Math.floor(total / 12), total % 12, targetDay), 'yyyy-MM-dd');
    }

    case 'yearly': {
      const a = parseISO(anchor);
      return format(ymd(from.getFullYear() + r.interval, a.getMonth(), a.getDate()), 'yyyy-MM-dd');
    }
  }
}

export function firstOccurrence(r: RecurrenceRule, from: Date): string {
  if (r.freq === 'weekly' && r.byDay && r.byDay.length) {
    const idxs = r.byDay.map((d) => WD_ORDER.indexOf(d)).sort((a, b) => a - b);
    const fromIdx = dayToIdx(getDay(from));
    const same = idxs.find((i) => i >= fromIdx);
    const targetIdx = same !== undefined ? same : idxs[0] + 7;
    return format(addDays(from, targetIdx - fromIdx), 'yyyy-MM-dd');
  }
  return format(from, 'yyyy-MM-dd');
}
