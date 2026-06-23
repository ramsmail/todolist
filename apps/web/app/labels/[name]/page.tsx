'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useTasksByLabel, completeTask } from '@todolist/db';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

export default function LabelPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const db = usePowerSync();
  const { data: tasks } = useTasksByLabel(name);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex-1 flex flex-col h-screen">
      <header className="px-6 py-5 border-b border-border">
        <h1 className="text-text-primary text-xl font-bold">@{name}</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        {tasks.length === 0 ? (
          <p className="p-6 text-text-muted text-sm">No tasks with this label.</p>
        ) : (
          <TaskList
            tasks={tasks as any}
            onPress={setSelected}
            onComplete={(id) => completeTask(db as any, id)}
          />
        )}
      </div>
      <TaskDetailPanel taskId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
