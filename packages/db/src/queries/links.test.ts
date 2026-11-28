import { describe, it, expect, vi } from 'vitest';
import {
  linkNoteToTask,
  unlinkNoteFromTask,
  deleteLinksFor,
  LINKED_TASKS_QUERY,
  LINKED_NOTES_QUERY,
} from './links';

function fakeDb(existing: { id: string } | null = null) {
  return {
    getOptional: vi.fn().mockResolvedValue(existing),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

describe('linkNoteToTask', () => {
  it('inserts a note->task link', async () => {
    const db = fakeDb(null);
    await linkNoteToTask(db as any, 'u1', 'n1', 't1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO links');
    // id, user_id, from_type, from_id, to_type, to_id, origin, created_at
    expect(params.slice(1, 7)).toEqual(['u1', 'note', 'n1', 'task', 't1', 'manual']);
  });

  it('only writes to links: linking never changes the task', async () => {
    const db = fakeDb(null);
    await linkNoteToTask(db as any, 'u1', 'n1', 't1');
    expect(db.execute).toHaveBeenCalledTimes(1);
    const [sql] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO links');
    expect(sql).not.toMatch(/tasks|status/i);
  });

  it('is idempotent: no insert when the link already exists in either direction', async () => {
    const db = fakeDb({ id: 'l1' });
    await linkNoteToTask(db as any, 'u1', 'n1', 't1');
    expect(db.execute).not.toHaveBeenCalled();
    const [sql, params] = db.getOptional.mock.calls[0];
    expect(sql).toContain("from_type = 'note' AND from_id = ? AND to_type = 'task' AND to_id = ?");
    expect(sql).toContain("from_type = 'task' AND from_id = ? AND to_type = 'note' AND to_id = ?");
    expect(params).toEqual(['n1', 't1', 't1', 'n1']);
  });
});

describe('unlinkNoteFromTask', () => {
  it('hard-deletes the link in both directions', async () => {
    const db = fakeDb();
    await unlinkNoteFromTask(db as any, 'n1', 't1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('DELETE FROM links');
    expect(params).toEqual(['n1', 't1', 't1', 'n1']);
  });
});

describe('deleteLinksFor', () => {
  it('removes every link touching the entity', async () => {
    const db = fakeDb();
    await deleteLinksFor(db as any, 'note', 'n1');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('DELETE FROM links');
    expect(sql).toContain('(from_type = ? AND from_id = ?) OR (to_type = ? AND to_id = ?)');
    expect(params).toEqual(['note', 'n1', 'note', 'n1']);
  });
});

describe('linked-item queries', () => {
  it('LINKED_TASKS_QUERY reads both directions and hides deleted tasks', () => {
    expect(LINKED_TASKS_QUERY).toContain("l.from_type = 'note' AND l.from_id = ? AND l.to_type = 'task'");
    expect(LINKED_TASKS_QUERY).toContain("l.to_type = 'note' AND l.to_id = ? AND l.from_type = 'task'");
    expect(LINKED_TASKS_QUERY).toContain('t.deleted_at IS NULL');
  });
  it('LINKED_NOTES_QUERY reads both directions and hides deleted notes', () => {
    expect(LINKED_NOTES_QUERY).toContain("l.from_type = 'task' AND l.from_id = ? AND l.to_type = 'note'");
    expect(LINKED_NOTES_QUERY).toContain("l.to_type = 'task' AND l.to_id = ? AND l.from_type = 'note'");
    expect(LINKED_NOTES_QUERY).toContain('n.deleted_at IS NULL');
  });
});
