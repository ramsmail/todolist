import { describe, it, expect, vi } from 'vitest';
import { createReconciler } from '../src/notifications/reconciliation';

function makeDeps(overrides: Partial<Record<string, any>> = {}) {
  return {
    getPendingReminders: vi.fn().mockResolvedValue([]),
    scheduleReminderNotification: vi.fn().mockResolvedValue('notif-1'),
    cancelNotification: vi.fn().mockResolvedValue(undefined),
    getInboxCount: vi.fn().mockResolvedValue(0),
    getNudgeSettings: vi.fn().mockResolvedValue({ enabled: false, time: null }),
    scheduleNudgeNotification: vi.fn().mockResolvedValue('nudge-1'),
    ...overrides,
  };
}

describe('reconcileReminders', () => {
  it('schedules a notification for a pending reminder not yet scheduled', async () => {
    const deps = makeDeps({
      getPendingReminders: vi.fn().mockResolvedValue([{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }]),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    expect(deps.scheduleReminderNotification).toHaveBeenCalledTimes(1);
    expect(deps.scheduleReminderNotification).toHaveBeenCalledWith({ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' });
  });

  it('does not re-schedule a reminder that is already scheduled', async () => {
    const pending = [{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }];
    const deps = makeDeps({ getPendingReminders: vi.fn().mockResolvedValue(pending) });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    await reconciler.reconcileReminders();
    expect(deps.scheduleReminderNotification).toHaveBeenCalledTimes(1);
  });

  it('cancels a scheduled notification whose reminder is no longer pending (deleted, completed, re-synced, or already delivered)', async () => {
    const pending = [{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }];
    const deps = makeDeps({
      getPendingReminders: vi.fn()
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce([]), // second pass: gone (e.g. another device completed the task)
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    await reconciler.reconcileReminders();
    expect(deps.cancelNotification).toHaveBeenCalledWith('notif-1');
  });

  it('schedules newly-pending reminders and cancels stale ones in the same pass', async () => {
    const deps = makeDeps({
      getPendingReminders: vi.fn()
        .mockResolvedValueOnce([{ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' }])
        .mockResolvedValueOnce([{ id: 'rem-2', task_id: 'task-2', remind_at_utc: '2026-07-21T09:00:00.000Z' }]),
      scheduleReminderNotification: vi.fn()
        .mockResolvedValueOnce('notif-1')
        .mockResolvedValueOnce('notif-2'),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders();
    await reconciler.reconcileReminders();
    expect(deps.cancelNotification).toHaveBeenCalledWith('notif-1');
    expect(deps.scheduleReminderNotification).toHaveBeenCalledTimes(2);
  });
});

describe('reconcileNudge', () => {
  it('does nothing (no schedule call) when disabled', async () => {
    const deps = makeDeps();
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    expect(deps.scheduleNudgeNotification).not.toHaveBeenCalled();
  });

  it('stays silent when enabled but the inbox is empty', async () => {
    const deps = makeDeps({ getNudgeSettings: vi.fn().mockResolvedValue({ enabled: true, time: '08:00' }), getInboxCount: vi.fn().mockResolvedValue(0) });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    expect(deps.scheduleNudgeNotification).not.toHaveBeenCalled();
  });

  it('schedules with the current count when enabled and the inbox is non-empty', async () => {
    const deps = makeDeps({ getNudgeSettings: vi.fn().mockResolvedValue({ enabled: true, time: '08:00' }), getInboxCount: vi.fn().mockResolvedValue(7) });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    expect(deps.scheduleNudgeNotification).toHaveBeenCalledWith(7, '08:00');
  });

  it('replaces rather than stacks: a second reconcile cancels the previous nudge notification before rescheduling', async () => {
    const deps = makeDeps({
      getNudgeSettings: vi.fn().mockResolvedValue({ enabled: true, time: '08:00' }),
      getInboxCount: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(5),
      scheduleNudgeNotification: vi.fn().mockResolvedValueOnce('nudge-1').mockResolvedValueOnce('nudge-2'),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileNudge();
    await reconciler.reconcileNudge();
    expect(deps.cancelNotification).toHaveBeenCalledWith('nudge-1');
    expect(deps.scheduleNudgeNotification).toHaveBeenCalledTimes(2);
  });
});
