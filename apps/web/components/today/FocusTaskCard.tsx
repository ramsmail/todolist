'use client';

import { memo } from 'react';
import { useLabels } from '@todolist/db';
import { LabelChip } from '@/components/tasks/LabelChip';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#3B82F6', 4: '#9CA3AF',
};

interface FocusTaskItem {
  id:             string;
  title:          string;
  priority:       number;
  due_date?:      string | null;
  due_time?:      string | null;
  labels?:        string | null;
  project_name?:  string | null;
  project_color?: string | null;
}

interface Props {
  task:           FocusTaskItem;
  onPress:        (id: string) => void;
  onComplete:     (id: string) => void;
  onToggleFocus:  (id: string) => void;
}

export const FocusTaskCard = memo(function FocusTaskCard({
  task, onPress, onComplete, onToggleFocus,
}: Props) {
  const { data: allLabels } = useLabels();
  const colorOf = (name: string) => allLabels.find(l => l.name === name)?.color ?? '#9CA3AF';
  const names: string[] = task.labels ? JSON.parse(task.labels) : [];

  return (
    <div className="relative border border-border rounded-xl bg-surface-alt/60 overflow-hidden group">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent rounded-l-xl" />

      <div className="pl-4 pr-3 py-3 flex items-start gap-3">
        <button
          onClick={e => { e.stopPropagation(); onComplete(task.id); }}
          className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ borderColor: PRIORITY_COLOR[task.priority] ?? '#9CA3AF' }}
          aria-label={`Complete ${task.title}`}
        />

        <button
          onClick={() => onPress(task.id)}
          className="flex-1 text-left min-w-0 focus:outline-none"
          aria-label={`Open task: ${task.title}`}
        >
          <p className="text-text-primary text-sm font-medium">{task.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.project_name && (
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.project_color ?? '#6366F1' }}
                />
                {task.project_name}
              </span>
            )}
            {task.due_time && (
              <span className="text-xs text-text-muted">· {task.due_time.slice(0, 5)}</span>
            )}
            {names.map(n => <LabelChip key={n} name={n} color={colorOf(n)} />)}
          </div>
        </button>

        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
          style={{ color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}20` }}
          aria-label={`Priority ${task.priority}`}
        >
          P{task.priority}
        </span>

        <button
          onClick={e => { e.stopPropagation(); onToggleFocus(task.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary flex-shrink-0 mt-0.5 focus:outline-none focus:opacity-100"
          aria-label={`Remove ${task.title} from focus`}
          title="Remove from focus"
        >
          📌
        </button>
      </div>
    </div>
  );
});
