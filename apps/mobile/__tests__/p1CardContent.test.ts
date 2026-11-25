import { describe, it, expect } from 'vitest';
import { formatP1CardBody } from '../src/notifications/p1CardContent';

const today = '2026-09-01';

describe('formatP1CardBody', () => {
  it('says due today for a task dated today', () => {
    expect(formatP1CardBody({ id: 'a', title: 'A', due_date: '2026-09-01', due_time: null }, today))
      .toBe('Due today');
  });

  it('includes the time when a task dated today has one', () => {
    expect(formatP1CardBody({ id: 'a', title: 'A', due_date: '2026-09-01', due_time: '14:30' }, today))
      .toBe('Due today at 14:30');
  });

  it('names the missed date for an overdue task', () => {
    expect(formatP1CardBody({ id: 'a', title: 'A', due_date: '2026-08-25', due_time: null }, today))
      .toBe('Overdue — was due 25 Aug');
  });

  it('includes the time on an overdue task that had one', () => {
    expect(formatP1CardBody({ id: 'a', title: 'A', due_date: '2026-08-25', due_time: '09:00' }, today))
      .toBe('Overdue — was due 25 Aug at 09:00');
  });

  it('formats a single-digit day without a leading zero', () => {
    expect(formatP1CardBody({ id: 'a', title: 'A', due_date: '2026-08-05', due_time: null }, today))
      .toBe('Overdue — was due 5 Aug');
  });

  it('crosses a year boundary without saying the year', () => {
    expect(formatP1CardBody({ id: 'a', title: 'A', due_date: '2025-12-31', due_time: null }, today))
      .toBe('Overdue — was due 31 Dec');
  });

  it('falls back to a plain label if an undated task ever reaches it', () => {
    expect(formatP1CardBody({ id: 'a', title: 'A', due_date: null, due_time: null }, today))
      .toBe('Priority 1');
  });
});
