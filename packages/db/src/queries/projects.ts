import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import type { ProjectRecord } from '../schema';

export function useProjects() {
  return useQuery<Pick<ProjectRecord, 'id' | 'name' | 'color' | 'icon' | 'sort_order'>>(
    `SELECT id, name, color, icon, sort_order FROM projects
     WHERE is_archived = 0 AND deleted_at IS NULL
     ORDER BY sort_order`
  );
}

export function useProjectsWithStats() {
  return useQuery<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    color: string;
    icon: string;
    due_date: string | null;
    total_tasks: number;
    completed_tasks: number;
    open_tasks: number;
  }>(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.category,
       p.color,
       p.icon,
       p.due_date,
       COUNT(CASE WHEN t.status != 'cancelled' AND t.deleted_at IS NULL THEN 1 END) as total_tasks,
       COUNT(CASE WHEN t.status = 'completed' AND t.deleted_at IS NULL THEN 1 END) as completed_tasks,
       COUNT(CASE WHEN t.status NOT IN ('completed', 'cancelled') AND t.deleted_at IS NULL THEN 1 END) as open_tasks
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE p.is_archived = 0 AND p.deleted_at IS NULL
     GROUP BY p.id, p.name, p.description, p.category, p.color, p.icon, p.due_date
     ORDER BY p.sort_order`
  );
}

export async function createProject(
  db: AbstractPowerSyncDatabase,
  fields: {
    userId: string;
    name: string;
    description?: string;
    category?: string;
    due_date?: string;
    color?: string;
    icon?: string;
    afterSortOrder?: string | null;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  await db.execute(
    `INSERT INTO projects (id, user_id, name, description, category, due_date, color, icon, is_archived, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,0,?,?,?)`,
    [
      id,
      fields.userId,
      fields.name,
      fields.description ?? null,
      fields.category ?? 'Personal',
      fields.due_date ?? null,
      fields.color ?? '#6366F1',
      fields.icon ?? '📁',
      sortOrder,
      now,
      now
    ]
  );
  return id;
}

export async function deleteProject(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id]
  );
}
