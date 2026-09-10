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
  for (const slug of process.argv.slice(2)) {
    const row = (await getCmaAdminRowBySlug(slug)) as Record<string, unknown> | null
    if (!row) { console.log(slug, 'missing'); continue }
    const s = row.build_summary as Record<string, unknown>
    const sel = (s?.comp_selection ?? {}) as Record<string, unknown>
    const audit = (s?.audit ?? {}) as Record<string, unknown>
    const args = row.render_args as Record<string, unknown> | null
    const pricing = (args?.pricing ?? {}) as Record<string, unknown>
    const review = (pricing?.review ?? {}) as Record<string, unknown>
    console.log(`\n=== ${slug}`)
    console.log(`subject: ${row.subject_address} · type ${String((args?.subject as Record<string, unknown>)?.propertySubType ?? '?')} · sqft ${String((args?.subject as Record<string, unknown>)?.sqft ?? '?')} · beds ${row.subject_beds ?? '?'} baths ${row.subject_baths ?? '?'}`)
    console.log(`value ${row.value_low}–${row.value_high} · recommended ${row.recommended_list} · comps ${row.comps_count}`)
    console.log(`tiers: ${JSON.stringify(sel.final_tier_counts)}`)
    console.log(`audit: ${String(audit.verdict ?? 'none')} · needsReview ${String(review.needsReview)} · severity ${String(review.severity)}`)
    console.log(`reasons: ${JSON.stringify(review.reasons ?? [])}`)
    const disclosures = (sel.disclosures ?? []) as string[]
    for (const d of disclosures.filter((x) => /widen|resort/i.test(x))) console.log(`disclosure: ${d.slice(0, 200)}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
