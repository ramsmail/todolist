'use client';

import { type PropsWithChildren } from 'react';
import { Sidebar } from './Sidebar';
import { useImmersive } from '@/lib/focus/ImmersiveContext';

interface Props extends PropsWithChildren {
  onQuickAdd: () => void;
}

export function AppShell({ children, onQuickAdd }: Props) {
  const { immersive } = useImmersive();

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {!immersive && <Sidebar onQuickAdd={onQuickAdd} />}
      <main className="flex-1 overflow-y-auto scrollable">
        {children}
      </main>
    </div>
  );
}
