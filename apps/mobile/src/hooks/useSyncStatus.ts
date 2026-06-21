import { useState, useEffect } from 'react';
import { usePowerSync } from '@powersync/react';

// Mirror the SyncStatus type from @todolist/ui to keep types compatible
export type SyncStatus = 'synced' | 'syncing' | 'stale' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: Date | null;
}

export function useSyncStatus(): SyncState {
  const db = usePowerSync();

  const getState = (): SyncState => {
    const s = db.currentStatus;
    if (!s.connected) {
      return { status: 'offline', lastSyncedAt: s.lastSyncedAt ?? null };
    }
    if (s.dataFlowStatus?.downloading) {
      return { status: 'syncing', lastSyncedAt: s.lastSyncedAt ?? null };
    }
    return { status: 'synced', lastSyncedAt: s.lastSyncedAt ?? null };
  };

  const [state, setState] = useState<SyncState>(getState);

  useEffect(() => {
    const unsubscribe = db.registerListener({
      statusChanged: () => setState(getState()),
    });
    return unsubscribe;
  }, [db]);

  return state;
}
