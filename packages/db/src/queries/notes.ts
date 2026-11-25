import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import { deleteLinksFor } from './links';
import type { NoteRecord } from '../schema';

export type NoteFields = {
  userId: string;
  title?: string;
  body?: string;
  projectId?: string | null;
  labels?: string[];
  sourceUrl?: string | null;
};

export type NoteListRow = Pick<
  NoteRecord,
  | 'title' | 'body' | 'link_title' | 'link_excerpt' | 'link_image_url' | 'link_site_name'
  | 'source_url' | 'link_status' | 'is_archived' | 'is_processed' | 'project_id'
  | 'labels' | 'conflict_of' | 'updated_at'
> & { id: string };

export const NOTE_LIST_COLUMNS = `id, title, body, link_title, link_excerpt, link_image_url, link_site_name,
         source_url, link_status, is_archived, is_processed, project_id, labels, conflict_of, updated_at`;

export const NOTES_LIST_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL AND is_archived = 0
  ORDER BY updated_at DESC
`;

export const NOTES_LIST_WITH_ARCHIVED_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL
  ORDER BY updated_at DESC
`;

export const NOTES_BY_PROJECT_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL AND is_archived = 0 AND project_id = ?
  ORDER BY updated_at DESC
`;

export const NOTE_QUERY = `SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL LIMIT 1`;

export const NOTES_INBOX_QUERY = `
  SELECT id, title, body, link_title, source_url, updated_at
  FROM notes
  WHERE deleted_at IS NULL AND is_processed = 0 AND is_archived = 0
  ORDER BY created_at DESC
`;

export function useNotesList(includeArchived = false) {
  return useQuery<NoteListRow>(includeArchived ? NOTES_LIST_WITH_ARCHIVED_QUERY : NOTES_LIST_QUERY);
}

export function useNotesByProject(projectId: string) {
  return useQuery<NoteListRow>(NOTES_BY_PROJECT_QUERY, [projectId]);
}

export function useNote(id: string) {
  return useQuery<NoteRecord>(NOTE_QUERY, [id]);
}

export function useNotesInbox() {
  return useQuery<
    Pick<NoteRecord, 'title' | 'body' | 'link_title' | 'source_url' | 'updated_at'> & { id: string }
  >(NOTES_INBOX_QUERY);
}

export async function createNote(
  db: AbstractPowerSyncDatabase,
  fields: NoteFields
): Promise<string> {
  const id = crypto.randomUUID();
  const sourceUrl = fields.sourceUrl ?? null;
  // base_revision, created_at, updated_at are inlined as SQL literals so the
  // params array stays at exactly 11 elements (id + 10 fields). This keeps
  // param indices stable and matches the test assertions.
  await db.execute(
    `INSERT INTO notes
       (id, user_id, title, body, project_id, labels, is_archived, is_processed,
        source_url, link_status, revision, base_revision, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,
             strftime('%Y-%m-%dT%H:%M:%fZ','now'),
             strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    [
      id,
      fields.userId,
      fields.title ?? '',
      fields.body ?? '',
      fields.projectId ?? null,
      JSON.stringify(fields.labels ?? []),
      0,
      0,
      sourceUrl,
      sourceUrl ? 'pending' : null,
      0,
    ]
  );
  return id;
}

export async function updateNote(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  patch: { body?: string; title?: string }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    params.push(patch.title);
  }
  if (patch.body !== undefined) {
    // Same statement, evaluated against the pre-update row: the server conflict
    // trigger compares base_revision with its stored revision. Reading the
    // revision here (not from the caller) keeps back-to-back autosaves chained.
    sets.push('body = ?', 'base_revision = revision', 'revision = revision + 1');
    params.push(patch.body);
  }
  sets.push('updated_at = ?');
  params.push(new Date().toISOString(), noteId);
  await db.execute(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function setNoteSourceUrl(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  url: string
): Promise<void> {
  await db.execute(
    `UPDATE notes SET source_url = ?, link_status = 'pending', updated_at = ? WHERE id = ?`,
    [url, new Date().toISOString(), noteId]
  );
}

export async function setNoteProject(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  projectId: string | null
): Promise<void> {
  await db.execute(
    `UPDATE notes SET project_id = ?, updated_at = ? WHERE id = ?`,
    [projectId, new Date().toISOString(), noteId]
  );
}

export async function setNoteLabels(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  labels: string[]
): Promise<void> {
  await db.execute(
    `UPDATE notes SET labels = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(labels), new Date().toISOString(), noteId]
  );
}

export async function archiveNote(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  archived: boolean
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE notes SET is_archived = ?, updated_at = ? WHERE id = ?`,
    [archived ? 1 : 0, now, noteId]
  );
}

export async function deleteNote(
  db: AbstractPowerSyncDatabase,
  noteId: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, noteId]
    );
    await deleteLinksFor(tx, 'note', noteId);
  });
}

export async function createLinkedTask(
  db: AbstractPowerSyncDatabase,
  opts: { userId: string; noteId: string; title: string }
): Promise<{ taskId: string }> {
  const taskId = crypto.randomUUID();
  const linkId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO tasks
         (id, user_id, title, description, status, priority, labels, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [taskId, opts.userId, opts.title, null, 'inbox', 4, '[]', generateKeyBetween(null, null), now, now]
    );
    await tx.execute(
      `INSERT INTO links (id, user_id, from_type, from_id, to_type, to_id, origin, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [linkId, opts.userId, 'note', opts.noteId, 'task', taskId, 'manual', now]
    );
  });
  return { taskId };
}

export async function createLinkedNote(
  db: AbstractPowerSyncDatabase,
  opts: { userId: string; taskId: string; title: string }
): Promise<{ noteId: string }> {
  const noteId = crypto.randomUUID();
  const linkId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.writeTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO notes
         (id, user_id, title, body, project_id, labels, is_archived, is_processed,
          source_url, link_status, revision, base_revision, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [noteId, opts.userId, opts.title, '', null, '[]', 0, 0, null, null, 0, 0, now, now]
    );
    await tx.execute(
      `INSERT INTO links (id, user_id, from_type, from_id, to_type, to_id, origin, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [linkId, opts.userId, 'task', opts.taskId, 'note', noteId, 'manual', now]
    );
  });
  return { noteId };
}
