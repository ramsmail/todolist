'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useTodayTasks, completeTask } from '@todolist/db';
import { TaskRow } from '@/components/tasks/TaskRow';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function TodayPage() {
  const db              = usePowerSync();
  const { data: tasks } = useTodayTasks();
  const [capture,  setCapture]  = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const today   = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.due_date && t.due_date < today);
  const dueToday = tasks.filter(t => t.due_date === today);

  const handleComplete = async (id: string) => { await completeTask(db as any, id); };

  const renderSection = (title: string, items: typeof tasks, titleClass = '') => (
    items.length > 0 && (
      <section aria-labelledby={`section-${title}`}>
        <h2
          id={`section-${title}`}
          className={`px-6 py-2 text-xs font-semibold uppercase tracking-wider border-b border-border ${titleClass || 'text-text-muted'}`}
        >
          {title}
        </h2>
        <div role="list">
          {items.map(task => (
            <TaskRow
              key={task.id}
              task={task as any}
              onPress={setDetailId}
              onComplete={handleComplete}
            />
          ))}
        </div>
      </section>
    )
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h1 className="text-text-primary text-xl font-bold">Today</h1>
          <button
            onClick={() => setCapture(true)}
            className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
          >
            + Add task
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-text-primary font-semibold text-lg">All done for today 🎉</p>
              <p className="text-text-muted text-sm">Nothing due today or overdue</p>
            </div>
          ) : (
            <>
              {renderSection('Overdue', overdue, 'text-p1')}
              {renderSection('Today', dueToday)}
            </>
          )}
        </div>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
      <QuickCaptureModal open={capture} onClose={() => setCapture(false)} />
    </div>
  );
}
