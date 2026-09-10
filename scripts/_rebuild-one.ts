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
  const slug = process.argv[2]!
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { buildCma } = await import('@/lib/cma/build')
  const before = (await getCmaAdminRowBySlug(slug)) as Record<string, unknown> | null
  if (!before) { console.log('missing'); return }
  const res = await buildCma({
    slug,
    docType: (before.doc_type as 'cma' | 'expired-audit') ?? 'cma',
    rawAddress: (before.subject_address as string | null) ?? null,
    city: (before.subject_city as string | null) ?? null,
    mlsNumber: (before.subject_listing_key as string | null) ?? null,
    client: {
      name: (before.client_name as string | null) ?? null,
      email: (before.client_email as string | null) ?? null,
      phone: (before.client_phone as string | null) ?? null,
      notes: (before.client_notes as string | null) ?? null,
    },
    brokerSlug: (before.broker_slug as string | null) ?? null,
    personId: (before.person_id as number | null) ?? null,
    requestSource: (before.request_source as string | null) ?? 'rebuild',
  } as never).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }))
  console.log('build:', JSON.stringify(res).slice(0, 200))
}
main().catch((e) => { console.error(e); process.exit(1) })
