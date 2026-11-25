'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useQuery } from '@powersync/react';
import { completeTask } from '@todolist/db';
import { TaskRow } from '@/components/tasks/TaskRow';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function AllTasksPage() {
  const db = usePowerSync();
  const { data: tasks } = useQuery<{
    id: string; title: string; priority: number;
    due_date: string | null; status: string;
    labels: string | null; recurrence_rule: string | null;
  }>(
    `SELECT id, title, priority, due_date, status, labels, recurrence_rule
     FROM tasks
     WHERE status NOT IN ('completed', 'cancelled')
       AND deleted_at IS NULL
     ORDER BY priority, sort_order`
  );
  const [detailId, setDetailId] = useState<string | null>(null);

  const handleComplete = async (id: string) => { await completeTask(db as any, id); };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 pt-8 pb-4 border-b border-border">
          <h1 className="text-text-primary text-3xl font-bold">All Tasks</h1>
          <p className="text-text-muted text-sm mt-1">{tasks.length} active</p>
        </div>
        <div className="flex-1 overflow-y-auto scrollable px-6 pt-6 pb-6 space-y-2" role="list">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-text-primary font-semibold text-lg">No active tasks</p>
              <p className="text-text-muted text-sm">You're all caught up</p>
            </div>
          ) : (
            tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task as any}
                onPress={setDetailId}
                onComplete={handleComplete}
                draggable={true}
              />
            ))
          )}
        </div>
      </div>
      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
