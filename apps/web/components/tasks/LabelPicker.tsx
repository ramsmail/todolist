'use client';

import { useRef, useState, useEffect } from 'react';
import { useLabels } from '@todolist/db';
import { LabelChip } from './LabelChip';

interface Props {
  selected: string[];
  onChange: (labels: string[]) => void;
}

export function LabelPicker({ selected, onChange }: Props) {
  const { data: labels } = useLabels();
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter(l => l !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const addNew = () => {
    const name = newLabel.trim().toLowerCase();
    if (!name || selected.includes(name)) return;
    onChange([...selected, name]);
    setNewLabel('');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex flex-wrap items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors min-h-[24px]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected.length > 0 ? (
          selected.map(name => {
            const color = labels.find(l => l.name === name)?.color ?? '#9CA3AF';
            return <LabelChip key={name} name={name} color={color} />;
          })
        ) : (
          <span className="text-text-muted">Add labels</span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-56 bg-surface-alt border border-border rounded-xl shadow-lg z-10 py-1"
          role="listbox"
          aria-label="Select labels"
          aria-multiselectable="true"
        >
          {labels.map(l => {
            const name = l.name;
            if (!name) return null;
            return (
              <button
                key={l.id}
                role="option"
                aria-selected={selected.includes(name)}
                onClick={() => toggle(name)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
              >
                <span className="w-3 h-3 rounded border border-border flex items-center justify-center flex-shrink-0">
                  {selected.includes(name) && <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: l.color ?? '#9CA3AF' }} />}
                </span>
                {name}
              </button>
            );
          })}
          <div className="px-2 pt-1">
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } }}
              placeholder="New label…"
              className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-text-primary text-xs focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      )}
    </div>
  );
}
