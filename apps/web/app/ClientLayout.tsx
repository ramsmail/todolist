'use client';

import { PropsWithChildren, useState } from 'react';
import dynamic from 'next/dynamic';
import { AppShell } from '@/components/layout/AppShell';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { QuickCaptureModal } from '@/components/tasks/QuickCaptureModal';
import { ShortcutProvider } from '@/lib/shortcuts/ShortcutContext';
import { ShortcutsOverlay } from '@/components/layout/ShortcutsOverlay';
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
import { FocusSessionProvider } from '@/lib/focus/FocusSessionContext';
import { ImmersiveProvider } from '@/lib/focus/ImmersiveContext';
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
      <FocusSessionProvider>
        <ImmersiveProvider>
          <ShortcutProvider>
            <KeyboardShortcuts onOpenQuickCapture={() => setShowCapture(true)}>
              <AppShell onQuickAdd={() => setShowCapture(true)}>
                {children}
              </AppShell>
              <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
              <QuickCaptureModal  open={showCapture} onClose={() => setShowCapture(false)} />
              <ShortcutsOverlay />
            </KeyboardShortcuts>
          </ShortcutProvider>
        </ImmersiveProvider>
      </FocusSessionProvider>
    </PowerSyncProvider>
  );
}
