import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const rf = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return rf.call(this, req, ...args)
}
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { rows } = await listCmaQueue({ limit: 500 })
  const byOrigin = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const o = String(r.origin ?? '?')
    if (!byOrigin.has(o)) byOrigin.set(o, new Map())
    const m = byOrigin.get(o)!
    const st = String(r.state ?? '?')
    m.set(st, (m.get(st) ?? 0) + 1)
  }
  console.log(`queue rows: ${rows.length}\n`)
  for (const [o, m] of [...byOrigin.entries()].sort()) {
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    const parts = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`)
    console.log(`  ${o.padEnd(18)} ${String(total).padStart(4)}   ${parts.join(' · ')}`)
  }
  const expired = rows.filter((r) => String(r.origin) === 'expired')
  const ready = expired.filter((r) => String(r.state) === 'ready')
  const sent = expired.filter((r) => String(r.state) === 'sent')
  console.log(`\nexpired lane: ${expired.length} rows | ready to send ${ready.length} | already sent ${sent.length}`)
  console.log(`  with a contact email .... ${expired.filter((r) => (r.contactEmail ?? '').trim()).length}`)
  console.log(`  ready AND has email ..... ${ready.filter((r) => (r.contactEmail ?? '').trim()).length}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
