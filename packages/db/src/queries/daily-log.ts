import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { DailyLogRecord } from '../schema';

// The calendar day used as the daily_log key. Uses the UTC date to stay
// consistent with the rest of the app's date handling (see TODAY_QUERY /
// `new Date().toISOString().split('T')[0]` in tasks).
function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

// --- React hooks ---

// Today's self-reported energy level (1–5), or null if not set yet.
// Relies on sync rules to scope rows to the current user (no user_id filter).
export function useTodayEnergy() {
  const today = todayKey();
  const query = useQuery<Pick<DailyLogRecord, 'energy_level'>>(
    `SELECT energy_level FROM daily_log WHERE log_date = ? LIMIT 1`,
    [today]
  );
  const energy = useMemo<number | null>(
    () => (query.data?.[0]?.energy_level ?? null) as number | null,
    [query.data]
  );
  return { ...query, energy };
}

// --- Write helpers (called directly with db instance) ---

// Upsert today's energy level. PowerSync-backed views don't reliably support
// SQL `ON CONFLICT`, so we read-then-write (mirrors completeTask's pattern).
export async function setEnergy(
  db: AbstractPowerSyncDatabase,
  userId: string,
  level: number
): Promise<void> {
  const today = todayKey();
  const now = new Date().toISOString();
  const existing = await db.getOptional<Pick<DailyLogRecord, 'user_id'> & { id: string }>(
    `SELECT id FROM daily_log WHERE user_id = ? AND log_date = ? LIMIT 1`,
    [userId, today]
  );

  if (existing) {
    await db.execute(
      `UPDATE daily_log SET energy_level = ?, updated_at = ? WHERE id = ?`,
      [level, now, existing.id]
    );
    return;
  }

  await db.execute(
    `INSERT INTO daily_log (id, user_id, log_date, energy_level, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
    [crypto.randomUUID(), userId, today, level, now, now]
  );
}
