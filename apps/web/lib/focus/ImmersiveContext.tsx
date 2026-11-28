'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface ImmersiveState {
  immersive:    boolean;
  setImmersive: (value: boolean) => void;
}

const Ctx = createContext<ImmersiveState | null>(null);

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(false);
  return <Ctx.Provider value={{ immersive, setImmersive }}>{children}</Ctx.Provider>;
}

export function useImmersive(): ImmersiveState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useImmersive must be used within ImmersiveProvider');
  return ctx;
}
