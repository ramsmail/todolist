'use client';

import { PropsWithChildren, useState } from 'react';
import { PowerSyncProvider } from '@/lib/powersync/PowerSyncProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { usePathname } from 'next/navigation';

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
