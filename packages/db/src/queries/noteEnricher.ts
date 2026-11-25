import type { AbstractPowerSyncDatabase } from '@powersync/common';
import type { NoteRecord } from '../schema';

export type PendingNoteRow = Pick<NoteRecord, 'source_url'> & { id: string };

export type EnrichmentResult = {
  title: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  siteName: string | null;
} | null;

export async function getPendingNotes(db: AbstractPowerSyncDatabase): Promise<PendingNoteRow[]> {
  return db.getAll<PendingNoteRow>(
    `SELECT id, source_url FROM notes WHERE link_status = 'pending' AND deleted_at IS NULL LIMIT 20`
  );
}

export async function applyEnrichment(
  db: AbstractPowerSyncDatabase,
  noteId: string,
  data: EnrichmentResult
): Promise<void> {
  const now = new Date().toISOString();
  if (data) {
    await db.execute(
      `UPDATE notes SET link_title = ?, link_excerpt = ?, link_image_url = ?, link_site_name = ?, link_status = 'ok', updated_at = ? WHERE id = ?`,
      [data.title, data.excerpt, data.imageUrl, data.siteName, now, noteId]
    );
  } else {
    await db.execute(
      `UPDATE notes SET link_status = 'failed', updated_at = ? WHERE id = ?`,
      [now, noteId]
    );
  }
}
