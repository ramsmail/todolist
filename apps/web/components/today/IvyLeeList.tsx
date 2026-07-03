'use client';

import { useRef, useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { completeTask, moveTask, toggleFocus } from '@todolist/db';
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
  tasks: Task[];      // pre-filtered in_focus===1, sorted by sort_order
  projects: Project[];
  onOpenDetail: (id: string) => void;
}

const SLOTS = 6;

export function IvyLeeList({ tasks, projects, onOpenDetail }: Props) {
  const db = usePowerSync();
  const dragIdxRef = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  const handleDragStart = (idx: number) => {
    dragIdxRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = async (toIdx: number) => {
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === toIdx) {
      dragIdxRef.current = null;
      setOverIdx(null);
      return;
    }
    const task = tasks[fromIdx];
    if (!task) return;

    let taskAbove: Task | null;
    let taskBelow: Task | null;
    if (toIdx > fromIdx) {
      taskAbove = tasks[toIdx] ?? null;
      taskBelow = tasks[toIdx + 1] ?? null;
    } else {
      taskAbove = tasks[toIdx - 1] ?? null;
      taskBelow = tasks[toIdx] ?? null;
    }

    const newKey = generateKeyBetween(
      taskAbove?.sort_order ?? null,
      taskBelow?.sort_order ?? null,
    );
    await moveTask(db as any, task.id, task.priority ?? 4, newKey);
    dragIdxRef.current = null;
    setOverIdx(null);
  };

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  const handleRemoveFromFocus = async (id: string) => {
    setMenuOpenId(null);
    await toggleFocus(db as any, id);
  };

  const slots = Array.from({ length: SLOTS }, (_, i) => tasks[i] ?? null);

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Top Priorities
      </p>
      {slots.map((task, i) => {
        const isFirst = i === 0;

        if (!task) {
          return (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 px-3 py-3 border border-dashed border-gray-200 rounded-lg"
            >
              <span className="text-xs text-gray-300 w-5 text-center">{i + 1}</span>
              <span className="text-sm text-gray-300">—</span>
            </div>
          );
        }

        const proj = projectOf(task.project_id ?? null);

        return (
          <div
            key={task.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { dragIdxRef.current = null; setOverIdx(null); }}
            className={[
              'flex items-center gap-3 px-3 py-3 rounded-lg select-none relative',
              isFirst
                ? 'border-l-2 border-indigo-500 shadow-sm bg-white'
                : 'bg-white',
              overIdx === i && dragIdxRef.current !== i ? 'ring-2 ring-indigo-300' : '',
            ].join(' ')}
          >
            <span className={`text-xs w-5 text-center font-semibold flex-shrink-0 ${isFirst ? 'text-indigo-500' : 'text-gray-400'}`}>
              {i + 1}
            </span>
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-indigo-500 cursor-pointer flex-shrink-0"
              onChange={() => handleComplete(task.id)}
              aria-label={`Complete ${task.title}`}
            />
            <button
              onClick={() => onOpenDetail(task.id)}
              className="flex-1 text-left text-sm text-gray-800 truncate hover:text-indigo-600 transition-colors"
            >
              {task.title}
            </button>
            {proj && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: proj.color ?? '#808080' }}
              />
            )}
            {isFirst && (
              <span className="text-xs bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                NOW
              </span>
            )}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpenId(menuOpenId === task.id ? null : task.id)}
                className="text-gray-300 hover:text-gray-500 px-1 focus:outline-none"
                aria-label="Task options"
              >
                ⋯
              </button>
              {menuOpenId === task.id && (
                <div className="absolute right-0 top-6 z-20 bg-white border border-gray-100 rounded-lg shadow-lg py-1 min-w-max">
                  <button
                    onClick={() => handleRemoveFromFocus(task.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Remove from priorities
                  </button>
                </div>
              )}
            </div>
            <span className="text-gray-300 cursor-grab flex-shrink-0" aria-hidden="true">⠿</span>
          </div>
        );
      })}
    </div>
  );
}
