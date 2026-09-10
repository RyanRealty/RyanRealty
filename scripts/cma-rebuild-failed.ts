/**
 * Rebuild every queue document whose last build FAILED, and hold each result.
 *
 * These are people who asked for a value and got nothing. As of 2026-09-10 there
 * were 73, and the dominant recorded causes were the exact-bath wall ("No sold
 * 3-bath home in City ILIKE 'Sisters'…") and a comp set nothing graded on price
 * — both of which the comp-selection work of that day removed. A rebuild is
 * purely additive: a failed document can only improve.
 *
 * Nothing here sends. buildCma writes the document and the queue state; the send
 * path is not on this route.
 *
 *   npx tsx scripts/cma-rebuild-failed.ts [--limit N] [--concurrency 3] [--dry]
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

async function main() {
  const limit = Number(arg('limit', '500'))
  const concurrency = Number(arg('concurrency', '3'))
  const dry = process.argv.includes('--dry')

  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { getCmaAdminRowBySlug } = await import('@/lib/data/cma/documents')
  const { buildCma } = await import('@/lib/cma/build')

  const { rows } = await listCmaQueue({ limit: 500 })
  if (rows.length === 0) {
    console.error('UNREADABLE: the queue came back empty — refusing to act on it.')
    process.exit(2)
  }
  const targets = rows
    .filter((r) => String(r.state) === 'failed')
    .map((r) => ({ slug: r.slug, address: r.address ?? null, error: String(r.buildError ?? '') }))
    .slice(0, limit)

  console.log(`queue rows: ${rows.length} | last build failed: ${targets.length}`)
  if (dry) {
    for (const t of targets) console.log(`  ${String(t.slug).padEnd(38)} ${t.error.slice(0, 90)}`)
    return
  }

  let done = 0
  let fixed = 0
  let stillFailing = 0
  const queue = [...targets]

  async function worker(): Promise<void> {
    for (;;) {
      const t = queue.shift()
      if (!t) return
      const before = (await getCmaAdminRowBySlug(t.slug)) as Record<string, unknown> | null
      if (!before) {
        done++
        console.log(`  MISSING  ${t.slug} — no document row`)
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
        requestSource: 'failed-rebuild',
      } as never).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }))
      done++
      if (!res.ok) {
        stillFailing++
        console.log(`  STILL    ${String(t.slug).padEnd(38)} ${String(res.error).slice(0, 130)}`)
        console.error(`[${done}/${targets.length}]`)
        continue
      }
      const after = (await getCmaAdminRowBySlug(t.slug)) as Record<string, unknown> | null
      const lo = Number(after?.value_low ?? 0)
      const hi = Number(after?.value_high ?? 0)
      fixed++
      console.log(
        `  PRICED   ${String(t.slug).padEnd(38)} $${lo.toLocaleString()}-$${hi.toLocaleString()} around $${Number(after?.recommended_list ?? 0).toLocaleString()}${lo > 0 && hi > 0 ? ` (${(hi / lo).toFixed(2)}x)` : ''}`,
      )
      console.error(`[${done}/${targets.length}]`)
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()))

  console.log(`\nattempted ${done} of ${targets.length} | now priced ${fixed} | still failing ${stillFailing}`)
  console.log('Every document stays in the queue for review. Nothing was sent.')
}
main().catch((e) => { console.error(e); process.exit(1) })
