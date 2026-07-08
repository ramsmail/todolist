import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { useQuery } from '@powersync/react';
import type { AttachmentRecord } from '../schema';

export function useAttachmentsForTask(taskId: string) {
  return useQuery<AttachmentRecord>(
    `SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at`,
    [taskId]
  );
}

export async function createAttachment(
  db: AbstractPowerSyncDatabase,
  fields: {
    taskId: string;
    userId: string;
    type: 'image' | 'audio' | 'file';
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath?: string | null;
    localUri?: string;
    thumbnailUri?: string;
    durationSeconds?: number;
  }
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO attachments
       (id, task_id, user_id, type, filename, mime_type, size_bytes,
        storage_path, local_uri, thumbnail_uri, duration_seconds, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      fields.taskId,
      fields.userId,
      fields.type,
      fields.filename,
      fields.mimeType,
      fields.sizeBytes,
      fields.storagePath,
      fields.localUri ?? null,
      fields.thumbnailUri ?? null,
      fields.durationSeconds ?? null,
      now,
      now,
    ]
  );
  return id;
}
