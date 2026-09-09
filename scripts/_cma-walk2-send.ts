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
// Approve (what the broker does on the review page) and send, to harness aliases only.
async function main() {
  const { getCmaAdminRowBySlug, updateCmaRowFieldsBySlug } = await import('@/lib/data/cma/documents')
  const { sendCmaToLead } = await import('@/lib/cma/send')
  for (const slug of process.argv.slice(2)) {
    const row = (await getCmaAdminRowBySlug(slug)) as Record<string, unknown> | null
    if (!row) { console.log(slug, 'MISSING'); continue }
    const to = String(row.client_email ?? '')
    if (!/^marketing\+\w+@ryan-realty\.com$/.test(to)) {
      console.log(slug, 'REFUSED — not a harness alias:', to)
      continue
    }
    const summary = row.build_summary as { needs_review?: boolean; review_reason?: string | null } | null
    if (String(row.status) === 'draft') {
      const up = await updateCmaRowFieldsBySlug(slug, { status: 'finalized', finalized_at: new Date().toISOString() })
      console.log(slug, 'approved', up.ok ? 'ok' : up.error, summary?.needs_review ? `(review ack: ${summary.review_reason ?? 'flagged'})` : '(clean)')
    }
    const res = await sendCmaToLead(slug)
    console.log(slug, '→', to, JSON.stringify(res).slice(0, 400))
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
