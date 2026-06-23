'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePowerSync } from '@powersync/react';
import { parseTaskInput } from '@todolist/core';
import { createTask, ensureLabels } from '@todolist/db';
import { createClient } from '@/lib/supabase/client';

interface Props {
  open:       boolean;
  projectId?: string | null;
  onClose:    () => void;
}

export function QuickCaptureModal({ open, projectId, onClose }: Props) {
  const db      = usePowerSync();
  const [input,  setInput]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const parsed = parseTaskInput(trimmed, { now: new Date() });
      if (parsed.labels.length) await ensureLabels(db as any, user.id, parsed.labels);
      await createTask(db as any, {
        userId:         user.id,
        title:          parsed.title,
        priority:       parsed.priority,
        dueDate:        parsed.dueDate,
        dueTime:        parsed.dueTime,
        timezone:       Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId:      projectId ?? null,
        labels:         parsed.labels,
        recurrenceRule: parsed.recurrenceRule,
        status:         'inbox',
      });
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }, [db, input, projectId, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="New task"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative w-full max-w-xl bg-surface-alt rounded-2xl p-6 shadow-2xl">
        <h2 className="text-text-primary font-semibold text-lg mb-1">New task</h2>
        <p className="text-text-muted text-xs mb-4">
          Tip: "Submit report p1 #work @waiting tomorrow 3pm"
        </p>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          placeholder="What needs to be done?"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent mb-4"
        />

        {error && <p className="text-error text-xs mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-border rounded-xl py-2.5 text-text-secondary text-sm hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!input.trim() || saving}
            className="flex-2 bg-accent text-white font-semibold rounded-xl py-2.5 px-6 text-sm hover:bg-accent-dark transition-colors disabled:opacity-40"
          >
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </div>
    </div>
  );
}
