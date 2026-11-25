'use client';

import { useState } from 'react';
import { quadrantLabel } from '@todolist/core';
import { TaskRow, type TaskRowItem } from '@/components/tasks/TaskRow';

const QUADRANT_CONFIG = {
  1: { icon: '⚡', bg: 'bg-amber-50',   header: 'text-amber-700',   ring: 'ring-amber-400/50'   },
  2: { icon: '📅', bg: 'bg-indigo-50',  header: 'text-indigo-700',  ring: 'ring-indigo-400/50'  },
  3: { icon: '↪',  bg: 'bg-neutral-50', header: 'text-neutral-600', ring: 'ring-neutral-400/50' },
  4: { icon: '✕',  bg: 'bg-rose-50',    header: 'text-rose-700',    ring: 'ring-rose-400/50'    },
} as const;

interface MatrixQuadrantProps {
  quadrant: 1 | 2 | 3 | 4;
  tasks: TaskRowItem[];
  onTaskPress: (id: string) => void;
  onTaskComplete: (id: string) => void;
  onDropTask: (taskId: string, targetQuadrant: number) => void;
}

export function MatrixQuadrant({
  quadrant, tasks, onTaskPress, onTaskComplete, onDropTask,
}: MatrixQuadrantProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = QUADRANT_CONFIG[quadrant];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onDropTask(taskId, quadrant);
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border border-border ${config.bg} transition-all ${isDragOver ? `ring-2 ${config.ring}` : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <span aria-hidden="true">{config.icon}</span>
        <span className={`text-xs font-bold tracking-widest uppercase ${config.header}`}>
          {quadrantLabel[quadrant]}
        </span>
        <span className="ml-auto text-xs text-text-muted">{tasks.length}</span>
      </div>
      <div
        className="flex-1 overflow-y-auto max-h-[calc(50vh-6rem)] px-3 pb-3 space-y-2"
        role="list"
      >
        {tasks.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">No tasks here</p>
        ) : (
          tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onPress={onTaskPress}
              onComplete={onTaskComplete}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/plain', task.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
