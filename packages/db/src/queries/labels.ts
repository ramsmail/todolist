import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { LabelRecord, TaskRecord } from '../schema';
import { pickLabelColor, renameInLabelArray, removeFromLabelArray } from './labelUtils';

export function useLabels() {
  return useQuery<LabelRecord>(
    `SELECT * FROM labels WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE`
  );
}

export type LabelTaskRow = Pick<
  TaskRecord,
  'id' | 'title' | 'priority' | 'due_date' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'
>;

export function useTasksByLabel(name: string) {
  return useQuery<LabelTaskRow>(
    `SELECT id, title, priority, due_date, status, sort_order, labels, recurrence_rule
     FROM tasks
     WHERE deleted_at IS NULL
       AND status NOT IN ('completed', 'cancelled')
       AND EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)
     ORDER BY sort_order`,
    [name]
  );
}

export async function createLabel(
  db: AbstractPowerSyncDatabase,
  fields: { userId: string; name: string; color?: string }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = fields.name.trim().toLowerCase();
  await db.execute(
    `INSERT INTO labels (id, user_id, name, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, fields.userId, name, fields.color ?? pickLabelColor(name), now, now]
  );
  return id;
}

export async function ensureLabels(
  db: AbstractPowerSyncDatabase,
  userId: string,
  names: string[]
): Promise<void> {
  for (const raw of names) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    const existing = await db.getOptional<{ id: string }>(
      `SELECT id FROM labels WHERE name = ? AND deleted_at IS NULL LIMIT 1`,
      [name]
    );
    if (!existing) await createLabel(db, { userId, name });
  }
}

export async function updateLabel(
  db: AbstractPowerSyncDatabase,
  id: string,
  fields: { name?: string; color?: string }
): Promise<void> {
  const now = new Date().toISOString();
  const current = await db.get<LabelRecord>(`SELECT * FROM labels WHERE id = ?`, [id]);
  const newName = fields.name !== undefined ? fields.name.trim().toLowerCase() : current.name;
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE labels SET name = ?, color = ?, updated_at = ? WHERE id = ?`,
      [newName, fields.color ?? current.color, now, id]
    );
    if (newName !== current.name && current.name && newName) {
      const tasks = await tx.getAll<{ id: string; labels: string | null }>(
        `SELECT id, labels FROM tasks
         WHERE deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)`,
        [current.name]
      );
      for (const t of tasks) {
        const arr = renameInLabelArray(JSON.parse(t.labels ?? '[]') as string[], current.name as string, newName as string);
        await tx.execute(`UPDATE tasks SET labels = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify(arr), now, t.id]);
      }
    }
  });
}

export async function deleteLabel(db: AbstractPowerSyncDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  const current = await db.get<LabelRecord>(`SELECT * FROM labels WHERE id = ?`, [id]);
  await db.writeTransaction(async (tx) => {
    await tx.execute(`UPDATE labels SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
    if (current.name) {
      const tasks = await tx.getAll<{ id: string; labels: string | null }>(
        `SELECT id, labels FROM tasks
         WHERE deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM json_each(tasks.labels) WHERE value = ?)`,
        [current.name]
      );
      for (const t of tasks) {
        const arr = removeFromLabelArray(JSON.parse(t.labels ?? '[]') as string[], current.name as string);
        await tx.execute(`UPDATE tasks SET labels = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify(arr), now, t.id]);
      }
    }
  });
}
