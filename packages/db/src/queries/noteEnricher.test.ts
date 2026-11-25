import { describe, it, expect, vi } from 'vitest';
import { getPendingNotes, applyEnrichment } from './noteEnricher';

function fakeDb(rows: any[] = []) {
  return {
    getAll: vi.fn().mockResolvedValue(rows),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

describe('getPendingNotes', () => {
  it('queries for notes with link_status = pending', async () => {
    const db = fakeDb([{ id: 'n1', source_url: 'https://x.com' }]);
    const result = await getPendingNotes(db as any);
    const [sql] = db.getAll.mock.calls[0];
    expect(sql).toContain("link_status = 'pending'");
    expect(sql).toContain('deleted_at IS NULL');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('returns an empty array when nothing is pending', async () => {
    const db = fakeDb([]);
    expect(await getPendingNotes(db as any)).toEqual([]);
  });
});

describe('applyEnrichment', () => {
  it('writes all four link fields and sets link_status to ok', async () => {
    const db = fakeDb();
    await applyEnrichment(db as any, 'n1', {
      title: 'Article',
      excerpt: 'A short summary',
      imageUrl: 'https://x.com/img.jpg',
      siteName: 'X',
    });
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('UPDATE notes SET');
    expect(sql).toContain('link_title = ?');
    expect(sql).toContain('link_excerpt = ?');
    expect(sql).toContain('link_image_url = ?');
    expect(sql).toContain('link_site_name = ?');
    expect(sql).toContain("link_status = 'ok'");
    expect(sql).toContain('WHERE id = ?');
    expect(params).toEqual(['Article', 'A short summary', 'https://x.com/img.jpg', 'X', expect.any(String), 'n1']);
  });

  it('sets link_status to failed when enrichment data is null', async () => {
    const db = fakeDb();
    await applyEnrichment(db as any, 'n1', null);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain("link_status = 'failed'");
    expect(params).toEqual([expect.any(String), 'n1']);
  });
});
