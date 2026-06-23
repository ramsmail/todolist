'use client';

import { useState, useEffect } from 'react';
import { usePowerSync } from '@powersync/react';
import { createClient } from '@/lib/supabase/client';
import {
  useLabels, useProjects, createSavedFilter, updateSavedFilter,
  type SavedFilterRecord,
} from '@todolist/db';
import { serializeFilterQuery, isEmptyFilterQuery, type FilterQuery } from '@todolist/core';

const PRIORITY_LABELS: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
const DUE_OPTIONS = [
  { value: 'today',     label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'next_week', label: 'Next week' },
  { value: 'overdue',   label: 'Overdue' },
  { value: 'no_date',   label: 'No date' },
] as const;

interface Props {
  open:    boolean;
  onClose: () => void;
  filter?: SavedFilterRecord;
}

function parseExisting(filter?: SavedFilterRecord): FilterQuery {
  if (!filter?.query) return {};
  try { return JSON.parse(filter.query as string); } catch { return {}; }
}

export function FilterBuilderModal({ open, onClose, filter }: Props) {
  const db = usePowerSync();
  const { data: labels }   = useLabels();
  const { data: projects } = useProjects();

  const [name, setName]   = useState('');
  const [icon, setIcon]   = useState('');
  const [query, setQuery] = useState<FilterQuery>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName((filter?.name as string) ?? '');
      setIcon((filter?.icon as string) ?? '');
      setQuery(parseExisting(filter));
    }
  }, [open, filter]);

  if (!open) return null;

  const togglePriority = (p: 1 | 2 | 3 | 4) => {
    setQuery(q => {
      const cur = q.priority ?? [];
      return {
        ...q,
        priority: cur.includes(p) ? cur.filter(x => x !== p) : [...cur, p],
      };
    });
  };

  const toggleLabel = (labelName: string) => {
    setQuery(q => {
      const cur = q.labels ?? [];
      return {
        ...q,
        labels: cur.includes(labelName) ? cur.filter(x => x !== labelName) : [...cur, labelName],
      };
    });
  };

  const setProject = (projectId: string | null | undefined) => {
    setQuery(q => ({ ...q, projectId }));
  };

  const setDueRange = (v: FilterQuery['dueDateRange'] | '') => {
    setQuery(q => ({ ...q, dueDateRange: v || undefined }));
  };

  const canSave = name.trim().length > 0 && !isEmptyFilterQuery(query);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const queryStr = serializeFilterQuery(query);
      if (filter?.id) {
        await updateSavedFilter(db, filter.id as string, {
          name: name.trim(), icon: icon || undefined, query: queryStr,
        });
      } else {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await createSavedFilter(db, {
          userId: user.id, name: name.trim(), icon: icon || undefined, query: queryStr,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={filter ? 'Edit filter' : 'New filter'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-text-primary font-semibold text-lg mb-4">
          {filter ? 'Edit filter' : 'New filter'}
        </h2>

        {/* Name */}
        <label className="block mb-3">
          <span className="text-xs text-text-muted block mb-1" id="filter-name-label">Filter name</span>
          <input
            id="filter-name"
            aria-labelledby="filter-name-label"
            aria-label="Filter name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Urgent this week"
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        {/* Icon */}
        <label className="block mb-4">
          <span className="text-xs text-text-muted block mb-1">Icon (emoji, optional)</span>
          <input
            type="text"
            value={icon}
            onChange={e => setIcon(e.target.value)}
            placeholder="e.g. 🔥"
            maxLength={2}
            className="w-24 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        {/* Priority */}
        <div className="mb-4">
          <p className="text-xs text-text-muted mb-2">Priority</p>
          <div className="flex gap-2">
            {([1, 2, 3, 4] as const).map(p => (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${(query.priority ?? []).includes(p)
                    ? 'bg-accent text-white'
                    : 'bg-bg border border-border text-text-secondary hover:border-accent'}`}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Due date range */}
        <div className="mb-4">
          <p className="text-xs text-text-muted mb-2">Due date</p>
          <select
            value={query.dueDateRange ?? ''}
            onChange={e => setDueRange(e.target.value as FilterQuery['dueDateRange'] | '')}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Any</option>
            {DUE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-text-muted mb-2">Labels (any of)</p>
            <div className="flex flex-wrap gap-2">
              {labels.filter(l => l.name && !l.deleted_at).map(l => {
                const lName = l.name as string;
                const selected = (query.labels ?? []).includes(lName);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLabel(lName)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors
                      ${selected ? 'ring-2 ring-accent' : 'bg-bg border border-border'}`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color as string }} />
                    {lName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Project */}
        <div className="mb-6">
          <p className="text-xs text-text-muted mb-2">Project</p>
          <select
            value={query.projectId === null ? '__no_project__' : (query.projectId ?? '')}
            onChange={e => {
              const v = e.target.value;
              setProject(v === '' ? undefined : v === '__no_project__' ? null : v);
            }}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Any project</option>
            <option value="__no_project__">No project</option>
            {projects.filter(p => !p.deleted_at).map(p => (
              <option key={p.id as string} value={p.id as string}>{p.name as string}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
