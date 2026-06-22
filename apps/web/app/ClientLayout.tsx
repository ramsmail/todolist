'use client';

import { PropsWithChildren, useState } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/layout/Sidebar';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { usePathname } from 'next/navigation';

// @powersync/web uses __dirname and browser-only APIs (WASM, Web Workers).
// dynamic + ssr:false ensures the module never executes in the Node.js/Edge SSR context.
const PowerSyncProvider = dynamic(
  () => import('@/lib/powersync/PowerSyncProvider').then(m => m.PowerSyncProvider),
  { ssr: false }
);

export function ClientLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isLogin  = pathname === '/login';
  const [showCreate, setShowCreate] = useState(false);

  if (isLogin) return <>{children}</>;

  return (
    <PowerSyncProvider>
      <div className="flex h-screen bg-bg overflow-hidden">
        <Sidebar onNewProject={() => setShowCreate(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </PowerSyncProvider>
  );
}
