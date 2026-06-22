'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useInboxTasks, completeTask } from '@todolist/db';
import { TaskList } from '@/components/tasks/TaskList';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function InboxPage() {
  const db               = usePowerSync();
  const { data: tasks }  = useInboxTasks();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h1 className="text-text-primary text-xl font-bold">Inbox</h1>
          <button
            onClick={() => setCapture(true)}
            className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
            aria-label="Add task"
          >
            + Add task
          </button>
        </div>

        {/* Task list or empty */}
        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-text-primary font-semibold text-lg">Inbox is clear</p>
            <p className="text-text-muted text-sm">Click "+ Add task" to capture something</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TaskList
              tasks={tasks as any}
              onPress={setDetailId}
              onComplete={handleComplete}
            />
          </div>
        )}
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />

      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </div>
  );
}
