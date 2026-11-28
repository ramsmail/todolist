import { describe, it, expect, vi } from 'vitest';
import { createReminder, updateReminderTime, deleteReminder, snoozeReminder, getPendingReminders, getReminderForTask, deleteRemindersForTask } from './reminders';

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

describe('getReminderForTask', () => {
  it('queries for the most recent non-deleted reminder for the given task', async () => {
    const db = makeMockDb({
      getOptional: vi.fn().mockResolvedValue({ id: 'rem-1', task_id: 'task-1' }),
    });
    const result = await getReminderForTask(db, 'task-1');
    const [sql, params] = db.getOptional.mock.calls[0];
    expect(sql).toContain('WHERE task_id = ?');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('ORDER BY remind_at_utc DESC');
    expect(params).toEqual(['task-1']);
    expect(result).toEqual({ id: 'rem-1', task_id: 'task-1' });
  });

  it('returns null when no reminder exists', async () => {
    const db = makeMockDb({ getOptional: vi.fn().mockResolvedValue(null) });
    const result = await getReminderForTask(db, 'task-1');
    expect(result).toBeNull();
  });
});

describe('deleteRemindersForTask', () => {
  it("soft-deletes all non-deleted reminders for the given task", async () => {
    const db = makeMockDb();
    await deleteRemindersForTask(db, 'task-1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('deleted_at = ?');
    expect(sql).toContain('task_id = ?');
    expect(sql).toContain('deleted_at IS NULL');
    expect(params).toEqual([expect.any(String), expect.any(String), 'task-1']);
  });
});

describe('getPendingReminders', () => {
  it('queries for un-notified, non-deleted, past-due reminders for the given user', async () => {
    const db = makeMockDb();
    const before = Date.now();
    await getPendingReminders(db, 'user-1');
    const [sql, params] = db.getAll.mock.calls[0];
    expect(sql).toContain("notified_mobile = 0");
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('remind_at_utc > ?');
    expect(params[0]).toBe('user-1');
    expect(new Date(params[1]).getTime()).toBeGreaterThanOrEqual(before);
  });
});
