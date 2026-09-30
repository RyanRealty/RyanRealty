/**
 * market-report-spark-check: CLAUDE.md §0's hard pre-render gate for a market
 * report, as pure functions.
 *
 * The rule: before a market report renders, every printed figure Spark can also
 * produce is rebuilt from Spark's own listings, both values and the delta
 * print, and any |delta| > 1% is a STOP that goes to Matt before anything
 * sends (Spark wins for active inventory and days on market; Supabase wins for
 * reconciled historical closes past the Spark cutover). A figure that cannot be
 * rebuilt is reported 'not-reconciled', never passed: it does not ship until it
 * is verified or cut (§0 rule 7).
 *
 * A check is only a check when Spark's figure is taken over the SAME population
 * the printed figure was. A count over a different population is a second
 * number, not a reconciliation. So every check names its population, and each
 * printed figure is rebuilt under the rules of the instrument that produced it:
 *
 *   Market Truth (market_metric, definition mt-v1), segment detached
 *   (PropertyType 'A' and PropertySubType 'Single Family Residence'):
 *     city          MLS City text (place_membership method city_text)
 *     neighborhood  the smallest neighborhood polygon holding the point; a
 *                   listing inside none (or with no coordinates) falls back to
 *                   the first neighborhood, by slug, whose
 *                   neighborhood_subdivisions label equals its SubdivisionName
 *                   (supabase/migrations/20260923014500_place_membership_incremental_refresh.sql)
 *     active_count  StandardStatus 'Active'; a listing filed by alias label
 *                   counts only when its MLS City is in the service area
 *                   (market_service_area). Measured 2026-09-30, not read from
 *                   the migration, which would count it: Klamath Falls listing
 *                   20260529194642378805000000 (SubdivisionName "Tanglewood",
 *                   a Bend subdivision label) holds a primary alias membership
 *                   in bend-larkspur and the live cell's 29 leaves it out; a
 *                   second Klamath Falls name match (bend-mountain-view) is
 *                   left out the same way, while in-area alias listings
 *                   (Broken Top, Crosswater) are counted.
 *     closed cells  publishable closes (MLS City in the service area, close
 *                   price of at least 1000, no price typo, one row per parcel,
 *                   close date and price, ranked over every close of every
 *                   property type) with close_date in (period_end - window, period_end]
 *                   (supabase/migrations/20260822233000_refresh_market_fact_sale.sql;
 *                   20260925060000 adds absent_from_mls, a sale Spark no longer
 *                   serves, which no Spark pull can contain)
 *     year over year  the same window ending 12 months before period_end
 *     months of supply  active_count / (closes in (period_end - 180 days, period_end] / 6)
 *   market_stats_cache (methodology v3-2026-05-07, public.cache_methodology_definitions),
 *   Single Family Residence, ClosePrice of at least 1000:
 *     city          inside the boundaries polygon keyed by the cache row's own
 *                   slug when there is one, else MLS City text
 *     neighborhood  SubdivisionName among the neighborhood's neighborhood_subdivisions labels
 *     window        CloseDate between period_start and period_end, both included
 *     days on market  days_to_pending: whole 24-hour periods from OnMarketDate
 *                   to pending_timestamp, never below 0 (see listToPendingDays)
 *
 * A percent change (year over year, month over month) is compared at the one
 * decimal it prints: the rebuilt change must print the same number. A relative
 * delta of two small percentages says nothing. The headline repeats one area's
 * figures and passes only when every figure it repeats passed.
 *
 * Known residue, stated rather than hidden:
 *   - Market Truth ranks duplicate parcels over every closed listing in the
 *     MLS; the rebuild ranks over every close the pulls returned (every
 *     property type in the pulled cities, boxes and alias labels), so a
 *     duplicate whose twin sits outside those pulls is not seen.
 *   - place_membership skips a polygon that fails PostGIS ST_IsValid; the
 *     rebuild cannot test validity and uses every polygon that loaded. A
 *     polygon that did not load at all makes every neighborhood membership
 *     check not-reconciled.
 *   - Alias labels match case-insensitively (Market Truth's lower(btrim())).
 *     Spark is asked for each label's exact text, so a case variant with no
 *     coordinates, outside every pulled city and box, is not seen.
 *   - A pull pages by ascending ListingKey and must end with as many unique
 *     rows as Spark's TotalRows on its first and last page. A listing that
 *     leaves the set while another re-enters it mid-pull can still slip past.
 *
 * Pure: no I/O. scripts/render-market-report.ts pulls the Spark rows, the
 * polygons and the alias labels, then calls buildSparkChecks.
 */

import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { MarketTrendPoint } from '@/lib/data/market/getMarketTrend'
import type { MetricProvenance } from '@/lib/data/market-truth/getMetric'
import type { ReportFigure } from '@/lib/crm/market-report-figures'
import { chartableMonths, momMedianPair } from '@/lib/crm/market-report-email'
import { marketVerdict } from '@/lib/market/classify'

/** CLAUDE.md §0: a Spark delta beyond this many percent stops the render. */
export const SPARK_DELTA_LIMIT_PCT = 1

/** One Spark v1 listing, only the StandardFields a check reads. */
export type SparkListing = {
  ListingKey: string
  City?: string | null
  PropertyType?: string | null
  PropertySubType?: string | null
  StandardStatus?: string | null
  ClosePrice?: number | null
  CloseDate?: string | null
  ListPrice?: number | null
  OnMarketDate?: string | null
  PendingTimestamp?: string | null
  Latitude?: number | null
  Longitude?: number | null
  SubdivisionName?: string | null
  ParcelNumber?: string | null
  ModificationTimestamp?: string | null
}

export type Polygonal = GeoJSON.Polygon | GeoJSON.MultiPolygon

/** A neighborhood polygon and its area, for the smallest-polygon rule. */
export type NeighborhoodShape = { slug: string; geometry: Polygonal; acres: number }

export type NeighborhoodAlias = { neighborhoodSlug: string; subdivisionLabel: string }

export type SparkCheckStatus = 'ok' | 'STOP' | 'not-reconciled' | 'derived'

export type SparkCheck = {
  area: string | null
  figure: string
  /** The printed figure's raw value. */
  supabase: number | null
  /** The same figure rebuilt from Spark. */
  spark: number | null
  /** (supabase - spark) / spark, percent. Null for a percent change (see deltaPoints). */
  deltaPct: number | null
  /** A percent change only: supabase - spark, in percentage points. */
  deltaPoints?: number | null
  /** The sample behind the printed figure, when it has one. */
  supabaseN?: number | null
  /** The Spark rows the rebuilt figure rests on. */
  sparkN?: number | null
  /** The population both figures are taken over, in plain words. */
  population: string
  status: SparkCheckStatus
  note?: string
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** The UTC calendar day of a date or an ISO timestamp. Null when unparseable. */
export function utcDay(value: string | null | undefined): string | null {
  if (!value) return null
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

function dayNumber(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from)
}

export function addDays(day: string, days: number): string {
  return new Date((dayNumber(day) + days) * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Postgres `(day - interval 'N months')::date`: the same day of the month, N
 * months earlier, clamped to that month's last day (2026-03-31 minus one month
 * is 2026-02-28).
 */
export function minusMonths(day: string, months: number): string {
  const total = Number(day.slice(0, 4)) * 12 + (Number(day.slice(5, 7)) - 1) - months
  const year = Math.floor(total / 12)
  const month = total - year * 12
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(Number(day.slice(8, 10)), last))).toISOString().slice(0, 10)
}

/** The last day of the month a YYYY-MM-DD falls in. */
export function monthLastDay(day: string): string {
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).toISOString().slice(0, 10)
}

/** A Market Truth window: close_date in (after, through]. */
type Window = { after: string; through: string }

/** A windowed cell's own window: (period_end - window, period_end]. */
export function cellWindow(cell: Pick<MetricProvenance, 'periodEnd' | 'windowMonths'>): Window | null {
  if (!cell.periodEnd) return null
  return { after: minusMonths(cell.periodEnd, cell.windowMonths || 12), through: cell.periodEnd }
}

/**
 * The year-over-year comparison window: the same length, ending 12 months
 * before period_end (v_prior_end = period_end - 12 months in
 * compute_market_metrics), whatever the window length.
 */
export function priorYearWindow(cell: Pick<MetricProvenance, 'periodEnd' | 'windowMonths'>): Window | null {
  if (!cell.periodEnd) return null
  const through = minusMonths(cell.periodEnd, 12)
  return { after: minusMonths(through, cell.windowMonths || 12), through }
}

// ── Statistics ───────────────────────────────────────────────────────────────

/** PostgreSQL percentile_cont(p): linear interpolation between the nearest ranks. */
export function percentileCont(values: readonly number[], p = 0.5): number | null {
  const v = values.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b)
  if (v.length === 0) return null
  const pos = p * (v.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return v[lo]! + (v[hi]! - v[lo]!) * (pos - lo)
}

/** (supabase - spark) / spark as a percent, two decimals. Null when either is missing or spark is 0. */
export function deltaPct(supabase: number | null, spark: number | null): number | null {
  if (supabase == null || spark == null || !Number.isFinite(supabase) || !Number.isFinite(spark)) return null
  if (spark === 0) return supabase === 0 ? 0 : null
  return Math.round(((supabase - spark) / spark) * 10_000) / 100
}

/** ok when both values exist and |delta| is within the §0 limit, else STOP. */
export function deltaStatus(delta: number | null): 'ok' | 'STOP' {
  return delta != null && Math.abs(delta) <= SPARK_DELTA_LIMIT_PCT ? 'ok' : 'STOP'
}

/** A percent as the email prints it: one decimal (lib/crm/market-report-format.ts). */
export function printedPercent(value: number): number {
  const r = Math.round(value * 10) / 10
  return r === 0 ? 0 : r
}

// ── Geometry ─────────────────────────────────────────────────────────────────

function ringContains(ring: readonly GeoJSON.Position[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function polygonContains(rings: readonly GeoJSON.Position[][], x: number, y: number): boolean {
  if (rings.length === 0 || !ringContains(rings[0]!, x, y)) return false
  for (let k = 1; k < rings.length; k++) if (ringContains(rings[k]!, x, y)) return false
  return true
}

/** Even-odd containment of a longitude/latitude point in a Polygon or MultiPolygon (holes respected). */
export function pointInPolygonal(lng: number, lat: number, geom: Polygonal): boolean {
  if (geom.type === 'Polygon') return polygonContains(geom.coordinates, lng, lat)
  return geom.coordinates.some((poly) => polygonContains(poly, lng, lat))
}

const EARTH_RADIUS_M = 6_378_137
const SQ_M_PER_ACRE = 4046.8564224

function ringAreaSqM(ring: readonly GeoJSON.Position[]): number {
  if (ring.length < 3) return 0
  const rad = Math.PI / 180
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    sum += (b[0]! - a[0]!) * rad * (2 + Math.sin(a[1]! * rad) + Math.sin(b[1]! * rad))
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2)
}

/** Spherical area in acres (outer rings minus holes). Orders overlapping polygons by size. */
export function polygonalAcres(geom: Polygonal): number {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  let sqm = 0
  for (const rings of polys) {
    rings.forEach((ring, k) => {
      sqm += (k === 0 ? 1 : -1) * ringAreaSqM(ring)
    })
  }
  return sqm / SQ_M_PER_ACRE
}

/** [minLng, minLat, maxLng, maxLat] of a polygon, for a Spark bounding-box pull. */
export function polygonalBbox(geom: Polygonal): [number, number, number, number] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const rings of polys) {
    for (const [x, y] of rings[0] ?? []) {
      if (x! < minX) minX = x!
      if (x! > maxX) maxX = x!
      if (y! < minY) minY = y!
      if (y! > maxY) maxY = y!
    }
  }
  return [minX, minY, maxX, maxY]
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Detached: PropertyType 'A' and PropertySubType 'Single Family Residence' (MARKET_TRUTH D1). */
export function isDetached(r: SparkListing): boolean {
  return r.PropertyType === 'A' && r.PropertySubType === 'Single Family Residence'
}

function hasPoint(r: SparkListing): { lng: number; lat: number } | null {
  const lat = num(r.Latitude)
  const lng = num(r.Longitude)
  if (lat == null || lng == null || (lat === 0 && lng === 0)) return null
  return { lng, lat }
}

/** One row per ListingKey across several pulls (the first seen wins). */
export function uniqueListings(rows: readonly SparkListing[]): SparkListing[] {
  const seen = new Set<string>()
  const out: SparkListing[] = []
  for (const r of rows) {
    if (!r?.ListingKey || seen.has(r.ListingKey)) continue
    seen.add(r.ListingKey)
    out.push(r)
  }
  return out
}

const JUNK_PARCEL = /^(n\/?a\.?|none|tbd|null|unknown|0+|-+|\.+)$/

/** A real parcel number, or null for a junk key (TBD, N/A, 0...), as market_fact_sale reads it. */
export function realParcel(parcel: string | null | undefined): string | null {
  const t = (parcel ?? '').trim()
  if (!t || JUNK_PARCEL.test(t.toLowerCase())) return null
  return t
}

/** market_fact_sale's price_typo: a close near 10x the list, or a list over 500x the close. */
export function isPriceTypo(close: number | null, list: number | null): boolean {
  if (close == null || list == null || !(close > 0) || !(list > 0)) return false
  const ratio = close / list
  return (ratio >= 9 && ratio <= 11) || list / close > 500
}

/**
 * Market Truth's publishable closes (market_fact_sale.is_publishable) among
 * the given closed rows: one row per real parcel, close date and rounded close
 * price (the latest modified wins, ListingKey breaks a tie), then an MLS City
 * inside the service area, a close price of at least 1000 and no price typo.
 * The duplicate rank runs before the
 * other exclusions, as the fact refresh does, so pass EVERY closed row pulled,
 * of every property type, and narrow to detached and a population after: a
 * detached close whose same-parcel twin (a land or farm listing of the same
 * sale) was modified later is a duplicate, not a sale.
 */
export function marketTruthPublishableCloses(
  rows: readonly SparkListing[],
  inServiceArea: (r: SparkListing) => boolean = () => true,
): SparkListing[] {
  const groups = new Map<string, SparkListing[]>()
  for (const r of rows) {
    const parcel = realParcel(r.ParcelNumber)
    const key = parcel
      ? `${parcel}|${utcDay(r.CloseDate) ?? ''}|${Math.round(num(r.ClosePrice) ?? -1)}`
      : `key|${r.ListingKey}`
    const g = groups.get(key) ?? []
    g.push(r)
    groups.set(key, g)
  }
  const out: SparkListing[] = []
  for (const g of groups.values()) {
    const winner = [...g].sort((a, b) => {
      const ta = Date.parse(a.ModificationTimestamp ?? '')
      const tb = Date.parse(b.ModificationTimestamp ?? '')
      const va = Number.isFinite(ta) ? ta : -Infinity
      const vb = Number.isFinite(tb) ? tb : -Infinity
      if (va !== vb) return vb - va
      return a.ListingKey < b.ListingKey ? 1 : a.ListingKey > b.ListingKey ? -1 : 0
    })[0]!
    if (!inServiceArea(winner)) continue
    const close = num(winner.ClosePrice)
    if (close == null || close < 1000) continue
    if (isPriceTypo(close, num(winner.ListPrice))) continue
    if (!utcDay(winner.CloseDate)) continue
    out.push(winner)
  }
  return out
}

/** Index alias labels: lower-cased trimmed label to its neighborhood slugs, sorted. */
export function buildAliasIndex(rows: readonly NeighborhoodAlias[]): Map<string, string[]> {
  const idx = new Map<string, string[]>()
  for (const r of rows) {
    const label = norm(r.subdivisionLabel)
    if (!label || !r.neighborhoodSlug) continue
    const slugs = idx.get(label) ?? []
    if (!slugs.includes(r.neighborhoodSlug)) slugs.push(r.neighborhoodSlug)
    idx.set(label, slugs)
  }
  for (const slugs of idx.values()) slugs.sort()
  return idx
}

/**
 * The neighborhood Market Truth files a listing under (place_membership
 * is_primary, geo_type neighborhood): the smallest neighborhood polygon
 * holding its point, ties by slug; a listing inside none, or with no point,
 * takes the first neighborhood (by slug) whose alias label matches its
 * SubdivisionName. Null when neither applies.
 */
export function primaryNeighborhood(
  r: SparkListing,
  shapes: readonly NeighborhoodShape[],
  aliases: ReadonlyMap<string, readonly string[]>,
): string | null {
  return primaryNeighborhoodMembership(r, shapes, aliases)?.slug ?? null
}

/** primaryNeighborhood, with how the listing was filed (inside a polygon, or by alias label). */
export function primaryNeighborhoodMembership(
  r: SparkListing,
  shapes: readonly NeighborhoodShape[],
  aliases: ReadonlyMap<string, readonly string[]>,
): { slug: string; method: 'polygon' | 'alias' } | null {
  const p = hasPoint(r)
  if (p) {
    let best: NeighborhoodShape | null = null
    for (const s of shapes) {
      if (!pointInPolygonal(p.lng, p.lat, s.geometry)) continue
      if (!best || s.acres < best.acres || (s.acres === best.acres && s.slug < best.slug)) best = s
    }
    if (best) return { slug: best.slug, method: 'polygon' }
  }
  const name = norm(r.SubdivisionName)
  const slug = name ? aliases.get(name)?.[0] : undefined
  return slug ? { slug, method: 'alias' } : null
}

/**
 * The cache's list-to-pending days: COALESCE(days_to_pending, pending_timestamp::date
 * - OnMarketDate::date). The stored days_to_pending counts WHOLE 24-hour periods
 * from OnMarketDate to pending_timestamp and never goes below 0, not calendar
 * days: measured 2026-09-30 against the 51 Larkspur closes the rolling_365d row
 * rests on (24 of them are a day shorter than the calendar count, and a
 * calendar count moved that median from 8 to 9) and against the stored rows
 * whose pending time precedes their on-market time (0, not negative). Every
 * listing Spark returns carries both timestamps, so the stored value is the one
 * rebuilt here.
 */
export function listToPendingDays(r: SparkListing): number | null {
  const on = Date.parse(r.OnMarketDate ?? '')
  const pending = Date.parse(r.PendingTimestamp ?? '')
  if (!Number.isFinite(on) || !Number.isFinite(pending)) return null
  return Math.max(0, Math.floor((pending - on) / 86_400_000))
}

// ── Populations ──────────────────────────────────────────────────────────────

/** The inputs a check needs besides the printed figures. */
export type SparkCheckData = {
  /** Every active detached Spark row pulled, deduped (the status is re-checked here). */
  active: readonly SparkListing[]
  /** Every closed Spark row pulled, of EVERY property type, deduped. */
  closed: readonly SparkListing[]
  /**
   * City slug (the report's) to the boundaries polygon keyed by the cache
   * row's own slug: a polygon, or null when that slug has none (the cache then
   * matches MLS City text).
   */
  cityPolygons: ReadonlyMap<string, Polygonal | null>
  /** Every neighborhood polygon (the smallest-polygon rule needs all of them). */
  neighborhoods: readonly NeighborhoodShape[]
  /** Neighborhood slugs whose polygon did not load: membership cannot be rebuilt while any is missing. */
  neighborhoodPolygonGaps: readonly string[]
  /** Every neighborhood_subdivisions row. */
  aliases: readonly NeighborhoodAlias[]
  /** The MLS City names inside Market Truth's service area (market_service_area.city_proper). */
  serviceAreaCities: readonly string[]
  /** When the Spark rows were fetched (ISO), for the timing note on live counts. */
  fetchedAt: string
}

type Unavailable = { unavailable: string }

type MarketTruthPopulation = {
  description: string
  /** StandardStatus Active, detached, in the population. */
  active: SparkListing[]
  /** Publishable detached closes in the population. */
  closes: SparkListing[]
}

type CachePopulation = {
  description: string
  /** Detached closes of at least 1000 in the population (the cache does no duplicate ranking). */
  closes: SparkListing[]
}

function marketTruthPopulation(
  area: MarketReportAreaBlock,
  data: SparkCheckData,
  publishable: readonly SparkListing[],
  aliasIdx: Map<string, string[]>,
  inServiceArea: (r: SparkListing) => boolean,
): MarketTruthPopulation | Unavailable {
  if (area.geoType === 'city') {
    const city = norm(area.areaLabel)
    const inCity = (r: SparkListing) => isDetached(r) && norm(r.City) === city
    return {
      description: `Market Truth city: MLS City '${area.areaLabel}', detached`,
      active: data.active.filter((r) => inCity(r) && r.StandardStatus === 'Active'),
      closes: publishable.filter((r) => inCity(r) && r.StandardStatus === 'Closed'),
    }
  }
  if (data.neighborhoodPolygonGaps.length > 0) {
    return { unavailable: `neighborhood polygons that did not load (${data.neighborhoodPolygonGaps.join(', ')}) leave the smallest-polygon membership unbuildable` }
  }
  if (!data.neighborhoods.some((n) => n.slug === area.slug)) {
    return { unavailable: `the ${area.slug} polygon did not load, so membership cannot be rebuilt` }
  }
  const membership = (r: SparkListing) => (isDetached(r) ? primaryNeighborhoodMembership(r, data.neighborhoods, aliasIdx) : null)
  return {
    description: `Market Truth neighborhood: the smallest neighborhood polygon holding the listing is ${area.slug}, or its alias label outside every polygon (a service-area City only), detached`,
    active: data.active.filter((r) => {
      if (r.StandardStatus !== 'Active') return false
      const m = membership(r)
      return m != null && m.slug === area.slug && (m.method === 'polygon' || inServiceArea(r))
    }),
    closes: publishable.filter((r) => r.StandardStatus === 'Closed' && membership(r)?.slug === area.slug),
  }
}

function cachePopulation(area: MarketReportAreaBlock, data: SparkCheckData): CachePopulation | Unavailable {
  const base = (r: SparkListing) =>
    isDetached(r) && r.StandardStatus === 'Closed' && (num(r.ClosePrice) ?? 0) >= 1000 && utcDay(r.CloseDate) != null
  if (area.geoType === 'city') {
    const polygon = data.cityPolygons.get(area.slug)
    if (polygon === undefined) return { unavailable: `no city polygon read was made for ${area.slug}` }
    if (polygon) {
      return {
        description: `market_stats_cache v3 city: inside the ${area.slug} boundaries polygon, Single Family Residence, close price of at least 1000`,
        closes: data.closed.filter((r) => {
          if (!base(r)) return false
          const p = hasPoint(r)
          return p != null && pointInPolygonal(p.lng, p.lat, polygon)
        }),
      }
    }
    const city = norm(area.areaLabel)
    return {
      description: `market_stats_cache v3 city: MLS City '${area.areaLabel}' (no polygon under the cache row's slug), Single Family Residence, close price of at least 1000`,
      closes: data.closed.filter((r) => base(r) && norm(r.City) === city),
    }
  }
  const labels = new Set(data.aliases.filter((a) => a.neighborhoodSlug === area.slug).map((a) => norm(a.subdivisionLabel)))
  if (labels.size === 0) return { unavailable: `no neighborhood_subdivisions labels for ${area.slug}` }
  return {
    description: `market_stats_cache v3 neighborhood: SubdivisionName among the ${labels.size} neighborhood_subdivisions labels of ${area.slug}, Single Family Residence, close price of at least 1000`,
    closes: data.closed.filter((r) => base(r) && labels.has(norm(r.SubdivisionName))),
  }
}

function inWindow(rows: readonly SparkListing[], w: Window): SparkListing[] {
  return rows.filter((r) => {
    const d = utcDay(r.CloseDate)
    return d != null && d > w.after && d <= w.through
  })
}

/** Closes with a close day in [from, to] (market_stats_cache windows). */
function closedBetween(rows: readonly SparkListing[], from: string, to: string): SparkListing[] {
  return rows.filter((r) => {
    const d = utcDay(r.CloseDate)
    return d != null && d >= from && d <= to
  })
}

function closePrices(rows: readonly SparkListing[]): number[] {
  return rows.map((r) => num(r.ClosePrice)).filter((n): n is number => n != null)
}

function windowText(w: Window): string {
  return `(${w.after}, ${w.through}]`
}

// ── Printed figures ──────────────────────────────────────────────────────────

const TWELVE_MONTH = {
  median: 'median sale price, last 12 months',
  sold: 'homes sold, last 12 months',
  yoy: 'median sale price change from a year ago',
} as const
const MONTH_FIGURE = /^([A-Z][a-z]+) median sale price$/
const MOM_FIGURE = /^median sale price change ([A-Z][a-z]+) to ([A-Z][a-z]+)$/
const CHART_FIGURE = /^median sale price chart, /

function periodStartOf(f: ReportFigure): string | null {
  return /period_start=(\d{4}-\d{2}-\d{2})/.exec(f.filter)?.[1] ?? null
}

/**
 * The earliest CloseDate a Spark pull must reach back to so the window of
 * every PRINTED figure is covered. Null when no printed figure needs a closed
 * set (a trend point that printed nothing is not a reason to pull).
 */
export function earliestCloseDayNeeded(blocks: readonly MarketReportAreaBlock[], figures: readonly ReportFigure[]): string | null {
  const days: string[] = []
  for (const area of blocks) {
    const printed = figures.filter((f) => f.area === area.slug)
    const has = (label: string) => printed.some((f) => f.label === label)
    const tm = area.provenance?.twelveMonth
    const cacheStart = utcDay(area.provenance?.cache?.periodStart)
    if (area.twelveMonthSource === 'market-truth') {
      for (const [label, cell] of [
        [TWELVE_MONTH.median, tm?.medianClose],
        [TWELVE_MONTH.sold, tm?.closedCount],
      ] as const) {
        const w = has(label) && cell ? cellWindow(cell) : null
        if (w) days.push(w.after)
      }
      const prior = has(TWELVE_MONTH.yoy) && tm?.yoyMedian ? priorYearWindow(tm.yoyMedian) : null
      if (prior) days.push(prior.after)
    } else if (cacheStart && (has(TWELVE_MONTH.median) || has(TWELVE_MONTH.sold))) {
      days.push(cacheStart)
    }
    const mosEnd = area.provenance?.live?.periodEnd
    if (mosEnd && (has('months of supply') || has('market verdict'))) days.push(addDays(mosEnd, -180))
    if (cacheStart && has('median days on market, last 12 months')) days.push(cacheStart)
    for (const f of printed) {
      const start = MONTH_FIGURE.test(f.label) ? periodStartOf(f) : null
      if (start) days.push(start)
    }
    const points = area.trend?.points ?? []
    if (printed.some((f) => MOM_FIGURE.test(f.label))) {
      const pair = momMedianPair(points)
      if (pair) days.push(`${pair.prev.periodStart.slice(0, 7)}-01`)
    }
    if (printed.some((f) => CHART_FIGURE.test(f.label))) {
      const run = chartableMonths(points)
      if (run?.[0]) days.push(`${run[0].periodStart.slice(0, 7)}-01`)
    }
  }
  return days.length ? days.sort()[0]! : null
}

// ── Checks ───────────────────────────────────────────────────────────────────

function check(
  area: MarketReportAreaBlock | null,
  figure: string,
  supabase: number | null,
  spark: number | null,
  population: string,
  extra: { supabaseN?: number | null; sparkN?: number | null; note?: string } = {},
): SparkCheck {
  const delta = deltaPct(supabase, spark)
  return {
    area: area?.slug ?? null,
    figure,
    supabase,
    spark,
    deltaPct: delta,
    ...(extra.supabaseN !== undefined ? { supabaseN: extra.supabaseN } : {}),
    ...(extra.sparkN !== undefined ? { sparkN: extra.sparkN } : {}),
    population,
    status: deltaStatus(delta),
    ...(extra.note ? { note: extra.note } : {}),
  }
}

/** A percent change passes when the rebuilt change prints the same one-decimal number. */
function changeCheck(
  area: MarketReportAreaBlock,
  figure: string,
  printed: number | null,
  rebuilt: number | null,
  population: string,
  note: string,
): SparkCheck {
  const same = printed != null && rebuilt != null && printedPercent(printed) === printedPercent(rebuilt)
  return {
    area: area.slug,
    figure,
    supabase: printed,
    spark: rebuilt == null ? null : Math.round(rebuilt * 100) / 100,
    deltaPct: null,
    deltaPoints: printed != null && rebuilt != null ? Math.round((printed - rebuilt) * 100) / 100 : null,
    population,
    status: same ? 'ok' : 'STOP',
    note: `${note}; a percent change is compared at the one decimal it prints`,
  }
}

function notReconciled(area: MarketReportAreaBlock | null, figure: string, supabase: number | null, reason: string): SparkCheck {
  return { area: area?.slug ?? null, figure, supabase, spark: null, deltaPct: null, population: 'n/a', status: 'not-reconciled', note: reason }
}

function changedSince(rows: readonly SparkListing[], iso: string | null | undefined): number | null {
  const t = Date.parse(iso ?? '')
  if (!Number.isFinite(t)) return null
  return rows.filter((r) => {
    const m = Date.parse(r.ModificationTimestamp ?? '')
    return Number.isFinite(m) && m > t
  }).length
}

function monthName(day: string): string {
  return new Date(`${day.slice(0, 7)}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
}

/** Spark's median close price for one calendar month over a population, with its n. */
function monthMedian(closes: readonly SparkListing[], periodStart: string): { median: number | null; n: number } {
  const start = `${periodStart.slice(0, 7)}-01`
  const rows = closedBetween(closes, start, monthLastDay(start))
  return { median: percentileCont(closePrices(rows)), n: rows.length }
}

/** Which of one area's figures a headline repeats, from the forms buildHeadline writes. */
function headlineRepeats(text: string, blocks: readonly MarketReportAreaBlock[]): { area: MarketReportAreaBlock; figures: string[] } | null {
  const area = [...blocks].sort((a, b) => b.areaLabel.length - a.areaLabel.length).find((b) => text.startsWith(`${b.areaLabel} `))
  if (!area) return null
  const rest = text.slice(area.areaLabel.length + 1)
  if (/^home prices are (up|down) \d+\.\d% from a year ago$/.test(rest) || rest === 'home prices are holding steady year over year') {
    return { area, figures: [TWELVE_MONTH.yoy] }
  }
  if (/^is a .+ with .+ of supply$/.test(rest)) return { area, figures: ['months of supply', 'market verdict'] }
  if (/^homes sold for a median \$[\d,]+ over the last 12 months$/.test(rest)) return { area, figures: [TWELVE_MONTH.median] }
  return null
}

/**
 * Rebuild every printed figure Spark can produce and compare it. One check per
 * printed figure, in the order the email printed them. A figure whose inputs
 * this module cannot rebuild (a historical end-of-period count, a window with
 * no recorded end, a polygon that did not load) comes back 'not-reconciled'
 * with the reason, never passed.
 */
export function buildSparkChecks(input: {
  blocks: readonly MarketReportAreaBlock[]
  figures: readonly ReportFigure[]
  data: SparkCheckData
}): SparkCheck[] {
  const { blocks, figures, data } = input
  const aliasIdx = buildAliasIndex(data.aliases)
  const serviceArea = new Set(data.serviceAreaCities.map(norm))
  const inServiceArea = (r: SparkListing) => serviceArea.has(norm(r.City))
  const publishableAll = marketTruthPublishableCloses(data.closed, inServiceArea)
  const byArea = new Map(blocks.map((b) => [b.slug, b]))
  const mt = new Map<string, MarketTruthPopulation | Unavailable>()
  const cache = new Map<string, CachePopulation | Unavailable>()
  const mtFor = (a: MarketReportAreaBlock) => {
    if (!mt.has(a.slug)) mt.set(a.slug, marketTruthPopulation(a, data, publishableAll, aliasIdx, inServiceArea))
    return mt.get(a.slug)!
  }
  const cacheFor = (a: MarketReportAreaBlock) => {
    if (!cache.has(a.slug)) cache.set(a.slug, cachePopulation(a, data))
    return cache.get(a.slug)!
  }
  const checkFigure = (f: ReportFigure, area: MarketReportAreaBlock): SparkCheck => {
    const prov = area.provenance ?? null
    const label = f.label

    if (label === 'homes for sale') {
      if (!prov?.live) {
        return notReconciled(area, label, f.value, 'a historical end-of-period inventory from the cache row; Spark serves current status only')
      }
      const pop = mtFor(area)
      if ('unavailable' in pop) return notReconciled(area, label, f.value, pop.unavailable)
      const changed = changedSince(pop.active, prov.live.computedAt)
      return check(area, label, f.value, pop.active.length, `${pop.description}, StandardStatus 'Active'`, {
        sparkN: pop.active.length,
        note: `Supabase figure computed ${prov.live.computedAt ?? 'at an unrecorded time'}; Spark fetched ${data.fetchedAt}${changed != null ? `; ${changed} of Spark's rows were modified after the figure was computed` : ''}`,
      })
    }

    if (label === 'months of supply' || label === 'market verdict') {
      const periodEnd = prov?.live?.periodEnd ?? null
      if (area.monthsOfSupplySource !== 'live' || !prov?.live || area.geoType !== 'city' || !periodEnd) {
        return notReconciled(area, label, f.value, 'months of supply here is not the live Market Truth city cell with a recorded period_end')
      }
      const pop = mtFor(area)
      if ('unavailable' in pop) return notReconciled(area, label, f.value, pop.unavailable)
      const w: Window = { after: addDays(periodEnd, -180), through: periodEnd }
      const closes = inWindow(pop.closes, w).length
      const mos = closes > 0 ? pop.active.length / (closes / 6) : null
      if (label === 'months of supply') {
        return check(area, label, f.value, mos == null ? null : Math.round(mos * 100) / 100, `${pop.description}; StandardStatus 'Active' / (publishable closes in ${windowText(w)} / 6)`, {
          sparkN: closes,
          note: `Spark: ${pop.active.length} active / (${closes} closes / 6)`,
        })
      }
      const printed = area.marketVerdict ?? 'unknown'
      const fromSpark = marketVerdict(mos).kind
      return {
        area: area.slug,
        figure: label,
        supabase: null,
        spark: null,
        deltaPct: null,
        population: 'derived from months of supply (4 or less sellers, 4 to 6 balanced, 6 or more buyers)',
        status: printed === fromSpark && printed !== 'unknown' ? 'ok' : 'STOP',
        note: `printed ${printed}; Spark's months of supply gives ${fromSpark}`,
      }
    }

    if (label === TWELVE_MONTH.median || label === TWELVE_MONTH.sold || label === TWELVE_MONTH.yoy) {
      if (area.twelveMonthSource === 'market-truth') {
        const cell =
          label === TWELVE_MONTH.sold
            ? prov?.twelveMonth?.closedCount
            : label === TWELVE_MONTH.median
              ? prov?.twelveMonth?.medianClose
              : prov?.twelveMonth?.yoyMedian
        const w = cell ? cellWindow(cell) : null
        if (!cell || !w) return notReconciled(area, label, f.value, 'the Market Truth cell carries no period_end, so its window cannot be rebuilt')
        const pop = mtFor(area)
        if ('unavailable' in pop) return notReconciled(area, label, f.value, pop.unavailable)
        const rows = inWindow(pop.closes, w)
        const population = `${pop.description}, publishable closes in ${windowText(w)}`
        if (label === TWELVE_MONTH.sold) return check(area, label, f.value, rows.length, population, { supabaseN: cell.sampleN, sparkN: rows.length })
        if (label === TWELVE_MONTH.median) {
          return check(area, label, f.value, percentileCont(closePrices(rows)), population, { supabaseN: cell.sampleN, sparkN: rows.length })
        }
        const pw = priorYearWindow(cell)!
        const prior = inWindow(pop.closes, pw)
        const now = percentileCont(closePrices(rows))
        const then = percentileCont(closePrices(prior))
        const yoy = now != null && then != null && then > 0 ? (now / then - 1) * 100 : null
        return changeCheck(area, label, f.value, yoy, `${population} against ${windowText(pw)}`, `Spark medians ${now ?? 'n/a'} (n=${rows.length}) and ${then ?? 'n/a'} (n=${prior.length})`)
      }
      const pop = cacheFor(area)
      const start = utcDay(prov?.cache?.periodStart)
      const end = utcDay(prov?.cache?.periodEnd)
      if ('unavailable' in pop) return notReconciled(area, label, f.value, pop.unavailable)
      if (!start || !end || label === TWELVE_MONTH.yoy) {
        return notReconciled(area, label, f.value, 'the cache row carries no window, or the change is a cache year-over-year cell')
      }
      const rows = closedBetween(pop.closes, start, end)
      const population = `${pop.description}, closes in [${start}, ${end}]`
      return label === TWELVE_MONTH.sold
        ? check(area, label, f.value, rows.length, population, { sparkN: rows.length })
        : check(area, label, f.value, percentileCont(closePrices(rows)), population, { sparkN: rows.length })
    }

    if (label === 'median days on market, last 12 months') {
      const pop = cacheFor(area)
      const start = utcDay(prov?.cache?.periodStart)
      const end = utcDay(prov?.cache?.periodEnd)
      if ('unavailable' in pop) return notReconciled(area, label, f.value, pop.unavailable)
      if (!start || !end) return notReconciled(area, label, f.value, 'the cache row carries no window')
      const rows = closedBetween(pop.closes, start, end)
      const days = rows.map(listToPendingDays).filter((d): d is number => d != null)
      return check(area, label, f.value, days.length >= 5 ? percentileCont(days) : null, `${pop.description}, closes in [${start}, ${end}], list-to-pending days`, {
        supabaseN: prov?.cache?.soldCount ?? null,
        sparkN: days.length,
        note: `${rows.length} Spark closes, ${days.length} with both an on-market and a pending time`,
      })
    }

    const monthMatch = MONTH_FIGURE.exec(label)
    if (monthMatch || MOM_FIGURE.test(label) || CHART_FIGURE.test(label)) {
      const pop = cacheFor(area)
      if ('unavailable' in pop) return notReconciled(area, label, f.value, pop.unavailable)
      const points = area.trend?.points ?? []
      if (monthMatch) {
        const start = periodStartOf(f)
        const point = start ? points.find((p) => p.periodStart.slice(0, 10) === start) : undefined
        if (!point || monthName(point.periodStart) !== monthMatch[1]) {
          return notReconciled(area, label, f.value, 'the month the figure names is not in the series')
        }
        const m = monthMedian(pop.closes, point.periodStart)
        return check(area, label, f.value, m.median, `${pop.description}, closes in ${point.periodStart.slice(0, 7)}`, { supabaseN: point.soldCount, sparkN: m.n })
      }
      if (MOM_FIGURE.test(label)) {
        const pair = momMedianPair(points)
        if (!pair) return notReconciled(area, label, f.value, 'no month-over-month pair in the series')
        const a = monthMedian(pop.closes, pair.prev.periodStart).median
        const b = monthMedian(pop.closes, pair.latest.periodStart).median
        const pct = a != null && b != null && a > 0 ? ((b - a) / a) * 100 : null
        return changeCheck(
          area,
          label,
          f.value,
          pct,
          `${pop.description}, closes in ${pair.prev.periodStart.slice(0, 7)} and ${pair.latest.periodStart.slice(0, 7)}`,
          `Spark medians ${a ?? 'n/a'} and ${b ?? 'n/a'}`,
        )
      }
      const run = chartableMonths(points)
      if (!run) return notReconciled(area, label, f.value, 'no chartable run in the series')
      // The chart prints the latest month's median and the run's highest and
      // lowest medians as axis labels, and draws every month: check each one.
      // One month Spark cannot rebuild leaves the chart unverified (STOP).
      const months = run.map((p: MarketTrendPoint) => {
        const s = monthMedian(pop.closes, p.periodStart).median
        return { month: p.periodStart.slice(0, 7), printed: p.medianSalePrice, spark: s, delta: deltaPct(p.medianSalePrice, s) }
      })
      const unrebuilt = months.find((m) => m.delta == null)
      const worst = unrebuilt ?? [...months].sort((x, y) => Math.abs(y.delta!) - Math.abs(x.delta!))[0]!
      return {
        area: area.slug,
        figure: label,
        supabase: null,
        spark: null,
        deltaPct: worst.delta,
        population: `${pop.description}, each month's closes`,
        status: deltaStatus(worst.delta),
        note: `every month drawn; largest delta ${worst.month}: ${months.map((m) => `${m.month} ${m.printed ?? 'n/a'} vs ${m.spark ?? 'n/a'} (${m.delta ?? 'n/a'}%)`).join('; ')}`,
      }
    }

    return notReconciled(area, label, f.value, 'no Spark rebuild is defined for this figure')
  }

  const out: SparkCheck[] = []
  const headlines: Array<{ index: number; figure: ReportFigure }> = []

  for (const f of figures) {
    const area = f.area ? byArea.get(f.area) ?? null : null
    if (!area) {
      headlines.push({ index: out.length, figure: f })
      out.push(notReconciled(null, f.label, f.value, 'pending'))
      continue
    }
    out.push(checkFigure(f, area))
  }

  // The headline last: it passes only when every figure it repeats passed.
  for (const { index, figure } of headlines) {
    const repeats = figure.label === 'headline' ? headlineRepeats(figure.display, blocks) : null
    if (!repeats) {
      out[index] = {
        area: null,
        figure: figure.label,
        supabase: figure.value,
        spark: null,
        deltaPct: null,
        population: 'n/a',
        status: /\d/.test(figure.display) ? 'not-reconciled' : 'derived',
        note: /\d/.test(figure.display) ? 'a number this check cannot map to a checked figure' : 'states no figure',
      }
      continue
    }
    const found = repeats.figures.map((label) => ({ label, c: out.find((c) => c.area === repeats.area.slug && c.figure === label) }))
    // A repeated figure that differs from Spark stops the headline; one that
    // could not be rebuilt (or never printed, so was never checked) leaves it
    // not reconciled, never a claimed delta.
    const status: SparkCheckStatus = found.some((x) => x.c?.status === 'STOP')
      ? 'STOP'
      : found.every((x) => x.c?.status === 'ok')
        ? 'ok'
        : 'not-reconciled'
    out[index] = {
      area: null,
      figure: figure.label,
      supabase: null,
      spark: null,
      deltaPct: null,
      population: `repeats ${repeats.area.slug}: ${repeats.figures.join(', ')}`,
      status,
      note:
        status === 'ok'
          ? 'every figure it repeats reconciled'
          : `repeats: ${found.filter((x) => x.c?.status !== 'ok').map((x) => `${x.label} (${x.c?.status ?? 'not printed, not checked'})`).join(', ')}`,
    }
  }
  return out
}
