import { useState, useEffect } from 'react';
import { usePowerSync } from '@powersync/react';

export type SyncStatus = 'synced' | 'syncing' | 'stale' | 'offline';

export interface SyncState {
  status:      SyncStatus;
  lastSyncedAt: Date | null;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Module-level pure function avoids stale-closure issues in useEffect dep arrays
function deriveState(s: {
  connected:       boolean;
  dataFlowStatus?: { downloading?: boolean };
  lastSyncedAt?:   Date;
}): SyncState {
  const lastSyncedAt = s.lastSyncedAt ?? null;
  if (!s.connected) return { status: 'offline', lastSyncedAt };
  if (s.dataFlowStatus?.downloading) return { status: 'syncing', lastSyncedAt };
  if (lastSyncedAt && Date.now() - lastSyncedAt.getTime() > STALE_THRESHOLD_MS) {
    return { status: 'stale', lastSyncedAt };
  }
  return { status: 'synced', lastSyncedAt };
}

export function useSyncStatus(): SyncState {
  const db = usePowerSync();
  const [state, setState] = useState<SyncState>(() => deriveState(db.currentStatus));

  useEffect(() => {
    // Use the status argument provided by the listener (not re-reading db.currentStatus)
    return db.registerListener({
      statusChanged: (status) => setState(deriveState(status)),
    });
  }, [db]);

  // Schedule a timer to flip 'synced' → 'stale' exactly when the threshold is crossed
  useEffect(() => {
    if (state.status !== 'synced' || !state.lastSyncedAt) return;
    const remaining = STALE_THRESHOLD_MS - (Date.now() - state.lastSyncedAt.getTime());
    if (remaining <= 0) {
      setState(prev => ({ ...prev, status: 'stale' }));
      return;
    }
    const timer = setTimeout(() => {
      setState(prev => prev.status === 'synced' ? { ...prev, status: 'stale' } : prev);
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.status, state.lastSyncedAt]);

  return state;
}
