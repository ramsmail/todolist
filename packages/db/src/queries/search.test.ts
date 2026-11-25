import { describe, it, expect } from 'vitest';
import { escapeLike, toLikePattern, NOTE_SEARCH_QUERY, TASK_SEARCH_QUERY } from './search';

describe('escapeLike / toLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
  it('wraps the trimmed term in wildcards', () => {
    expect(toLikePattern('  plan ')).toBe('%plan%');
  });
});

describe('NOTE_SEARCH_QUERY', () => {
  it('searches title, body and link_title with an escape clause', () => {
    for (const col of ['title', 'body', 'link_title']) {
      expect(NOTE_SEARCH_QUERY).toContain(`${col} LIKE ? ESCAPE '\\'`);
    }
  });
  it('excludes deleted notes, and archived ones unless asked', () => {
    expect(NOTE_SEARCH_QUERY).toContain('deleted_at IS NULL');
    expect(NOTE_SEARCH_QUERY).toContain('(? = 1 OR is_archived = 0)');
  });
  it('caps the result count', () => {
    expect(NOTE_SEARCH_QUERY).toContain('LIMIT 50');
  });
});

describe('TASK_SEARCH_QUERY', () => {
  it('searches title and description, hides finished and deleted tasks', () => {
    expect(TASK_SEARCH_QUERY).toContain(`title LIKE ? ESCAPE '\\'`);
    expect(TASK_SEARCH_QUERY).toContain(`description LIKE ? ESCAPE '\\'`);
    expect(TASK_SEARCH_QUERY).toContain("status NOT IN ('completed', 'cancelled')");
    expect(TASK_SEARCH_QUERY).toContain('deleted_at IS NULL');
  });
  it('selects the columns TaskRow renders', () => {
    expect(TASK_SEARCH_QUERY).toContain('SELECT id, title, priority, due_date, due_time, status, sort_order, labels, recurrence_rule');
  });
});
