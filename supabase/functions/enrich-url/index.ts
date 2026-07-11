// Supabase Edge Function: enrich-url
//
// Given { taskId, url }, fetches the linked page server-side, extracts a human
// title (og:title or <title>) and description (og:description or <meta name
// ="description">), updates the task's title to "Read: <title>", and backfills
// the description only if the task doesn't already have one (never clobbers
// something the user typed). Called fire-and-forget from the mobile share
// screen after a URL is captured.
//
// Auth: uses the caller's JWT (forwarded Authorization header) so the UPDATE is
// constrained by the tasks RLS policy — a user can only enrich their own task.
// No service-role key is used.
//
// Why enrich server-side: the page fetch + parse must not run on a possibly
// metered/offline device, and the update flows back to every client via
// PowerSync replication of the Postgres change.
//
// Deploy: supabase functions deploy enrich-url

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TITLE_PREFIX = 'Read: ';
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 256 * 1024;
// The capture writes the task locally via PowerSync; it may not have replicated
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

type PageMeta = { title: string | null; description: string | null };

async function fetchPageMeta(url: string): Promise<PageMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TodoListBot/1.0; +https://todolist.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return { title: null, description: null };
    if (!(res.headers.get('content-type') ?? '').includes('text/html')) return { title: null, description: null };
    const html = await readCapped(res, MAX_HTML_BYTES);
    return { title: extractTitle(html), description: extractDescription(html) };
  } catch {
    return { title: null, description: null };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  let body: { taskId?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { taskId, url } = body;
  if (typeof taskId !== 'string' || typeof url !== 'string') {
    return json({ error: 'taskId and url are required' }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ error: 'Invalid URL' }, 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return json({ error: 'Unsupported URL scheme' }, 400);
  }

  const { title: pageTitle, description: pageDescription } = await fetchPageMeta(url);
  if (!pageTitle) return json({ ok: false, reason: 'no-title' });

  const newTitle = (TITLE_PREFIX + pageTitle).slice(0, MAX_TITLE);
  const newDescription = pageDescription ? pageDescription.slice(0, MAX_DESCRIPTION) : null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Retry until the locally-created task has replicated to Postgres (RLS scopes
  // every query to the caller's own rows). No row yet == not there yet.
  for (let attempt = 0; attempt < UPDATE_ATTEMPTS; attempt++) {
    const { data: existing, error: selectError } = await supabase
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

      const { error: updateError } = await supabase.from('tasks').update(update).eq('id', taskId);
      if (updateError) return json({ error: updateError.message }, 500);
      return json({ ok: true, title: newTitle, description: update.description ?? null });
    }

    if (attempt < UPDATE_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, UPDATE_RETRY_MS));
    }
  }

  return json({ ok: false, reason: 'task-not-found' });
});
