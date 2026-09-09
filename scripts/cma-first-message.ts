/**
 * Print the first-contact email for one or more CMA rows exactly as the send
 * rail composes it (same facts builder, same broker row, same last-list
 * resolution), so the copy Matt approves is the copy that sends.
 *
 *   npx tsx scripts/cma-first-message.ts <slug> [<slug> ...]
 *   npx tsx scripts/cma-first-message.ts --lane fsbo      (first unarchived row in that lane)
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
  const { getCmaAdminRowBySlug, getCmaProspectAsk } = await import('@/lib/data/cma/documents')
  const { getCmaBrokerBySlugOrEmail } = await import('@/lib/data/cma/builderReads')
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { classifyCmaOrigin } = await import('@/lib/cma/origin')
  const { resolveTheirPrice } = await import('@/lib/cma/queue-view')
  const { formatPublishedPhone } = await import('@/lib/cma/format-phone')
  const { cmaFirstContactFactsFromRow, composeCmaFirstContact } = await import('@/lib/cma/first-contact')

  const argv = process.argv.slice(2)
  const slugs: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lane') {
      const lane = argv[++i]
      const { rows } = await listCmaQueue({ limit: 500, includeArchived: true })
      const hit = rows.filter((r) => r.origin === lane && r.valueLow != null).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
      if (!hit) console.log(`no row in lane ${lane}`)
      else slugs.push(hit.slug)
    } else slugs.push(argv[i])
  }
  for (const slug of slugs) {
    const row = await getCmaAdminRowBySlug(slug)
    if (!row) { console.log(`\n=== ${slug}: not found`); continue }
    const brokerRaw = await getCmaBrokerBySlugOrEmail({ slug: (row.broker_slug as string | null) ?? null })
    const brokerName = (brokerRaw?.display_name as string) ?? 'Matt Ryan'
    const brokerPhone = formatPublishedPhone((brokerRaw?.twilio_number as string | null) ?? null)
    const origin = classifyCmaOrigin((row.request_source as string | null) ?? null, (row.doc_type as string | null) ?? null)
    const lastListPrice = resolveTheirPrice(origin, row.build_summary, await getCmaProspectAsk(String(row.id)))
    const clientName = (row.client_name as string | null) ?? null
    const facts = cmaFirstContactFactsFromRow(row as Record<string, unknown>, {
      brokerName,
      brokerPhone,
      firstName: (clientName ?? '').trim().split(/\s+/)[0] || null,
      lastListPrice,
    })
    const copy = composeCmaFirstContact(origin, facts)
    console.log(`\n=== ${slug} · origin ${origin} · status ${String(row.status)} · comps ${String(row.comps_count)} · scope ${facts.salesScope ?? 'none'} · last ${lastListPrice ?? 'none'}`)
    console.log(`Subject: ${copy.subject}`)
    console.log(`Preview: ${copy.previewText}\n`)
    console.log(copy.bodyText)
    console.log(`\n${brokerName.split(/\s+/)[0]}\nRyan Realty${brokerPhone ? `\n${brokerPhone}` : ''}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
