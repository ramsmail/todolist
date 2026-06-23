import { describe, it, expect, vi } from 'vitest';
import { createSavedFilter, updateSavedFilter, deleteSavedFilter } from './savedFilters';

function makeMockDb(lastRow: { sort_order: string } | null = null) {
  return {
    execute:     vi.fn().mockResolvedValue(undefined),
    getOptional: vi.fn().mockResolvedValue(lastRow),
  } as any;
}

describe('createSavedFilter', () => {
  it('inserts a row and returns a UUID', async () => {
    const db = makeMockDb({ sort_order: 'a0' });
    const id = await createSavedFilter(db, {
      userId: 'u1',
      name:   'High priority this week',
      query:  '{"priority":[1],"dueDateRange":"this_week"}',
    });
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(36); // UUID format
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO saved_filters');
    expect(params).toContain('u1');
    expect(params).toContain('High priority this week');
  });

  it('inserts with an initial sort_order when no filters exist', async () => {
    const db = makeMockDb(null);
    const id = await createSavedFilter(db, { userId: 'u1', name: 'Test', query: '{}' });
    expect(typeof id).toBe('string');
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('inserts optional icon when provided', async () => {
    const db = makeMockDb(null);
    await createSavedFilter(db, { userId: 'u1', name: 'Test', icon: '🔥', query: '{}' });
    const [, params] = db.execute.mock.calls[0];
    expect(params).toContain('🔥');
  });
});

describe('updateSavedFilter', () => {
  it('updates only the name field when only name provided', async () => {
    const db = makeMockDb();
    await updateSavedFilter(db, 'id-1', { name: 'Renamed' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('name = ?');
    expect(sql).not.toContain('icon = ?');
    expect(sql).not.toContain('query = ?');
    expect(params).toContain('Renamed');
    expect(params).toContain('id-1');
  });

  it('updates query and icon when provided', async () => {
    const db = makeMockDb();
    await updateSavedFilter(db, 'id-2', { icon: '⭐', query: '{"priority":[2]}' });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('icon = ?');
    expect(sql).toContain('query = ?');
    expect(params).toContain('⭐');
  });
});

describe('deleteSavedFilter', () => {
  it('soft-deletes by setting deleted_at', async () => {
    const db = makeMockDb();
    await deleteSavedFilter(db, 'id-3');
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('deleted_at');
    expect(sql).toContain('UPDATE saved_filters');
    expect(params).toContain('id-3');
  });
});
