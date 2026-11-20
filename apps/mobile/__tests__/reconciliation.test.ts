import { describe, it, expect, vi } from 'vitest';
import { createReconciler } from '../src/notifications/reconciliation';
import { CHECKIN_LINES } from '../src/notifications/checkinContent';

function makeDeps(overrides: Partial<Record<string, any>> = {}) {
  return {
    getPendingReminders: vi.fn().mockResolvedValue([]),
    scheduleReminderNotification: vi.fn().mockResolvedValue('notif-1'),
    cancelNotification: vi.fn().mockResolvedValue(undefined),
    getInboxCount: vi.fn().mockResolvedValue(0),
    getNudgeSettings: vi.fn().mockResolvedValue({ enabled: false, time: null }),
    scheduleNudgeNotification: vi.fn().mockResolvedValue('nudge-1'),
    getP1CardTasks: vi.fn().mockResolvedValue([]),
    getP1CardSettings: vi.fn().mockResolvedValue({ enabled: false, time: null }),
    scheduleP1CardNotification: vi.fn().mockResolvedValue('p1-notif-1'),
    getCheckinSettings: vi.fn().mockResolvedValue({ enabled: false, time: '10:00' }),
    scheduleCheckinNotification: vi.fn().mockResolvedValue('checkin-1'),
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

  it('a rejected cancelNotification does not stop other stale items in the same pass from being cancelled, and retries the failed one next pass', async () => {
    const pending = [
      { id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' },
      { id: 'rem-2', task_id: 'task-2', remind_at_utc: '2026-07-21T09:00:00.000Z' },
    ];
    const deps = makeDeps({
      getPendingReminders: vi.fn()
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce([]) // both now stale
        .mockResolvedValueOnce([]), // third pass: retry
      scheduleReminderNotification: vi.fn()
        .mockResolvedValueOnce('notif-1')
        .mockResolvedValueOnce('notif-2'),
      cancelNotification: vi.fn()
        .mockRejectedValueOnce(new Error('transient OS error')) // fails for notif-1
        .mockResolvedValueOnce(undefined) // succeeds for notif-2
        .mockResolvedValueOnce(undefined), // notif-1 retried successfully next pass
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders(); // schedules both
    await reconciler.reconcileReminders(); // both now stale; notif-1's cancel rejects, notif-2's succeeds
    expect(deps.cancelNotification).toHaveBeenCalledWith('notif-2');
    await reconciler.reconcileReminders(); // third pass: notif-1 should still be tracked and retried
    expect(deps.cancelNotification).toHaveBeenCalledWith('notif-1');
    expect(deps.cancelNotification).toHaveBeenCalledTimes(3);
  });

  it('a rejected scheduleReminderNotification does not stop other newly-pending items in the same pass from being scheduled, and retries the failed one next pass', async () => {
    const deps = makeDeps({
      getPendingReminders: vi.fn().mockResolvedValue([
        { id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' },
        { id: 'rem-2', task_id: 'task-2', remind_at_utc: '2026-07-21T09:00:00.000Z' },
      ]),
      scheduleReminderNotification: vi.fn()
        .mockRejectedValueOnce(new Error('transient OS error')) // fails for rem-1
        .mockResolvedValueOnce('notif-2') // succeeds for rem-2
        .mockResolvedValueOnce('notif-1'), // rem-1 retried successfully next pass
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileReminders(); // rem-1 fails, rem-2 succeeds
    expect(deps.scheduleReminderNotification).toHaveBeenCalledWith({ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' });
    expect(deps.scheduleReminderNotification).toHaveBeenCalledWith({ id: 'rem-2', task_id: 'task-2', remind_at_utc: '2026-07-21T09:00:00.000Z' });
    await reconciler.reconcileReminders(); // rem-1 should be retried (not permanently dropped), rem-2 should NOT be re-scheduled (already tracked)
    expect(deps.scheduleReminderNotification).toHaveBeenCalledTimes(3);
    expect(deps.scheduleReminderNotification).toHaveBeenLastCalledWith({ id: 'rem-1', task_id: 'task-1', remind_at_utc: '2026-07-20T09:00:00.000Z' });
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

describe('reconcileP1Cards', () => {
  const task = { id: 'task-1', title: 'File the tax return', due_date: '2026-08-30', due_time: null };
  const enabled = { enabled: true, time: '09:00' };

  it('schedules a card per qualifying task when enabled', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn().mockResolvedValue(enabled),
      getP1CardTasks: vi.fn().mockResolvedValue([task, { ...task, id: 'task-2' }]),
    });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();

    expect(deps.scheduleP1CardNotification).toHaveBeenCalledTimes(2);
    expect(deps.scheduleP1CardNotification).toHaveBeenCalledWith(task, '09:00');
  });

  it('schedules nothing when the setting is off', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn().mockResolvedValue({ enabled: false, time: '09:00' }),
      getP1CardTasks: vi.fn().mockResolvedValue([task]),
    });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();

    expect(deps.scheduleP1CardNotification).not.toHaveBeenCalled();
  });

  it('schedules nothing when no fire time is set', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn().mockResolvedValue({ enabled: true, time: null }),
      getP1CardTasks: vi.fn().mockResolvedValue([task]),
    });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();

    expect(deps.scheduleP1CardNotification).not.toHaveBeenCalled();
  });

  it('does not query for tasks at all when the setting is off', async () => {
    const deps = makeDeps({ getP1CardSettings: vi.fn().mockResolvedValue({ enabled: false, time: null }) });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();

    expect(deps.getP1CardTasks).not.toHaveBeenCalled();
  });

  it('cancels the previous pass cards before scheduling fresh ones', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn().mockResolvedValue(enabled),
      getP1CardTasks: vi.fn().mockResolvedValue([task]),
    });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();
    await reconciler.reconcileP1Cards();

    expect(deps.cancelNotification).toHaveBeenCalledWith('p1-notif-1');
    expect(deps.scheduleP1CardNotification).toHaveBeenCalledTimes(2);
  });

  it('cancels a card for a task that no longer qualifies', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn().mockResolvedValue(enabled),
      getP1CardTasks: vi.fn()
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([]), // completed on another device
    });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();
    await reconciler.reconcileP1Cards();

    expect(deps.cancelNotification).toHaveBeenCalledWith('p1-notif-1');
    expect(deps.scheduleP1CardNotification).toHaveBeenCalledTimes(1);
  });

  it('clears scheduled cards when the setting is turned off', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn()
        .mockResolvedValueOnce(enabled)
        .mockResolvedValueOnce({ enabled: false, time: '09:00' }),
      getP1CardTasks: vi.fn().mockResolvedValue([task]),
    });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();
    await reconciler.reconcileP1Cards();

    expect(deps.cancelNotification).toHaveBeenCalledWith('p1-notif-1');
  });

  it('still schedules the remaining tasks when one schedule call throws', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn().mockResolvedValue(enabled),
      getP1CardTasks: vi.fn().mockResolvedValue([task, { ...task, id: 'task-2' }]),
      scheduleP1CardNotification: vi.fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce('p1-notif-2'),
    });
    const reconciler = createReconciler(deps as any);

    await expect(reconciler.reconcileP1Cards()).resolves.toBeUndefined();
    expect(deps.scheduleP1CardNotification).toHaveBeenCalledTimes(2);
  });

  it('does not leave a cancelled card tracked when cancellation throws', async () => {
    const deps = makeDeps({
      getP1CardSettings: vi.fn().mockResolvedValue(enabled),
      getP1CardTasks: vi.fn().mockResolvedValue([task]),
      cancelNotification: vi.fn().mockRejectedValue(new Error('gone')),
    });
    const reconciler = createReconciler(deps as any);

    await reconciler.reconcileP1Cards();
    await expect(reconciler.reconcileP1Cards()).resolves.toBeUndefined();
    expect(deps.scheduleP1CardNotification).toHaveBeenCalledTimes(2);
  });
});

describe('reconcileCheckin', () => {
  it('schedules nothing when disabled', async () => {
    const deps = makeDeps();
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    expect(deps.scheduleCheckinNotification).not.toHaveBeenCalled();
  });

  it('schedules at the configured time with a check-in line when enabled, even with an empty inbox', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn().mockResolvedValue({ enabled: true, time: '10:00' }),
      getInboxCount: vi.fn().mockResolvedValue(0),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    expect(deps.scheduleCheckinNotification).toHaveBeenCalledTimes(1);
    const [time, body] = deps.scheduleCheckinNotification.mock.calls[0];
    expect(time).toBe('10:00');
    expect(CHECKIN_LINES).toContain(body);
  });

  it('replaces rather than stacks: cancels the previous check-in before rescheduling', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn().mockResolvedValue({ enabled: true, time: '10:00' }),
      scheduleCheckinNotification: vi.fn().mockResolvedValueOnce('checkin-1').mockResolvedValueOnce('checkin-2'),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    await reconciler.reconcileCheckin();
    expect(deps.cancelNotification).toHaveBeenCalledWith('checkin-1');
    expect(deps.scheduleCheckinNotification).toHaveBeenCalledTimes(2);
  });

  it('reschedules at the new time after the time setting changes', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn()
        .mockResolvedValueOnce({ enabled: true, time: '10:00' })
        .mockResolvedValueOnce({ enabled: true, time: '07:30' }),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    await reconciler.reconcileCheckin();
    expect(deps.scheduleCheckinNotification.mock.calls[1][0]).toBe('07:30');
  });

  it('cancels and does not reschedule after being disabled', async () => {
    const deps = makeDeps({
      getCheckinSettings: vi.fn()
        .mockResolvedValueOnce({ enabled: true, time: '10:00' })
        .mockResolvedValueOnce({ enabled: false, time: '10:00' }),
    });
    const reconciler = createReconciler(deps as any);
    await reconciler.reconcileCheckin();
    await reconciler.reconcileCheckin();
    expect(deps.cancelNotification).toHaveBeenCalledWith('checkin-1');
    expect(deps.scheduleCheckinNotification).toHaveBeenCalledTimes(1);
  });
});
