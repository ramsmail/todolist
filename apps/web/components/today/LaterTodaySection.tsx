'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { toggleFocus, moveTask } from '@todolist/db';
import { generateKeyBetween } from 'fractional-indexing';

type Task = {
  id: string;
  title: string | null;
  priority: number | null;
  sort_order: string | null;
  project_id: string | null;
  status: string | null;
  in_focus: number | null;
};

type Project = { id: string; name: string | null; color: string | null };

interface Props {
  tasks: Task[];       // pre-filtered: in_focus !== 1
  projects: Project[];
  focusTasks: Task[];  // current focus list — used to check count and last sort_order
}

export function LaterTodaySection({ tasks, projects, focusTasks }: Props) {
  const db = usePowerSync();
  const [isOpen, setIsOpen] = useState(false);
  const canAddFocus = focusTasks.length < 6;

  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  const handleAddToFocus = async (task: Task) => {
    const lastFocus = focusTasks[focusTasks.length - 1] ?? null;
    await toggleFocus(db as any, task.id);
    await moveTask(
      db as any,
      task.id,
      task.priority ?? 4,
      generateKeyBetween(lastFocus?.sort_order ?? null, null),
    );
  };

  if (tasks.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-gray-600">Later Today</span>
        <span className="text-xs text-gray-400">
          · {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
        <span className="ml-auto text-gray-400 text-xs">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-1">
          {tasks.map(task => {
            const proj = projectOf(task.project_id ?? null);
            return (
              <div key={task.id} className="group flex items-center gap-3 px-3 py-3 bg-white rounded-lg">
                {proj && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: proj.color ?? '#808080' }}
                  />
                )}
                <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                {canAddFocus && (
                  <button
                    onClick={() => handleAddToFocus(task)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-indigo-500 hover:text-indigo-700 font-medium flex-shrink-0"
                    aria-label={`Add ${task.title} to Top Priorities`}
                  >
                    + Focus
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
