import { describe, it, expect, vi } from 'vitest';
import { LOGBOOK_QUERY, MATRIX_QUERY, TODAY_QUERY, AGENDA_QUERY, FOCUS_TASKS_QUERY, TOP_PRIORITIES_QUERY, groupTasksByPriority, groupAgendaTasks, completeTask, deleteTask } from './tasks';
import { quadrantLabel } from '@todolist/core';

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

describe('TODAY_QUERY', () => {
  it('includes in_focus field', () => {
    expect(TODAY_QUERY).toContain('in_focus');
  });

  it('includes due_time field', () => {
    expect(TODAY_QUERY).toContain('due_time');
  });
});

describe('AGENDA_QUERY', () => {
  it('includes everything already due', () => {
    expect(AGENDA_QUERY).toContain("due_date <= date('now')");
  });

  it('also includes undated top-level P1 work', () => {
    expect(AGENDA_QUERY).toContain('due_date IS NULL AND priority = 1 AND parent_task_id IS NULL');
  });

  it('excludes completed and cancelled tasks', () => {
    expect(AGENDA_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });

  it('excludes soft-deleted tasks', () => {
    expect(AGENDA_QUERY).toContain('deleted_at IS NULL');
  });

  it('selects recurrence_rule so rows can label repeats', () => {
    expect(AGENDA_QUERY).toContain('recurrence_rule');
  });

  it('orders by priority so P1 leads each section', () => {
    expect(AGENDA_QUERY).toContain('ORDER BY priority, sort_order');
  });
});

describe('TODAY_QUERY regression', () => {
  it('stays date-only, so the web Today page and sidebar count are unaffected', () => {
    expect(TODAY_QUERY).not.toContain('priority = 1');
  });
});

describe('FOCUS_TASKS_QUERY', () => {
  it('filters on in_focus = 1', () => {
    expect(FOCUS_TASKS_QUERY).toContain('in_focus = 1');
  });

  it('excludes completed and cancelled tasks', () => {
    expect(FOCUS_TASKS_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });
});

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

describe('TOP_PRIORITIES_QUERY', () => {
  // A recurring task is not completed by completeTask — it keeps its id and
  // advances due_date — so it stays in this result set afterwards. Rows have to
  // be able to show that it repeats, otherwise checking one off looks like the
  // task failed to save.
  it("selects recurrence_rule so rows can mark repeating tasks", () => {
    expect(TOP_PRIORITIES_QUERY).toContain('recurrence_rule');
  });

  it("excludes completed and cancelled tasks", () => {
    expect(TOP_PRIORITIES_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });

  it("excludes soft-deleted tasks", () => {
    expect(TOP_PRIORITIES_QUERY).toContain("deleted_at IS NULL");
  });

  it("excludes sub-tasks", () => {
    expect(TOP_PRIORITIES_QUERY).toContain('parent_task_id IS NULL');
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

  // Pins the behaviour that surprised us on the Home dashboard: a recurring
  // task survives completion under its original id, so any list that doesn't
  // filter by due date still contains it afterwards. Rows must not assume
  // completion removes them.
  it("leaves the original recurring task active and only advances its due_date", async () => {
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

    const taskUpdate = db.txExecute.mock.calls.find(([sql]: [string]) =>
      sql.includes('UPDATE tasks SET due_date = ?')
    );
    expect(taskUpdate).toBeDefined();
    expect(taskUpdate[0]).not.toContain("status = 'completed'");
    expect(taskUpdate[1]).toEqual(['2026-07-21', expect.any(String), 'task-1']);

    // The completed occurrence is a separate snapshot row, not the original.
    const snapshot = db.txExecute.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO tasks')
    );
    expect(snapshot).toBeDefined();
    expect(snapshot[1][0]).not.toBe('task-1');
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

describe('groupAgendaTasks', () => {
  const today = '2026-09-01';

  it('splits dated tasks into Overdue and Today', () => {
    const sections = groupAgendaTasks([
      { id: 'late', due_date: '2026-08-25', priority: 2 },
      { id: 'now', due_date: '2026-09-01', priority: 3 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['overdue', 'today']);
    expect(sections[0].data.map(t => t.id)).toEqual(['late']);
    expect(sections[1].data.map(t => t.id)).toEqual(['now']);
  });

  it('puts undated P1 work in its own Do First band', () => {
    const sections = groupAgendaTasks([
      { id: 'someday', due_date: null, priority: 1 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['do-first']);
    expect(sections[0].data.map(t => t.id)).toEqual(['someday']);
  });

  it('titles the Do First band from the shared quadrant label', () => {
    const sections = groupAgendaTasks([{ id: 'a', due_date: null, priority: 1 }], today);

    expect(sections[0].title).toBe(quadrantLabel[1]);
  });

  it('drops undated non-P1 tasks rather than mislabelling them as Do First', () => {
    const sections = groupAgendaTasks([
      { id: 'undated-p3', due_date: null, priority: 3 },
    ], today);

    expect(sections).toEqual([]);
  });

  it('omits empty sections so no bare header renders', () => {
    const sections = groupAgendaTasks([
      { id: 'now', due_date: '2026-09-01', priority: 1 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['today']);
  });

  it('orders bands Overdue, then Today, then Do First', () => {
    const sections = groupAgendaTasks([
      { id: 'undated', due_date: null, priority: 1 },
      { id: 'now', due_date: '2026-09-01', priority: 1 },
      { id: 'late', due_date: '2026-08-01', priority: 1 },
    ], today);

    expect(sections.map(s => s.key)).toEqual(['overdue', 'today', 'do-first']);
  });

  it("preserves the query's order within a band", () => {
    const sections = groupAgendaTasks([
      { id: 'first', due_date: '2026-08-01', priority: 1 },
      { id: 'second', due_date: '2026-08-02', priority: 2 },
    ], today);

    expect(sections[0].data.map(t => t.id)).toEqual(['first', 'second']);
  });

  it('treats a null priority as non-P1 when undated', () => {
    const sections = groupAgendaTasks([
      { id: 'a', due_date: null, priority: null },
    ], today);

    expect(sections).toEqual([]);
  });
});
