import { describe, it, expect } from 'vitest';
import { parseTaskInput } from './parser';

describe('parseTaskInput', () => {
  const now = new Date('2026-06-20T10:00:00.000Z');

  it('returns plain title with defaults when input has no tokens', () => {
    expect(parseTaskInput('Buy milk', { now })).toEqual({
      title: 'Buy milk',
      priority: 4,
      projectSlug: null,
      labels: [],
      dueDate: null,
      dueTime: null,
      recurrenceRule: null,
    });
  });

  it('extracts p1 priority and strips token from title', () => {
    expect(parseTaskInput('Buy milk p1', { now })).toMatchObject({
      title: 'Buy milk',
      priority: 1,
    });
  });

  it('extracts p3 priority', () => {
    expect(parseTaskInput('Buy milk p3', { now })).toMatchObject({ priority: 3 });
  });

  it('extracts !2 bang-priority syntax', () => {
    expect(parseTaskInput('Buy milk !2', { now })).toMatchObject({ priority: 2 });
  });

  it('extracts project slug from #token', () => {
    expect(parseTaskInput('Submit report #work', { now })).toMatchObject({
      title: 'Submit report',
      projectSlug: 'work',
    });
  });

  it('handles hyphenated project slug', () => {
    expect(parseTaskInput('Task #side-project', { now })).toMatchObject({
      projectSlug: 'side-project',
    });
  });

  it('extracts a single label from @token', () => {
    expect(parseTaskInput('Review PR @waiting', { now })).toMatchObject({
      labels: ['waiting'],
    });
  });

  it('extracts multiple labels', () => {
    expect(parseTaskInput('Task @waiting @urgent', { now })).toMatchObject({
      labels: ['waiting', 'urgent'],
    });
  });

  it('extracts due date from "tomorrow" (date only, no time)', () => {
    const result = parseTaskInput('Meeting tomorrow', { now });
    expect(result.dueDate).toBe('2026-06-21');
    expect(result.dueTime).toBeNull();
  });

  it('extracts due date and time', () => {
    const result = parseTaskInput('Meeting tomorrow 3pm', { now });
    expect(result.dueDate).toBe('2026-06-21');
    expect(result.dueTime).toBe('15:00');
  });

  it('extracts all metadata from a complex input', () => {
    expect(
      parseTaskInput('Submit report p1 #work @waiting tomorrow 3pm', { now })
    ).toMatchObject({
      title: 'Submit report',
      priority: 1,
      projectSlug: 'work',
      labels: ['waiting'],
      dueDate: '2026-06-21',
      dueTime: '15:00',
    });
  });

  it('falls back gracefully on unrecognised input — title preserved, no data lost', () => {
    const result = parseTaskInput('Just a plain task ??? 123', { now });
    expect(result.title).toBe('Just a plain task ??? 123');
    expect(result.priority).toBe(4);
    expect(result.projectSlug).toBeNull();
    expect(result.labels).toEqual([]);
  });

  it('uses full original input as title when all tokens are stripped but nothing remains', () => {
    const result = parseTaskInput('p1 #work @label', { now });
    expect(result.title).toBe('p1 #work @label');
  });

  it('parses "every day" into a daily rule and infers due date = today', () => {
    expect(parseTaskInput('Water plants every day', { now })).toMatchObject({
      title: 'Water plants',
      recurrenceRule: 'FREQ=DAILY',
      dueDate: '2026-06-20',
    });
  });

  it('parses "every weekday"', () => {
    expect(parseTaskInput('Stand-up every weekday', { now })).toMatchObject({
      title: 'Stand-up',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    });
  });

  it('parses "every monday, wednesday" in canonical order', () => {
    expect(parseTaskInput('Gym every monday, wednesday', { now })).toMatchObject({
      title: 'Gym',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    });
  });

  it('parses "every 2 weeks"', () => {
    expect(parseTaskInput('Pay cleaner every 2 weeks', { now })).toMatchObject({
      title: 'Pay cleaner',
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2',
    });
  });

  it('keeps explicit due date alongside recurrence', () => {
    expect(parseTaskInput('Report every month', { now })).toMatchObject({
      recurrenceRule: 'FREQ=MONTHLY',
      dueDate: '2026-06-20',
    });
  });
});
