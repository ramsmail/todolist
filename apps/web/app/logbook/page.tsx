'use client';

import { useLogbook } from '@todolist/db';
import { TaskRow, type TaskRowItem } from '@/components/tasks/TaskRow';

type LogbookEntry = {
  id: string; title: string; priority: number; due_date: string | null;
  status: string; updated_at: string; project_id: string | null; labels: string | null;
};

function dateBucket(updatedAt: string): 'today' | 'this_week' | 'earlier' {
  const todayStr = new Date().toISOString().split('T')[0];
  const dayStr   = updatedAt.split('T')[0];
  if (dayStr === todayStr) return 'today';
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(dayStr) >= sevenDaysAgo ? 'this_week' : 'earlier';
}

const BUCKET_LABELS = {
  today:     'Today',
  this_week: 'This week',
  earlier:   'Earlier',
} as const;

export default function LogbookPage() {
  const { data: tasks } = useLogbook();

  const buckets: Record<'today' | 'this_week' | 'earlier', LogbookEntry[]> = {
    today: [], this_week: [], earlier: [],
  };
  for (const t of tasks) {
    buckets[dateBucket(t.updated_at as string)].push(t as LogbookEntry);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-text-primary font-semibold text-xl">Logbook</h1>
      </header>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2">
          <p className="text-text-primary font-semibold text-lg">Nothing completed yet</p>
          <p className="text-text-muted text-sm">Tasks you finish will appear here.</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 scrollable">
          {(['today', 'this_week', 'earlier'] as const).map((b) => {
            if (buckets[b].length === 0) return null;
            return (
              <section key={b} aria-label={BUCKET_LABELS[b]}>
                <h2 className="px-6 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border bg-bg/50">
                  {BUCKET_LABELS[b]}
                </h2>
                <ul role="list" aria-label={`${BUCKET_LABELS[b]} completed tasks`}>
                  {buckets[b].map((t) => (
                    <li key={t.id}>
                      <TaskRow
                        task={t as TaskRowItem}
                        onPress={() => {}}
                        onComplete={() => {}}
                        readOnly
                        completedAt={t.updated_at}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
