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
 * reports): the SAME gate the sender runs before every send
 * (lib/crm/market-report-spark-gate.ts). Every printed figure is rebuilt from
 * Spark's own listings over the population it was computed over
 * (lib/crm/market-report-spark-check.ts names each instrument's rules: Market
 * Truth by MLS City text or the smallest neighborhood polygon,
 * market_stats_cache by the city polygon or the neighborhood's alias labels).
 * The gate pulls the rows those populations need: each city by MLS City text,
 * each area polygon's bounding box (then point-in-polygon), and each
 * neighborhood's alias labels (listings outside every polygon or without
 * coordinates, and the cache's neighborhood set), detached actives and closes
 * of every property type (Market Truth ranks duplicate parcels across types),
 * back to the earliest window a printed figure uses. A pull is complete (rows
 * collected equal Spark's TotalRows) or the script throws. Both values, the
 * delta and the population print. The rule is §0's, strict: any |delta| over
 * 1% is a STOP, with no tolerance for small counts.
 *
 * Exit codes: 0 every figure reconciled and every source fresh; 2 STOP (a
 * |delta| over 1%: the conflict goes to Matt before anything sends); 3 a
 * figure could not be rebuilt (it does not ship until verified or cut, §0
 * rule 7); 4 a source is stale (the cadence sender would hold it); 1 an error.
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
  // The same gate the sender runs before every send (lib/crm/market-report-spark-gate.ts):
  // the pulls, the populations, and the strict §0 rule (any |delta| > 1% is a STOP).
  const { runSparkGate } = await import('../lib/crm/market-report-spark-gate')
  const gate = await runSparkGate({ blocks, figures: rendered.figures, now })
  if (gate.error) throw new Error(`Spark cross-check could not run: ${gate.error}`)
  const checks = gate.checks
  const sparkQueries = gate.queries
  const since = gate.since
  const polygonGaps = gate.polygonGaps

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
        spark_rule: gate.rule,
        spark_verdict: gate.verdict,
        spark_close_date_from: since,
        spark_polygon_read_gaps: polygonGaps,
        spark_queries: sparkQueries,
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
  console.log('\nSpark queries (rows collected = TotalRows, or the pull throws):')
  for (const q of sparkQueries) console.log(`  ${q.kind} rows=${q.rows} attempts=${q.attempts} ${q.filter}`)
  if (polygonGaps.length) console.log(`Neighborhood polygons that did not load: ${polygonGaps.join(', ')}`)
  console.log('\nSpark cross-check (supabase | spark | delta | population):')
  for (const c of checks) {
    const delta = c.deltaPoints != null ? `${c.deltaPoints} pts` : `${c.deltaPct ?? 'n/a'}%`
    console.log(
      `  ${c.status.padEnd(15)} ${c.area ?? 'report'} ${c.figure}: ${c.supabase ?? 'n/a'} | ${c.spark ?? 'n/a'} | ${delta}${c.supabaseN != null || c.sparkN != null ? ` | n ${c.supabaseN ?? 'n/a'} vs ${c.sparkN ?? 'n/a'}` : ''}`,
    )
    console.log(`                  ${c.population}${c.note ? ` [${c.note}]` : ''}`)
  }
  if (checks.some((c) => c.status === 'STOP')) {
    console.log('\nSTOP: a figure differs from Spark by more than 1%. Surface it to Matt before anything sends (CLAUDE.md §0).')
    process.exitCode = 2
  } else if (checks.some((c) => c.status === 'not-reconciled')) {
    console.log('\nNOT RECONCILED: a figure could not be rebuilt from Spark. It does not ship until it is verified or cut (CLAUDE.md §0 rule 7).')
    process.exitCode = 3
  } else if (stale.length > 0) {
    console.log(`\nSTALE: ${describeStaleSources(stale)}. The cadence sender holds a report on stale data; this one does not ship either.`)
    process.exitCode = 4
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
