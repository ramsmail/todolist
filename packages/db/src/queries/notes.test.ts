import { describe, it, expect, vi } from 'vitest';
import {
  createNote,
  updateNote,
  archiveNote,
  deleteNote,
  createLinkedTask,
  createLinkedNote,
  NOTES_LIST_QUERY,
  NOTES_INBOX_QUERY,
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
  it('increments base_revision to match current revision before the write', async () => {
    const db = fakeDb();
    await updateNote(db as any, 'n1', { body: 'new body', revision: 3 });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET body = ?, base_revision = ?, revision = ?, updated_at = ?');
    expect(params[0]).toBe('new body');
    expect(params[1]).toBe(3);  // base_revision = old revision
    expect(params[2]).toBe(4);  // revision = old revision + 1
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
  it('soft-deletes the note', async () => {
    const db = fakeDb();
    await deleteNote(db as any, 'n1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET deleted_at = ?');
    expect(params[params.length - 1]).toBe('n1');
  });
});

describe('createLinkedTask', () => {
  it('inserts the task and the note->task link in one transaction', async () => {
    const db = fakeDb();
    await createLinkedTask(db as any, { userId: 'u1', noteId: 'n1', title: 'Fix it' });
    expect(db.writeTransaction).toHaveBeenCalledTimes(1);
    const tx = await db.writeTransaction.mock.results[0].value;
    expect(tx.execute).toHaveBeenCalledTimes(2);
    const [taskSql, taskParams] = tx.execute.mock.calls[0];
    expect(taskSql).toContain('INSERT INTO tasks');
    expect(taskParams.slice(1, 7)).toEqual(['u1', 'Fix it', null, 'todo', 1, 'note:n1']);
    const [linkSql] = tx.execute.mock.calls[1];
    expect(linkSql).toContain('INSERT INTO links');
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
  it('NOTES_LIST_QUERY excludes deleted notes', () => {
    expect(NOTES_LIST_QUERY).toContain('deleted_at IS NULL');
  });
  it('NOTES_LIST_QUERY excludes conflict copies', () => {
    expect(NOTES_LIST_QUERY).toContain('conflict_of IS NULL');
  });
  it('NOTES_INBOX_QUERY filters for unprocessed, non-archived notes', () => {
    expect(NOTES_INBOX_QUERY).toContain('is_processed = 0');
    expect(NOTES_INBOX_QUERY).toContain('is_archived = 0');
  });
});
