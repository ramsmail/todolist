'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { useLabels, createLabel, updateLabel, deleteLabel } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

const SWATCHES = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6'];

export default function ManageLabelsPage() {
  const db = usePowerSync();
  const { data: labels } = useLabels();
  const [newName, setNewName] = useState('');

  const create = async () => {
    const name = newName.trim().toLowerCase();
    if (!name) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await createLabel(db as any, { userId: user.id, name });
    setNewName('');
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto scrollable">
      <header className="px-6 py-5 border-b border-border">
        <h1 className="text-text-primary text-xl font-bold">Manage labels</h1>
      </header>

      <div className="p-6 max-w-lg space-y-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            placeholder="New label name"
            aria-label="New label name"
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-accent"
          />
          <button onClick={create} className="bg-accent text-white font-semibold rounded-xl px-5 text-sm">
            Add
          </button>
        </div>

        <ul className="space-y-2" role="list">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
              <div className="flex gap-1" role="group" aria-label={`Color for ${l.name}`}>
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateLabel(db as any, l.id, { color: c })}
                    aria-label={`Set ${l.name} color ${c}`}
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: c, outline: l.color === c ? '2px solid white' : undefined }}
                  />
                ))}
              </div>
              <input
                defaultValue={l.name ?? ''}
                aria-label={`Rename ${l.name}`}
                onBlur={(e) => {
                  const v = e.target.value.trim().toLowerCase();
                  if (v && v !== l.name) updateLabel(db as any, l.id, { name: v });
                }}
                className="flex-1 bg-transparent text-text-primary text-sm focus:outline-none"
              />
              <button
                onClick={() => { if (confirm(`Delete label "${l.name}"?`)) deleteLabel(db as any, l.id); }}
                className="text-text-muted hover:text-error text-sm"
                aria-label={`Delete ${l.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
