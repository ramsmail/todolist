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
});
