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
 * reports): every printed figure is rebuilt from Spark's own listings over the
 * population it was computed over (lib/crm/market-report-spark-check.ts names
 * each instrument's rules: Market Truth by MLS City text or the smallest
 * neighborhood polygon, market_stats_cache by the city polygon or the
 * neighborhood's alias labels). This script pulls the rows those populations
 * need: each city by MLS City text, each area polygon's bounding box (then
 * point-in-polygon), and each neighborhood's alias labels (listings outside
 * every polygon or without coordinates, and the cache's neighborhood set),
 * detached actives and closes of every property type (Market Truth ranks
 * duplicate parcels across types), back to the earliest window a printed
 * figure uses. A pull is complete (rows collected equal Spark's TotalRows) or
 * the script throws. Both values, the delta and the population print.
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

type SparkListing = import('../lib/crm/market-report-spark-check').SparkListing

const DETACHED = "PropertyType Eq 'A' And PropertySubType Eq 'Single Family Residence'"
const SPARK_SELECT =
  'ListingKey,City,PropertyType,PropertySubType,StandardStatus,ClosePrice,CloseDate,ListPrice,OnMarketDate,PendingTimestamp,Latitude,Longitude,SubdivisionName,ParcelNumber,ModificationTimestamp'

type SparkQueryLog = {
  kind: 'active' | 'closed'
  filter: string
  total_rows: number | null
  rows: number
  attempts: number
  fetched_at: string
}

/** Rows a single pull may return before it is refused as too broad. */
const SPARK_MAX_ROWS = 60_000

/**
 * Every row a Spark v1 /listings filter returns (the API the sync reads),
 * COMPLETE or not at all. Pages run in ascending ListingKey order (a key leads
 * with its creation time, so a new listing lands on the last page), and the
 * unique rows collected must equal the TotalRows Spark reported on the first
 * and the last page; a mismatch re-pulls, and a third mismatch throws. A
 * partial pull never reaches a check.
 */
async function sparkPull(filter: string): Promise<{ rows: SparkListing[]; totalRows: number; attempts: number }> {
  const { fetchSparkListingsPage } = await import('../lib/spark')
  const { uniqueListings } = await import('../lib/crm/market-report-spark-check')
  const token = process.env.SPARK_API_KEY?.trim()
  if (!token) throw new Error('SPARK_API_KEY is not set')
  let last = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const rows: SparkListing[] = []
    let firstTotal: number | null = null
    let lastTotal: number | null = null
    for (let page = 1; ; page++) {
      const res = await fetchSparkListingsPage(token, { page, limit: 1000, filter, select: SPARK_SELECT, orderby: '+ListingKey' })
      const d = res.D
      if (!d?.Success) throw new Error(`Spark read failed for ${filter}`)
      const total = typeof d.Pagination?.TotalRows === 'number' ? d.Pagination.TotalRows : null
      const pages = typeof d.Pagination?.TotalPages === 'number' ? d.Pagination.TotalPages : null
      if (total == null || pages == null) throw new Error(`Spark returned no Pagination block for ${filter}`)
      if (total > SPARK_MAX_ROWS) throw new Error(`Spark pull too broad (${total} rows): ${filter}`)
      if (page === 1) firstTotal = total
      lastTotal = total
      for (const r of d.Results ?? []) {
        const f = ((r as { StandardFields?: Record<string, unknown> }).StandardFields ?? r) as Record<string, unknown>
        rows.push({ ...f, ListingKey: String(f.ListingKey ?? (r as { Id?: string }).Id ?? '') } as SparkListing)
      }
      if (page >= pages) break
    }
    const unique = uniqueListings(rows)
    if (firstTotal === lastTotal && unique.length === lastTotal) return { rows: unique, totalRows: lastTotal!, attempts: attempt }
    last = `collected ${unique.length} unique rows, TotalRows ${firstTotal} then ${lastTotal}`
  }
  throw new Error(`Spark pull incomplete after 3 attempts (${last}): ${filter}`)
}

/** Run async jobs with at most `limit` in flight (Spark rate-limits a burst). */
async function pool<T, R>(items: readonly T[], limit: number, job: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await job(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function quote(v: string): string {
  return `'${v.replace(/'/g, "\\'")}'`
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
  const {
    buildSparkChecks,
    earliestCloseDayNeeded,
    polygonalAcres,
    polygonalBbox,
    uniqueListings,
  } = await import('../lib/crm/market-report-spark-check')
  type Polygonal = import('../lib/crm/market-report-spark-check').Polygonal
  type NeighborhoodShape = import('../lib/crm/market-report-spark-check').NeighborhoodShape
  const { getBoundaryGeoJSON } = await import('../lib/data/geo/getBoundaryGeoJSON')
  const { getCrmNeighborhoodOptions } = await import('../lib/data/crm/getCrmNeighborhoodOptions')
  const { getNeighborhoodAliasRows } = await import('../lib/data/geo/getNeighborhoodAliasRows')
  const { getServiceAreaCities } = await import('../lib/data/market-truth/getServiceAreaCities')
  const { canonicalCityCacheSlug } = await import('../lib/market/city-cache-slug')

  // A failed read must never pass for "no polygon": getBoundaryGeoJSON answers
  // null without the anon client, and the neighborhood list degrades to [] on
  // an error. Both would quietly swap the population a check rebuilds.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required to read boundary polygons')
  }
  const since = earliestCloseDayNeeded(blocks, rendered.figures)

  // A city's cache row is keyed by its space-form slug (lib/market/city-cache-slug.ts),
  // and its polygon is the boundaries row under THAT slug when one exists
  // ("la pine" has none, so the cache matches MLS City text there).
  const cityPolygons = new Map<string, Polygonal | null>()
  await Promise.all(
    blocks
      .filter((b) => b.geoType === 'city')
      .map(async (b) => {
        cityPolygons.set(b.slug, await getBoundaryGeoJSON({ geoType: 'city', geoSlug: canonicalCityCacheSlug(b.slug) }))
      }),
  )
  // Every neighborhood polygon: Market Truth files a listing under the
  // smallest one holding it, so a check needs all of them, not only its own.
  const options = await getCrmNeighborhoodOptions()
  if (options.length === 0) throw new Error('no neighborhood slugs were read; refusing to rebuild neighborhood membership')
  const shapes = await Promise.all(
    options.map(async (opt) => ({ slug: opt.key, geometry: await getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: opt.key }) })),
  )
  const neighborhoods: NeighborhoodShape[] = shapes
    .filter((x): x is { slug: string; geometry: Polygonal } => x.geometry != null)
    .map((x) => ({ slug: x.slug, geometry: x.geometry, acres: polygonalAcres(x.geometry) }))
  const polygonGaps = shapes.filter((x) => x.geometry == null).map((x) => x.slug)
  const aliases = await getNeighborhoodAliasRows()
  const serviceAreaCities = await getServiceAreaCities()
  if (serviceAreaCities.length === 0) throw new Error('no service-area cities were read; refusing to rebuild Market Truth populations')

  // The pulls. Actives are detached only (the count is). Closes are EVERY
  // property type: Market Truth ranks duplicate parcels across types. Each
  // city by MLS City text; each area polygon's bounding box (any City text);
  // each neighborhood's alias labels (listings outside every polygon, or with
  // no coordinates, and the cache's neighborhood population), 25 per pull.
  const pulls = new Map<string, 'active' | 'closed'>()
  const addPulls = (where: string) => {
    pulls.set(`StandardStatus Eq 'Active' And ${DETACHED} And ${where}`, 'active')
    if (since) pulls.set(`StandardStatus Eq 'Closed' And CloseDate Ge ${since} And ${where}`, 'closed')
  }
  const bboxWhere = (g: Polygonal) => {
    const [minLng, minLat, maxLng, maxLat] = polygonalBbox(g)
    return `Latitude Bt ${minLat},${maxLat} And Longitude Bt ${minLng},${maxLng}`
  }
  for (const b of blocks) {
    if (b.geoType === 'city') {
      addPulls(`City Eq ${quote(b.areaLabel)}`)
      const poly = cityPolygons.get(b.slug)
      if (poly) addPulls(bboxWhere(poly))
      continue
    }
    const own = neighborhoods.find((n) => n.slug === b.slug)
    if (own) addPulls(bboxWhere(own.geometry))
    const labels = [...new Set(aliases.filter((a) => a.neighborhoodSlug === b.slug).map((a) => a.subdivisionLabel.trim()).filter(Boolean))]
    for (let i = 0; i < labels.length; i += 25) {
      addPulls(`(${labels.slice(i, i + 25).map((l) => `SubdivisionName Eq ${quote(l)}`).join(' Or ')})`)
    }
  }
  const sparkQueries: SparkQueryLog[] = []
  const activeRows: SparkListing[] = []
  const closedRows: SparkListing[] = []
  const pulled = await pool([...pulls], 3, async ([filter, kind]) => {
    const fetched = new Date().toISOString()
    const { rows, totalRows, attempts } = await sparkPull(filter)
    return { kind, filter, rows, totalRows, attempts, fetched }
  })
  for (const p of pulled) {
    sparkQueries.push({ kind: p.kind, filter: `Spark v1 /listings _filter=${p.filter}`, total_rows: p.totalRows, rows: p.rows.length, attempts: p.attempts, fetched_at: p.fetched })
    ;(p.kind === 'active' ? activeRows : closedRows).push(...p.rows)
  }
  const checks = buildSparkChecks({
    blocks,
    figures: rendered.figures,
    data: {
      active: uniqueListings(activeRows),
      closed: uniqueListings(closedRows),
      cityPolygons,
      neighborhoods,
      neighborhoodPolygonGaps: polygonGaps,
      aliases,
      serviceAreaCities,
      fetchedAt: sparkQueries.map((q) => q.fetched_at).sort()[0] ?? fetchedAt,
    },
  })

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
