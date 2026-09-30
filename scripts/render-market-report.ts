#!/usr/bin/env tsx
/**
 * render-market-report — render one contact's market report from LIVE data to
 * out/ for review. It NEVER sends: the Resend keys are deleted from this
 * process before anything loads, and nothing here imports the send path.
 *
 *   npx tsx scripts/render-market-report.ts --person 64138 --subscription 9016
 *   npx tsx scripts/render-market-report.ts --person 64138 --areas bend,bend-larkspur
 *
 * Writes, under out/market-report/ (gitignored):
 *   <slug>-<date>.html      the email exactly as the send path builds it
 *                           (renderMarketReportEmail + prepareDeliverableEmail,
 *                           one footer), minus tracking: no pixel, no wraps
 *   <slug>-<date>.txt       the plain-text part
 *   <slug>-<date>.citations.json
 *                           every printed figure with its source, filter,
 *                           as-of date and sample (CLAUDE.md §0), the
 *                           freshness verdict, and the Spark cross-check
 *
 * The report's links are signed as a broker PREVIEW for the contact: clicking
 * one opens her preferences page read-only and changes nothing. Signed with
 * this machine's secret chain, so they only open where that secret matches.
 *
 * §0 Spark cross-check (CLAUDE.md, the hard pre-render gate for market
 * reports): every printed figure Spark can reproduce by attribute filter is
 * pulled from Spark and compared; |delta| > 1% prints STOP and exits 2, and
 * the conflict goes to Matt before anything sends. A figure Spark cannot
 * reproduce by attribute filter (a boundary-defined neighborhood's count, a
 * twelve-month median over the closed set) is listed as NOT reconciled, with
 * the reason, never silently passed.
 */
import Module from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── Never send. Before any import that could reach the wire. ────────────────
delete process.env.RESEND_API_KEY
delete process.env.RESEND_WEBHOOKS_API_KEY

// server-only and next/cache are Next.js runtime modules; a CLI loads stubs.
const ROOT = process.cwd()
const M = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string }
const origResolve = M._resolveFilename
M._resolveFilename = function (this: unknown, req: string, ...rest: unknown[]) {
  if (req === 'server-only') return join(ROOT, 'test/server-only-stub.ts')
  if (req === 'next/cache') return join(ROOT, 'test/next-cache-cli-stub.ts')
  return origResolve.call(this, req, ...rest)
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

type SparkCheck = {
  area: string
  figure: string
  supabase: number | null
  spark: number | null
  deltaPct: number | null
  filter: string
  status: 'ok' | 'STOP' | 'not-reconciled'
  note?: string
}

/**
 * Spark's own count of active detached homes in a city (the v1 listings API,
 * the one the sync reads; SparkQL filter). Detached = PropertyType 'A' and
 * PropertySubType 'Single Family Residence', the Market Truth segment rule
 * (supabase/migrations/20260822233000_refresh_market_fact_sale.sql). A missing
 * pagination block reads as null (unknown), never as zero.
 */
async function sparkActiveCount(city: string): Promise<{ count: number | null; filter: string }> {
  const { fetchSparkListingsPage } = await import('../lib/spark')
  const token = process.env.SPARK_API_KEY?.trim()
  if (!token) throw new Error('SPARK_API_KEY is not set')
  const filter = `StandardStatus Eq 'Active' And City Eq '${city.replace(/'/g, "\\'")}' And PropertyType Eq 'A' And PropertySubType Eq 'Single Family Residence'`
  const res = await fetchSparkListingsPage(token, { page: 1, limit: 1, filter })
  const rows = res.D?.Pagination?.TotalRows
  return { count: typeof rows === 'number' ? rows : null, filter: `Spark v1 /listings _filter=${filter}` }
}

async function main() {
  const personId = Number(arg('person'))
  if (!Number.isInteger(personId) || personId <= 0) throw new Error('--person <crm_people.id> is required')
  const subscriptionId = Number(arg('subscription') ?? 0) || null
  const outDir = resolve(ROOT, arg('out') ?? 'out/market-report')

  const { getMarketReportContact } = await import('../lib/data/crm/marketReportSubscription')
  const { getContactReportSubscription } = await import('../lib/data/crm/getContactReportSubscriptions')
  const { getMarketReportData } = await import('../lib/data/crm/getMarketReportData')
  const { renderMarketReportEmail } = await import('../lib/crm/market-report-email')
  const { findStaleSources, describeStaleSources, MARKET_DATA_MAX_AGE_HOURS } = await import('../lib/crm/market-report-freshness')
  const { prepareDeliverableEmail } = await import('../lib/email/prepare')
  const { shellBrokerFor } = await import('../lib/email/broker-identity')
  const { reportEmailLinks } = await import('../lib/email/report-link-token')

  const contact = await getMarketReportContact(personId)
  if (!contact || contact.deleted) throw new Error(`crm_people ${personId} not found`)
  const sub = await getContactReportSubscription(personId)
  const areas = (arg('areas') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const areaSlugs = areas.length > 0 ? areas : (sub?.areas ?? [])
  if (areaSlugs.length === 0) throw new Error('no areas: pass --areas or give the contact a subscription')
  const brokerSlug = contact.assignedBroker ?? 'matt'
  const now = new Date()
  const fetchedAt = now.toISOString()

  const blocks = await getMarketReportData(areaSlugs)
  if (blocks.length === 0) throw new Error(`no verified market data for ${areaSlugs.join(', ')}`)
  const stale = findStaleSources(blocks, now)

  const links = reportEmailLinks({
    personId,
    subscriptionId,
    emailKey: `market-report:local-render:${personId}:${now.getTime()}`,
    preview: true,
  })
  const rendered = renderMarketReportEmail({
    contactName: contact.firstName ?? contact.name,
    brokerSlug,
    areas: blocks,
    unsubscribeUrl: links.unsubscribeUrl,
    viewUrl: links.viewUrl,
    manageUrl: links.manageUrl,
    senderBroker: shellBrokerFor(brokerSlug),
    asOf: now,
  })
  const prepared = prepareDeliverableEmail({
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    personId,
    unsubscribeUrl: links.unsubscribeUrl,
    oneClickUnsubscribeUrl: links.oneClickUrl,
    footer: 'from-body',
  })

  // ── §0 Spark cross-check ──────────────────────────────────────────────────
  const checks: SparkCheck[] = []
  for (const b of blocks) {
    if (b.activeListings != null) {
      if (b.geoType === 'city') {
        try {
          const { count, filter } = await sparkActiveCount(b.areaLabel)
          const deltaPct = count != null && count > 0 ? Math.round(((b.activeListings - count) / count) * 1000) / 10 : null
          checks.push({
            area: b.slug,
            figure: 'homes for sale',
            supabase: b.activeListings,
            spark: count,
            deltaPct,
            filter,
            status: deltaPct != null && Math.abs(deltaPct) <= 1 ? 'ok' : 'STOP',
          })
        } catch (e) {
          checks.push({
            area: b.slug,
            figure: 'homes for sale',
            supabase: b.activeListings,
            spark: null,
            deltaPct: null,
            filter: 'Spark OData Property',
            status: 'STOP',
            note: `Spark read failed: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`,
          })
        }
      } else {
        checks.push({
          area: b.slug,
          figure: 'homes for sale',
          supabase: b.activeListings,
          spark: null,
          deltaPct: null,
          filter: 'n/a',
          status: 'not-reconciled',
          note: 'a boundary-defined neighborhood: Spark has no attribute that reproduces the polygon',
        })
      }
    }
    for (const figure of ['median sale price, last 12 months', 'homes sold, last 12 months', 'median days on market, last 12 months']) {
      if (rendered.figures.some((f) => f.area === b.slug && f.label === figure)) {
        checks.push({
          area: b.slug,
          figure,
          supabase: null,
          spark: null,
          deltaPct: null,
          filter: 'n/a',
          status: 'not-reconciled',
          note: 'a twelve-month figure over the closed set: not reproduced from Spark by this script',
        })
      }
    }
  }

  // ── Write ────────────────────────────────────────────────────────────────
  mkdirSync(outDir, { recursive: true })
  const stem = `${(contact.name ?? `person-${personId}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${fetchedAt.slice(0, 10)}`
  const htmlPath = join(outDir, `${stem}.html`)
  writeFileSync(htmlPath, prepared.html)
  writeFileSync(join(outDir, `${stem}.txt`), `Subject: ${prepared.subject}\n\n${prepared.text}\n`)
  writeFileSync(
    join(outDir, `${stem}.citations.json`),
    JSON.stringify(
      {
        rendered_at: fetchedAt,
        not_sent: true,
        person_id: personId,
        subscription_id: subscriptionId,
        broker: brokerSlug,
        subject: prepared.subject,
        areas: blocks.map((b) => b.slug),
        freshness: { max_age_hours: MARKET_DATA_MAX_AGE_HOURS, stale },
        headers: prepared.headers,
        deliverability: prepared.report.level,
        figures: rendered.figures.map((f) => ({ ...f, fetched_at: fetchedAt })),
        spark_cross_check: checks,
      },
      null,
      2,
    ),
  )

  // ── Print ────────────────────────────────────────────────────────────────
  console.log(`NOT SENT. Rendered ${htmlPath}`)
  console.log(`Subject: ${prepared.subject}`)
  console.log(`From: ${brokerSlug} · deliverability: ${prepared.report.level}`)
  for (const issue of prepared.report.issues) console.log(`  deliverability ${issue.severity}: ${issue.code}${issue.message ? ` (${issue.message})` : ''}`)
  console.log(`Freshness (max ${MARKET_DATA_MAX_AGE_HOURS}h): ${stale.length ? `STALE ${describeStaleSources(stale)}` : 'fresh'}`)
  console.log('\nFigures (display | source · filter · as of · n):')
  for (const f of rendered.figures) {
    console.log(`  ${f.areaLabel ?? 'report'} · ${f.label}: ${f.display} | ${f.source} · ${f.filter} · as of ${f.as_of ?? 'n/a'} · n=${f.n ?? 'n/a'}`)
  }
  console.log('\nSpark cross-check:')
  for (const c of checks) {
    console.log(
      `  ${c.status.padEnd(15)} ${c.area} ${c.figure}: supabase=${c.supabase ?? 'n/a'} spark=${c.spark ?? 'n/a'} delta=${c.deltaPct ?? 'n/a'}%${c.note ? ` (${c.note})` : ''}`,
    )
  }
  if (checks.some((c) => c.status === 'STOP')) {
    console.log('\nSTOP: a figure differs from Spark by more than 1%. Surface it to Matt before anything sends (CLAUDE.md §0).')
    process.exitCode = 2
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
