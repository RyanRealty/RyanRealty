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
  const s = (row.build_summary ?? {}) as Record<string, unknown>
  const j = (s.judgment ?? s.comparability ?? null) as Record<string, unknown> | null
  console.log('judgment keys:', Object.keys(s).join(', '))
  if (j) console.log(JSON.stringify(j, null, 2).slice(0, 4000))
  const trace = ((s.comp_selection as Record<string, unknown>)?.trace ?? []) as string[]
  for (const t of trace) if (/judgment|vetted|excluded/i.test(t)) console.log('\ntrace:', t)
}
main().catch((e) => { console.error(e); process.exit(1) })
