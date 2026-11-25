'use client';

import { useMemo, useState } from 'react';
import { filterNotes, type NoteKind } from '@todolist/core';
import { useLabels, useNotesList, useProjects } from '@todolist/db';
import { NoteRow } from '@/components/notes/NoteRow';
import { useNewNote } from '@/hooks/useNewNote';

const KINDS: { value: NoteKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'links', label: 'Links' },
  { value: 'thoughts', label: 'Thoughts' },
];

const SELECT = 'bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent';

export default function NotesPage() {
  const [kind, setKind] = useState<NoteKind>('all');
  const [projectId, setProjectId] = useState('');
  const [label, setLabel] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { data: notes } = useNotesList(showArchived);
  const { data: projects } = useProjects();
  const { data: labels } = useLabels();
  const newNote = useNewNote();

  const visible = useMemo(
    () => filterNotes(notes, { kind, projectId: projectId || null, label: label || null }),
    [notes, kind, projectId, label]
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const labelColor = (name: string) => labels.find((l) => l.name === name)?.color ?? '#6366F1';
  const filtering = kind !== 'all' || projectId !== '' || label !== '';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-text-primary text-2xl font-bold mb-1">Notes</h1>
          <p className="text-text-secondary text-sm">{visible.length} notes</p>
        </div>
        <button
          type="button"
          onClick={() => void newNote()}
          className="bg-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent-dark transition-colors"
        >
          + New note
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap px-6 py-3 border-b border-border">
        <div role="group" aria-label="Note type" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
              className={`px-3 py-1 ${kind === k.value ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <select aria-label="Filter by project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={SELECT}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select aria-label="Filter by label" value={label} onChange={(e) => setLabel(e.target.value)} className={SELECT}>
          <option value="">All labels</option>
          {labels.filter((l) => l.name).map((l) => (
            <option key={l.id} value={l.name as string}>{l.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <div className="flex-1 overflow-y-auto scrollable px-6 py-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            {filtering ? (
              <p className="text-text-primary font-semibold text-lg">No notes match these filters</p>
            ) : (
              <>
                <p className="text-text-primary font-semibold text-lg">No notes yet</p>
                <p className="text-text-muted text-sm">Capture a thought or paste a link to get started.</p>
              </>
            )}
          </div>
        ) : (
          <ul className="max-w-3xl space-y-2" role="list">
            {visible.map((n) => {
              const p = n.project_id ? projectById.get(n.project_id) : null;
              return (
                <li key={n.id}>
                  <NoteRow note={n} project={p ? { name: p.name ?? '', color: p.color } : null} labelColor={labelColor} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
