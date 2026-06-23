export interface FilterQuery {
  priority?:     (1 | 2 | 3 | 4)[];
  dueDateRange?: 'today' | 'this_week' | 'next_week' | 'overdue' | 'no_date';
  labels?:       string[];
  projectId?:    string | null;
}

export function serializeFilterQuery(q: FilterQuery): string {
  return JSON.stringify(q);
}

export function parseFilterQuery(s: string): FilterQuery {
  try {
    return JSON.parse(s) as FilterQuery;
  } catch {
    return {};
  }
}

export function isEmptyFilterQuery(q: FilterQuery): boolean {
  return (
    (!q.priority || q.priority.length === 0) &&
    !q.dueDateRange &&
    (!q.labels || q.labels.length === 0) &&
    q.projectId === undefined
  );
}
