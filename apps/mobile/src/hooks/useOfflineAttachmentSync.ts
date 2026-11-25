import { useEffect, useRef } from 'react';
import { usePowerSync } from '@powersync/react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabase/client';
import { readFileBytes } from '../share/readFileBytes';

interface PendingAttachment {
  id: string;
  local_uri: string;
  filename: string;
  mime_type: string;
  user_id: string;
}

// On every reconnect, query for attachments whose binary upload didn't complete
// (storage_path IS NULL but local_uri is set — wrote locally while offline) and
// retry. Uses PowerSync's own status listener so no native NetInfo module needed.
export function useOfflineAttachmentSync() {
  const db = usePowerSync();
  const { session } = useAuth();
  const running = useRef(false);

  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;

    return db.registerListener({
      statusChanged: async (status) => {
        if (!status.connected || running.current) return;
        running.current = true;

        try {
          const pending = await db.getAll<PendingAttachment>(
            `SELECT id, local_uri, filename, mime_type, user_id
             FROM attachments
             WHERE storage_path IS NULL
               AND local_uri IS NOT NULL
               AND user_id = ?`,
            [userId]
          );

          if (pending.length === 0) return;

          for (const row of pending) {
            try {
              const fileBytes = await readFileBytes(row.local_uri);
              const path = `${row.user_id}/${row.id}/${row.filename}`;
              const { data, error } = await supabase.storage
                .from('attachments')
                .upload(path, fileBytes, { contentType: row.mime_type, upsert: true });
              if (error) throw error;
              await db.execute(
                `UPDATE attachments SET storage_path = ?, updated_at = ? WHERE id = ?`,
                [data.path, new Date().toISOString(), row.id]
              );
            } catch (err) {
              console.error('[offlineSync] attachment retry failed:', row.id, err);
            }
          }
        } finally {
          running.current = false;
        }
      },
    });
  }, [db, session]);
}
