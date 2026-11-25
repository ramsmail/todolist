'use client';

import { useNotesByProject } from '@todolist/db';
import { useNewNote } from '@/hooks/useNewNote';
import { NoteRow } from './NoteRow';

export function ProjectNotesSection({ projectId }: { projectId: string }) {
  const { data: notes } = useNotesByProject(projectId);
  const newNote = useNewNote();

  return (
    <section aria-label="Project notes" className="border-t border-border px-6 py-4 max-h-72 overflow-y-auto scrollable">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes</h2>
        <button type="button" onClick={() => void newNote({ projectId })} className="text-accent text-sm hover:opacity-80">
          + Add note
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-text-muted text-sm">No notes in this project yet</p>
      ) : (
        <ul className="space-y-2" role="list">
          {notes.map((n) => (
            <li key={n.id}>
              <NoteRow note={n} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
