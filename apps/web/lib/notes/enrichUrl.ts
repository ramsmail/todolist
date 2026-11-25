import { createClient } from '@/lib/supabase/client';

// supabase-js attaches the signed-in user's JWT, which the function uses so
// that RLS scopes the update to the note's owner.
export async function invokeEnrichUrl(noteId: string, url: string): Promise<boolean> {
  try {
    const { error } = await createClient().functions.invoke('enrich-url', { body: { noteId, url } });
    return !error;
  } catch {
    return false;
  }
}
