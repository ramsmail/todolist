import { PowerSyncDatabase, type WebSQLOpenFactoryOptions } from '@powersync/web';
import { AppSchema } from '@todolist/db';

let instance: PowerSyncDatabase | undefined;

export function getPowerSyncDb(): PowerSyncDatabase {
  if (!instance) {
    const databaseOptions: WebSQLOpenFactoryOptions = {
      dbFilename: 'todolist.db',
      worker: '/@powersync/worker/WASQLiteDB.umd.js',
    };
    instance = new PowerSyncDatabase({
      schema: AppSchema,
      database: databaseOptions,
      sync: { worker: '/@powersync/worker/SharedSyncImplementation.umd.js' },
    });
  }
  return instance;
}
