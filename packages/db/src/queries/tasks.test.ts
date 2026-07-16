import { describe, it, expect, vi } from 'vitest';
import { LOGBOOK_QUERY, MATRIX_QUERY, groupTasksByPriority, completeTask, deleteTask } from './tasks';

function makeMockDb(overrides: Partial<Record<string, any>> = {}) {
  const txExecute = vi.fn().mockResolvedValue(undefined);
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    getOptional: vi.fn().mockResolvedValue(null),
    getAll: vi.fn().mockResolvedValue([]),
    writeTransaction: vi.fn(async (fn: (tx: { execute: typeof txExecute }) => Promise<void>) => {
      await fn({ execute: txExecute });
    }),
    txExecute,
    ...overrides,
  } as any;
}

describe('LOGBOOK_QUERY', () => {
  it("selects only completed tasks", () => {
    expect(LOGBOOK_QUERY).toContain("status = 'completed'");
  });

  it("excludes soft-deleted tasks", () => {
    expect(LOGBOOK_QUERY).toContain("deleted_at IS NULL");
  });

  it("orders by updated_at descending", () => {
    expect(LOGBOOK_QUERY).toContain("updated_at DESC");
  });

  it("limits to 200 rows", () => {
    expect(LOGBOOK_QUERY).toContain("LIMIT 200");
  });
});

describe('MATRIX_QUERY', () => {
  it("excludes completed and cancelled tasks", () => {
    expect(MATRIX_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });

  it("excludes soft-deleted tasks", () => {
    expect(MATRIX_QUERY).toContain("deleted_at IS NULL");
  });

  it("orders by sort_order", () => {
    expect(MATRIX_QUERY).toContain("ORDER BY sort_order");
  });
});

describe('completeTask', () => {
  it("cancels the task's pending reminder(s) on plain (non-recurring) completion", async () => {
    const db = makeMockDb({
      getOptional: vi.fn().mockResolvedValue({
        id: 'task-1',
        recurrence_rule: null,
        due_date: '2026-07-20',
      }),
    });

    await completeTask(db, 'task-1');

    // First execute call completes the task; second cancels its reminders.
    expect(db.execute).toHaveBeenCalledTimes(2);
    const [completeSql] = db.execute.mock.calls[0];
    expect(completeSql).toContain("SET status = 'completed'");

    const [reminderSql, reminderParams] = db.execute.mock.calls[1];
    expect(reminderSql).toContain('UPDATE reminders');
    expect(reminderSql).toContain('deleted_at = ?');
    expect(reminderSql).toContain('task_id = ?');
    expect(reminderSql).toContain('deleted_at IS NULL');
    expect(reminderParams).toEqual([expect.any(String), expect.any(String), 'task-1']);
  });

  it("does nothing if the task no longer exists", async () => {
    const db = makeMockDb({ getOptional: vi.fn().mockResolvedValue(null) });
    await completeTask(db, 'task-1');
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.writeTransaction).not.toHaveBeenCalled();
  });

  it("cancels the reminder inside the same writeTransaction on recurring completion", async () => {
    const db = makeMockDb({
      getOptional: vi.fn().mockResolvedValue({
        id: 'task-1',
        user_id: 'user-1',
        title: 'Water plants',
        description: null,
        priority: 3,
        due_date: '2026-07-20',
        due_time: null,
        timezone: null,
        project_id: null,
        labels: '[]',
        sort_order: 'a0',
        recurrence_rule: 'FREQ=DAILY',
        recurrence_start: '2026-07-20',
      }),
    });

    await completeTask(db, 'task-1');

    expect(db.writeTransaction).toHaveBeenCalledTimes(1);
    // Snapshot insert, due_date advance, subtask reset, reminder cancel.
    expect(db.txExecute).toHaveBeenCalledTimes(4);

    const reminderCall = db.txExecute.mock.calls.find(([sql]: [string]) =>
      sql.includes('UPDATE reminders')
    );
    expect(reminderCall).toBeDefined();
    const [reminderSql, reminderParams] = reminderCall;
    expect(reminderSql).toContain('deleted_at = ?');
    expect(reminderSql).toContain('task_id = ?');
    expect(reminderSql).toContain('deleted_at IS NULL');
    expect(reminderParams).toEqual([expect.any(String), expect.any(String), 'task-1']);
  });
});

describe('deleteTask', () => {
  it("soft-deletes the task and cancels its pending reminder(s)", async () => {
    const db = makeMockDb();

    await deleteTask(db, 'task-1');

    expect(db.execute).toHaveBeenCalledTimes(2);
    const [taskSql, taskParams] = db.execute.mock.calls[0];
    expect(taskSql).toContain('UPDATE tasks SET deleted_at = ?');
    expect(taskParams[taskParams.length - 1]).toBe('task-1');

    const [reminderSql, reminderParams] = db.execute.mock.calls[1];
    expect(reminderSql).toContain('UPDATE reminders');
    expect(reminderSql).toContain('deleted_at = ?');
    expect(reminderSql).toContain('task_id = ?');
    expect(reminderParams).toEqual([expect.any(String), expect.any(String), 'task-1']);
  });
});

describe('groupTasksByPriority', () => {
  it("buckets tasks into their priority group", () => {
    const tasks = [
      { id: 'a', priority: 1 },
      { id: 'b', priority: 3 },
      { id: 'c', priority: 1 },
    ];

    const groups = groupTasksByPriority(tasks);

    expect(groups[1].map(t => t.id)).toEqual(['a', 'c']);
    expect(groups[2]).toEqual([]);
    expect(groups[3].map(t => t.id)).toEqual(['b']);
    expect(groups[4]).toEqual([]);
  });

  it("preserves each group's relative order", () => {
    const tasks = [
      { id: 'first', priority: 2 },
      { id: 'second', priority: 2 },
    ];

    const groups = groupTasksByPriority(tasks);

    expect(groups[2].map(t => t.id)).toEqual(['first', 'second']);
  });

  it("defaults a null priority to group 4", () => {
    const tasks = [{ id: 'a', priority: null }];

    const groups = groupTasksByPriority(tasks);

    expect(groups[4].map(t => t.id)).toEqual(['a']);
  });
});
