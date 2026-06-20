import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import type { Priority } from '../types';

export interface NlpParseResult {
  title: string;
  priority: Priority;
  projectSlug: string | null;
  labels: string[];
  dueDate: string | null;
  dueTime: string | null;
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

  // Clean up extra whitespace; fall back to original input if nothing remains
  const title = text.replace(/\s+/g, ' ').trim() || input.trim();
  return { title, priority, projectSlug, labels, dueDate, dueTime };
}
