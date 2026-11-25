// Generic links between entities. v1 stores note->task; reads accept both
// directions so phase 2 can add more types without changing callers.
// Links are HARD-deleted (no deleted_at); see syncTables.ts for why the
// upload connectors need to know that.
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { NoteRecord, TaskRecord } from '../schema';

export type LinkEntityType = 'note' | 'task';

// Anything with execute(): the db itself or a writeTransaction tx.
export type SqlExecutor = { execute: (sql: string, params?: unknown[]) => Promise<unknown> };

const PAIR_WHERE = `(from_type = 'note' AND from_id = ? AND to_type = 'task' AND to_id = ?)
     OR (from_type = 'task' AND from_id = ? AND to_type = 'note' AND to_id = ?)`;

export const LINKED_TASKS_QUERY = `
  SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id
  FROM links l
  JOIN tasks t
    ON (l.from_type = 'note' AND l.from_id = ? AND l.to_type = 'task' AND t.id = l.to_id)
    OR (l.to_type = 'note' AND l.to_id = ? AND l.from_type = 'task' AND t.id = l.from_id)
  WHERE t.deleted_at IS NULL
  ORDER BY (t.status = 'completed'), l.created_at
`;

export const LINKED_NOTES_QUERY = `
  SELECT n.id, n.title, n.body, n.link_title, n.source_url, n.updated_at
  FROM links l
  JOIN notes n
    ON (l.from_type = 'task' AND l.from_id = ? AND l.to_type = 'note' AND n.id = l.to_id)
    OR (l.to_type = 'task' AND l.to_id = ? AND l.from_type = 'note' AND n.id = l.from_id)
  WHERE n.deleted_at IS NULL
  ORDER BY n.updated_at DESC
`;

export type LinkedTaskRow = Pick<TaskRecord, 'title' | 'status' | 'priority' | 'due_date' | 'project_id'> & { id: string };
export type LinkedNoteRow = Pick<NoteRecord, 'title' | 'body' | 'link_title' | 'source_url' | 'updated_at'> & { id: string };

// --- React hooks ---

export function useLinkedTasks(noteId: string) {
  return useQuery<LinkedTaskRow>(LINKED_TASKS_QUERY, [noteId, noteId]);
}

export function useLinkedNotes(taskId: string) {
  return useQuery<LinkedNoteRow>(LINKED_NOTES_QUERY, [taskId, taskId]);
}

// --- Write helpers ---

export async function linkNoteToTask(
  db: AbstractPowerSyncDatabase,
  userId: string,
  noteId: string,
  taskId: string
): Promise<void> {
  const existing = await db.getOptional<{ id: string }>(
    `SELECT id FROM links WHERE ${PAIR_WHERE} LIMIT 1`,
    [noteId, taskId, taskId, noteId]
  );
  if (existing) return;
  await db.execute(
    `INSERT INTO links (id, user_id, from_type, from_id, to_type, to_id, origin, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [crypto.randomUUID(), userId, 'note', noteId, 'task', taskId, 'manual', new Date().toISOString()]
  );
}

export async function unlinkNoteFromTask(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  taskId: string
): Promise<void> {
  await db.execute(`DELETE FROM links WHERE ${PAIR_WHERE}`, [noteId, taskId, taskId, noteId]);
}

export async function deleteLinksFor(db: SqlExecutor, type: LinkEntityType, id: string): Promise<void> {
  await db.execute(
    `DELETE FROM links WHERE (from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?)`,
    [type, id, type, id]
  );
}
