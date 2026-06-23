'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useUpcomingTasks, completeTask } from '@todolist/db';
import { TaskRow } from '@/components/tasks/TaskRow';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

function groupByDate(tasks: any[]): { date: string; tasks: any[] }[] {
  const map = new Map<string, any[]>();
  for (const t of tasks) {
    const d = t.due_date ?? 'No date';
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(t);
  }
  return Array.from(map.entries()).map(([date, tasks]) => ({ date, tasks }));
}

function formatDate(iso: string) {
  if (iso === 'No date') return iso;
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export default function UpcomingPage() {
  const db              = usePowerSync();
  const { data: tasks } = useUpcomingTasks();
  const [detailId, setDetailId] = useState<string | null>(null);
  const groups = groupByDate(tasks);

  const handleComplete = async (id: string) => { await completeTask(db as any, id); };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-border">
          <h1 className="text-text-primary text-xl font-bold">Upcoming</h1>
        </div>

        <div className="flex-1 overflow-y-auto scrollable">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-text-primary font-semibold text-lg">Nothing upcoming</p>
              <p className="text-text-muted text-sm">Tasks due in the next 7 days appear here</p>
            </div>
          ) : (
            groups.map(({ date, tasks: groupTasks }) => (
              <section key={date} aria-labelledby={`date-${date}`}>
                <h2
                  id={`date-${date}`}
                  className="px-6 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border"
                >
                  {formatDate(date)}
                </h2>
                <div role="list">
                  {groupTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onPress={setDetailId}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
