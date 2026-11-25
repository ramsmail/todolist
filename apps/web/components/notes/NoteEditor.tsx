'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent } from 'react';
import { usePowerSync } from '@powersync/react';
import {
  extractSoleUrl, insertLink, selectionToTaskTitle, toggleInline, toggleLinePrefix, type TextEdit,
} from '@todolist/core';
import { createLinkedTask, setNoteSourceUrl, updateNote } from '@todolist/db';
import { useAutosave } from '@/hooks/useAutosave';
import { invokeEnrichUrl } from '@/lib/notes/enrichUrl';
import { enrichState, runPendingEnrichment } from '@/lib/notes/enrichPending';
import { MarkdownPreview } from './MarkdownPreview';
import { MarkdownToolbar, type ToolbarAction } from './MarkdownToolbar';

export interface EditableNote {
  id: string;
  title: string | null;
  body: string | null;
  source_url: string | null;
}

interface Props {
  note: EditableNote;
  userId: string | null;
}

interface Draft {
  title: string;
  body: string;
}

export function NoteEditor({ note, userId }: Props) {
  const db = usePowerSync();
  const [title, setTitle] = useState(note.title ?? '');
  const [body, setBody] = useState(note.body ?? '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [hasSelection, setHasSelection] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const latest = useRef<Draft>({ title: note.title ?? '', body: note.body ?? '' });
  const saved = useRef<Draft>({ title: note.title ?? '', body: note.body ?? '' });

  const { schedule, flush, isDirty } = useAutosave<Draft>(async (draft) => {
    const patch: { title?: string; body?: string } = {};
    if (draft.title !== saved.current.title) patch.title = draft.title;
    if (draft.body !== saved.current.body) patch.body = draft.body;
    if (patch.title === undefined && patch.body === undefined) return;
    saved.current = { title: draft.title, body: draft.body };
    await updateNote(db as any, note.id, patch);
  });

  // Adopt changes that arrive from sync, but never overwrite text being typed.
  useEffect(() => {
    if (isDirty()) return;
    const incoming = { title: note.title ?? '', body: note.body ?? '' };
    saved.current = incoming;
    latest.current = incoming;
    setTitle(incoming.title);
    setBody(incoming.body);
  }, [note.title, note.body, isDirty]);

  // Restore the selection a toolbar action computed, after React re-renders the textarea.
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const ta = textareaRef.current;
    if (!sel || !ta) return;
    pendingSelection.current = null;
    ta.focus();
    ta.setSelectionRange(sel.start, sel.end);
    setHasSelection(sel.end > sel.start);
  }, [body]);

  const commit = (next: Draft) => {
    latest.current = next;
    schedule(next);
  };
  const onTitleChange = (value: string) => {
    setTitle(value);
    commit({ ...latest.current, title: value });
  };
  const onBodyChange = (value: string) => {
    setBody(value);
    commit({ ...latest.current, body: value });
  };

  const syncSelectionState = () => {
    const ta = textareaRef.current;
    if (ta) setHasSelection(ta.selectionEnd > ta.selectionStart);
  };

  const apply = (action: ToolbarAction) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const edit: TextEdit = { text: body, selStart: ta.selectionStart, selEnd: ta.selectionEnd };

    if (action === 'task') {
      const title = selectionToTaskTitle(edit.text.slice(edit.selStart, edit.selEnd));
      if (!title || !userId) return;
      void createLinkedTask(db as any, { userId, noteId: note.id, title });
      return;
    }

    const next = {
      bold: () => toggleInline(edit, '**'),
      italic: () => toggleInline(edit, '_'),
      heading: () => toggleLinePrefix(edit, '## '),
      list: () => toggleLinePrefix(edit, '- '),
      checkbox: () => toggleLinePrefix(edit, '- [ ] '),
      link: () => insertLink(edit),
    }[action]();

    pendingSelection.current = { start: next.selStart, end: next.selEnd };
    setBody(next.text);
    commit({ ...latest.current, body: next.text });
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const url = extractSoleUrl(e.clipboardData.getData('text'));
    if (!url || body.trim() !== '' || note.source_url) return;
    // The pasted url also stays in the body; the preview card is added above it.
    void (async () => {
      await setNoteSourceUrl(db as any, note.id, url);
      void runPendingEnrichment(db as any, invokeEnrichUrl, enrichState);
    })();
  };

  return (
    <div className="space-y-3">
      <input
        aria-label="Note title"
        value={title}
        placeholder="Untitled"
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={() => void flush()}
        className="w-full bg-transparent text-text-primary text-2xl font-bold placeholder:text-text-muted focus:outline-none"
      />

      <div className="flex items-center justify-between gap-3">
        <div role="group" aria-label="Editor mode" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
          {(['edit', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                void flush();
                setHasSelection(false);
                setMode(m);
              }}
              className={`px-3 py-1 ${mode === m ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface'}`}
            >
              {m === 'edit' ? 'Edit' : 'Preview'}
            </button>
          ))}
        </div>
        {mode === 'edit' && <MarkdownToolbar onAction={apply} canMakeTask={hasSelection && !!userId} />}
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          aria-label="Note body"
          value={body}
          placeholder="Write in markdown…"
          onChange={(e) => onBodyChange(e.target.value)}
          onBlur={() => void flush()}
          onPaste={onPaste}
          onSelect={syncSelectionState}
          className="w-full min-h-[320px] bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm font-mono resize-y focus:outline-none focus:border-accent"
        />
      ) : (
        <div className="min-h-[320px] bg-surface border border-border rounded-xl px-4 py-3">
          <MarkdownPreview source={body} />
        </div>
      )}
    </div>
  );
}
