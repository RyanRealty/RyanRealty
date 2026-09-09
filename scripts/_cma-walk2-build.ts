import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}
async function main() {
  const { runCmaBuildWorker } = await import('@/lib/cma/worker')
  for (const slug of process.argv.slice(2)) {
    const res = await runCmaBuildWorker(1, { slug })
    console.log(slug, JSON.stringify(res.results.map((r) => ({ status: r.status, error: r.error ?? null }))))
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
