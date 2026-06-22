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

export async function createProject(
  db: AbstractPowerSyncDatabase,
  fields: { userId: string; name: string; color?: string; icon?: string; afterSortOrder?: string | null }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sortOrder = generateKeyBetween(fields.afterSortOrder ?? null, null);
  await db.execute(
    `INSERT INTO projects (id, user_id, name, color, icon, is_archived, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,0,?,?,?)`,
    [id, fields.userId, fields.name, fields.color ?? '#6366F1', fields.icon ?? '📁', sortOrder, now, now]
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
