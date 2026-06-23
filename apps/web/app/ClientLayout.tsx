'use client';

import { PropsWithChildren, useState } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/layout/Sidebar';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { ShortcutProvider } from '@/lib/shortcuts/ShortcutContext';
import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
import { usePathname } from 'next/navigation';

const PowerSyncProvider = dynamic(
  () => import('@/lib/powersync/PowerSyncProvider').then(m => m.PowerSyncProvider),
  { ssr: false }
);

export function ClientLayout({ children }: PropsWithChildren) {
  const pathname      = usePathname();
  const isLogin       = pathname === '/login';
  const [showCreate, setShowCreate]   = useState(false);
  const [showCapture, setShowCapture] = useState(false);

  if (isLogin) return <>{children}</>;

  return (
    <PowerSyncProvider>
      <ShortcutProvider>
        <KeyboardShortcuts onOpenQuickCapture={() => setShowCapture(true)}>
          <div className="flex h-screen bg-bg overflow-hidden">
            <Sidebar onNewProject={() => setShowCreate(true)} />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
          <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
          <QuickCaptureModal  open={showCapture} onClose={() => setShowCapture(false)} />
          <ShortcutsOverlay />
        </KeyboardShortcuts>
      </ShortcutProvider>
    </PowerSyncProvider>
  );
}
