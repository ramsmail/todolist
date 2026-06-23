'use client';

import { use } from 'react';
import { useSavedFilters, useFilteredTasks, completeTask } from '@todolist/db';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default function FilterPage({ params }: Props) {
  const { id } = use(params);
  const db     = usePowerSync();
  const { userId } = useCurrentUser();

  const { data: filters }  = useSavedFilters(userId ?? '');
  const filter = filters.find(f => f.id === id);

  const { data: rawTasks } = useFilteredTasks((filter?.query as string) ?? '{}');
  const tasks = rawTasks.filter(t => t.title) as any[];
  const [selected, setSelected] = useState<string | null>(null);

  const handleComplete = async (taskId: string) => {
    await completeTask(db as any, taskId);
  };

  if (!filter) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-text-primary font-semibold">Filter not found</p>
        <Link href="/inbox" className="text-accent text-sm">Go to Inbox</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        <header className="border-b border-border px-6 py-4">
          <h1 className="text-text-primary font-semibold text-xl">
            {(filter.icon as string) ? `${filter.icon} ` : ''}{filter.name as string}
          </h1>
        </header>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <p className="text-text-primary font-semibold text-lg">No tasks match this filter</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <TaskList
              tasks={tasks}
              onPress={setSelected}
              onComplete={handleComplete}
            />
          </div>
        )}
      </div>

      {selected && (
        <TaskDetailPanel taskId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
