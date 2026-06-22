import { memo } from 'react';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

export interface TaskRowItem {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
}

interface Props {
  task:       TaskRowItem;
  onPress:    (id: string) => void;
  onComplete: (id: string) => void;
}

function isOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().split('T')[0];
}

export const TaskRow = memo(function TaskRow({ task, onPress, onComplete }: Props) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5 border-b border-border hover:bg-surface-alt/40 group cursor-pointer transition-colors"
      role="listitem"
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onComplete(task.id); }}
        className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
        style={{ borderColor: PRIORITY_COLOR[task.priority] ?? '#9CA3AF' }}
        aria-label={`Complete ${task.title}`}
      />

      {/* Content */}
      <button
        onClick={() => onPress(task.id)}
        className="flex-1 text-left min-w-0 focus:outline-none"
        aria-label={`Open task: ${task.title}`}
      >
        <p className="text-text-primary text-sm truncate">{task.title}</p>
        {task.due_date && (
          <p className={`text-xs mt-0.5 ${isOverdue(task.due_date) ? 'text-p1' : 'text-text-muted'}`}>
            {task.due_date}
          </p>
        )}
      </button>

      {/* Priority badge */}
      <span
        className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
        style={{ color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}20` }}
        aria-label={`Priority ${task.priority}`}
      >
        P{task.priority}
      </span>
    </div>
  );
});
