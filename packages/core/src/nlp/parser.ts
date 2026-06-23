import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import type { Priority } from '../types';
import { parseRule, firstOccurrence, type Weekday } from '../recurrence/recurrence';

export interface NlpParseResult {
  title: string;
  priority: Priority;
  projectSlug: string | null;
  labels: string[];
  dueDate: string | null;
  dueTime: string | null;
  recurrenceRule: string | null;
}

export interface NlpParseOptions {
  now?: Date;
  timezone?: string;
}

// Matches: p1, p2, p3, p4, !1, !2, !3, !4 as standalone tokens
const PRIORITY_RE = /(?<!\S)(?:p([1-4])|!([1-4]))(?!\S)/gi;
// Matches: #slug or #slug-with-hyphens (no spaces)
const PROJECT_RE = /#([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)/gi;
// Matches: @label or @label-with-hyphens
const LABEL_RE = /@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)/gi;

const DOW: Record<string, Weekday> = {
  monday: 'MO', mon: 'MO', tuesday: 'TU', tue: 'TU', tues: 'TU',
  wednesday: 'WE', wed: 'WE', thursday: 'TH', thu: 'TH', thurs: 'TH',
  friday: 'FR', fri: 'FR', saturday: 'SA', sat: 'SA', sunday: 'SU', sun: 'SU',
};
const WD_CANON: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function extractRecurrence(input: string): { rule: string | null; rest: string } {
  let text = input;

  const everyN = text.match(/\bevery\s+(\d+)\s+(days?|weeks?|months?|years?)\b/i);
  if (everyN) {
    const n = parseInt(everyN[1], 10);
    const u = everyN[2].toLowerCase();
    const freq = u.startsWith('day') ? 'DAILY' : u.startsWith('week') ? 'WEEKLY'
      : u.startsWith('month') ? 'MONTHLY' : 'YEARLY';
    const rule = `FREQ=${freq}` + (n > 1 ? `;INTERVAL=${n}` : '');
    return { rule, rest: text.replace(everyN[0], ' ') };
  }

  const weekdayRe = /\b(every\s+weekday|weekdays)\b/i;
  if (weekdayRe.test(text)) {
    return { rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', rest: text.replace(weekdayRe, ' ') };
  }

  const dowRe = /\bevery\s+((?:mon|tue|tues|wed|thu|thurs|fri|sat|sun)[a-z]*(?:\s*(?:,|and)\s*(?:mon|tue|tues|wed|thu|thurs|fri|sat|sun)[a-z]*)*)\b/i;
  const dow = text.match(dowRe);
  if (dow) {
    const tokens = dow[1].toLowerCase().split(/\s*(?:,|and)\s*/).map((t) => t.trim()).filter(Boolean);
    const days = tokens.map((t) => DOW[t]).filter(Boolean) as Weekday[];
    if (days.length) {
      const ordered = WD_CANON.filter((d) => days.includes(d));
      return { rule: `FREQ=WEEKLY;BYDAY=${ordered.join(',')}`, rest: text.replace(dow[0], ' ') };
    }
  }

  const simple: Array<[RegExp, string]> = [
    [/\b(daily|every\s+day)\b/i, 'FREQ=DAILY'],
    [/\b(weekly|every\s+week)\b/i, 'FREQ=WEEKLY'],
    [/\b(monthly|every\s+month)\b/i, 'FREQ=MONTHLY'],
    [/\b(yearly|annually|every\s+year)\b/i, 'FREQ=YEARLY'],
  ];
  for (const [re, rule] of simple) {
    if (re.test(text)) return { rule, rest: text.replace(re, ' ') };
  }
  return { rule: null, rest: text };
}

export function parseTaskInput(
  input: string,
  options: NlpParseOptions = {}
): NlpParseResult {
  const { now = new Date() } = options;
  let text = input.trim();

  // Extract priority — last match wins (rightmost p1 beats p2 if both present)
  let priority: Priority = 4;
  text = text.replace(PRIORITY_RE, (_, p, bang) => {
    const n = parseInt(p ?? bang, 10);
    if (n >= 1 && n <= 4) priority = n as Priority;
    return ' ';
  });

  // Extract project (first #token wins)
  let projectSlug: string | null = null;
  text = text.replace(PROJECT_RE, (_, slug) => {
    if (!projectSlug) projectSlug = slug.toLowerCase();
    return ' ';
  });

  // Extract labels (all @tokens)
  const labels: string[] = [];
  text = text.replace(LABEL_RE, (_, label) => {
    labels.push(label.toLowerCase());
    return ' ';
  });

  // Extract recurrence before chrono so "every monday" isn't read as a one-off date
  const rec = extractRecurrence(text);
  const recurrenceRule = rec.rule;
  text = rec.rest;

  // Extract date/time via chrono-node (first match only)
  const chronoRef: Parameters<typeof chrono.parse>[1] = options.timezone
    ? { instant: now, timezone: options.timezone }
    : now;
  const parsed = chrono.parse(text, chronoRef, { forwardDate: true });
  let dueDate: string | null = null;
  let dueTime: string | null = null;

  if (parsed.length > 0) {
    const ref = parsed[0];
    text = text.slice(0, ref.index) + ' ' + text.slice(ref.index + ref.text.length);
    const date = ref.start.date();
    dueDate = format(date, 'yyyy-MM-dd');
    if (ref.start.isCertain('hour')) {
      dueTime = format(date, 'HH:mm');
    }
  }

  // If recurring with no explicit date, anchor to the first occurrence on/after now
  if (recurrenceRule && !dueDate) {
    const parsedRule = parseRule(recurrenceRule);
    if (parsedRule) dueDate = firstOccurrence(parsedRule, now);
  }

  // Clean up extra whitespace; fall back to original input if nothing remains
  const title = text.replace(/\s+/g, ' ').trim() || input.trim();
  return { title, priority, projectSlug, labels, dueDate, dueTime, recurrenceRule };
}
