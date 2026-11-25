import { describe, it, expect } from 'vitest';
import { HARD_DELETE_TABLES, isHardDeleteTable } from './syncTables';

describe('isHardDeleteTable', () => {
  it('treats links as hard-delete (no deleted_at column)', () => {
    expect(isHardDeleteTable('links')).toBe(true);
  });

  it('keeps soft delete for tables with deleted_at', () => {
    for (const t of ['tasks', 'notes', 'projects', 'labels', 'reminders', 'attachments', 'saved_filters']) {
      expect(isHardDeleteTable(t)).toBe(false);
    }
  });

  it('exposes the list for connectors', () => {
    expect(HARD_DELETE_TABLES).toEqual(['links']);
  });
});
