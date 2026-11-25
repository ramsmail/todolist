'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePowerSync } from '@powersync/react';
import { noteDisplayTitle } from '@todolist/core';
import { createLinkedNote, linkNoteToTask, unlinkNoteFromTask, useLinkedNotes, useNoteSearch } from '@todolist/db';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { SearchPicker } from './SearchPicker';

function LinkNotePicker({ excludeIds, onPick, onClose }: {
  excludeIds: Set<string>;
  onPick: (noteId: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState('');
  const { data } = useNoteSearch(term, false);
  const results = data.filter((n) => !excludeIds.has(n.id)).map((n) => ({ id: n.id, label: noteDisplayTitle(n) }));
  return (
    <SearchPicker label="Search notes" term={term} onTermChange={setTerm} results={results} onPick={onPick} onClose={onClose} />
  );
}

export function LinkedNotesSection({ taskId }: { taskId: string }) {
  const db = usePowerSync();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { data: notes } = useLinkedNotes(taskId);
  const [picking, setPicking] = useState(false);

  const pick = async (noteId: string) => {
    if (!userId) return;
    await linkNoteToTask(db as any, userId, noteId, taskId);
    setPicking(false);
  };

  const createNew = async () => {
    if (!userId) return;
    const { noteId } = await createLinkedNote(db as any, { userId, taskId, title: '' });
    router.push(`/notes/${noteId}`);
  };

  return (
    <div>
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Linked notes</p>

      {notes.length === 0 ? (
        <p className="text-text-muted text-sm">No linked notes</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const title = noteDisplayTitle(n);
            return (
              <li key={n.id} className="flex items-center gap-3">
                <Link href={`/notes/${n.id}`} className="flex-1 truncate text-sm text-accent hover:underline">
                  {title}
                </Link>
                <button
                  type="button"
                  onClick={() => unlinkNoteFromTask(db as any, n.id, taskId)}
                  aria-label={`Unlink ${title}`}
                  className="text-text-muted hover:text-error text-sm"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {picking && (
        <LinkNotePicker excludeIds={new Set(notes.map((n) => n.id))} onPick={pick} onClose={() => setPicking(false)} />
      )}

      {!picking && (
        <div className="mt-3 flex gap-4">
          <button type="button" onClick={() => setPicking(true)} className="text-accent text-sm hover:opacity-80">
            + Link existing
          </button>
          <button type="button" onClick={() => void createNew()} className="text-accent text-sm hover:opacity-80">
            + New note
          </button>
        </div>
      )}
    </div>
  );
}
