import { parseLabelsJson } from '../labels';

export type NoteKind = 'all' | 'links' | 'thoughts';

export interface NoteFilterable {
  source_url?: string | null;
  project_id?: string | null;
  labels?: string | null;
}

export interface NoteFilter {
  kind?: NoteKind;
  projectId?: string | null;
  label?: string | null;
}

export function filterNotes<T extends NoteFilterable>(notes: T[], filter: NoteFilter): T[] {
  const kind = filter.kind ?? 'all';
  return notes.filter((n) => {
    const isLink = !!n.source_url && n.source_url.trim() !== '';
    if (kind === 'links' && !isLink) return false;
    if (kind === 'thoughts' && isLink) return false;
    if (filter.projectId && n.project_id !== filter.projectId) return false;
    if (filter.label && !parseLabelsJson(n.labels).includes(filter.label)) return false;
    return true;
  });
}
