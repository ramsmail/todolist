import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { INBOX_QUERY } from './queries/tasks';

export { AppSchema } from './schema';
export type { Database, TaskRecord, ProjectRecord, LabelRecord, SavedFilterRecord, DailyLogRecord, UserSettingsRecord } from './schema';

// Plain (non-hook) inbox count for use outside component render — e.g. the
// notification reconciliation service, which runs in a useEffect, not a
// component body, so useInboxTasks (a hook) can't be called there.
export async function getInboxCount(db: AbstractPowerSyncDatabase): Promise<number> {
  const rows = await db.getAll(INBOX_QUERY);
  return rows.length;
}

export * from './queries/tasks';
export * from './queries/daily-log';
export * from './queries/projects';
export * from './queries/labels';
export * from './queries/labelUtils';
export * from './queries/savedFilters';
export * from './queries/attachments';
export * from './queries/reminders';
export * from './queries/userSettings';
export * from './queries/streak';
export * from './queries/weeklyActivity';
export * from './queries/syncTables';
