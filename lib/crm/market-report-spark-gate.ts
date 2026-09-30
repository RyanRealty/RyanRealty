/**
 * market-report-spark-gate: CLAUDE.md §0's hard pre-render gate for a market
 * report, run by the SENDER before every send (scheduled, manual and preview)
 * and by scripts/render-market-report.ts. Before 2026-09-30 only the render
 * script ran it, so no report that actually went out had been reconciled.
 *
 * THE RULE, exactly as §0 states it, and no looser: every printed figure Spark
 * can also produce is rebuilt from Spark's own listings over the population
 * the figure was computed on (lib/crm/market-report-spark-check.ts), and any
 * |delta| > 1% is a STOP. There is no tolerance for small counts: a printed 29
 * against Spark's 30 is a 3.33% delta and it STOPs. A looser rule is Matt's
 * call to make, not the code's (coordinator, 2026-09-30). A figure Spark cannot
 * rebuild is NOT RECONCILED and does not ship either (§0 rule 7), and a check
 * that cannot run at all (Spark down, a key missing, a polygon read failing)
 * reconciles nothing. The sender HOLDS the report on any of the three,
 * records the hold with both values, the delta, the population and the Spark
 * queries (crm_report_sends.spark_check), and pages Matt so a person decides.
 *
 * The pulls, and why each is shaped as it is, are documented beside them
 * (sparkPullFilters, sparkPull). A pull is complete (rows collected equal
 * Spark's TotalRows) or it throws: a partial pull never reaches a check.
 *
 * A memo (createSparkGateMemo) lets one cron run share the pulls and the
 * polygon and alias reads across its subscribers: two contacts who both follow
 * Bend cost one Bend pull. It lives for one run only, so every run pulls fresh.
 *
 * Server-only. Reads go through lib/data (DAL boundary) and lib/spark.
 */
import 'server-only'

import { fetchSparkListingsPage } from '@/lib/spark'
import { getBoundaryGeoJSON } from '@/lib/data/geo/getBoundaryGeoJSON'
import { getCrmNeighborhoodOptions } from '@/lib/data/crm/getCrmNeighborhoodOptions'
import { getNeighborhoodAliasRows } from '@/lib/data/geo/getNeighborhoodAliasRows'
import { getServiceAreaCities } from '@/lib/data/market-report/reconcile'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { ReportFigure } from '@/lib/crm/market-report-figures'
import {
  buildSparkChecks,
  earliestCloseDayNeeded,
  polygonalAcres,
  polygonalBbox,
  SPARK_DELTA_LIMIT_PCT,
  uniqueListings,
  type NeighborhoodAlias,
  type NeighborhoodShape,
  type Polygonal,
  type SparkCheck,
  type SparkCheckData,
  type SparkListing,
} from '@/lib/crm/market-report-spark-check'

/** The rule every check result carries, so a stored trace says which rule held it. */
export const SPARK_GATE_RULE =
  `CLAUDE.md §0: every printed figure is rebuilt from Spark over the population it was computed on; ` +
  `any |delta| > ${SPARK_DELTA_LIMIT_PCT}% is a STOP (strict: no tolerance for small counts); ` +
  'a figure Spark cannot rebuild is not reconciled and does not ship; the report is held and Matt decides.'

const DETACHED = "PropertyType Eq 'A' And PropertySubType Eq 'Single Family Residence'"
const SPARK_SELECT =
  'ListingKey,City,PropertyType,PropertySubType,StandardStatus,ClosePrice,CloseDate,ListPrice,OnMarketDate,PendingTimestamp,Latitude,Longitude,SubdivisionName,ParcelNumber,ModificationTimestamp'

/** Rows a single pull may return before it is refused as too broad. */
const SPARK_MAX_ROWS = 60_000

/** Alias labels per SubdivisionName pull (the filter must stay a sane length). */
const LABELS_PER_PULL = 25

export type SparkQueryLog = {
  kind: 'active' | 'closed'
  filter: string
  total_rows: number | null
  rows: number
  attempts: number
  fetched_at: string
}

export type SparkGateVerdict = 'ok' | 'STOP' | 'not-reconciled'

/** What a send stores (crm_report_sends.spark_check) and what a hold names. */
export type SparkGateResult = {
  verdict: SparkGateVerdict
  rule: string
  checkedAt: string
  /** The earliest close day the pulls reached back to. */
  since: string | null
  /** One check per printed figure, in the order the email printed them. */
  checks: SparkCheck[]
  queries: SparkQueryLog[]
  /** Neighborhood polygons that did not load (they leave neighborhood checks unbuilt). */
  polygonGaps: string[]
  /** Why the check could not run at all. Null when it ran. */
  error: string | null
}

type SparkPull = { rows: SparkListing[]; totalRows: number; attempts: number; fetchedAt: string }

type GateContext = {
  neighborhoods: NeighborhoodShape[]
  polygonGaps: string[]
  aliases: NeighborhoodAlias[]
  serviceAreaCities: string[]
}

/** Per-run shared reads (see the file comment). */
export type SparkGateMemo = {
  pulls: Map<string, Promise<SparkPull>>
  cityPolygons: Map<string, Promise<Polygonal | null>>
  context: Promise<GateContext> | null
}

export function createSparkGateMemo(): SparkGateMemo {
  return { pulls: new Map(), cityPolygons: new Map(), context: null }
}

/**
 * STOP when any check STOPs; not-reconciled when any could not be rebuilt;
 * else ok. An EMPTY list is a STOP (review 2026-09-30): a gate that checked
 * nothing has verified nothing, and a report with printed figures never
 * passes on zero checks. Pure.
 */
export function sparkGateVerdict(checks: readonly SparkCheck[]): SparkGateVerdict {
  if (checks.length === 0) return 'STOP'
  if (checks.some((c) => c.status === 'STOP')) return 'STOP'
  if (checks.some((c) => c.status === 'not-reconciled')) return 'not-reconciled'
  return 'ok'
}

function valueText(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? 'n/a' : String(Math.round(v * 100) / 100)
}

/**
 * One line per figure that held the report: area and figure, both values, the
 * delta, the population. Capped at `limit` characters. Pure.
 */
export function describeSparkGate(result: Pick<SparkGateResult, 'verdict' | 'checks' | 'error'>, limit = 2000): string {
  if (result.verdict === 'ok') return 'Spark check passed: every printed figure reconciled within 1%.'
  if (result.error) return `Spark check could not run, so no figure is verified (CLAUDE.md §0): ${result.error}`.slice(0, limit)
  if (result.checks.length === 0) {
    return 'Spark check STOP: no printed figure was checked, so nothing is verified (CLAUDE.md §0).'.slice(0, limit)
  }
  const bad = result.checks.filter((c) => c.status === (result.verdict === 'STOP' ? 'STOP' : 'not-reconciled'))
  const head =
    result.verdict === 'STOP'
      ? `Spark check STOP, ${bad.length} figure${bad.length === 1 ? '' : 's'} over the 1% limit (CLAUDE.md §0): `
      : `Spark check could not verify ${bad.length} figure${bad.length === 1 ? '' : 's'} (CLAUDE.md §0 rule 7): `
  const lines = bad.map((c) => {
    const delta = c.deltaPoints != null ? `${c.deltaPoints} pts` : c.deltaPct != null ? `${c.deltaPct}%` : 'n/a'
    const values = result.verdict === 'STOP' ? `: printed ${valueText(c.supabase)}, Spark ${valueText(c.spark)}, delta ${delta}` : ''
    return `${c.area ?? 'report'} ${c.figure}${values} [${c.population}${c.note ? `; ${c.note}` : ''}]`
  })
  return (head + lines.join('; ')).slice(0, limit)
}

function quote(v: string): string {
  return `'${v.replace(/'/g, "\\'")}'`
}

function bboxWhere(g: Polygonal): string {
  const [minLng, minLat, maxLng, maxLat] = polygonalBbox(g)
  return `Latitude Bt ${minLat},${maxLat} And Longitude Bt ${minLng},${maxLng}`
}

/**
 * The Spark v1 /listings filters the checks need, each with the set it feeds.
 * Pure. Actives are detached only (the printed count is); closes are EVERY
 * property type, because Market Truth ranks duplicate parcels across types.
 * Each city by MLS City text, plus its polygon's bounding box (the cache's
 * city population is the polygon, whatever the City text); each neighborhood
 * by its polygon's bounding box, plus its alias labels (a listing outside
 * every polygon or without coordinates, and the cache's neighborhood set),
 * LABELS_PER_PULL at a time. Closes reach back to `since` only.
 */
export function sparkPullFilters(input: {
  blocks: readonly MarketReportAreaBlock[]
  since: string | null
  cityPolygons: ReadonlyMap<string, Polygonal | null>
  neighborhoods: readonly NeighborhoodShape[]
  aliases: readonly NeighborhoodAlias[]
}): Map<string, 'active' | 'closed'> {
  const pulls = new Map<string, 'active' | 'closed'>()
  const add = (where: string) => {
    pulls.set(`StandardStatus Eq 'Active' And ${DETACHED} And ${where}`, 'active')
    if (input.since) pulls.set(`StandardStatus Eq 'Closed' And CloseDate Ge ${input.since} And ${where}`, 'closed')
  }
  for (const b of input.blocks) {
    if (b.geoType === 'city') {
      add(`City Eq ${quote(b.areaLabel)}`)
      const poly = input.cityPolygons.get(b.slug)
      if (poly) add(bboxWhere(poly))
      continue
    }
    const own = input.neighborhoods.find((n) => n.slug === b.slug)
    if (own) add(bboxWhere(own.geometry))
    const labels = [
      ...new Set(input.aliases.filter((a) => a.neighborhoodSlug === b.slug).map((a) => a.subdivisionLabel.trim()).filter(Boolean)),
    ]
    for (let i = 0; i < labels.length; i += LABELS_PER_PULL) {
      add(`(${labels.slice(i, i + LABELS_PER_PULL).map((l) => `SubdivisionName Eq ${quote(l)}`).join(' Or ')})`)
    }
  }
  return pulls
}

/**
 * Every row a Spark v1 /listings filter returns, COMPLETE or not at all. Pages
 * run in ascending ListingKey order (a key leads with its creation time, so a
 * new listing lands on the last page), and the unique rows collected must
 * equal the TotalRows Spark reported on the first and the last page; a
 * mismatch re-pulls, and a third mismatch throws.
 */
export async function sparkPull(
  filter: string,
  token: string,
  fetchPage: typeof fetchSparkListingsPage = fetchSparkListingsPage,
): Promise<SparkPull> {
  let last = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const fetchedAt = new Date().toISOString()
    const rows: SparkListing[] = []
    let firstTotal: number | null = null
    let lastTotal: number | null = null
    for (let page = 1; ; page++) {
      const res = await fetchPage(token, { page, limit: 1000, filter, select: SPARK_SELECT, orderby: '+ListingKey' })
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
    if (firstTotal === lastTotal && unique.length === lastTotal) {
      return { rows: unique, totalRows: lastTotal!, attempts: attempt, fetchedAt }
    }
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

/**
 * The neighborhood polygons (all of them: Market Truth files a listing under
 * the smallest one holding it), the alias labels and the service-area cities.
 * A failed read never passes for "none": getBoundaryGeoJSON answers null
 * without the anon client, and the neighborhood list degrades to [] on an
 * error, and either would quietly swap the population a check rebuilds.
 */
async function loadContext(): Promise<GateContext> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required to read boundary polygons')
  }
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
  const serviceAreaCities = (await getServiceAreaCities()).map((c) => c.city)
  if (serviceAreaCities.length === 0) throw new Error('no service-area cities were read; refusing to rebuild Market Truth populations')
  return { neighborhoods, polygonGaps, aliases, serviceAreaCities }
}

/**
 * Everything buildSparkChecks needs for these blocks and printed figures:
 * the polygons, the alias labels, the service area, and every Spark pull.
 * Throws when any of it cannot be read completely.
 */
export async function gatherSparkCheckData(input: {
  blocks: readonly MarketReportAreaBlock[]
  figures: readonly ReportFigure[]
  memo?: SparkGateMemo
}): Promise<{ data: SparkCheckData; queries: SparkQueryLog[]; since: string | null; polygonGaps: string[] }> {
  const token = process.env.SPARK_API_KEY?.trim()
  if (!token) throw new Error('SPARK_API_KEY is not set')
  const memo = input.memo ?? createSparkGateMemo()
  if (!memo.context) {
    memo.context = loadContext()
    // A failed read must not stay memoized for the next subscriber of the run.
    memo.context.catch(() => {
      memo.context = null
    })
  }
  const ctx = await memo.context

  // A city's cache row is keyed by its space-form slug (lib/market/city-cache-slug.ts),
  // and its polygon is the boundaries row under THAT slug when one exists
  // ("la pine" has none, so the cache matches MLS City text there).
  const cityPolygons = new Map<string, Polygonal | null>()
  for (const b of input.blocks.filter((x) => x.geoType === 'city')) {
    const key = canonicalCityCacheSlug(b.slug)
    let p = memo.cityPolygons.get(key)
    if (!p) {
      p = getBoundaryGeoJSON({ geoType: 'city', geoSlug: key })
      memo.cityPolygons.set(key, p)
      p.catch(() => memo.cityPolygons.delete(key))
    }
    cityPolygons.set(b.slug, await p)
  }

  const since = earliestCloseDayNeeded(input.blocks, input.figures)
  const filters = sparkPullFilters({ blocks: input.blocks, since, cityPolygons, neighborhoods: ctx.neighborhoods, aliases: ctx.aliases })
  const pulled = await pool([...filters], 3, async ([filter, kind]) => {
    let p = memo.pulls.get(filter)
    if (!p) {
      p = sparkPull(filter, token)
      memo.pulls.set(filter, p)
      p.catch(() => memo.pulls.delete(filter))
    }
    return { kind, filter, pull: await p }
  })

  const queries: SparkQueryLog[] = []
  const active: SparkListing[] = []
  const closed: SparkListing[] = []
  for (const { kind, filter, pull } of pulled) {
    queries.push({
      kind,
      filter: `Spark v1 /listings _filter=${filter}`,
      total_rows: pull.totalRows,
      rows: pull.rows.length,
      attempts: pull.attempts,
      fetched_at: pull.fetchedAt,
    })
    ;(kind === 'active' ? active : closed).push(...pull.rows)
  }
  return {
    data: {
      active: uniqueListings(active),
      closed: uniqueListings(closed),
      cityPolygons,
      neighborhoods: ctx.neighborhoods,
      neighborhoodPolygonGaps: ctx.polygonGaps,
      aliases: ctx.aliases,
      serviceAreaCities: ctx.serviceAreaCities,
      fetchedAt: queries.map((q) => q.fetched_at).sort()[0] ?? new Date().toISOString(),
    },
    queries,
    since,
    polygonGaps: ctx.polygonGaps,
  }
}

/**
 * The gate: pull, rebuild every printed figure, and say ok, STOP or
 * not-reconciled. Never throws: a check that cannot run comes back
 * not-reconciled with the reason, and the sender holds on it.
 */
export async function runSparkGate(input: {
  blocks: readonly MarketReportAreaBlock[]
  figures: readonly ReportFigure[]
  memo?: SparkGateMemo
  now?: Date
}): Promise<SparkGateResult> {
  const checkedAt = (input.now ?? new Date()).toISOString()
  try {
    const { data, queries, since, polygonGaps } = await gatherSparkCheckData(input)
    const checks = buildSparkChecks({ blocks: input.blocks, figures: input.figures, data })
    return { verdict: sparkGateVerdict(checks), rule: SPARK_GATE_RULE, checkedAt, since, checks, queries, polygonGaps, error: null }
  } catch (e) {
    return {
      verdict: 'not-reconciled',
      rule: SPARK_GATE_RULE,
      checkedAt,
      since: null,
      checks: [],
      queries: [],
      polygonGaps: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
