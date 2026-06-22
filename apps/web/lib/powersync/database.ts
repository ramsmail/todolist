import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from '@todolist/db';

let instance: PowerSyncDatabase | undefined;

export function getPowerSyncDb(): PowerSyncDatabase {
  if (!instance) {
    instance = new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: 'todolist.db' },
    });
  }
  return instance;
}
