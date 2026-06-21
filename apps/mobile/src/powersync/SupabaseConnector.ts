import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '../supabase/client';

const FATAL_CODES = [/^22/, /^23/]; // Postgres class 22 (data), 23 (integrity)

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated - cannot fetch PowerSync credentials');
    }
    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL!,
      token:    session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const table = supabase.from(op.table);
        let result: { error: any };

        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            // Soft delete — deleted_at triggers the DB updated_at trigger; don't pass updated_at client-side
            result = await table
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', op.id);
            break;
          default:
            throw new Error(`Unknown UpdateType: ${(op as any).op}`);
        }

        if (result!.error) throw result!.error;
      }

      await transaction.complete();
    } catch (ex: any) {
      const code = ex?.code ?? '';
      if (FATAL_CODES.some(re => re.test(String(code)))) {
        // Data bug — discard to unblock the queue rather than retry forever
        console.error('Fatal upload error, discarding transaction:', ex);
        await transaction.complete();
      } else {
        throw ex; // Retryable (network, 5xx)
      }
    }
  }
}
