import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/web';
import { createClient } from '@/lib/supabase/client';

const FATAL_CODES = [/^22/, /^23/];

export class WebConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const supabase = createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw new Error('Not authenticated — cannot fetch PowerSync credentials');
    }
    return {
      endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL!,
      token:    session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const supabase = createClient();

    try {
      for (const op of transaction.crud) {
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
        console.error('Fatal upload error, discarding transaction:', ex);
        await transaction.complete();
      } else {
        throw ex;
      }
    }
  }
}
