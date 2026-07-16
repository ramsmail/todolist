import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { UserSettingsRecord } from '../schema';

// user_settings has at most one row: the current (locally synced) user's own
// row, per the `id = auth.user_id()` sync rule — no WHERE clause needed.
export function useUserSettings() {
  return useQuery<UserSettingsRecord>(`SELECT * FROM user_settings LIMIT 1`);
}

export async function getUserSettings(db: AbstractPowerSyncDatabase): Promise<UserSettingsRecord | null> {
  return db.getOptional<UserSettingsRecord>(`SELECT * FROM user_settings LIMIT 1`);
}

type WritableFields = Partial<Pick<UserSettingsRecord, 'timezone' | 'expo_push_token' | 'nudge_enabled' | 'nudge_time'>>;

export async function upsertUserSettings(
  db: AbstractPowerSyncDatabase,
  userId: string,
  fields: WritableFields
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.getOptional<{ id: string }>(`SELECT id FROM user_settings WHERE id = ?`, [userId]);

  if (existing) {
    const keys = Object.keys(fields) as (keyof WritableFields)[];
    if (keys.length === 0) return;
    const sets = keys.map(k => `${k} = ?`);
    const values = keys.map(k => fields[k]);
    await db.execute(
      `UPDATE user_settings SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
      [...values, now, userId]
    );
  } else {
    await db.execute(
      `INSERT INTO user_settings (id, timezone, expo_push_token, nudge_enabled, nudge_time, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [userId, fields.timezone ?? null, fields.expo_push_token ?? null, fields.nudge_enabled ?? 0, fields.nudge_time ?? null, now, now]
    );
  }
}
