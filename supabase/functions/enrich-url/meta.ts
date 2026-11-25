// Extracts link-preview metadata from raw HTML using regex patterns.
// No DOM, no Deno-specific APIs — works in both Deno and Node/vitest.

export interface MetaResult {
  title: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

function attr(html: string, ...patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
  }
  return null;
}

const og  = (prop: string) => new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
const tw  = (name: string) => new RegExp(`<meta[^>]+name=["']twitter:${name}["'][^>]+content=["']([^"']+)["']`, 'i');
// Also handle content-first ordering: <meta content="..." property="og:title">
const ogR = (prop: string) => new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i');
const twR = (name: string) => new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:${name}["']`, 'i');
const named = (name: string) => new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
const namedR = (name: string) => new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i');

function cap(s: string | null, max: number): string | null {
  return s && s.length > max ? s.slice(0, max) : s;
}

export function extractMeta(html: string): MetaResult {
  const title =
    attr(html, og('title'), ogR('title'), tw('title'), twR('title')) ??
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null);
  const excerpt =
    attr(html, og('description'), ogR('description'), tw('description'), twR('description'),
         named('description'), namedR('description'));
  const imageUrl = attr(html, og('image'), ogR('image'), tw('image:src'), twR('image:src'));
  const siteName = attr(html, og('site_name'), ogR('site_name'));
  return {
    title: cap(title, 500),
    excerpt: cap(excerpt, 500),
    imageUrl,
    siteName,
  };
}
