import { describe, it, expect, vi } from 'vitest';
import { createReminder, updateReminderTime, deleteReminder, snoozeReminder, getPendingReminders } from './reminders';

function makeMockDb(overrides: Partial<Record<string, any>> = {}) {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    getOptional: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any;
}

describe('createReminder', () => {
  it('inserts a row with notified flags reset to 0 and returns a UUID', async () => {
    const db = makeMockDb();
    const id = await createReminder(db, 'task-1', 'user-1', '2026-07-20 09:00', '2026-07-20T03:30:00.000Z');
    expect(id).toHaveLength(36);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO reminders');
    expect(params).toEqual([id, 'task-1', 'user-1', '2026-07-20 09:00', '2026-07-20T03:30:00.000Z', 0, 0, expect.any(String), expect.any(String)]);
  });
});

describe('updateReminderTime', () => {
  it('updates the time and resets both notified flags', async () => {
    const db = makeMockDb();
    await updateReminderTime(db, 'rem-1', '2026-07-21 09:00', '2026-07-21T03:30:00.000Z');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('notified_mobile = 0');
    expect(sql).toContain('notified_web = 0');
    expect(params).toEqual(['2026-07-21 09:00', '2026-07-21T03:30:00.000Z', expect.any(String), 'rem-1']);
  });
});

describe('deleteReminder', () => {
  it('soft-deletes by setting deleted_at', async () => {
    const db = makeMockDb();
    await deleteReminder(db, 'rem-1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('deleted_at = ?');
    expect(params[params.length - 1]).toBe('rem-1');
  });
});

describe('snoozeReminder', () => {
  it('does nothing if the reminder no longer exists', async () => {
    const db = makeMockDb({ getOptional: vi.fn().mockResolvedValue(null) });
    await snoozeReminder(db, 'rem-1', 60);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('advances remind_at_utc by the given minutes and resets both notified flags', async () => {
    const db = makeMockDb({
      getOptional: vi.fn().mockResolvedValue({
        id: 'rem-1',
        remind_at_utc: '2026-07-20T03:30:00.000Z',
        remind_at_local: '2026-07-20 09:00',
      }),
    });
    await snoozeReminder(db, 'rem-1', 60);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('notified_mobile = 0');
    expect(sql).toContain('notified_web = 0');
    expect(params[1]).toBe('2026-07-20T04:30:00.000Z');
  });
});

describe('getPendingReminders', () => {
  it('queries for un-notified, non-deleted, past-due reminders for the given user', async () => {
    const db = makeMockDb();
    await getPendingReminders(db, 'user-1');
    const [sql, params] = db.getAll.mock.calls[0];
    expect(sql).toContain("notified_mobile = 0");
    expect(sql).toContain('deleted_at IS NULL');
    expect(params[0]).toBe('user-1');
  });
});
