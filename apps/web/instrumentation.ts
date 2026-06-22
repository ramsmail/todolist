export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Polyfill __dirname globally so any module that references it outside a
    // CJS module-wrapper scope (e.g. webpack mini-runtimes in pre-compiled
    // Next.js server bundles like app-page.runtime.prod.js) gets '/' instead
    // of a ReferenceError.  In a proper CJS require() the module-wrapper
    // local __dirname shadows this, so it never interferes with real paths.
    if (typeof (globalThis as any).__dirname === 'undefined') {
      (globalThis as any).__dirname = '/';
      console.log('[instrumentation] __dirname was undefined — polyfilled to "/"');
    }

    // Monkey-patch Module._load to capture the *exact* file that throws
    // "ReferenceError: __dirname is not defined" and print its full stack.
    // This is diagnostic-only and is a no-op once the issue is resolved.
    const Module = require('module') as typeof import('module') & {
      _load: (id: string, parent: unknown, isMain: boolean) => unknown;
    };
    const orig = Module._load;
    Module._load = function diagLoad(id, parent, isMain) {
      try {
        return orig.call(this, id, parent, isMain);
      } catch (err: unknown) {
        if (
          err instanceof ReferenceError &&
          err.message.includes('__dirname')
        ) {
          console.error(
            `[instrumentation] __dirname ReferenceError while loading "${id}"\n` +
            (err.stack ?? String(err))
          );
        }
        throw err;
      }
    };

    process.on('uncaughtException', (err) => {
      console.error('[instrumentation] uncaughtException\n' + (err.stack ?? err));
    });
    process.on('unhandledRejection', (reason) => {
      const msg = reason instanceof Error ? reason.stack : String(reason);
      console.error('[instrumentation] unhandledRejection\n' + msg);
    });
  }
}
