'use client';

import Link from 'next/link';
import { useMemo } from 'react';

interface ProjectCardProps {
  id: string;
  name: string;
  description: string | null;
  category: string;
  color: string;
  icon: string;
  due_date: string | null;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

const categoryColors = {
  Business: 'bg-orange-100 text-orange-700',
  Learning: 'bg-blue-100 text-blue-700',
  Habit: 'bg-purple-100 text-purple-700',
  Personal: 'bg-green-100 text-green-700',
  Backlog: 'bg-gray-100 text-gray-700',
};

export function ProjectCard({
  id,
  name,
  description,
  category,
  color,
  icon,
  due_date,
  total_tasks,
  completed_tasks,
  open_tasks,
}: ProjectCardProps) {
  const progress = total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;
  const categoryColor = categoryColors[category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-700';

  // Format due date for display
  const formattedDueDate = due_date
    ? new Date(due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <Link href={`/projects/${id}`}>
      <div className="block h-full p-5 border border-border rounded-xl hover:bg-surface transition-colors cursor-pointer">
        {/* Header: Icon + Name + Category Badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-semibold text-base truncate">{name}</h3>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium text-nowrap flex-shrink-0 ${categoryColor}`}>
            {category}
          </span>
        </div>

        {/* Description */}
        {description && (
          <p className="text-text-secondary text-sm mb-4 line-clamp-2">{description}</p>
        )}

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-text-muted">Progress</span>
            <span className="text-xs font-medium text-text-secondary">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                backgroundColor: color || '#6366F1',
              }}
            />
          </div>
        </div>

        {/* Task Counts */}
        <div className="flex items-center gap-4 mb-3">
          <div>
            <p className="text-xs text-text-muted">Open</p>
            <p className="text-lg font-semibold text-text-primary">{open_tasks}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Done</p>
            <p className="text-lg font-semibold text-text-primary">{completed_tasks}</p>
          </div>
          {total_tasks > 0 && (
            <div>
              <p className="text-xs text-text-muted">Total</p>
              <p className="text-lg font-semibold text-text-primary">{total_tasks}</p>
            </div>
          )}
        </div>

        {/* Due Date */}
        {formattedDueDate && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-text-muted">Due</p>
            <p className="text-sm font-medium text-text-secondary">{formattedDueDate}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
