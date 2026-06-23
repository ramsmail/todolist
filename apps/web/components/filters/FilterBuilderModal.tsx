'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { createSavedFilter, updateSavedFilter } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

interface Props {
  open: boolean;
  onClose: () => void;
  filter?: any;
}

const ICONS = ['📌', '🎯', '⚡', '🔥', '💡', '✅', '🚀', '🎨', '📝', '🏆'];

export function FilterBuilderModal({ open, onClose, filter }: Props) {
  const db = usePowerSync();
  const [name, setName] = useState(filter?.name ?? '');
  const [icon, setIcon] = useState(filter?.icon ?? ICONS[0]);
  const [query, setQuery] = useState(filter?.query ?? '{}');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (filter?.id) {
        await updateSavedFilter(db as any, filter.id, { name, icon, query });
      } else {
        await createSavedFilter(db as any, {
          userId: user.id,
          name: name.trim(),
          icon,
          query,
        });
      }
      onClose();
      setName('');
      setIcon(ICONS[0]);
      setQuery('{}');
    } catch (error) {
      console.error('Failed to save filter:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-text-primary font-semibold text-lg mb-4">
          {filter ? 'Edit filter' : 'Create new filter'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">
              Filter name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Urgent tasks"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">
              Icon
            </label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(ico => (
                <button
                  key={ico}
                  onClick={() => setIcon(ico)}
                  className={`text-2xl p-2 rounded-lg transition-colors ${
                    icon === ico
                      ? 'bg-accent'
                      : 'bg-bg hover:bg-bg'
                  }`}
                  aria-label={`Select ${ico} icon`}
                >
                  {ico}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-text-secondary text-sm font-medium mb-2">
              Query (JSON)
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='{"priority": ["high"]}'
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent font-mono"
              rows={4}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-text-secondary text-sm font-medium border border-border rounded-lg hover:bg-bg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
