'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePowerSync } from '@powersync/react';
import { useLabelsWithStats, updateLabel, deleteLabel } from '@todolist/db';
import { CreateLabelModal } from '@/components/labels/CreateLabelModal';

const SWATCHES = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6'];

export default function LabelsPage() {
  const db = usePowerSync();
  const { data: labels } = useLabelsWithStats();
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const totalTasks = labels.reduce((sum, l) => sum + l.open_tasks, 0);

  const handleRename = (id: string, newName: string, currentName: string) => {
    const trimmed = newName.trim().toLowerCase();
    if (trimmed && trimmed !== currentName) {
      updateLabel(db as any, id, { name: trimmed });
    }
    setEditingId(null);
  };

  const handleColorSelect = (id: string, color: string) => {
    updateLabel(db as any, id, { color });
    setColorPickerOpen(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete label "${name}"?`)) {
      deleteLabel(db as any, id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-text-primary text-2xl font-bold mb-1">Labels</h1>
          <p className="text-text-secondary text-sm">
            {labels.length} labels · {totalTasks} open tasks
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
        >
          + New label
        </button>
      </div>

      {/* Label list */}
      <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
        {labels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-text-primary font-semibold text-lg">No labels yet</p>
            <p className="text-text-muted text-sm">Create your first label to get started.</p>
          </div>
        ) : (
          <ul className="max-w-2xl space-y-2" role="list">
            {labels.map(label => (
              <li key={label.id}>
                <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  {/* Color dot */}
                  <button
                    onClick={() => setColorPickerOpen(colorPickerOpen === label.id ? null : label.id)}
                    className="w-4 h-4 rounded-full flex-shrink-0 hover:ring-2 hover:ring-white/50 transition-all"
                    style={{ backgroundColor: label.color ?? '#6366F1' }}
                    aria-label={`Change color for ${label.name}`}
                    aria-expanded={colorPickerOpen === label.id}
                  />

                  {/* Name — link or inline input */}
                  {editingId === label.id ? (
                    <input
                      autoFocus
                      defaultValue={label.name}
                      aria-label={`Rename ${label.name}`}
                      onBlur={e => handleRename(label.id, e.target.value, label.name)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-transparent text-text-primary text-sm focus:outline-none border-b border-accent"
                    />
                  ) : (
                    <Link
                      href={`/labels/${encodeURIComponent(label.name)}`}
                      className="flex-1 text-text-primary text-sm hover:text-accent transition-colors truncate"
                    >
                      {label.name}
                    </Link>
                  )}

                  {/* Open task count */}
                  <span className="text-xs text-text-muted bg-surface-alt px-2 py-0.5 rounded-full flex-shrink-0">
                    {label.open_tasks} tasks
                  </span>

                  {/* Pencil */}
                  <button
                    onClick={() => setEditingId(label.id)}
                    aria-label={`Rename ${label.name}`}
                    className="text-text-muted hover:text-text-secondary transition-colors text-sm flex-shrink-0"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(label.id, label.name)}
                    aria-label={`Delete ${label.name}`}
                    className="text-text-muted hover:text-error transition-colors text-sm flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* Inline color picker */}
                {colorPickerOpen === label.id && (
                  <div className="mt-1 ml-4 flex gap-2 px-4 py-2 bg-surface border border-border rounded-xl max-w-fit">
                    {SWATCHES.map(c => (
                      <button
                        key={c}
                        onClick={() => handleColorSelect(label.id, c)}
                        className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${label.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-surface' : ''}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Set color ${c}`}
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateLabelModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
