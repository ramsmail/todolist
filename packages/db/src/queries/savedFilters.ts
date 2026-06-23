import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import { parseFilterQuery, type FilterQuery } from '@todolist/core';
import type { SavedFilterRecord, TaskRecord } from '../schema';

export type FilteredTaskRow = Pick<
  TaskRecord,
  'id' | 'title' | 'priority' | 'due_date' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule' | 'project_id'
>;

export function buildFilterSQL(query: FilterQuery): { sql: string; params: (string | number)[] } {
  const conditions: string[] = [
    "status NOT IN ('completed', 'cancelled')",
    'deleted_at IS NULL',
    'parent_task_id IS NULL',
  ];
  const params: (string | number)[] = [];

  if (query.priority && query.priority.length > 0) {
    const ph = query.priority.map(() => '?').join(', ');
    conditions.push(`priority IN (${ph})`);
    params.push(...query.priority);
  }

  if (query.projectId !== undefined) {
    if (query.projectId === null) {
      conditions.push('project_id IS NULL');
    } else {
      conditions.push('project_id = ?');
      params.push(query.projectId);
    }
  }

  if (query.labels && query.labels.length > 0) {
    const labelConds = query.labels.map(
      () => "EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)"
    );
    conditions.push(`(${labelConds.join(' OR ')})`);
    params.push(...query.labels);
  }

  if (query.dueDateRange) {
    switch (query.dueDateRange) {
      case 'today':
        conditions.push("due_date = date('now')");
        break;
      case 'this_week':
        conditions.push("due_date >= date('now', '+1 day') AND due_date <= date('now', '+7 days')");
        break;
      case 'next_week':
        conditions.push("due_date >= date('now', '+8 days') AND due_date <= date('now', '+14 days')");
        break;
      case 'overdue':
        conditions.push("due_date < date('now') AND due_date IS NOT NULL");
        break;
      case 'no_date':
        conditions.push('due_date IS NULL');
        break;
    }
  }

  const sql = `
    SELECT id, title, priority, due_date, status, sort_order, labels, recurrence_rule, project_id
    FROM tasks
    WHERE ${conditions.join(' AND ')}
    ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, priority ASC
  `;
  return { sql, params };
}

export function useFilteredTasks(queryStr: string) {
  const query = parseFilterQuery(queryStr);
  const { sql, params } = buildFilterSQL(query);
  return useQuery<FilteredTaskRow>(sql, params);
}

export function useSavedFilters(userId: string) {
  return useQuery<SavedFilterRecord>(
    `SELECT * FROM saved_filters WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order`,
    [userId]
  );
}

export async function createSavedFilter(
  db: AbstractPowerSyncDatabase,
  fields: { userId: string; name: string; icon?: string; query: string }
): Promise<string> {
  const id  = crypto.randomUUID();
  const now = new Date().toISOString();
  const last = await db.getOptional<{ sort_order: string }>(
    `SELECT sort_order FROM saved_filters WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order DESC LIMIT 1`,
    [fields.userId]
  );
  const sortOrder = generateKeyBetween(last?.sort_order ?? null, null);
  await db.execute(
    `INSERT INTO saved_filters (id, user_id, name, icon, query, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, fields.userId, fields.name, fields.icon ?? null, fields.query, sortOrder, now, now]
  );
  return id;
}

export async function updateSavedFilter(
  db: AbstractPowerSyncDatabase,
  id: string,
  fields: { name?: string; icon?: string; query?: string }
): Promise<void> {
  const now    = new Date().toISOString();
  const sets: string[]           = ['updated_at = ?'];
  const params: (string | null)[] = [now];
  if (fields.name  !== undefined) { sets.push('name = ?');  params.push(fields.name); }
  if (fields.icon  !== undefined) { sets.push('icon = ?');  params.push(fields.icon); }
  if (fields.query !== undefined) { sets.push('query = ?'); params.push(fields.query); }
  params.push(id);
  await db.execute(`UPDATE saved_filters SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteSavedFilter(
  db: AbstractPowerSyncDatabase,
  id: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE saved_filters SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}
