'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { completeTask, useNoteSearch, useTaskSearch } from '@todolist/db';
import { NoteRow } from '@/components/notes/NoteRow';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';

type Scope = 'tasks' | 'notes';

export default function SearchPage() {
  const db = usePowerSync();
  const [term, setTerm] = useState('');
  const [scope, setScope] = useState<Scope>('tasks');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const query = term.trim();
  const { data: tasks } = useTaskSearch(query);
  const { data: notes } = useNoteSearch(query, includeArchived);

  const empty = scope === 'tasks' ? tasks.length === 0 : notes.length === 0;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-border space-y-3">
          <h1 className="text-text-primary text-2xl font-bold">Search</h1>
          <input
            autoFocus
            aria-label="Search"
            placeholder="Search tasks and notes…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full max-w-xl bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-4">
            <div role="group" aria-label="Search scope" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
              {(['tasks', 'notes'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                  className={`px-3 py-1 ${scope === s ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
                >
                  {s === 'tasks' ? 'Tasks' : 'Notes'}
                </button>
              ))}
            </div>
            {scope === 'notes' && (
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
                Include archived
              </label>
            )}
          </div>
        </div>

        {query === '' ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-sm">Type to search</p>
          </div>
        ) : empty ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-text-muted text-sm">No results</p>
          </div>
        ) : scope === 'tasks' ? (
          <div className="flex-1 overflow-hidden">
            <TaskList
              tasks={tasks as any}
              onPress={setDetailId}
              onComplete={(id) => { void completeTask(db as any, id); }}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
            <ul className="max-w-3xl space-y-2" role="list">
              {notes.map((n) => (
                <li key={n.id}>
                  <NoteRow note={n} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <TaskDetailPanel taskId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
