'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TaskRow, type TaskRowItem } from './TaskRow';

interface Props {
  tasks:      TaskRowItem[];
  onPress:    (id: string) => void;
  onComplete: (id: string) => void;
}

export function TaskList({ tasks, onPress, onComplete }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count:         tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize:  () => 56,
    overscan:      5,
  });

  if (tasks.length === 0) return null;

  return (
    <div ref={parentRef} className="overflow-auto" style={{ height: '100%' }}>
      <div
        role="list"
        aria-label="Tasks"
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map(vi => (
          <div
            key={vi.key}
            style={{
              position:  'absolute',
              top:       0,
              left:      0,
              width:     '100%',
              transform: `translateY(${vi.start}px)`,
            }}
          >
            <TaskRow
              task={tasks[vi.index]}
              onPress={onPress}
              onComplete={onComplete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
