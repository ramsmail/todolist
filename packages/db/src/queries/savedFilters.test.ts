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

import { buildFilterSQL } from './savedFilters';

describe('buildFilterSQL', () => {
  it('always excludes completed and cancelled tasks', () => {
    const { sql } = buildFilterSQL({});
    expect(sql).toContain("NOT IN ('completed', 'cancelled')");
    expect(sql).toContain('deleted_at IS NULL');
  });

  it('filters by priority with IN clause', () => {
    const { sql, params } = buildFilterSQL({ priority: [1, 2] });
    expect(sql).toContain('priority IN (?, ?)');
    expect(params).toContain(1);
    expect(params).toContain(2);
  });

  it('filters by specific projectId', () => {
    const { sql, params } = buildFilterSQL({ projectId: 'p1' });
    expect(sql).toContain('project_id = ?');
    expect(params).toContain('p1');
  });

  it('filters for no-project when projectId is null', () => {
    const { sql, params } = buildFilterSQL({ projectId: null });
    expect(sql).toContain('project_id IS NULL');
    expect(params).not.toContain(null);
  });

  it('filters by labels with OR logic using json_each', () => {
    const { sql, params } = buildFilterSQL({ labels: ['home', 'work'] });
    expect(sql).toContain('json_each');
    expect(sql).toContain('OR');
    expect(params).toContain('home');
    expect(params).toContain('work');
  });

  it('filters for today using SQLite date() function', () => {
    const { sql, params } = buildFilterSQL({ dueDateRange: 'today' });
    expect(sql).toContain("date('now')");
    expect(params).toHaveLength(0);
  });

  it('filters for this_week as a rolling +1 to +7 days window', () => {
    const { sql } = buildFilterSQL({ dueDateRange: 'this_week' });
    expect(sql).toContain("+1 day");
    expect(sql).toContain("+7 days");
  });

  it('filters for next_week as a rolling +8 to +14 days window', () => {
    const { sql } = buildFilterSQL({ dueDateRange: 'next_week' });
    expect(sql).toContain("+8 days");
    expect(sql).toContain("+14 days");
  });

  it('filters overdue tasks', () => {
    const { sql } = buildFilterSQL({ dueDateRange: 'overdue' });
    expect(sql).toContain("due_date < date('now')");
    expect(sql).toContain('IS NOT NULL');
  });

  it('filters tasks with no date', () => {
    const { sql } = buildFilterSQL({ dueDateRange: 'no_date' });
    expect(sql).toContain('due_date IS NULL');
  });

  it('ANDs multiple criteria together', () => {
    const { sql, params } = buildFilterSQL({ priority: [1], projectId: 'p1' });
    expect(sql).toContain('priority IN');
    expect(sql).toContain('project_id = ?');
    expect(params).toContain(1);
    expect(params).toContain('p1');
  });
});
