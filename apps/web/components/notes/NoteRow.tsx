'use client';

import Link from 'next/link';
import { extractSoleUrl, noteDisplayTitle, noteExcerpt, parseLabelsJson } from '@todolist/core';
import type { NoteListRow } from '@todolist/db';
import { LabelChip } from '@/components/tasks/LabelChip';

interface Props {
  note: NoteListRow;
  project?: { name: string; color: string | null } | null;
  labelColor?: (name: string) => string;
}

export function NoteRow({ note, project, labelColor = () => '#6366F1' }: Props) {
  const image = extractSoleUrl(note.link_image_url ?? '');
  const excerpt = noteExcerpt(note);
  const labels = parseLabelsJson(note.labels);

  return (
    <Link
      href={`/notes/${note.id}`}
      className="flex gap-3 bg-surface border border-border rounded-xl px-4 py-3 hover:border-accent transition-colors"
    >
      {image && (
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-text-primary text-sm font-semibold truncate">{noteDisplayTitle(note)}</p>
          {note.conflict_of && <span className="text-xs text-warning flex-shrink-0">Conflict copy</span>}
          {note.is_archived ? <span className="text-xs text-text-muted flex-shrink-0">Archived</span> : null}
        </div>
        {excerpt && <p className="text-text-secondary text-xs truncate mt-0.5">{excerpt}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {note.link_site_name && <span className="text-xs text-text-muted">{note.link_site_name}</span>}
          {project && (
            <span className="text-xs text-text-muted inline-flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: project.color ?? '#6366F1' }}
                aria-hidden="true"
              />
              {project.name}
            </span>
          )}
          {labels.map((name) => (
            <LabelChip key={name} name={name} color={labelColor(name)} />
          ))}
        </div>
      </div>
    </Link>
  );
}
