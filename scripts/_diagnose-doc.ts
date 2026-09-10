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
  const slug = process.argv[2]!
  const row = (await getCmaAdminRowBySlug(slug)) as Record<string, unknown>
  const s = row.build_summary as Record<string, unknown>
  const sel = (s?.comp_selection ?? {}) as Record<string, unknown>
  const args = row.render_args as Record<string, unknown> | null
  const subject = (args?.subject ?? {}) as Record<string, unknown>
  console.log('slug        ', row.slug)
  console.log('built_at    ', row.built_at)
  console.log('subject     ', row.subject_address, '| sub', row.subject_subdivision, '| sqft', subject.sqft, '| beds', row.subject_beds, 'baths', row.subject_baths, '| acres', subject.lotAcres)
  console.log('value       ', row.value_low, '-', row.value_high, 'rec', row.recommended_list)
  console.log('anchor      ', JSON.stringify(sel.price_anchor))
  console.log('path        ', sel.pricing_source, '| rural', sel.rural_acreage, '| area', sel.market_area, '| custom/new', sel.custom_or_new)
  console.log('tiers       ', JSON.stringify(sel.final_tier_counts))
  console.log('starved     ', sel.starved, 'at', sel.starved_at, '|', sel.starved_reason ?? '')
  console.log('candidates  ', sel.candidates, '| final', sel.final_count)
  console.log('excluded    ', JSON.stringify(sel.excluded_totals))
  const comps = (args?.comps ?? []) as Array<Record<string, unknown>>
  console.log(`\ncomps (${comps.length}):`)
  for (const c of comps) {
    console.log(`  ${String(c.address).padEnd(30)} $${Number(c.closePrice).toLocaleString().padStart(10)} | ${String(c.sqft)}sf | ${String(c.subdivision ?? '-').padEnd(22)} | ${String(c.selectionTier ?? c.tier ?? '-').padEnd(24)} | ${c.closeDate} | ${c.milesFromSubject ?? c.distanceMiles ?? '?'}mi`)
  }
  const trace = (sel.trace ?? s?.trace ?? []) as string[]
  for (const t of trace) if (/price tier|square foot/i.test(t)) console.log('\ntier:', t.slice(0, 180))
  const disc = (sel.disclosures ?? []) as string[]
  if (disc.length) { console.log('\ndisclosures:'); for (const d of disc) console.log('  -', d.slice(0, 150)) }
}
main().catch((e) => { console.error(e); process.exit(1) })
