import { PowerSyncDatabase } from '@powersync/node';
import { column, Schema, Table } from '@powersync/node';
import { createClient } from '@supabase/supabase-js';
import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/node';

// Minimal 1-table schema for the spike
const tasks = new Table({ title: column.text, status: column.text });
const SpikeSchema = new Schema({ tasks });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const POWERSYNC_URL = process.env.POWERSYNC_URL!;
const SUPABASE_EMAIL = process.env.SUPABASE_EMAIL!;
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class SpikeConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: SUPABASE_EMAIL,
      password: SUPABASE_PASSWORD,
    });
    if (error || !session) throw new Error(`Auth failed: ${error?.message}`);
    return { endpoint: POWERSYNC_URL, token: session.access_token };
  }

  async uploadData(db: AbstractPowerSyncDatabase) {
    const tx = await db.getNextCrudTransaction();
    if (!tx) return;
    for (const op of tx.crud) {
      await supabase.from(op.table).upsert({ ...op.opData, id: op.id });
    }
    await tx.complete();
  }
}

async function main() {
  const db = new PowerSyncDatabase({ schema: SpikeSchema, database: { dbFilename: '/tmp/spike.db' } });
  await db.connect(new SpikeConnector());

  console.log('Connected. Waiting 2s for initial sync...');
  await new Promise(r => setTimeout(r, 2000));

  // 1. INSERT a task locally
  const id = crypto.randomUUID();
  await db.execute('INSERT INTO tasks (id, title, status) VALUES (?, ?, ?)', [id, 'Spike task', 'inbox']);
  console.log('Task inserted locally');

  // 2. Verify local read
  const local = await db.getAll<{ id: string; title: string }>('SELECT id, title FROM tasks WHERE id = ?', [id]);
  console.assert(local.length === 1, 'Local read failed');
  console.log('Local read OK:', local[0].title);

  // 3. Verify upload propagated to Supabase
  await new Promise(r => setTimeout(r, 3000));
  const { data } = await supabase.from('tasks').select('id, title').eq('id', id);
  console.assert(data && data.length === 1, 'Supabase read failed');
  console.log('Supabase read OK:', data?.[0]?.title);

  // 4. UPDATE in Supabase, verify it syncs down
  await supabase.from('tasks').update({ title: 'Updated remotely' }).eq('id', id);
  await new Promise(r => setTimeout(r, 3000));
  const synced = await db.getAll<{ title: string }>('SELECT title FROM tasks WHERE id = ?', [id]);
  console.assert(synced[0]?.title === 'Updated remotely', 'Sync-down failed');
  console.log('Sync-down OK:', synced[0].title);

  console.log('\n✓ Spike passed — PowerSync ↔ Supabase sync is working');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
