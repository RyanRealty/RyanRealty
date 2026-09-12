/**
 * Rebuild every priced document whose range is wider than the threshold, and
 * HOLD every result for review (Matt 2026-09-10, on 23 Benaiah: "rebuild all
 * 56, hold for review").
 *
 * Nothing here sends. buildCma writes the document and the queue state; the
 * send path (autoSendBuiltCma) is not on this route at all, and a rebuilt
 * document that still carries a wide range raises its own review flag.
 *
 * Prints one line per document, before and after, so the effect of the engine
 * fixes is measured rather than asserted.
 *
 *   npx tsx scripts/cma-rebuild-wide-ranges.ts [--threshold 1.2] [--limit N] [--dry]
 */
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

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback
}

type Target = { slug: string; address: string | null; low: number; high: number; rec: number; spread: number }

async function main() {
  const threshold = Number(arg('threshold', '1.2'))
  const limit = Number(arg('limit', '500'))
  const dry = process.argv.includes('--dry')
  const concurrency = Number(arg('concurrency', '3'))

  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { buildCma } = await import('@/lib/cma/build')

  const { rows } = await listCmaQueue({ limit: 500 })
  const priced = rows.filter((r) => r.valueLow != null && r.valueHigh != null && (r.recommendedList ?? 0) > 0)
  if (priced.length === 0) {
    console.error('UNREADABLE: no priced rows came back — refusing to act on an empty read.')
    process.exit(2)
  }
  const targets: Target[] = priced
    .map((r) => {
      const low = Math.min(r.valueLow!, r.valueHigh!)
      const high = Math.max(r.valueLow!, r.valueHigh!)
      return { slug: r.slug, address: r.address ?? null, low, high, rec: r.recommendedList!, spread: high / low }
    })
    .filter((t) => t.spread >= threshold)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, limit)

  console.log(`priced documents: ${priced.length} | wider than ${threshold}x: ${targets.length}`)
  if (dry) {
    for (const t of targets) console.log(`  ${t.spread.toFixed(2)}x  ${t.slug}`)
    return
  }

  let done = 0
  let narrowed = 0
  let widened = 0
  let failed = 0
  const queue = [...targets]

  async function worker(): Promise<void> {
    for (;;) {
      const t = queue.shift()
      if (!t) return
      const before = (await getCmaAdminRowBySlug(t.slug)) as Record<string, unknown> | null
      if (!before) {
        console.log(`  MISSING  ${t.slug} — no document row`)
        failed++
        done++
        continue
      }
      const res = await buildCma({
        slug: t.slug,
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
        requestSource: 'wide-range-rebuild',
      } as never).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }))
      done++
      if (!res.ok) {
        failed++
        console.log(`  FAILED   ${t.spread.toFixed(2)}x  ${String(t.slug).padEnd(36)} ${String(res.error).slice(0, 160)}`)
        continue
      }
      const after = (await getCmaAdminRowBySlug(t.slug)) as Record<string, unknown> | null
      const lo = Number(after?.value_low ?? 0)
      const hi = Number(after?.value_high ?? 0)
      const spreadAfter = lo > 0 && hi > 0 ? hi / lo : NaN
      if (Number.isFinite(spreadAfter)) {
        if (spreadAfter < t.spread) narrowed++
        else if (spreadAfter > t.spread) widened++
      }
      console.log(
        `  ${t.spread.toFixed(2)}x -> ${Number.isFinite(spreadAfter) ? `${spreadAfter.toFixed(2)}x` : '  n/a'}  ${String(t.slug).padEnd(36)} $${lo.toLocaleString()}-$${hi.toLocaleString()} around $${Number(after?.recommended_list ?? 0).toLocaleString()}`,
      )
      console.error(`[${done}/${targets.length}]`)
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()))

  console.log(`\nrebuilt ${done} of ${targets.length} | narrower ${narrowed} | wider ${widened} | failed ${failed}`)
  console.log('Every document stays in the queue for review. Nothing was sent.')
}
main().catch((e) => { console.error(e); process.exit(1) })
