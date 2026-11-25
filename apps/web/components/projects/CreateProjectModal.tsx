'use client';

import { useState } from 'react';
import { usePowerSync } from '@powersync/react';
import { createProject } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

const COLORS = ['#6366F1','#EF4444','#F97316','#22C55E','#3B82F6','#EC4899','#F59E0B'];
const ICONS  = ['📁','⭐','🏠','💼','🎯','📚','🏋️','🛒','💡'];

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function CreateProjectModal({ open, onClose }: Props) {
  const db         = usePowerSync();
  const [formData, setFormData] = useState({
    name: '',
    color: COLORS[0],
    icon: ICONS[0],
    description: '',
    category: 'Personal',
    due_date: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await createProject(db as any, {
        userId: user.id,
        name: formData.name.trim(),
        color: formData.color,
        icon: formData.icon,
        description: formData.description,
        category: formData.category,
        due_date: formData.due_date,
      });
      setFormData({
        name: '',
        color: COLORS[0],
        icon: ICONS[0],
        description: '',
        category: 'Personal',
        due_date: '',
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      role="dialog" aria-modal="true" aria-label="New project"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-surface-alt rounded-2xl p-6 shadow-2xl">
        <h2 className="text-text-primary font-semibold text-lg mb-4">New project</h2>

        <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Name</label>
        <input
          type="text"
          autoFocus
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Project name"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent mb-4"
        />

        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Color</label>
        <div className="flex gap-2 mb-4">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setFormData({ ...formData, color: c })}
              className={`w-7 h-7 rounded-full transition-transform ${formData.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-alt scale-110' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
              aria-pressed={formData.color === c}
            />
          ))}
        </div>

        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Icon</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {ICONS.map(i => (
            <button
              key={i}
              onClick={() => setFormData({ ...formData, icon: i })}
              className={`text-xl p-1.5 rounded-lg border transition-colors ${formData.icon === i ? 'border-accent bg-surface' : 'border-transparent hover:bg-surface'}`}
              aria-label={`Icon ${i}`}
              aria-pressed={formData.icon === i}
            >
              {i}
            </button>
          ))}
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Description (optional)
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="What is this project about?"
            className="w-full px-3 py-2 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            rows={3}
          />
        </div>

        {/* Category */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Category
          </label>
          <select
            value={formData.category || 'Personal'}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          >
            <option value="Business">Business</option>
            <option value="Learning">Learning</option>
            <option value="Habit">Habit</option>
            <option value="Personal">Personal</option>
            <option value="Backlog">Backlog</option>
          </select>
        </div>

        {/* Due Date */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Due Date (optional)
          </label>
          <input
            type="date"
            value={formData.due_date || ''}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          />
        </div>

        {error && <p className="text-error text-xs mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-border rounded-xl py-2.5 text-text-secondary text-sm hover:bg-surface transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!formData.name.trim() || saving}
            className="flex-[2] bg-accent text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
