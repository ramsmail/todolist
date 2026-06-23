# TodoList — Project Notes for Claude

Monorepo (pnpm workspaces + turbo). Web app lives in `apps/web` (Next.js 14, App Router), shared code in `packages/*`. Deployed to Vercel.

## Deployment (Vercel) — READ BEFORE DEBUGGING DEPLOY ERRORS

The Vercel **project framework preset MUST be `nextjs`**. If it is ever `null`
("Other"), Vercel will not run the Next.js builder: it ships the *transpiled*
`middleware.ts` with a live `import 'next/server'` plus a raw traced
`node_modules/next`, instead of the properly webpack-bundled middleware. At edge
runtime `next/dist/compiled/ua-parser-js/ua-parser.js` then executes
`__nccwpck_require__.ab = __dirname + "/"` and crashes with:

```
[ReferenceError: __dirname is not defined]   (source: edge-middleware)
MIDDLEWARE_INVOCATION_FAILED → HTTP 500 on every route
```

**This is a project-config bug, not a code bug.** No amount of editing
`middleware.ts`, `next.config.js`, externals, or `__dirname` polyfills can fix it,
because Vercel isn't bundling the middleware at all — and `next/server` itself
pulls in `ua-parser-js` regardless of what you import.

Fix / verify the preset:

```bash
# inspect
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v9/projects/<projectId>?teamId=<teamId>" | jq .framework
# must print "nextjs"; if null, PATCH it:
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "https://api.vercel.com/v9/projects/<projectId>?teamId=<teamId>" -d '{"framework":"nextjs"}'
```

To reproduce a Vercel build locally and inspect the real edge artifact (this is
how the bug was found — `next build` alone hides it because it always bundles
correctly):

```bash
set -a; . apps/web/.env.local; set +a   # supply build-time env
vercel pull --yes --environment=production
vercel build --prod
# A healthy middleware function is a single self-contained bundle:
#   .vercel/output/functions/middleware.func/index.js   (~85 KB, 0 __dirname, no node_modules)
# A broken one has:
#   .vercel/output/functions/middleware.func/apps/web/middleware.js + traced node_modules/  ← framework=null
```

### Other deploy gotchas
- **Never upload `.worktrees/` to Vercel.** It's git-ignored, but CLI deploys
  without a `.vercelignore` upload it anyway — ~1.6 GB of node_modules plus a
  `package.json` that collides on the `@todolist/web` name. `.vercelignore`
  excludes it; keep that file.
- `next build` always bundles middleware correctly, so it will **not** reproduce
  deploy-only failures. Use `vercel build` to see what actually ships.

## Conventions
- Node 22 locally; the Vercel project is pinned to a Node major in project settings.
- Middleware is intentionally dependency-light (cookie presence check only); full
  auth verification happens in server components / API routes.
