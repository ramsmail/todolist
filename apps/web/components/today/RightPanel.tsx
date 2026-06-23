import type { ReactNode } from 'react';

export function RightPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="w-[280px] flex-shrink-0 flex flex-col gap-3 p-4 overflow-y-auto border-l border-border">
      {children}
    </aside>
  );
}
