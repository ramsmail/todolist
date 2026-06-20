import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from './tokens';

type SyncStatus = 'synced' | 'syncing' | 'stale' | 'offline';

interface Props {
  status: SyncStatus;
  lastSyncedAt: Date | null;
}

function statusColor(s: SyncStatus): string {
  if (s === 'synced') return colors.success;
  if (s === 'syncing') return colors.accent;
  if (s === 'stale') return colors.warning;
  return colors.error;
}

function statusLabel(s: SyncStatus, lastSyncedAt: Date | null): string {
  if (s === 'offline') return 'Offline';
  if (s === 'syncing') return 'Syncing…';
  if (s === 'stale' && lastSyncedAt) {
    const mins = Math.floor((Date.now() - lastSyncedAt.getTime()) / 60000);
    return `Not synced (${mins}m ago)`;
  }
  if (lastSyncedAt) {
    return `Synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return 'Synced';
}

export function SyncStatusIndicator({ status, lastSyncedAt }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
      <Text style={styles.label}>{statusLabel(status, lastSyncedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, color: colors.textMuted },
});
