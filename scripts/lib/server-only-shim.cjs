/**
 * Lets a plain `npx tsx scripts/<foo>.ts` process import CMA/DAL modules that
 * carry Next.js-only markers, without a Next server behind them:
 *
 *   - `server-only` / `client-only` throw unconditionally when required
 *     outside webpack's client/server graph split (that's their whole job).
 *   - `next/cache` (`unstable_cache`, `revalidateTag`, ...) needs Next's
 *     incremental cache, which does not exist in a bare Node/tsx process.
 *
 * Both get redirected to the no-op stubs vitest already uses for the same
 * reason (see `vitest.config.ts` + `test/server-only-stub.ts`,
 * `test/next-cache-cli-stub.ts`), and that several existing CMA CLI scripts
 * (`scripts/_rerender-cma.ts`, `scripts/_rebuild-cma.ts`,
 * `scripts/_rebuild-failing-cmas.ts`) already wire the same way. This module
 * is that pattern factored out so a new script does not re-derive it.
 *
 * Call `installServerOnlyShim()` once, BEFORE any `import()`/`require()` of
 * `lib/**` — module resolution is patched globally for the process, so later
 * imports (including ones nested deep in `@/lib/data`) resolve through it.
 */
const path = require('node:path')
const Module = require('node:module')

let installed = false

function installServerOnlyShim(repoRoot) {
  if (installed) return
  installed = true
  const root = repoRoot || path.resolve(__dirname, '..', '..')
  const SERVER_ONLY_STUB = path.join(root, 'test', 'server-only-stub.ts')
  const NEXT_CACHE_STUB = path.join(root, 'test', 'next-cache-cli-stub.ts')
  const origResolveFilename = Module._resolveFilename
  Module._resolveFilename = function (request, ...args) {
    const req =
      request === 'server-only' || request === 'client-only'
        ? SERVER_ONLY_STUB
        : request === 'next/cache'
          ? NEXT_CACHE_STUB
          : request
    return origResolveFilename.call(this, req, ...args)
  }
}

module.exports = { installServerOnlyShim }
