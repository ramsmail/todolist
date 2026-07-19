import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import { Alert } from 'react-native';
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

    // TEMPORARY DIAGNOSTIC — surface exactly what's being uploaded for
    // user_settings, in what order, since the local reads alone can't show
    // whether there are multiple/stale queued ops racing each other.
    const settingsOps = transaction.crud.filter(op => op.table === 'user_settings');
    if (settingsOps.length > 0) {
      Alert.alert(
        'Diagnostic: uploading user_settings',
        settingsOps.map(op => `${op.op}: ${JSON.stringify(op.opData)}`).join('\n')
      );
    }

    let failedOp: (typeof transaction.crud)[number] | undefined;
    try {
      for (const op of transaction.crud) {
        failedOp = op;
        const table = supabase.from(op.table);
        let result: { error: any };

        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData ?? {}).eq('id', op.id);
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
        Alert.alert(
          'Diagnostic: sync upload rejected',
          `Table: ${failedOp?.table}\nOp: ${failedOp?.op}\nCode: ${code}\nMessage: ${ex?.message ?? String(ex)}\nData: ${JSON.stringify(failedOp?.opData)}`
        );
        await transaction.complete();
      } else {
        console.error('Retryable upload error:', ex);
        Alert.alert(
          'Diagnostic: upload failed, will retry',
          `Table: ${failedOp?.table}\nOp: ${failedOp?.op}\nCode: ${code}\nMessage: ${ex?.message ?? String(ex)}`
        );
        throw ex; // Retryable (network, 5xx)
      }
    }
  }
}
