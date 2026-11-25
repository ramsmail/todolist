import { describe, it, expect, vi } from 'vitest';
import { handleNotificationResponse, DEFAULT_ACTION_IDENTIFIER } from '../src/notifications/deepLinkHandler';

function makeDeps() {
  return {
    completeTask: vi.fn().mockResolvedValue(undefined),
    snoozeReminder: vi.fn().mockResolvedValue(undefined),
    rescheduleTaskTomorrow: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
  };
}

describe('handleNotificationResponse', () => {
  it('completes the task on the "complete" action and does not navigate', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('complete', { taskId: 'task-1', url: '/task/task-1' }, deps);
    expect(deps.completeTask).toHaveBeenCalledWith('task-1');
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('snoozes the reminder by 60 minutes on the "snooze_1h" action and does not navigate', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('snooze_1h', { reminderId: 'rem-1', url: '/task/task-1' }, deps);
    expect(deps.snoozeReminder).toHaveBeenCalledWith('rem-1', 60);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the data url on a plain tap (default action)', async () => {
    const deps = makeDeps();
    await handleNotificationResponse(DEFAULT_ACTION_IDENTIFIER, { url: '/tasks' }, deps);
    expect(deps.navigate).toHaveBeenCalledWith('/tasks');
    expect(deps.completeTask).not.toHaveBeenCalled();
  });

  it('does nothing if the action is unrecognized', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('some-unknown-action', { url: '/tasks' }, deps);
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.completeTask).not.toHaveBeenCalled();
    expect(deps.snoozeReminder).not.toHaveBeenCalled();
  });

  it('a plain tap with no url does nothing', async () => {
    const deps = makeDeps();
    await handleNotificationResponse(DEFAULT_ACTION_IDENTIFIER, {}, deps);
    expect(deps.navigate).not.toHaveBeenCalled();
  });
});

describe('reschedule_tomorrow action', () => {
  it('pushes the task to tomorrow', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('reschedule_tomorrow', { taskId: 'task-1' }, deps);
    expect(deps.rescheduleTaskTomorrow).toHaveBeenCalledWith('task-1');
  });

  it('does not navigate, so the action stays out-of-app', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('reschedule_tomorrow', { taskId: 'task-1', url: '/task/task-1' }, deps);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('does nothing without a taskId', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('reschedule_tomorrow', {}, deps);
    expect(deps.rescheduleTaskTomorrow).not.toHaveBeenCalled();
  });

  it('does not complete the task', async () => {
    const deps = makeDeps();
    await handleNotificationResponse('reschedule_tomorrow', { taskId: 'task-1' }, deps);
    expect(deps.completeTask).not.toHaveBeenCalled();
  });

  it('still opens the task on a plain tap of a P1 card', async () => {
    const deps = makeDeps();
    await handleNotificationResponse(DEFAULT_ACTION_IDENTIFIER, { taskId: 'task-1', url: '/task/task-1' }, deps);
    expect(deps.navigate).toHaveBeenCalledWith('/task/task-1');
  });
});
