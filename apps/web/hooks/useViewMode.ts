'use client';

import { useState, useEffect } from 'react';

type ViewMode = 'list' | 'board';

export function useViewMode() {
  const [mode, setModeState] = useState<ViewMode>('list');
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem('today-view-mode');
    if (saved === 'list' || saved === 'board') {
      setModeState(saved);
    } else {
      setModeState('list');
    }
    setMounted(true);
  }, []);

  const setMode = (newMode: ViewMode) => {
    setModeState(newMode);
    localStorage.setItem('today-view-mode', newMode);
  };

  return { mode, setMode, mounted };
}
