import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { ReminderRecord } from '../schema';

export function useTaskReminder(taskId: string) {
  return useQuery<ReminderRecord>(
    `SELECT * FROM reminders WHERE task_id = ? AND deleted_at IS NULL ORDER BY remind_at_utc DESC LIMIT 1`,
    [taskId]
  );
}

export async function createReminder(
  db: AbstractPowerSyncDatabase,
  taskId: string,
  userId: string,
  remindAtLocal: string,
  remindAtUtc: string
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO reminders
       (id, task_id, user_id, remind_at_local, remind_at_utc, notified_mobile, notified_web, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, taskId, userId, remindAtLocal, remindAtUtc, 0, 0, now, now]
  );
  return id;
}

export async function updateReminderTime(
  db: AbstractPowerSyncDatabase,
  reminderId: string,
  remindAtLocal: string,
  remindAtUtc: string
): Promise<void> {
  await db.execute(
    `UPDATE reminders
     SET remind_at_local = ?, remind_at_utc = ?, notified_mobile = 0, notified_web = 0, updated_at = ?
     WHERE id = ?`,
    [remindAtLocal, remindAtUtc, new Date().toISOString(), reminderId]
  );
}

export async function deleteReminder(db: AbstractPowerSyncDatabase, reminderId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [now, reminderId]
  );
}

function toLocalDisplay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// Advances a reminder by `minutes` and resets both notified flags, re-entering
// both delivery paths (Edge Function poll + local reconciliation) exactly like
// a fresh reminder — no separate snooze-specific delivery code needed.
export async function snoozeReminder(
  db: AbstractPowerSyncDatabase,
  reminderId: string,
  minutes: number
): Promise<void> {
  const row = await db.getOptional<ReminderRecord>(
    `SELECT * FROM reminders WHERE id = ? AND deleted_at IS NULL`,
    [reminderId]
  );
  if (!row) return;

  const nextInstant = new Date(new Date(row.remind_at_utc).getTime() + minutes * 60000);
  await db.execute(
    `UPDATE reminders
     SET remind_at_local = ?, remind_at_utc = ?, notified_mobile = 0, notified_web = 0, updated_at = ?
     WHERE id = ?`,
    [toLocalDisplay(nextInstant), nextInstant.toISOString(), new Date().toISOString(), reminderId]
  );
}

// Reconciliation source-of-truth query: reminders that still need a local
// fallback notification scheduled (push not yet confirmed delivered, not
// deleted, still in the future).
export async function getPendingReminders(
  db: AbstractPowerSyncDatabase,
  userId: string
): Promise<Pick<ReminderRecord, 'id' | 'task_id' | 'remind_at_utc'>[]> {
  return db.getAll(
    `SELECT id, task_id, remind_at_utc FROM reminders
     WHERE user_id = ? AND notified_mobile = 0 AND deleted_at IS NULL AND remind_at_utc > ?`,
    [userId, new Date().toISOString()]
  );
}
