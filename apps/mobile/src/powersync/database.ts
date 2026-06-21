import { PowerSyncDatabase } from '@powersync/react-native';
import { AppSchema } from '@todolist/db';

// Singleton — created once, never recreated.
// PowerSync keeps the SQLite file open for the app's lifetime.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'todolist.db' },
});
