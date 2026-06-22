import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Handles email-confirmation and OAuth/magic-link returns. Supabase may send the
// user back with either a `token_hash` + `type` (verifyOtp flow — works across
// devices, recommended for the confirmation email template) or a `code` (PKCE
// flow — only works in the same browser that started signup). We support both
// and always log the outcome under `[auth/callback]` for debugging.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const providerError =
    searchParams.get('error_description') ?? searchParams.get('error');

  const log = (event: string, detail: unknown) =>
    // eslint-disable-next-line no-console
    console.log(`[auth/callback] ${event}`, detail);

  const toLogin = (msg: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  log('received', { hasCode: !!code, hasTokenHash: !!tokenHash, type, providerError });

  if (providerError) {
    return toLogin(providerError);
  }

  const supabase = await createServerSupabaseClient();

  try {
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (error) throw error;
      log('verifyOtp:success', { type });
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      log('exchangeCodeForSession:success', {});
    } else {
      log('missing_params', { url: request.url });
      return toLogin('Invalid or incomplete confirmation link.');
    }
  } catch (err: any) {
    log('error', { message: err?.message, status: err?.status, code: err?.code });
    return toLogin(err?.message ?? 'Could not confirm your email. The link may have expired.');
  }

  return NextResponse.redirect(`${origin}/inbox`);
}
