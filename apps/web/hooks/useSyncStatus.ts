'use client';

import { useEffect, useState } from 'react';
import { usePowerSync } from '@powersync/react';

export type SyncStatus = 'synced' | 'syncing' | 'stale' | 'offline';

const STALE_MS = 5 * 60 * 1000;

export function useSyncStatus(): { status: SyncStatus; lastSyncedAt: Date | null } {
  const db = usePowerSync();
  const [status,      setStatus]      = useState<SyncStatus>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => {
      const s = db.currentStatus;
      if (!s.connected) { setStatus('offline'); return; }
      if (s.dataFlowStatus?.downloading) { setStatus('syncing'); return; }
      const last = s.lastSyncedAt ? new Date(s.lastSyncedAt) : null;
      setLastSyncedAt(last);
      setStatus(last && Date.now() - last.getTime() > STALE_MS ? 'stale' : 'synced');
    };
    update();
    const unsub = db.registerListener({ statusChanged: update });
    return () => unsub();
  }, [db]);

  return { status, lastSyncedAt };
}
