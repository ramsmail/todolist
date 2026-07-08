import { describe, it, expect } from 'vitest';
import { LOGBOOK_QUERY, MATRIX_QUERY, groupTasksByPriority } from './tasks';

describe('LOGBOOK_QUERY', () => {
  it("selects only completed tasks", () => {
    expect(LOGBOOK_QUERY).toContain("status = 'completed'");
  });

  it("excludes soft-deleted tasks", () => {
    expect(LOGBOOK_QUERY).toContain("deleted_at IS NULL");
  });

  it("orders by updated_at descending", () => {
    expect(LOGBOOK_QUERY).toContain("updated_at DESC");
  });

  it("limits to 200 rows", () => {
    expect(LOGBOOK_QUERY).toContain("LIMIT 200");
  });
});

describe('MATRIX_QUERY', () => {
  it("excludes completed and cancelled tasks", () => {
    expect(MATRIX_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });

  it("excludes soft-deleted tasks", () => {
    expect(MATRIX_QUERY).toContain("deleted_at IS NULL");
  });

  it("orders by sort_order", () => {
    expect(MATRIX_QUERY).toContain("ORDER BY sort_order");
  });
});

describe('groupTasksByPriority', () => {
  it("buckets tasks into their priority group", () => {
    const tasks = [
      { id: 'a', priority: 1 },
      { id: 'b', priority: 3 },
      { id: 'c', priority: 1 },
    ];

    const groups = groupTasksByPriority(tasks);

    expect(groups[1].map(t => t.id)).toEqual(['a', 'c']);
    expect(groups[2]).toEqual([]);
    expect(groups[3].map(t => t.id)).toEqual(['b']);
    expect(groups[4]).toEqual([]);
  });

  it("preserves each group's relative order", () => {
    const tasks = [
      { id: 'first', priority: 2 },
      { id: 'second', priority: 2 },
    ];

    const groups = groupTasksByPriority(tasks);

    expect(groups[2].map(t => t.id)).toEqual(['first', 'second']);
  });

  it("defaults a null priority to group 4", () => {
    const tasks = [{ id: 'a', priority: null }];

    const groups = groupTasksByPriority(tasks);

    expect(groups[4].map(t => t.id)).toEqual(['a']);
  });
});
