import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import { parseRule, computeNext, quadrantLabel } from '@todolist/core';
import type { TaskRecord } from '../schema';
import { deleteRemindersForTask } from './reminders';

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
  SELECT id, title, priority, due_date, due_time, project_id, status, labels, recurrence_rule, in_focus, sort_order
  FROM tasks
  WHERE due_date <= date('now')
    AND status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY priority, sort_order
`;

// The mobile Today tab's list: everything already due (overdue + today) plus
// top-level P1 work carrying no date at all. That undated branch is the only
// thing the old Home "Top Priorities" list did that a date filter cannot;
// folding it in here is what let that tab go away.
//
// Deliberately NOT a widening of TODAY_QUERY: that one still backs the web
// Today page, the web Focus page, and the sidebar's Today count, and changing
// its meaning would move all three silently.
//
// parent_task_id is filtered on the undated branch only, so dated subtasks
// keep showing up exactly as they do today while undated P1 subtasks don't
// surface as if they were standalone work.
export const AGENDA_QUERY = `
  SELECT id, title, priority, due_date, due_time, project_id, status, labels, recurrence_rule, in_focus, sort_order
  FROM tasks
  WHERE status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
    AND (
      due_date <= date('now')
      OR (due_date IS NULL AND priority = 1 AND parent_task_id IS NULL)
    )
  ORDER BY priority, sort_order
`;

// How many P1 cards may sit in the notification shade at once. Three keeps the
// shade readable next to the Inbox triage card; a user with a large P1 backlog
// sees the three closest to breaching, not all of them.
export const P1_CARD_LIMIT = 3;

export interface P1CardTaskRow {
  id:       string;
  title:    string;
  due_date: string | null;
  due_time: string | null;
}

// Backs the mobile P1 notification cards: priority-1 work that is open and has
// already arrived (overdue or due today).
//
// due_date IS NOT NULL is redundant against `due_date <= date('now')` in
// SQLite, but it is written explicitly because it states the actual product
// rule: undated P1 work belongs to the Today tab's Do First band, not to a
// notification. Without it, a future edit widening the date clause would
// silently start paging the user about work with no deadline.
export const P1_CARDS_QUERY = `
  SELECT id, title, due_date, due_time
  FROM tasks
  WHERE status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
    AND priority = 1
    AND due_date IS NOT NULL
    AND due_date <= date('now')
  ORDER BY due_date, sort_order
  LIMIT ${P1_CARD_LIMIT}
`;

export async function getP1CardTasks(db: AbstractPowerSyncDatabase): Promise<P1CardTaskRow[]> {
  return db.getAll<P1CardTaskRow>(P1_CARDS_QUERY);
}

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

export const MATRIX_QUERY = `
  SELECT id, title, priority, due_date, project_id, status, labels, recurrence_rule, sort_order
  FROM tasks
  WHERE status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY sort_order
`;

export function groupTasksByPriority<T extends { priority: number | null }>(
  tasks: T[]
): Record<1 | 2 | 3 | 4, T[]> {
  const groups: Record<1 | 2 | 3 | 4, T[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const task of tasks) {
    const priority = (task.priority ?? 4) as 1 | 2 | 3 | 4;
    (groups[priority] ?? groups[4]).push(task);
  }
  return groups;
}

export type AgendaSectionKey = 'overdue' | 'today' | 'do-first';

export interface AgendaSection<T> {
  key:   AgendaSectionKey;
  title: string;
  data:  T[];
}

interface AgendaTask {
  due_date: string | null;
  priority: number | null;
}

// Splits AGENDA_QUERY's rows into the three bands the mobile Today tab renders.
// `today` is passed in rather than read off the clock so this stays pure and
// testable; callers pass new Date().toISOString().split('T')[0].
//
// Undated rows can only be P1 given AGENDA_QUERY's WHERE clause, but the
// priority check is repeated here so a future caller with a looser query can't
// quietly file ordinary undated tasks under "Do First".
export function groupAgendaTasks<T extends AgendaTask>(
  tasks: T[],
  today: string
): AgendaSection<T>[] {
  const overdue:  T[] = [];
  const dueToday: T[] = [];
  const doFirst:  T[] = [];

  for (const task of tasks) {
    if (task.due_date == null) {
      if (task.priority === 1) doFirst.push(task);
      continue;
    }
    if (task.due_date < today) overdue.push(task);
    else if (task.due_date === today) dueToday.push(task);
  }

  const sections: AgendaSection<T>[] = [
    { key: 'overdue',  title: 'Overdue',        data: overdue },
    { key: 'today',    title: 'Today',          data: dueToday },
    { key: 'do-first', title: quadrantLabel[1], data: doFirst },
  ];

  return sections.filter(section => section.data.length > 0);
}

// --- React hooks ---

export function useInboxTasks() {
  const query = useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'>>(INBOX_QUERY);
  const count = useMemo(() => {
    return query.data?.length ?? 0;
  }, [query.data]);

  return { ...query, count };
}

export function useMatrixTasks() {
  const query = useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'project_id' | 'status' | 'labels' | 'recurrence_rule' | 'sort_order'>>(MATRIX_QUERY);
  const byQuadrant = useMemo(() => groupTasksByPriority(query.data ?? []), [query.data]);

  return { ...query, byQuadrant };
}

export function useTodayTasks() {
  const query = useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'project_id' | 'status' | 'labels' | 'recurrence_rule' | 'in_focus' | 'sort_order'>>(TODAY_QUERY);
  const count = useMemo(() => {
    return query.data?.length ?? 0;
  }, [query.data]);

  return { ...query, count };
}

export function useAgendaTasks() {
  const query = useQuery<Pick<TaskRecord,
    'id' | 'title' | 'priority' | 'due_date' | 'due_time' | 'project_id' |
    'status' | 'labels' | 'recurrence_rule' | 'in_focus' | 'sort_order'
  >>(AGENDA_QUERY);
  const count = useMemo(() => query.data?.length ?? 0, [query.data]);

  return { ...query, count };
}

// From feat/today-dashboard-redesign — not yet wired into a screen; kept
// alongside useTodayTasks/useTodayStats below (the already-integrated
// versions) pending reconciliation of the two Today-page designs.
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

// Top priorities for the home dashboard: focused tasks first, then by priority.
// Fields match SwipeableTaskRow's TaskRowData so the row component is reusable.
//
// Deliberately unfiltered by due date, so undated tasks and recurring tasks
// whose next occurrence is still ahead both stay visible. That means a
// recurring task remains here after completeTask advances it — recurrence_rule
// is selected so rows can label it instead of looking like a failed save.
export const TOP_PRIORITIES_QUERY = `
  SELECT id, title, priority, due_date, status, labels, recurrence_rule
  FROM tasks
  WHERE status NOT IN ('completed', 'cancelled')
    AND parent_task_id IS NULL
    AND deleted_at IS NULL
  ORDER BY in_focus DESC, priority, sort_order
  LIMIT 3
`;

export function useTopPriorities() {
  return useQuery<Pick<TaskRecord, 'id' | 'title' | 'priority' | 'due_date' | 'status' | 'labels' | 'recurrence_rule'>>(TOP_PRIORITIES_QUERY);
}

export function useTodayStats() {
  return useQuery<{ total: number; completed: number }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM tasks
     WHERE due_date <= date('now')
       AND status NOT IN ('cancelled')
       AND deleted_at IS NULL`
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
    description?: string | null;
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
    sourceUrl?: string | null;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  const recurrenceRule = fields.recurrenceRule ?? null;
  const recurrenceStart = recurrenceRule ? (fields.dueDate ?? null) : null;
  await db.execute(
    `INSERT INTO tasks
       (id, user_id, title, description, status, priority, due_date, due_time, timezone,
        project_id, parent_task_id, recurrence_rule, recurrence_start,
        labels, sort_order, source_url, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      fields.userId,
      fields.title,
      fields.description ?? null,
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
      fields.sourceUrl ?? null,
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
    await deleteRemindersForTask(db, id);
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
    // Cancel the reminder that just fired for this occurrence. The task keeps
    // its id across occurrences (only due_date advances), so without this the
    // just-fired reminder row would still look "pending" for the next one.
    // A new reminder for the next occurrence is a separate, manual action —
    // no auto-carry-forward exists anywhere in this codebase.
    await tx.execute(
      `UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE task_id = ? AND deleted_at IS NULL`,
      [now, now, id]
    );
  });
}

export async function updateTaskTitle(db: AbstractPowerSyncDatabase, id: string, title: string): Promise<void> {
  await db.execute(
    `UPDATE tasks SET title = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [title, new Date().toISOString(), id]
  );
}

export async function updateTaskDescription(db: AbstractPowerSyncDatabase, id: string, description: string | null): Promise<void> {
  await db.execute(
    `UPDATE tasks SET description = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [description, new Date().toISOString(), id]
  );
}

export async function setTaskLabels(db: AbstractPowerSyncDatabase, id: string, labels: string[]): Promise<void> {
  await db.execute(
    `UPDATE tasks SET labels = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [JSON.stringify(labels), new Date().toISOString(), id]
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

// Move a task to a (possibly new) priority bucket and position. `sortOrder`
// is a fractional-indexing key produced by the caller (see `generateKeyBetween`).
// Used by the Kanban board for both cross-column (priority change) and
// within-column (reorder) drags.
export async function moveTask(
  db: AbstractPowerSyncDatabase,
  id: string,
  priority: number,
  sortOrder: string
): Promise<void> {
  await db.execute(
    `UPDATE tasks SET priority = ?, sort_order = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [priority, sortOrder, new Date().toISOString(), id]
  );
}

export async function deleteTask(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
  await deleteRemindersForTask(db, id);
}

export async function toggleFocus(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE tasks SET in_focus = CASE WHEN in_focus = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [now, id]
  );
}
