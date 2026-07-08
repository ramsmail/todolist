import { describe, it, expect, vi } from 'vitest';
import { handleShareIntent } from '../src/share/handleShareIntent';

// Minimal ShareIntent factory — only the fields handleShareIntent reads.
function intent(partial: Record<string, unknown>): any {
  return { text: null, webUrl: null, files: null, type: null, ...partial };
}

const bytesFor = (s: string) => new Uint8Array(Buffer.from(s));

describe('handleShareIntent', () => {
  it('maps a shared URL (webUrl) to a text payload with sourceUrl', async () => {
    const read = vi.fn();
    const res = await handleShareIntent(
      intent({ webUrl: 'https://example.com/article', type: 'weburl' }),
      read
    );
    expect(res.sourceUrl).toBe('https://example.com/article');
    expect(res.title).toBe('https://example.com/article');
    expect(res.files).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it('detects a URL that arrived only in the text field (no webUrl)', async () => {
    const res = await handleShareIntent(
      intent({ text: 'https://example.com/x', type: 'text' }),
      vi.fn()
    );
    expect(res.sourceUrl).toBe('https://example.com/x');
    expect(res.title).toBe('https://example.com/x');
    expect(res.files).toEqual([]);
  });

  it('maps plain shared text to a title with no sourceUrl', async () => {
    const res = await handleShareIntent(
      intent({ text: 'Buy milk tomorrow', type: 'text' }),
      vi.fn()
    );
    expect(res.title).toBe('Buy milk tomorrow');
    expect(res.sourceUrl).toBeNull();
    expect(res.files).toEqual([]);
  });

  it('uses only the first line of multiline text and trims it', async () => {
    const res = await handleShareIntent(
      intent({ text: '  First line  \nSecond line\nThird', type: 'text' }),
      vi.fn()
    );
    expect(res.title).toBe('First line');
  });

  it('truncates very long titles to 200 chars with an ellipsis', async () => {
    const long = 'a'.repeat(300);
    const res = await handleShareIntent(intent({ text: long, type: 'text' }), vi.fn());
    expect(res.title.length).toBe(201); // 200 + ellipsis char
    expect(res.title.endsWith('…')).toBe(true);
  });

  it('reads bytes for a shared file and builds a SharedFile', async () => {
    const read = vi.fn().mockResolvedValue(bytesFor('PDFDATA'));
    const res = await handleShareIntent(
      intent({
        type: 'file',
        files: [
          { fileName: 'doc.pdf', mimeType: 'application/pdf', path: 'file:///cache/doc.pdf', size: 7, width: null, height: null, duration: null },
        ],
      }),
      read
    );
    expect(read).toHaveBeenCalledWith('file:///cache/doc.pdf');
    expect(res.files).toHaveLength(1);
    expect(res.files[0]).toMatchObject({
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 7,
      localUri: 'file:///cache/doc.pdf',
    });
    expect(res.files[0].fileBytes).toEqual(bytesFor('PDFDATA'));
    expect(res.title).toBe('doc.pdf'); // falls back to filename
  });

  it('falls back to byte length when file size is null', async () => {
    const read = vi.fn().mockResolvedValue(bytesFor('hello'));
    const res = await handleShareIntent(
      intent({
        type: 'media',
        files: [
          { fileName: 'p.jpg', mimeType: 'image/jpeg', path: 'file:///p.jpg', size: null, width: 1, height: 1, duration: null },
        ],
      }),
      read
    );
    expect(res.files[0].sizeBytes).toBe(5);
  });

  it('prefers caption text as the title when both text and files are shared', async () => {
    const read = vi.fn().mockResolvedValue(bytesFor('img'));
    const res = await handleShareIntent(
      intent({
        text: 'Holiday photo',
        type: 'media',
        files: [
          { fileName: 'p.jpg', mimeType: 'image/jpeg', path: 'file:///p.jpg', size: 3, width: 1, height: 1, duration: null },
        ],
      }),
      read
    );
    expect(res.title).toBe('Holiday photo');
    expect(res.files).toHaveLength(1);
  });

  it('reads every file when multiple are shared, preserving order', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(bytesFor('one'))
      .mockResolvedValueOnce(bytesFor('two'));
    const res = await handleShareIntent(
      intent({
        type: 'media',
        files: [
          { fileName: 'a.jpg', mimeType: 'image/jpeg', path: 'file:///a.jpg', size: 3, width: 1, height: 1, duration: null },
          { fileName: 'b.jpg', mimeType: 'image/jpeg', path: 'file:///b.jpg', size: 3, width: 1, height: 1, duration: null },
        ],
      }),
      read
    );
    expect(res.files.map((f) => f.filename)).toEqual(['a.jpg', 'b.jpg']);
    expect(res.files[0].fileBytes).toEqual(bytesFor('one'));
    expect(res.files[1].fileBytes).toEqual(bytesFor('two'));
  });

  it('throws when the intent carries no usable content', async () => {
    await expect(handleShareIntent(intent({}), vi.fn())).rejects.toThrow(/no usable/i);
  });
});
