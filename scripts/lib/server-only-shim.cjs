/**
 * `server-only` resolver shim for CLI scripts (npx tsx -r).
 *
 * `server-only` throws by design outside a Next server component, and every
 * DAL module imports it. vitest aliases it to test/server-only-stub.ts; a CLI
 * has no bundler to alias with, so this preloads a resolve hook that returns
 * an empty module for that request and leaves everything else alone.
 *
 *   npx tsx -r ./scripts/lib/server-only-shim.cjs scripts/<script>.ts
 */
const Module = require('module')
const orig = Module._load
Module._load = function (request, ...rest) {
  if (request === 'server-only') return {}
  return orig.call(this, request, ...rest)
}
