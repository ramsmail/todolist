'use client';

import { ReactNode, useEffect } from 'react';
import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';
import { shouldIgnoreShortcut } from '@/lib/shortcuts/shouldIgnoreShortcut';
import { useNewNote } from '@/hooks/useNewNote';

interface Props {
  children: ReactNode;
  onOpenQuickCapture: () => void;
}

export function KeyboardShortcuts({ children, onOpenQuickCapture }: Props) {
  const { openShortcuts } = useShortcuts();
  const newNote = useNewNote();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter for quick capture
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onOpenQuickCapture();
      }
      // Cmd+/ or Ctrl+/ to open shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        openShortcuts();
      }
      // n for a new note (never while typing or with a modifier held)
      if (
        e.key === 'n' &&
        !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey &&
        !shouldIgnoreShortcut(e.target)
      ) {
        e.preventDefault();
        void newNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenQuickCapture, openShortcuts, newNote]);

  return <>{children}</>;
}
