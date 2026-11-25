import { useQuery } from '@powersync/react';
import type { TaskRecord } from '../schema';
import { NOTE_LIST_COLUMNS, type NoteListRow } from './notes';

// v1 search is a local SQLite LIKE. FTS5 can replace these two functions later
// without any UI change.

export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function toLikePattern(term: string): string {
  return `%${escapeLike(term.trim())}%`;
}

export const NOTE_SEARCH_QUERY = `
  SELECT ${NOTE_LIST_COLUMNS}
  FROM notes
  WHERE deleted_at IS NULL
    AND (? = 1 OR is_archived = 0)
    AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR link_title LIKE ? ESCAPE '\\')
  ORDER BY updated_at DESC
  LIMIT 50
`;

export const TASK_SEARCH_QUERY = `
  SELECT id, title, priority, due_date, due_time, status, sort_order, labels, recurrence_rule
  FROM tasks
  WHERE deleted_at IS NULL
    AND status NOT IN ('completed', 'cancelled')
    AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
  ORDER BY updated_at DESC
  LIMIT 50
`;

export type TaskSearchRow = Pick<
  TaskRecord,
  'title' | 'priority' | 'due_date' | 'due_time' | 'status' | 'sort_order' | 'labels' | 'recurrence_rule'
> & { id: string };

export function useNoteSearch(term: string, includeArchived = false) {
  const p = toLikePattern(term);
  return useQuery<NoteListRow>(NOTE_SEARCH_QUERY, [includeArchived ? 1 : 0, p, p, p]);
}

export function useTaskSearch(term: string) {
  const p = toLikePattern(term);
  return useQuery<TaskSearchRow>(TASK_SEARCH_QUERY, [p, p]);
}
