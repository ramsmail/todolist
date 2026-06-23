import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import type { SavedFilterRecord } from '../schema';

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
