import { memo } from 'react';
import { useLabels } from '@todolist/db';
import { LabelChip } from './LabelChip';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

export interface TaskRowItem {
  id:       string;
  title:    string;
  priority: number;
  due_date: string | null;
  status:   string;
  labels?:  string | null;
  recurrence_rule?: string | null;
}

interface Props {
  task:         TaskRowItem;
  onPress:      (id: string) => void;
  onComplete:   (id: string) => void;
  readOnly?:    boolean;
  completedAt?: string;
  tabIndex?:    number;
  draggable?:   boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?:   (e: React.DragEvent) => void;
}

function isOverdue(dueDate: string) {
  return dueDate < new Date().toISOString().split('T')[0];
}

export const TaskRow = memo(function TaskRow({
  task, onPress, onComplete, readOnly = false, completedAt, tabIndex, draggable = false, onDragStart, onDragEnd,
}: Props) {
  const { data: allLabels } = useLabels();
  const colorOf = (name: string) =>
    allLabels.find((l) => l.name === name)?.color ?? '#9CA3AF';
  const names: string[] = task.labels ? JSON.parse(task.labels) : [];

  return (
    <div
      className={`flex items-start gap-3 px-4 py-4 rounded-xl border border-border bg-surface hover:bg-surface-alt hover:shadow-sm group transition-all min-h-[80px] ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      role="listitem"
      tabIndex={readOnly ? undefined : (tabIndex ?? 0)}
      data-task-id={readOnly ? undefined : task.id}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Drag handle */}
      {draggable && (
        <div className="text-text-muted/50 hover:text-text-muted flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>
      )}

      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); if (!readOnly) onComplete(task.id); }}
        disabled={readOnly}
        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-accent
          ${readOnly ? 'opacity-40 cursor-default' : 'hover:bg-surface'}`}
        style={{ borderColor: PRIORITY_COLOR[task.priority] ?? '#9CA3AF' }}
        aria-label={readOnly ? `${task.title} (completed)` : `Complete ${task.title}`}
      />

      {/* Content */}
      <button
        onClick={() => onPress(task.id)}
        className="flex-1 text-left min-w-0 focus:outline-none"
        aria-label={`Open task: ${task.title}`}
      >
        <p className="text-text-primary text-sm truncate">{task.title}</p>
        {(names.length > 0 || task.recurrence_rule) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {task.recurrence_rule && (
              <span className="text-xs text-text-muted" aria-label="Recurring" title="Repeats">↻</span>
            )}
            {names.map((n) => <LabelChip key={n} name={n} color={colorOf(n)} />)}
          </div>
        )}
        {completedAt ? (
          <p className="text-xs mt-0.5 text-text-muted">
            Completed {completedAt.split('T')[0]}
          </p>
        ) : task.due_date ? (
          <p className={`text-xs mt-0.5 ${isOverdue(task.due_date) ? 'text-p1' : 'text-text-muted'}`}>
            {task.due_date}
          </p>
        ) : null}
      </button>

      {/* Priority badge */}
      <span
        className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
        style={{ color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}20` }}
        aria-label={`Priority ${task.priority}`}
      >
        P{task.priority}
      </span>

      {/* Chevron affordance */}
      <span className="text-text-muted group-hover:text-text-primary flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        →
      </span>
    </div>
  );
});
