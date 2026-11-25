'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { usePowerSync } from '@powersync/react';
import { noteDisplayTitle, parseLabelsJson } from '@todolist/core';
import { archiveNote, deleteNote, setNoteLabels, setNoteProject, useNote } from '@todolist/db';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ProjectPicker } from '@/components/projects/ProjectPicker';
import { LabelPicker } from '@/components/tasks/LabelPicker';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { LinkPreviewCard } from '@/components/notes/LinkPreviewCard';
import { ConflictBanner } from '@/components/notes/ConflictBanner';
import { LinkedTasksPanel } from '@/components/notes/LinkedTasksPanel';

export default function NotePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const db = usePowerSync();
  const { userId } = useCurrentUser();
  const { data, isLoading } = useNote(id);
  const note = data?.[0];
  const { data: originalRows } = useNote(note?.conflict_of ?? '');
  const original = originalRows?.[0];

  if (!note) {
    return (
      <div className="px-6 py-8">
        {isLoading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : (
          <>
            <p className="text-text-primary font-semibold text-lg">Note not found</p>
            <Link href="/notes" className="text-accent text-sm hover:underline">Back to notes</Link>
          </>
        )}
      </div>
    );
  }

  const archived = !!note.is_archived;

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return;
    await deleteNote(db as any, note.id);
    router.push('/notes');
  };

  const handleDeleteCopy = async () => {
    if (!confirm('Delete this conflict copy? Make sure you have kept anything you need from it.')) return;
    await deleteNote(db as any, note.id);
    router.push(original ? `/notes/${original.id}` : '/notes');
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/notes" className="text-text-muted text-sm hover:text-text-primary">← Notes</Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void archiveNote(db as any, note.id, !archived)}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
          <button type="button" onClick={() => void handleDelete()} className="text-sm text-error hover:underline">
            Delete note
          </button>
        </div>
      </div>

      {note.conflict_of && (
        <ConflictBanner
          originalTitle={original ? noteDisplayTitle(original) : null}
          hasOriginal={!!original}
          onOpenOriginal={() => original && router.push(`/notes/${original.id}`)}
          onDeleteCopy={() => void handleDeleteCopy()}
        />
      )}

      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Project</p>
          <ProjectPicker value={note.project_id ?? null} onChange={(pid) => void setNoteProject(db as any, note.id, pid)} />
        </div>
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Labels</p>
          <LabelPicker
            selected={parseLabelsJson(note.labels)}
            onChange={(labels) => void setNoteLabels(db as any, note.id, labels)}
          />
        </div>
      </div>

      {note.source_url && (
        <LinkPreviewCard
          url={note.source_url}
          title={note.link_title}
          excerpt={note.link_excerpt}
          imageUrl={note.link_image_url}
          siteName={note.link_site_name}
          status={note.link_status}
        />
      )}

      <NoteEditor key={note.id} note={note} userId={userId} />

      <LinkedTasksPanel noteId={note.id} userId={userId} />
    </div>
  );
}
