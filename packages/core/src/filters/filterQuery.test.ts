import { describe, it, expect } from 'vitest';
import {
  serializeFilterQuery, parseFilterQuery, isEmptyFilterQuery,
  type FilterQuery,
} from './index';

describe('serializeFilterQuery / parseFilterQuery', () => {
  it('round-trips a full query', () => {
    const q: FilterQuery = {
      priority: [1, 2],
      dueDateRange: 'this_week',
      labels: ['home', 'work'],
      projectId: 'proj-1',
    };
    expect(parseFilterQuery(serializeFilterQuery(q))).toEqual(q);
  });

  it('round-trips a partial query (priority only)', () => {
    const q: FilterQuery = { priority: [3] };
    expect(parseFilterQuery(serializeFilterQuery(q))).toEqual(q);
  });

  it('round-trips null projectId (explicit no-project criterion)', () => {
    const q: FilterQuery = { projectId: null };
    expect(parseFilterQuery(serializeFilterQuery(q))).toEqual(q);
  });

  it('returns empty object for invalid JSON', () => {
    expect(parseFilterQuery('not json')).toEqual({});
  });
});

describe('isEmptyFilterQuery', () => {
  it('returns true for empty object', () => {
    expect(isEmptyFilterQuery({})).toBe(true);
  });

  it('returns true when all arrays are empty', () => {
    expect(isEmptyFilterQuery({ priority: [], labels: [] })).toBe(true);
  });

  it('returns false when priority is set', () => {
    expect(isEmptyFilterQuery({ priority: [1] })).toBe(false);
  });

  it('returns false when dueDateRange is set', () => {
    expect(isEmptyFilterQuery({ dueDateRange: 'today' })).toBe(false);
  });

  it('returns false when labels is set', () => {
    expect(isEmptyFilterQuery({ labels: ['home'] })).toBe(false);
  });

  it('returns false when projectId is null (explicit no-project criterion)', () => {
    expect(isEmptyFilterQuery({ projectId: null })).toBe(false);
  });
});
