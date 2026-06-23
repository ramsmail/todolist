'use client';

import { ReactNode, useEffect } from 'react';
import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';

interface Props {
  children: ReactNode;
  onOpenQuickCapture: () => void;
}

export function KeyboardShortcuts({ children, onOpenQuickCapture }: Props) {
  const { openShortcuts } = useShortcuts();

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenQuickCapture, openShortcuts]);

  return <>{children}</>;
}
