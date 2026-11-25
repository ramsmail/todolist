import { PowerSyncDatabase } from '@powersync/react-native';
import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import { AppSchema } from '@todolist/db';

// op-sqlite is the native SQLite adapter PowerSync uses on React Native.
// Without an explicit SQLOpenFactory, PowerSync has no on-device SQLite to
// open, so sync silently never runs — this factory is what makes it work.
const factory = new OPSqliteOpenFactory({
  dbFilename: 'todolist.db',
});

// Singleton — created once, never recreated.
// PowerSync keeps the SQLite file open for the app's lifetime.
export const db = new PowerSyncDatabase({
  database: factory,
  schema: AppSchema,
});
