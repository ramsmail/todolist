'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'register';

// Lightweight client-side logger so auth issues are debuggable straight from the
// browser console in production. The `[auth]` prefix makes them easy to filter.
function authLog(event: string, detail: unknown) {
  // eslint-disable-next-line no-console
  console.log(`[auth] ${event}`, detail);
}

// Normalise a Supabase auth error into a clear, user-facing message.
function describeAuthError(err: any): { message: string; needsConfirm: boolean } {
  const code: string | undefined = err?.code;
  const raw: string = err?.message ?? '';

  if (code === 'email_not_confirmed' || /not confirmed/i.test(raw)) {
    return {
      needsConfirm: true,
      message:
        'Your email isn’t confirmed yet. Check your inbox (and spam) for the ' +
        'confirmation link, or resend it below.',
    };
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(raw)) {
    return {
      needsConfirm: false,
      message:
        'Incorrect email or password. If you just signed up, confirm your ' +
        'email first.',
    };
  }
  return { needsConfirm: false, message: raw || 'An unexpected error occurred.' };
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  // Surface errors handed back by /api/auth/callback (e.g. an expired or
  // already-used confirmation link) via ?error=… on the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errParam = params.get('error');
    const msgParam = params.get('message');
    if (errParam) {
      authLog('callback_error_param', { error: errParam });
      setError(decodeURIComponent(errParam));
    }
    if (msgParam) setNotice(decodeURIComponent(msgParam));
  }, []);

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/callback`
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsConfirm(false);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        authLog('signInWithPassword:result', {
          email,
          hasSession: !!data?.session,
          userId: data?.user?.id ?? null,
          error: error
            ? { message: error.message, status: error.status, code: (error as any).code }
            : null,
        });
        if (error) {
          const { message, needsConfirm } = describeAuthError(error);
          setNeedsConfirm(needsConfirm);
          throw new Error(message);
        }
        router.push('/inbox');
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        authLog('signUp:result', {
          email,
          hasSession: !!data?.session,
          userId: data?.user?.id ?? null,
          // identities is [] when the email is already registered (Supabase
          // hides this to prevent account enumeration).
          identities: data?.user?.identities?.length ?? null,
          confirmationSentAt: (data?.user as any)?.confirmation_sent_at ?? null,
          error: error
            ? { message: error.message, status: error.status, code: (error as any).code }
            : null,
        });
        if (error) throw error;

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setMode('login');
          throw new Error(
            'An account with this email already exists. Try signing in instead.',
          );
        }

        if (data.session) {
          // Email confirmation is disabled in Supabase — already signed in.
          router.push('/inbox');
          router.refresh();
        } else {
          // Confirmation required: tell the user to check their email.
          setNeedsConfirm(true);
          setNotice(
            `Account created. We’ve sent a confirmation link to ${email}. ` +
              'Click it to finish signing up, then come back and sign in.',
          );
        }
      }
    } catch (err: any) {
      authLog('error', { mode, message: err?.message, status: err?.status, code: err?.code });
      setError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo },
      });
      authLog('resend:result', { email, error: error ? error.message : null });
      if (error) throw error;
      setNotice(`Confirmation email re-sent to ${email}.`);
    } catch (err: any) {
      authLog('resend:error', { email, message: err?.message });
      setError(err?.message ?? 'Could not resend the confirmation email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-text-primary text-2xl font-bold mb-2">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-text-muted text-sm mb-8">
          {mode === 'login' ? 'Sign in to continue.' : 'Start organizing your tasks.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-xs font-medium mb-1.5">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-text-secondary text-xs font-medium mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={12}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {notice && (
            <p className="text-text-secondary text-sm bg-surface border border-border rounded-xl px-4 py-3">
              {notice}
            </p>
          )}

          {error && <p className="text-error text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white font-semibold rounded-xl py-3 text-sm hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {needsConfirm && (
          <button
            onClick={handleResend}
            disabled={loading || !email}
            className="mt-3 w-full text-accent text-sm hover:text-accent-dark transition-colors disabled:opacity-50"
          >
            Resend confirmation email
          </button>
        )}

        <button
          onClick={() => {
            setMode(m => (m === 'login' ? 'register' : 'login'));
            setError(null);
            setNotice(null);
            setNeedsConfirm(false);
          }}
          className="mt-6 w-full text-text-muted text-sm hover:text-text-secondary transition-colors"
        >
          {mode === 'login' ? 'No account? Create one' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
