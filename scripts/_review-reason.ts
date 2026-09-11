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
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const row = (await getCmaAdminRowBySlug(process.argv[2]!)) as Record<string, unknown>
  for (const k of Object.keys(row)) {
    if (/review|state|status/i.test(k)) console.log(`${k} = ${String(row[k]).slice(0, 400)}`)
  }
  const cit = (row.citations ?? {}) as Record<string, unknown>
  const subj = (cit.subject ?? {}) as Record<string, unknown>
  console.log('\nsubject beds/baths used:', subj.beds, '/', subj.baths)
  console.log('room_conflicts:', JSON.stringify(subj.room_conflicts ?? null, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
