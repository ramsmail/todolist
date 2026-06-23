'use client';

import { createContext, useContext, useState, type PropsWithChildren } from 'react';

interface ShortcutContextType {
  shortcutsOpen:   boolean;
  openShortcuts:   () => void;
  closeShortcuts:  () => void;
  toggleShortcuts: () => void;
}

const ShortcutContext = createContext<ShortcutContextType | null>(null);

export function ShortcutProvider({ children }: PropsWithChildren) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  return (
    <ShortcutContext.Provider value={{
      shortcutsOpen,
      openShortcuts:   () => setShortcutsOpen(true),
      closeShortcuts:  () => setShortcutsOpen(false),
      toggleShortcuts: () => setShortcutsOpen(p => !p),
    }}>
      {children}
    </ShortcutContext.Provider>
  );
}

export function useShortcuts() {
  const ctx = useContext(ShortcutContext);
  if (!ctx) throw new Error('useShortcuts must be used inside ShortcutProvider');
  return ctx;
}
