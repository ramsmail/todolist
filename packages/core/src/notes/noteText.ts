// Pure text helpers for notes. No DB, no React.

export interface NoteTextFields {
  title?: string | null;
  body?: string | null;
  link_title?: string | null;
  link_excerpt?: string | null;
}

const TITLE_MAX = 80;
const TASK_TITLE_MAX = 200;

// Leading markdown block markers: headings, quotes, bullets, ordered items, checkboxes.
const BLOCK_MARKERS = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)*(?:\[[ xX]\]\s+)?/;
const INLINE_MARKERS = /(\*\*|__|\*|_|~~|`)/g;

function stripLine(line: string): string {
  return line.replace(BLOCK_MARKERS, '').replace(INLINE_MARKERS, '').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function firstContentLineIndex(lines: string[]): number {
  return lines.findIndex((l) => stripLine(l) !== '');
}

export function noteDisplayTitle(note: NoteTextFields): string {
  const explicit = (note.title ?? '').trim();
  if (explicit) return explicit;
  const link = (note.link_title ?? '').trim();
  if (link) return link;
  const lines = (note.body ?? '').split('\n');
  const i = firstContentLineIndex(lines);
  if (i === -1) return 'Untitled';
  return truncate(stripLine(lines[i]), TITLE_MAX);
}

export function noteExcerpt(note: NoteTextFields, max = 120): string {
  let lines = (note.body ?? '').split('\n');
  const usesBodyAsTitle = !(note.title ?? '').trim() && !(note.link_title ?? '').trim();
  if (usesBodyAsTitle) {
    const i = firstContentLineIndex(lines);
    if (i !== -1) lines = lines.slice(i + 1);
  }
  const text = lines.map(stripLine).filter(Boolean).join(' ');
  const source = text || (note.link_excerpt ?? '').trim();
  return source.length <= max ? source : source.slice(0, max);
}

export function selectionToTaskTitle(selection: string): string {
  const joined = selection.split('\n').map(stripLine).filter(Boolean).join(' ');
  return joined.slice(0, TASK_TITLE_MAX);
}

export function extractSoleUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}
