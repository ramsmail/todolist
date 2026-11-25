'use client';

import { useState } from 'react';
import { usePowerSync, useQuery } from '@powersync/react';
import { completeTask, updateTaskPriority } from '@todolist/db';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { MatrixQuadrant } from './MatrixQuadrant';
import type { TaskRowItem } from '@/components/tasks/TaskRow';

const MATRIX_QUERY = `
  SELECT id, title, priority, labels, status, due_date, recurrence_rule, sort_order
  FROM tasks
  WHERE status NOT IN ('completed', 'cancelled')
    AND deleted_at IS NULL
  ORDER BY sort_order
`;

export default function MatrixPage() {
  const db = usePowerSync();
  const { data: tasks } = useQuery<TaskRowItem & { sort_order: string }>(MATRIX_QUERY);
  const [detailId, setDetailId]       = useState<string | null>(null);
  const [showCapture, setShowCapture] = useState(false);

  const byQuadrant = (p: number) => tasks.filter(t => t.priority === p);

  const handleDrop = async (taskId: string, targetQuadrant: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.priority === targetQuadrant) return;
    await updateTaskPriority(db as any, taskId, targetQuadrant);
  };

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-6 pt-8 pb-4 border-b border-border flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-3xl font-bold">Task Matrix</h1>
            <p className="text-text-muted text-sm mt-1">
              Eisenhower decision framework — prioritize by urgency and importance
            </p>
          </div>
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 bg-accent text-white font-semibold rounded-xl px-4 py-2 text-sm hover:bg-accent-dark transition-colors"
          >
            + Add Task
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 h-full min-h-[600px]" style={{ gridTemplateRows: '1fr 1fr' }}>
            {([1, 2, 3, 4] as const).map(q => (
              <MatrixQuadrant
                key={q}
                quadrant={q}
                tasks={byQuadrant(q)}
                onTaskPress={setDetailId}
                onTaskComplete={handleComplete}
                onDropTask={handleDrop}
              />
            ))}
          </div>
        </div>
      </div>
      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={showCapture} onClose={() => setShowCapture(false)} />
    </div>
  );
}
