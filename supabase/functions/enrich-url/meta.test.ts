import { describe, it, expect } from 'vitest';
import { extractMeta } from './meta';

const html = (head: string) => `<!DOCTYPE html><html><head>${head}</head><body></body></html>`;

describe('extractMeta', () => {
  it('extracts og:title, og:description, og:image, og:site_name', () => {
    const m = extractMeta(html(`
      <meta property="og:title" content="OG Title" />
      <meta property="og:description" content="OG Desc" />
      <meta property="og:image" content="https://x.com/img.jpg" />
      <meta property="og:site_name" content="X" />
    `));
    expect(m.title).toBe('OG Title');
    expect(m.excerpt).toBe('OG Desc');
    expect(m.imageUrl).toBe('https://x.com/img.jpg');
    expect(m.siteName).toBe('X');
  });

  it('falls back to twitter:title when og:title is absent', () => {
    const m = extractMeta(html(`
      <meta name="twitter:title" content="TW Title" />
      <meta name="twitter:description" content="TW Desc" />
    `));
    expect(m.title).toBe('TW Title');
    expect(m.excerpt).toBe('TW Desc');
  });

  it('falls back to <title> when og and twitter are absent', () => {
    const m = extractMeta(html(`<title>  Page Title  </title>`));
    expect(m.title).toBe('Page Title');
  });

  it('falls back to meta[name=description] for excerpt', () => {
    const m = extractMeta(html(`
      <title>T</title>
      <meta name="description" content="Meta desc" />
    `));
    expect(m.excerpt).toBe('Meta desc');
  });

  it('returns nulls for missing fields', () => {
    const m = extractMeta('<html></html>');
    expect(m.title).toBeNull();
    expect(m.excerpt).toBeNull();
    expect(m.imageUrl).toBeNull();
    expect(m.siteName).toBeNull();
  });

  it('truncates title to 500 chars', () => {
    const m = extractMeta(html(`<title>${'a'.repeat(600)}</title>`));
    expect(m.title!.length).toBe(500);
  });

  it('truncates excerpt to 500 chars', () => {
    const m = extractMeta(html(`
      <meta name="description" content="${'x'.repeat(600)}" />
    `));
    expect(m.excerpt!.length).toBe(500);
  });
});
