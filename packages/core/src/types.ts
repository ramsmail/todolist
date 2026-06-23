export type Priority = 1 | 2 | 3 | 4;
export type TaskStatus = 'inbox' | 'active' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;   // 'YYYY-MM-DD'
  dueTime: string | null;   // 'HH:mm'
  timezone: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  recurrenceRule: string | null;
  recurrenceStart: string | null;
  labels: string[];
  sortOrder: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
  sortOrder: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type FilterQuery = {
  priority?: Priority[];
  labels?: string[];
  projectId?: string | null;
  dueDateRange?: 'today' | 'this_week' | 'next_week' | 'overdue' | 'no_date';
};

export function serializeFilterQuery(query: FilterQuery): string {
  return JSON.stringify(query);
}

export function isEmptyFilterQuery(query: FilterQuery): boolean {
  return (
    (!query.priority || query.priority.length === 0) &&
    (!query.labels || query.labels.length === 0) &&
    query.projectId === undefined &&
    query.dueDateRange === undefined
  );
}
