export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Polyfill __dirname at the global level so any module that references it
    // in a non-CJS context (e.g. webpack mini-runtimes inside pre-compiled bundles
    // that Next.js loads directly) gets a valid value instead of a ReferenceError.
    if (typeof (globalThis as any).__dirname === 'undefined') {
      (globalThis as any).__dirname = '/';
    }

    // Log uncaught errors with full stack traces so Vercel function logs show
    // exactly which file causes "ReferenceError: __dirname is not defined".
    process.on('uncaughtException', (err) => {
      console.error('[instrumentation] uncaughtException:', err.stack ?? err);
    });
    process.on('unhandledRejection', (reason) => {
      console.error('[instrumentation] unhandledRejection:', reason);
    });
  }
}
