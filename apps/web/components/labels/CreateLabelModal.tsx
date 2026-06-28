'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { createLabel } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

const SWATCHES = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateLabelModal({ open, onClose }: Props) {
  const db = usePowerSync();
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await createLabel(db as any, { userId: user.id, name: name.trim(), color });
      setName('');
      setColor(SWATCHES[0]);
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create label');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      role="dialog" aria-modal="true" aria-label="New label"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-surface-alt rounded-2xl p-6 shadow-2xl">
        <h2 className="text-text-primary font-semibold text-lg mb-4">New label</h2>

        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
          Name
        </label>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Label name"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent mb-4"
        />

        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
          Color
        </label>
        <div className="flex gap-2 mb-6">
          {SWATCHES.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-alt scale-110' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            />
          ))}
        </div>

        {error && <p className="text-error text-xs mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-border rounded-xl py-2.5 text-text-secondary text-sm hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="flex-[2] bg-accent text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
