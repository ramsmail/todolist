'use client';

import { useRef, useState } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  completeTask, createLinkedTask, linkNoteToTask, reopenTask, unlinkNoteFromTask, useLinkedTasks, useTaskSearch,
} from '@todolist/db';
import { SearchPicker } from './SearchPicker';

// A freshly linked row appears under the cursor as the picker closes; ignore stray
// clicks on checkboxes for a moment so a double-click can't complete the task.
const LINK_CLICK_GUARD_MS = 600;

interface Props {
  noteId: string;
  userId: string | null;
}

function LinkTaskPicker({ excludeIds, onPick, onClose }: {
  excludeIds: Set<string>;
  onPick: (taskId: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useTaskSearch(term);
  const results = data.filter((t) => !excludeIds.has(t.id)).map((t) => ({ id: t.id, label: t.title ?? '' }));
  return (
    <SearchPicker label="Search tasks" term={term} onTermChange={setTerm} results={results} onPick={onPick} onClose={onClose} />
  );
}

export function LinkedTasksPanel({ noteId, userId }: Props) {
  const db = usePowerSync();
  const { data: tasks } = useLinkedTasks(noteId);
  const [mode, setMode] = useState<'idle' | 'link' | 'new'>('idle');
  const [newTitle, setNewTitle] = useState('');
  const lastLinkedAt = useRef(0);

  const toggle = (taskId: string, done: boolean) => {
    if (Date.now() - lastLinkedAt.current < LINK_CLICK_GUARD_MS) return;
    void (done ? reopenTask(db as any, taskId) : completeTask(db as any, taskId));
  };

  const close = () => {
    setMode('idle');
    setNewTitle('');
  };

  const submitNew = async () => {
    const title = newTitle.trim();
    if (!title || !userId) return;
    await createLinkedTask(db as any, { userId, noteId, title });
    lastLinkedAt.current = Date.now();
    close();
  };

  const pick = async (taskId: string) => {
    if (!userId) return;
    await linkNoteToTask(db as any, userId, noteId, taskId);
    lastLinkedAt.current = Date.now();
    close();
  };

  return (
    <section aria-label="Linked tasks">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Linked tasks</h2>

      {tasks.length === 0 ? (
        <p className="text-text-muted text-sm">No linked tasks</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const done = t.status === 'completed';
            return (
              <li key={t.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(t.id, done)}
                  aria-label={`Complete ${t.title}`}
                  className="w-4 h-4 flex-shrink-0"
                />
                <span className={`text-sm flex-1 truncate ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                  {t.title}
                </span>
                <button
                  type="button"
                  onClick={() => unlinkNoteFromTask(db as any, noteId, t.id)}
                  aria-label={`Unlink ${t.title}`}
                  className="text-text-muted hover:text-error text-sm"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === 'link' && (
        <LinkTaskPicker excludeIds={new Set(tasks.map((t) => t.id))} onPick={pick} onClose={close} />
      )}

      {mode === 'new' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            aria-label="New task title"
            placeholder="Task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitNew();
              if (e.key === 'Escape') {
                e.nativeEvent.stopPropagation();
                close();
              }
            }}
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
          <button type="button" onClick={() => void submitNew()} className="text-accent text-sm font-medium">Add</button>
          <button type="button" onClick={close} className="text-text-muted text-sm">Cancel</button>
        </div>
      )}

      {mode === 'idle' && (
        <div className="mt-3 flex gap-4">
          <button type="button" onClick={() => setMode('link')} className="text-accent text-sm hover:opacity-80">
            + Link existing
          </button>
          <button type="button" onClick={() => setMode('new')} className="text-accent text-sm hover:opacity-80">
            + New task
          </button>
        </div>
      )}
    </section>
  );
}
