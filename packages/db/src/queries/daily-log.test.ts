import { describe, it, expect, vi } from 'vitest';
import { setEnergy } from './daily-log';
import { TOP_PRIORITIES_QUERY } from './tasks';

function fakeDb(existing: { id: string } | null) {
  return {
    getOptional: vi.fn().mockResolvedValue(existing),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

describe('setEnergy', () => {
  it('inserts a new row when none exists for today', async () => {
    const db = fakeDb(null);
    await setEnergy(db as any, 'user-1', 4);

    expect(db.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO daily_log');
    // params: id, user_id, log_date, energy_level, created_at, updated_at
    expect(params[1]).toBe('user-1');
    expect(params[3]).toBe(4);
  });

  it('updates the existing row instead of inserting', async () => {
    const db = fakeDb({ id: 'row-9' });
    await setEnergy(db as any, 'user-1', 2);

    expect(db.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE daily_log');
    expect(params[0]).toBe(2);       // energy_level
    expect(params[2]).toBe('row-9'); // WHERE id
  });

  it('scopes the existence check to the user and today', async () => {
    const db = fakeDb(null);
    const today = new Date().toISOString().split('T')[0];
    await setEnergy(db as any, 'user-1', 3);

    const [, params] = db.getOptional.mock.calls[0];
    expect(params).toEqual(['user-1', today]);
  });
});

describe('TOP_PRIORITIES_QUERY', () => {
  it('excludes completed and cancelled tasks', () => {
    expect(TOP_PRIORITIES_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });

  it('excludes soft-deleted tasks', () => {
    expect(TOP_PRIORITIES_QUERY).toContain('deleted_at IS NULL');
  });

  it('surfaces focused tasks first, then by priority', () => {
    expect(TOP_PRIORITIES_QUERY).toContain('ORDER BY in_focus DESC, priority, sort_order');
  });

  it('limits to three rows', () => {
    expect(TOP_PRIORITIES_QUERY).toContain('LIMIT 3');
  });
});
