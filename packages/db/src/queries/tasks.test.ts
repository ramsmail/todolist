import { describe, it, expect } from 'vitest';
import { LOGBOOK_QUERY, TODAY_QUERY, FOCUS_TASKS_QUERY, TODAY_STATS_QUERY } from './tasks';

describe('TODAY_QUERY', () => {
  it('includes in_focus field', () => {
    expect(TODAY_QUERY).toContain('in_focus');
  });

  it('includes due_time field', () => {
    expect(TODAY_QUERY).toContain('due_time');
  });
});

describe('FOCUS_TASKS_QUERY', () => {
  it('filters on in_focus = 1', () => {
    expect(FOCUS_TASKS_QUERY).toContain('in_focus = 1');
  });

  it('excludes completed and cancelled tasks', () => {
    expect(FOCUS_TASKS_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
  });
});

describe('TODAY_STATS_QUERY', () => {
  it('counts completed tasks', () => {
    expect(TODAY_STATS_QUERY).toContain("status = 'completed'");
    expect(TODAY_STATS_QUERY).toContain('completed');
  });

  it('scopes to today', () => {
    expect(TODAY_STATS_QUERY).toContain("date('now')");
  });
});

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
