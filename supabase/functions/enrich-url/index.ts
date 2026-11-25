// Supabase Edge Function: enrich-url
//
// Accepts exactly one of:
//   { taskId, url } — fetches the page, sets the task's title to "Read: <title>",
//     and backfills the description only if the task doesn't already have one
//     (never clobbers something the user typed).
//   { noteId, url } — fetches the page and writes link_title, link_excerpt,
//     link_image_url, link_site_name and link_status ('ok' | 'failed') to the
//     note. Never touches title or body.
// Called fire-and-forget from the mobile share screen (task) and the note
// capture flow (note) after a URL is captured.
//
// Auth: uses the caller's JWT (forwarded Authorization header) so every UPDATE
// is constrained by the tasks/notes RLS policies — a user can only enrich their
// own rows. No service-role key is used.
//
// SSRF: the URL is validated with assertSafeUrl before the first fetch, and each
// redirect hop is re-validated (redirects are followed manually, capped).
//
// Why enrich server-side: the page fetch + parse must not run on a possibly
// metered/offline device, and the update flows back to every client via
// PowerSync replication of the Postgres change.
//
// Deploy: supabase functions deploy enrich-url

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { assertSafeUrl } from './urlGuard.ts';
import { extractMeta } from './meta.ts';

const TITLE_PREFIX = 'Read: ';
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; TodoListBot/1.0; +https://todolist.app)';
// The capture writes the row locally via PowerSync; it may not have replicated
// to Postgres yet when this runs. Retry until the row appears.
const UPDATE_ATTEMPTS = 6;
const UPDATE_RETRY_MS = 1500;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Caller-scoped client: RLS applies, so only the caller's own rows can be read or written.
function makeClient(authHeader: string) {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractTitle(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const raw = og?.[1] ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!raw) return null;
  const clean = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  return clean || null;
}

function extractDescription(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const named =
    og ??
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const raw = named?.[1];
  if (!raw) return null;
  const clean = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  return clean || null;
}

// Read at most maxBytes of the body — a title lives near the top of <head>, and
// this caps memory against a hostile or huge response.
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder('utf-8').decode(concat(chunks, Math.min(total, maxBytes)));
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    if (off >= size) break;
    const slice = c.subarray(0, size - off);
    out.set(slice, off);
    off += slice.length;
  }
  return out;
}

// Fetches an HTML page, following redirects manually so every hop passes the
// SSRF guard. Returns null on any failure (unsafe hop, timeout, non-2xx, non-HTML).
async function fetchPageHtml(startUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertSafeUrl(current);
      const res = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      });
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => {});
        const location = res.headers.get('location');
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) {
        await res.body?.cancel().catch(() => {});
        return null;
      }
      return await readCapped(res, MAX_HTML_BYTES);
    }
    return null; // too many redirects
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Patches a note once its row has replicated to Postgres. Returns 'ok', 'not-found'
// (never visible to this caller within the retry budget, or RLS hides it), or an error.
async function patchNoteWhenReplicated(
  client: ReturnType<typeof makeClient>,
  noteId: string,
  patch: Record<string, unknown>,
): Promise<'ok' | 'not-found' | { error: string }> {
  for (let attempt = 0; attempt < UPDATE_ATTEMPTS; attempt++) {
    const { data, error: selectError } = await client
      .from('notes')
      .select('id')
      .eq('id', noteId)
      .maybeSingle();
    if (selectError) return { error: selectError.message };
    if (data) {
      const { error: updateError } = await client.from('notes').update(patch).eq('id', noteId);
      return updateError ? { error: updateError.message } : 'ok';
    }
    if (attempt < UPDATE_ATTEMPTS - 1) await sleep(UPDATE_RETRY_MS);
  }
  return 'not-found';
}

async function enrichTask(taskId: string, url: string, authHeader: string): Promise<Response> {
  const html = await fetchPageHtml(url);
  const pageTitle = html ? extractTitle(html) : null;
  const pageDescription = html ? extractDescription(html) : null;
  if (!pageTitle) return json({ ok: false, reason: 'no-title' });

  const newTitle = (TITLE_PREFIX + pageTitle).slice(0, MAX_TITLE);
  const newDescription = pageDescription ? pageDescription.slice(0, MAX_DESCRIPTION) : null;
  const client = makeClient(authHeader);

  // Retry until the locally-created task has replicated to Postgres (RLS scopes
  // every query to the caller's own rows). No row yet == not there yet.
  for (let attempt = 0; attempt < UPDATE_ATTEMPTS; attempt++) {
    const { data: existing, error: selectError } = await client
      .from('tasks')
      .select('id, description')
      .eq('id', taskId)
      .maybeSingle();

    if (selectError) return json({ error: selectError.message }, 500);

    if (existing) {
      const update: { title: string; updated_at: string; description?: string } = {
        title: newTitle,
        updated_at: new Date().toISOString(),
      };
      // Only backfill the description if the task doesn't already have one —
      // never overwrite something the user typed.
      if (newDescription && !existing.description) update.description = newDescription;

      const { error: updateError } = await client.from('tasks').update(update).eq('id', taskId);
      if (updateError) return json({ error: updateError.message }, 500);
      return json({ ok: true, title: newTitle, description: update.description ?? null });
    }

    if (attempt < UPDATE_ATTEMPTS - 1) await sleep(UPDATE_RETRY_MS);
  }

  return json({ ok: false, reason: 'task-not-found' });
}

async function enrichNote(noteId: string, url: string, authHeader: string): Promise<Response> {
  const client = makeClient(authHeader);
  const now = () => new Date().toISOString();

  const html = await fetchPageHtml(url);
  if (html === null) {
    // Mark failed so the client stops retrying; the note itself is never at risk.
    const failed = await patchNoteWhenReplicated(client, noteId, {
      link_status: 'failed',
      updated_at: now(),
    });
    if (failed !== 'ok' && failed !== 'not-found') {
      console.error('enrich-url: failed to mark note failed', failed.error);
    }
    return json({ ok: false, error: 'fetch failed' }, 502);
  }

  const meta = extractMeta(html);
  const result = await patchNoteWhenReplicated(client, noteId, {
    link_title: meta.title,
    link_excerpt: meta.excerpt,
    link_image_url: meta.imageUrl,
    link_site_name: meta.siteName,
    link_status: 'ok',
    updated_at: now(),
  });

  if (result === 'ok') return json({ ok: true, meta });
  if (result === 'not-found') return json({ ok: false, reason: 'note-not-found' });
  console.error('enrich-url: note update failed', result.error);
  return json({ error: result.error }, 500);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  let body: { taskId?: unknown; noteId?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { taskId, noteId, url } = body;
  const hasTask = taskId !== undefined;
  const hasNote = noteId !== undefined;
  if (hasTask === hasNote) {
    return json({ error: 'provide exactly one of taskId or noteId' }, 400);
  }
  if (typeof url !== 'string') return json({ error: 'url is required' }, 400);
  if (hasTask && typeof taskId !== 'string') return json({ error: 'taskId must be a string' }, 400);
  if (hasNote && typeof noteId !== 'string') return json({ error: 'noteId must be a string' }, 400);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ error: 'Invalid URL' }, 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return json({ error: 'Unsupported URL scheme' }, 400);
  }

  // SSRF guard before any outbound fetch, for both branches.
  try {
    assertSafeUrl(url);
  } catch {
    return json({ error: 'unsafe URL' }, 422);
  }

  if (hasNote) return enrichNote(noteId as string, url, authHeader);
  return enrichTask(taskId as string, url, authHeader);
});
