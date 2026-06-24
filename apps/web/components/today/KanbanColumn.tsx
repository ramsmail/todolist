'use client';

import { ReactNode } from 'react';

const PRIORITY_LABELS: Record<number, string> = {
  1: 'High Priority',
  2: 'Medium Priority',
  3: 'Low Priority',
};

const PRIORITY_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F97316',
  3: '#3B82F6',
};

interface Props {
  priority: number;
  children: ReactNode;
  onDrop: (e: React.DragEvent) => void;
  isEmpty: boolean;
}

export function KanbanColumn({ priority, children, onDrop, isEmpty }: Props) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="flex-1 min-h-[600px] bg-bg/50 rounded-lg border border-border/50 p-4 flex flex-col"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: PRIORITY_COLORS[priority] }}
        />
        <h3 className="text-sm font-semibold text-text-primary">
          {PRIORITY_LABELS[priority]}
        </h3>
      </div>

      {/* Tasks list */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {children}
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm py-8">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
