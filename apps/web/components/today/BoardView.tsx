'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { generateKeyBetween } from 'fractional-indexing';
import { completeTask, toggleFocus, moveTask } from '@todolist/db';
import { BoardTaskCard } from './BoardTaskCard';
import { KanbanColumn } from './KanbanColumn';

interface Task {
  id: string;
  title: string | null;
  priority: number;
  sort_order: string | null;
  due_date: string | null;
  due_time?: string | null;
  labels?: string | null;
  project_id: string | null;
  project_name?: string | null;
  project_color?: string | null;
  in_focus: number;
}

interface Props {
  tasks: Task[];
  projects: Array<{ id: string; name: string; color: string }>;
  onTaskDetail: (id: string) => void;
  onAddTask: () => void;
}

export function BoardView({ tasks, projects, onTaskDetail, onAddTask }: Props) {
  const db = usePowerSync();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const projectOf = (id: string | null) => projects.find(p => p.id === id);

  // Group tasks by priority (1=High, 2=Medium, 3=Low)
  const columns: Record<number, Task[]> = { 1: [], 2: [], 3: [] };
  tasks.forEach(t => {
    const priority = t.priority as keyof typeof columns;
    if (priority in columns) {
      columns[priority].push(t);
    }
  });

  // Sort tasks within each column by sort_order (lexicographic for fractional indexing)
  Object.keys(columns).forEach(key => {
    const priority = parseInt(key) as keyof typeof columns;
    columns[priority].sort((a, b) => {
      const aOrder = a.sort_order ?? '';
      const bOrder = b.sort_order ?? '';
      return aOrder.localeCompare(bOrder);
    });
  });

  const handleDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleDropOnColumn = (targetPriority: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');

    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Append to the bottom of the target column. `generateKeyBetween` produces a
    // fractional-indexing key after the current last card (or the first key if empty).
    // Note: drop is column-level, so this appends rather than inserting at a
    // pointer position — within-column reordering to a specific slot is not yet
    // supported (tracked separately).
    const targetColumnTasks = columns[targetPriority as 1 | 2 | 3] || [];
    const lastTask = targetColumnTasks[targetColumnTasks.length - 1];
    const newSortOrder = generateKeyBetween(lastTask?.sort_order ?? null, null);

    // No-op if dropped back into the same column at the same trailing position.
    if (task.priority === targetPriority && lastTask?.id === task.id) {
      setDraggedTaskId(null);
      return;
    }

    // All writes go through the packages/db layer (carries the deleted_at guard).
    await moveTask(db, taskId, targetPriority, newSortOrder);

    setDraggedTaskId(null);
  };

  const handleComplete = async (id: string) => {
    await completeTask(db as any, id);
  };

  const handleToggleFocus = async (id: string) => {
    await toggleFocus(db as any, id);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto scrollable">
      {/* Add task bar */}
      <div className="px-6 pb-4">
        <button
          onClick={() => onAddTask()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border text-text-muted text-sm hover:border-accent/40 hover:bg-surface transition-colors text-left"
        >
          <span>+</span>
          <span>Add a task — try "Draft update Fri 9am #project !high"</span>
        </button>
      </div>

      {/* Kanban board */}
      <div className="px-6 pb-6 flex-1">
        <div className="grid grid-cols-3 gap-4 h-full">
          {[1, 2, 3].map(priority => (
            <KanbanColumn
              key={priority}
              priority={priority}
              isEmpty={columns[priority as 1 | 2 | 3].length === 0}
              onDrop={handleDropOnColumn(priority)}
            >
              {columns[priority as 1 | 2 | 3].map(task => {
                const proj = projectOf(task.project_id);
                return (
                  <BoardTaskCard
                    key={task.id}
                    task={{
                      ...task,
                      project_name: proj?.name ?? null,
                      project_color: proj?.color ?? null,
                    }}
                    onPress={onTaskDetail}
                    onComplete={handleComplete}
                    onToggleFocus={handleToggleFocus}
                    draggable={true}
                    onDragStart={handleDragStart(task.id)}
                    onDragEnd={handleDragEnd}
                  />
                );
              })}
            </KanbanColumn>
          ))}
        </div>
      </div>
    </div>
  );
}
