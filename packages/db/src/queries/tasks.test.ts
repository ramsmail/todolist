import { describe, it, expect } from 'vitest';
import { LOGBOOK_QUERY } from './tasks';

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
