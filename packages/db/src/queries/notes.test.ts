import { describe, it, expect, vi } from 'vitest';
import {
  createNote,
  updateNote,
  archiveNote,
  deleteNote,
  createLinkedTask,
  createLinkedNote,
  setNoteSourceUrl,
  setNoteProject,
  setNoteLabels,
  NOTES_LIST_QUERY,
  NOTES_INBOX_QUERY,
  NOTES_LIST_WITH_ARCHIVED_QUERY,
  NOTES_BY_PROJECT_QUERY,
  NOTE_QUERY,
} from './notes';

function fakeDb() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    writeTransaction: vi.fn(async (fn: (tx: { execute: typeof vi.fn }) => Promise<void>) => {
      const tx = { execute: vi.fn().mockResolvedValue(undefined) };
      await fn(tx as any);
      return tx;
    }),
  };
}

describe('createNote', () => {
  it('inserts the note with the expected columns', async () => {
    const db = fakeDb();
    await createNote(db as any, {
      userId: 'u1',
      title: 'Plan',
      body: '# Plan',
    });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO notes');
    // params[0] = id (uuid), params[1..11]:
    expect(params.slice(1, 12)).toEqual([
      'u1', 'Plan', '# Plan', null, '[]', 0, 0, null, null, 0,
    ]);
  });

  it('sets link_status to pending when a source_url is provided', async () => {
    const db = fakeDb();
    await createNote(db as any, { userId: 'u1', sourceUrl: 'https://example.com' });
    const [, params] = db.execute.mock.calls[0];
    expect(params[8]).toBe('https://example.com');  // source_url
    expect(params[9]).toBe('pending');               // link_status
  });
});

describe('updateNote', () => {
  it('bumps the revision chain in SQL when the body changes', async () => {
    const db = fakeDb();
    await updateNote(db as any, 'n1', { body: 'new body' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('body = ?');
    // evaluated against the pre-update row, so base_revision = old, revision = old + 1
    expect(sql).toContain('base_revision = revision');
    expect(sql).toContain('revision = revision + 1');
    expect(params).toEqual(['new body', expect.any(String), 'n1']);
  });

  it('leaves the revision columns alone for a title-only change', async () => {
    const db = fakeDb();
    await updateNote(db as any, 'n1', { title: 'Plan' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).not.toContain('revision');
    expect(params).toEqual(['Plan', expect.any(String), 'n1']);
  });

  it('writes title and body together, bumping once', async () => {
    const db = fakeDb();
    await updateNote(db as any, 'n1', { title: 'T', body: 'B' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('title = ?');
    expect(sql).toContain('revision = revision + 1');
    expect(params).toEqual(['T', 'B', expect.any(String), 'n1']);
  });
});

describe('setNoteSourceUrl', () => {
  it('stores the url and marks the preview pending', async () => {
    const db = fakeDb();
    await setNoteSourceUrl(db as any, 'n1', 'https://example.com');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET source_url = ?');
    expect(sql).toContain("link_status = 'pending'");
    expect(params).toEqual(['https://example.com', expect.any(String), 'n1']);
  });
});

describe('setNoteProject / setNoteLabels', () => {
  it('setNoteProject updates project_id without touching revisions', async () => {
    const db = fakeDb();
    await setNoteProject(db as any, 'n1', 'p1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET project_id = ?');
    expect(sql).not.toContain('revision');
    expect(params).toEqual(['p1', expect.any(String), 'n1']);
  });

  it('setNoteLabels stores the labels as a JSON array', async () => {
    const db = fakeDb();
    await setNoteLabels(db as any, 'n1', ['work', 'idea']);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET labels = ?');
    expect(sql).not.toContain('revision');
    expect(params).toEqual(['["work","idea"]', expect.any(String), 'n1']);
  });
});

describe('archiveNote', () => {
  it('sets is_archived = 1', async () => {
    const db = fakeDb();
    await archiveNote(db as any, 'n1', true);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET is_archived = ?, updated_at = ?');
    expect(params[0]).toBe(1);
    expect(params[2]).toBe('n1');
  });
});

describe('deleteNote', () => {
  it('soft-deletes the note and removes its links in one transaction', async () => {
    const db = fakeDb();
    await deleteNote(db as any, 'n1');
    expect(db.writeTransaction).toHaveBeenCalledTimes(1);
    const tx = await db.writeTransaction.mock.results[0].value;

    const [sql, params] = tx.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET deleted_at = ?');
    expect(params[params.length - 1]).toBe('n1');

    const [linkSql, linkParams] = tx.execute.mock.calls[1];
    expect(linkSql).toContain('DELETE FROM links');
    expect(linkParams).toEqual(['note', 'n1', 'note', 'n1']);
  });
});

describe('createLinkedTask', () => {
  it('inserts a task that satisfies the Postgres constraints, and the note->task link, in one transaction', async () => {
    const db = fakeDb();
    await createLinkedTask(db as any, { userId: 'u1', noteId: 'n1', title: 'Fix it' });
    expect(db.writeTransaction).toHaveBeenCalledTimes(1);
    const tx = await db.writeTransaction.mock.results[0].value;
    expect(tx.execute).toHaveBeenCalledTimes(2);

    const [taskSql, taskParams] = tx.execute.mock.calls[0];
    expect(taskSql).toContain('INSERT INTO tasks');
    // id, user_id, title, description, status, priority, labels, sort_order, created_at, updated_at
    // status must be one Postgres allows; priority 4 = normal; labels NOT NULL; sort_order a valid fractional key
    expect(taskParams.slice(1, 8)).toEqual(['u1', 'Fix it', null, 'inbox', 4, '[]', 'a0']);

    const [linkSql, linkParams] = tx.execute.mock.calls[1];
    expect(linkSql).toContain('INSERT INTO links');
    expect(linkParams.slice(1, 7)).toEqual(['u1', 'note', 'n1', 'task', taskParams[0], 'manual']);
  });
});

describe('createLinkedNote', () => {
  it('inserts the note and the task->note link in one transaction', async () => {
    const db = fakeDb();
    await createLinkedNote(db as any, { userId: 'u1', taskId: 't1', title: 'Context' });
    expect(db.writeTransaction).toHaveBeenCalledTimes(1);
    const tx = await db.writeTransaction.mock.results[0].value;
    expect(tx.execute).toHaveBeenCalledTimes(2);
    const [noteSql, noteParams] = tx.execute.mock.calls[0];
    expect(noteSql).toContain('INSERT INTO notes');
    expect(noteParams.slice(1, 7)).toEqual(['u1', 'Context', '', null, '[]', 0]);
    const [linkSql] = tx.execute.mock.calls[1];
    expect(linkSql).toContain('INSERT INTO links');
  });
});

describe('query constants', () => {
  it('NOTES_LIST_QUERY excludes deleted and archived notes', () => {
    expect(NOTES_LIST_QUERY).toContain('deleted_at IS NULL');
    expect(NOTES_LIST_QUERY).toContain('is_archived = 0');
  });
  it('NOTES_LIST_QUERY includes conflict copies so they can be found and resolved', () => {
    expect(NOTES_LIST_QUERY).not.toContain('conflict_of IS NULL');
    expect(NOTES_LIST_QUERY).toContain('conflict_of');
  });
  it('NOTES_LIST_QUERY selects what a list row renders', () => {
    for (const col of ['link_excerpt', 'link_image_url', 'link_site_name', 'source_url', 'link_status', 'labels', 'project_id']) {
      expect(NOTES_LIST_QUERY).toContain(col);
    }
  });
  it('NOTES_LIST_WITH_ARCHIVED_QUERY keeps archived notes', () => {
    expect(NOTES_LIST_WITH_ARCHIVED_QUERY).toContain('deleted_at IS NULL');
    expect(NOTES_LIST_WITH_ARCHIVED_QUERY).not.toContain('is_archived = 0');
  });
  it('NOTES_BY_PROJECT_QUERY filters by project and hides archived', () => {
    expect(NOTES_BY_PROJECT_QUERY).toContain('project_id = ?');
    expect(NOTES_BY_PROJECT_QUERY).toContain('is_archived = 0');
    expect(NOTES_BY_PROJECT_QUERY).toContain('deleted_at IS NULL');
  });
  it('NOTE_QUERY loads one live note by id', () => {
    expect(NOTE_QUERY).toContain('WHERE id = ?');
    expect(NOTE_QUERY).toContain('deleted_at IS NULL');
  });
  it('NOTES_INBOX_QUERY filters for unprocessed, non-archived notes', () => {
    expect(NOTES_INBOX_QUERY).toContain('is_processed = 0');
    expect(NOTES_INBOX_QUERY).toContain('is_archived = 0');
  });
});
