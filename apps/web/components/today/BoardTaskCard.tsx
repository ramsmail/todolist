'use client';

import { memo } from 'react';
import { useLabels } from '@todolist/db';
import { LabelChip } from '@/components/tasks/LabelChip';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

interface BoardTaskCardItem {
  id:             string;
  title:          string | null;
  priority:       number | null;
  due_date?:      string | null;
  due_time?:      string | null;
  labels?:        string | null;
  project_name?:  string | null;
  project_color?: string | null;
  in_focus?:      number | null;
}

interface Props {
  task:           BoardTaskCardItem;
  onPress:        (id: string) => void;
  onComplete:     (id: string) => void;
  onToggleFocus:  (id: string) => void;
  draggable:      boolean;
  onDragStart:    (e: React.DragEvent) => void;
  onDragEnd:      (e: React.DragEvent) => void;
}

export const BoardTaskCard = memo(function BoardTaskCard({
  task, onPress, onComplete, onToggleFocus, draggable, onDragStart, onDragEnd,
}: Props) {
  const { data: allLabels } = useLabels();
  const colorOf = (name: string) => allLabels.find(l => l.name === name)?.color ?? '#9CA3AF';
  const names: string[] = task.labels ? JSON.parse(task.labels) : [];

  return (
    <div
      className={`relative border border-border rounded-lg bg-surface-alt/60 overflow-hidden group ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: PRIORITY_COLOR[task.priority ?? 4] }} />

      <div className="pl-3 pr-2 py-2.5 flex items-start gap-2">
        <button
          onClick={e => { e.stopPropagation(); onComplete(task.id); }}
          className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ borderColor: PRIORITY_COLOR[task.priority ?? 4] ?? '#9CA3AF' }}
          aria-label={`Complete ${task.title}`}
        />

        <button
          onClick={() => onPress(task.id)}
          className="flex-1 text-left min-w-0 focus:outline-none"
          aria-label={`Open task: ${task.title}`}
        >
          <p className="text-text-primary text-sm font-medium line-clamp-2">{task.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {task.project_name && (
              <span className="flex items-center gap-1 text-xs text-text-muted">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.project_color ?? '#6366F1' }}
                />
                <span className="truncate">{task.project_name}</span>
              </span>
            )}
            {task.due_time && (
              <span className="text-xs text-text-muted">· {task.due_time.slice(0, 5)}</span>
            )}
          </div>
          {names.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {names.slice(0, 2).map(n => <LabelChip key={n} name={n} color={colorOf(n)} />)}
              {names.length > 2 && <span className="text-xs text-text-muted">+{names.length - 2}</span>}
            </div>
          )}
        </button>

        {task.in_focus === 1 && (
          <span className="text-xs flex-shrink-0">📌</span>
        )}

        <button
          onClick={e => { e.stopPropagation(); onToggleFocus(task.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary flex-shrink-0 focus:outline-none focus:opacity-100"
          aria-label={task.in_focus === 1 ? `Unpin ${task.title}` : `Pin ${task.title}`}
          title={task.in_focus === 1 ? 'Unpin from focus' : 'Pin to focus'}
        >
          {task.in_focus === 1 ? '📍' : '📌'}
        </button>
      </div>
    </div>
  );
});
