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

/**
 * Every link the letter prints must land on a real page: HTTP 200 and not the
 * site's own refusal shell (a plat page renders 200 with "No subdivision at this
 * address" when nothing resolves). Printed under the letter so the proof is on
 * the same screen as the copy.
 */
async function checkLinks(bodyText: string): Promise<void> {
  const urls = [...new Set(bodyText.match(/https:\/\/[^\s]+?(?=\.?(?:\s|$))/g) ?? [])]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
        redirect: 'follow',
      })
      const body = await res.text()
      const refused = /No subdivision at this address|NEXT_HTTP_ERROR_FALLBACK|No community at this address/.test(body)
      console.log(`LINK ${res.status}${refused ? ' REFUSAL-SHELL' : ' ok'} ${url}`)
    } catch (e) {
      console.log(`LINK FAIL ${url} ${(e as Error).message}`)
    }
  }
}

async function main() {
  const { getCmaAdminRowBySlug, getCmaProspectAsk } = await import('@/lib/data/cma/documents')
  const { getCmaBrokerBySlugOrEmail } = await import('@/lib/data/cma/builderReads')
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { classifyCmaOrigin } = await import('@/lib/cma/origin')
  const { resolveTheirPrice } = await import('@/lib/cma/queue-view')
  const { buildSignature } = await import('@/lib/crm/email-signature')
  const { getBrokers } = await import('@/lib/data')
  const { cmaFirstContactFactsFromRow, composeCmaFirstContact } = await import('@/lib/cma/first-contact')
  const { resolveFirstContactPlace } = await import('@/lib/cma/first-contact-place')

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
    const origin = classifyCmaOrigin((row.request_source as string | null) ?? null, (row.doc_type as string | null) ?? null)
    const lastListPrice = resolveTheirPrice(origin, row.build_summary, await getCmaProspectAsk(String(row.id)))
    const clientName = (row.client_name as string | null) ?? null
    const facts = cmaFirstContactFactsFromRow(row as Record<string, unknown>, {
      brokerName,
      firstName: (clientName ?? '').trim().split(/\s+/)[0] || null,
      lastListPrice,
    })
    facts.place = await resolveFirstContactPlace(facts)
    const copy = composeCmaFirstContact(origin, facts)
    console.log(`\n=== ${slug} · origin ${origin} · status ${String(row.status)} · comps ${String(row.comps_count)} · scope ${facts.salesScope ?? 'none'} · last ${lastListPrice ?? 'none'}`)
    console.log(`Subject: ${copy.subject}`)
    console.log(`Preview: ${copy.previewText}\n`)
    console.log(copy.bodyText)
    // The signature the rail appends at send: Gmail-synced, else the saved one,
    // else the generated identity block, always with the Oregon pamphlet line.
    const brokers = await getBrokers()
    const brokerRow = brokers.find((b) => (b.email ?? '').toLowerCase() === (brokerRaw?.email as string | null ?? '').toLowerCase())
    const sig = brokerRow ? buildSignature(brokerRow) : null
    console.log(sig ? sig.plain : '(no system signature for this broker)')
    await checkLinks(copy.bodyText)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
