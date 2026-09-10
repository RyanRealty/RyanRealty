/**
 * Re-run the build on rows that produced NO number, and leave every result in
 * the queue for the broker (Matt 2026-09-09: "rebuild, hold for review").
 * Nothing is approved and nothing is sent by this script.
 *
 *   npx tsx scripts/cma-rebuild-unpriced.ts            # dry run, lists them
 *   npx tsx scripts/cma-rebuild-unpriced.ts --run 10   # rebuild the first ten
 */
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
  const run = process.argv.includes('--run')
  const limitArg = Number(process.argv[process.argv.indexOf('--run') + 1])
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 5
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { buildCma } = await import('@/lib/cma/build')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')

  const { rows } = await listCmaQueue({ limit: 500 })
  const targets = rows.filter((r) => r.valueLow == null && r.buildError && r.state !== 'archived')
  console.log(`${targets.length} row(s) carry no number.`)
  if (!run) {
    for (const r of targets.slice(0, 20)) console.log(`  ${r.slug.padEnd(40)} ${r.origin} ${r.city}`)
    console.log('\nDry run. Pass --run <n> to rebuild. Nothing is approved or sent either way.')
    return
  }
  let priced = 0
  let stillShort = 0
  for (const r of targets.slice(0, limit)) {
    // The subject is resolved from the ROW, the way the worker resolves it from
    // the action payload: an address (or MLS number) is what finds the home.
    const before = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    const res = await buildCma({
      slug: r.slug,
      docType: (before?.doc_type as 'cma' | 'expired-audit') ?? 'cma',
      rawAddress: (before?.subject_address as string | null) ?? null,
      city: (before?.subject_city as string | null) ?? null,
      mlsNumber: (before?.subject_listing_key as string | null) ?? null,
      client: {
        name: (before?.client_name as string | null) ?? null,
        email: (before?.client_email as string | null) ?? null,
        phone: (before?.client_phone as string | null) ?? null,
        notes: (before?.client_notes as string | null) ?? null,
      },
      brokerSlug: (before?.broker_slug as string | null) ?? null,
      personId: (before?.person_id as number | null) ?? null,
      requestSource: (before?.request_source as string | null) ?? 'rebuild-unpriced',
    } as never).catch(
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
    )
    const after = (await getCmaAdminRowBySlug(r.slug)) as Record<string, unknown> | null
    const value = after?.value_low as number | null
    const summary = after?.build_summary as Record<string, unknown> | null
    const selection = (summary?.comp_selection ?? null) as Record<string, unknown> | null
    const tiers = Object.keys((selection?.final_tier_counts ?? {}) as Record<string, number>)
    const widened = tiers.some((t) => t.includes('widened-disclosed'))
    if (value != null) priced++
    else stillShort++
    console.log(
      `${r.slug.padEnd(38)} ${value != null ? `PRICED $${Number(value).toLocaleString()}` : 'still short'}` +
        `${widened ? ' · widened+disclosed' : ''} · comps ${after?.comps_count ?? 0} · status ${String(after?.status)}` +
        `${value == null ? ` · ${String(after?.build_error ?? (res as { error?: string }).error ?? '').slice(0, 90)}` : ''}`,
    )
  }
  console.log(`\npriced ${priced} · still short ${stillShort}. Every row stays in the queue for review.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
