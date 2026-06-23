import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import { parseRule, computeNext } from '@todolist/core';
import type { TaskRecord } from '../schema';

// --- Read helpers (used in hooks) ---

export const INBOX_QUERY = `
  SELECT id, title, priority, due_date, due_time, status, sort_order, labels, recurrence_rule
  FROM tasks
  WHERE project_id IS NULL
    AND parent_task_id IS NULL
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY sort_order
`;

export const TODAY_QUERY = `
  SELECT id, title, priority, due_date, due_time, project_id, status, labels, recurrence_rule, in_focus
  FROM tasks
  WHERE due_date <= date('now')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY priority, sort_order
`;

export const UPCOMING_QUERY = `
  SELECT id, title, priority, due_date, project_id, status, labels, recurrence_rule
  FROM tasks
  WHERE due_date > date('now')
    AND due_date <= date('now', '+7 days')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY due_date, priority
`;

export const LOGBOOK_QUERY = `
  SELECT id, title, priority, due_date, status, updated_at, project_id, labels
  FROM tasks
  WHERE status = 'completed'
    AND deleted_at IS NULL
  ORDER BY updated_at DESC
  LIMIT 200
`;

// --- React hooks ---

export function useInboxTasks() {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'>>(INBOX_QUERY);
}

export function useTodayTasks() {
  return useQuery<Pick<TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'project_id' |
    'status' | 'labels' | 'recurrence_rule' | 'in_focus'
  >>(TODAY_QUERY);
}

export const FOCUS_TASKS_QUERY = `
  SELECT id, title, priority, due_date, due_time, project_id, status, labels, recurrence_rule, in_focus
  FROM tasks
  WHERE in_focus = 1
    AND due_date <= date('now')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY priority, sort_order
`;

export function useFocusTasks() {
  return useQuery<Pick<TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'project_id' |
    'status' | 'labels' | 'recurrence_rule' | 'in_focus'
  >>(FOCUS_TASKS_QUERY);
}

export const TODAY_STATS_QUERY = `
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
  FROM tasks
  WHERE due_date = date('now')
    AND deleted_at IS NULL
`;

export function useTodayStats() {
  return useQuery<{ total: number; completed: number }>(TODAY_STATS_QUERY);
}

export function useUpcomingTasks() {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'project_id' | 'status' | 'labels' | 'recurrence_rule'>>(UPCOMING_QUERY);
}

export function useLogbook() {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'status' | 'updated_at' | 'project_id' | 'labels'>>(LOGBOOK_QUERY);
}

export function useProjectTasks(projectId: string) {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'>>(
    `SELECT id, title, priority, due_date, status, sort_order, labels, recurrence_rule FROM tasks
     WHERE project_id = ?
       AND parent_task_id IS NULL
       AND status NOT IN ('completed', 'cancelled')
       AND deleted_at IS NULL
     ORDER BY sort_order`,
    [projectId]
  );
}

export function useSubtasks(parentTaskId: string) {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'status' | 'sort_order'>>(
    `SELECT id, title, status, sort_order FROM tasks
     WHERE parent_task_id = ?
       AND deleted_at IS NULL
     ORDER BY sort_order`,
    [parentTaskId]
  );
}

export function useTask(id: string) {
  return useQuery<TaskRecord>(
    `SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id]
  );
}

// --- Write helpers (called directly with db instance) ---

export async function createTask(
  db: AbstractPowerSyncDatabase,
  fields: {
    userId: string;
    title: string;
    priority?: number;
    status?: string;
    dueDate?: string | null;
    dueTime?: string | null;
    timezone?: string | null;
    projectId?: string | null;
    parentTaskId?: string | null;
    labels?: string[];
    afterSortOrder?: string | null;
    recurrenceRule?: string | null;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  const recurrenceRule = fields.recurrenceRule ?? null;
  const recurrenceStart = recurrenceRule ? (fields.dueDate ?? null) : null;
  await db.execute(
    `INSERT INTO tasks
       (id, user_id, title, status, priority, due_date, due_time, timezone,
        project_id, parent_task_id, recurrence_rule, recurrence_start,
        labels, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      fields.userId,
      fields.title,
      fields.status ?? 'inbox',
      fields.priority ?? 4,
      fields.dueDate ?? null,
      fields.dueTime ?? null,
      fields.timezone ?? null,
      fields.projectId ?? null,
      fields.parentTaskId ?? null,
      recurrenceRule,
      recurrenceStart,
      JSON.stringify(fields.labels ?? []),
      sortOrder,
      now,
      now,
    ]
  );
  return id;
}

export async function completeTask(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  const task = await db.getOptional<TaskRecord>(
    `SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (!task) return;

  const rule = task.recurrence_rule ? parseRule(task.recurrence_rule) : null;

  // Non-recurring (or undated): plain completion.
  if (!rule || !task.due_date) {
    await db.execute(
      `UPDATE tasks SET status = 'completed', updated_at = ? WHERE id = ?`,
      [now, id]
    );
    return;
  }

  // Recurring: snapshot the completed occurrence, then advance the original.
  const anchor = task.recurrence_start ?? task.due_date;
  const next = computeNext(rule, task.due_date, anchor);
  const snapshotId = crypto.randomUUID();

  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO tasks
         (id, user_id, title, description, status, priority, due_date, due_time, timezone,
          project_id, parent_task_id, recurrence_rule, recurrence_start,
          labels, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        snapshotId, task.user_id, task.title, task.description ?? null, 'completed',
        task.priority, task.due_date, task.due_time, task.timezone,
        task.project_id, null, null, null,
        task.labels, task.sort_order, now, now,
      ]
    );
    await tx.execute(
      `UPDATE tasks SET due_date = ?, updated_at = ? WHERE id = ?`,
      [next, now, id]
    );
    // Reset checked-off sub-tasks for the new occurrence.
    await tx.execute(
      `UPDATE tasks SET status = 'active', updated_at = ?
       WHERE parent_task_id = ? AND status = 'completed' AND deleted_at IS NULL`,
      [now, id]
    );
  });
}

export async function updateTaskTitle(db: AbstractPowerSyncDatabase, id: string, title: string): Promise<void> {
  await db.execute(
    `UPDATE tasks SET title = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [title, new Date().toISOString(), id]
  );
}

export async function updateTaskDue(
  db: AbstractPowerSyncDatabase,
  id: string,
  dueDate: string | null,
  dueTime: string | null
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET due_date = ?, due_time = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [dueDate, dueTime, new Date().toISOString(), id]
  );
}

export async function updateTaskRecurrence(
  db: AbstractPowerSyncDatabase,
  id: string,
  rule: string | null,
  start: string | null
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET recurrence_rule = ?, recurrence_start = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [rule, start, new Date().toISOString(), id]
  );
}

export async function updateTaskPriority(
  db: AbstractPowerSyncDatabase,
  id: string,
  priority: number
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [priority, new Date().toISOString(), id]
  );
}

export async function updateTaskProject(
  db: AbstractPowerSyncDatabase,
  id: string,
  projectId: string | null
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET project_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [projectId, new Date().toISOString(), id]
  );
}

export async function toggleFocus(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  await db.execute(
    `UPDATE tasks
     SET in_focus = CASE WHEN in_focus = 1 THEN 0 ELSE 1 END,
         updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [new Date().toISOString(), id]
  );
}

export async function deleteTask(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}
