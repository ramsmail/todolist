'use client';

import { useSyncStatus } from '@/hooks/useSyncStatus';

const dotColor: Record<string, string> = {
  synced:  'bg-success',
  syncing: 'bg-accent animate-pulse',
  stale:   'bg-warning',
  offline: 'bg-error',
};

const label: Record<string, string> = {
  synced:  'Synced',
  syncing: 'Syncing…',
  stale:   'Sync stale',
  offline: 'Offline',
};

export function SyncStatusIndicator() {
  const { status, lastSyncedAt } = useSyncStatus();
  const time = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[status]}`} />
      <span className="text-text-muted text-xs">
        {label[status]}{status === 'synced' && time ? ` ${time}` : ''}
      </span>
    </div>
  );
}
