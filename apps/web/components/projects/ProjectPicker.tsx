'use client';

import { useRef, useState, useEffect } from 'react';
import { useProjects } from '@todolist/db';

interface Props {
  value:    string | null;
  onChange: (projectId: string | null) => void;
}

export function ProjectPicker({ value, onChange }: Props) {
  const { data: projects } = useProjects();
  const [open, setOpen]    = useState(false);
  const ref                = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const current = projects.find(p => p.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: current.color ?? '#6366F1' }} />
            {current.name}
          </>
        ) : (
          <span className="text-text-muted">No project</span>
        )}
        <span className="text-text-muted text-xs">▾</span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-48 bg-surface-alt border border-border rounded-xl shadow-lg z-10 py-1"
          role="listbox"
          aria-label="Select project"
        >
          <button
            role="option"
            aria-selected={value === null}
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-text-muted hover:bg-surface transition-colors"
          >
            No project
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              role="option"
              aria-selected={value === p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color ?? '#6366F1' }} />
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
