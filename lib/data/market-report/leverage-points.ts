/**
 * Sale leverage points: where the buyer had leverage, one map dot per sale.
 *
 * The buyer video ad shows a quarter's sales landing on a map, first the ones
 * that sold after a price cut, then the ones with a seller credit, then the
 * overlap. The counts beside that map must be the monthly report's own, so
 * this reads the population compute_market_report_period reads (migration
 * 20260925020000_market_report_compact_facts, definition mr-v1) and applies
 * its two rules row by row:
 *
 *   population  public.market_report_sale: publishable market_fact_sale rows
 *               (is_publishable, close_date set, segment detached / condo /
 *               townhome) joined to market_report_listing, which carries the
 *               report geographies (region, MLS-city place membership,
 *               primary neighborhood, Bend quadrant) and the base segment.
 *   geography   geos contains '<geo_type>:<geo_slug>' (city:bend).
 *   segment     detached = every base_segment 'detached' row (sfr + acreage);
 *               sfr / acreage split it at lot_acres 1.0 (null counts as 0);
 *               condo_townhome = base_segment condo or townhome.
 *   window      close_date >= from and <= to, inclusive dates.
 *   price cut   price_cut_n: sale_to_orig_list is set, original_list_price > 0,
 *               list_price > 0, original_list_price > list_price, no
 *               'auction_list' exclusion, closed 2002 or later.
 *   credit      concession_with_n: concessions_yn = 'Yes' and
 *               concession_amount > 0, closed 2013 or later. The amount is
 *               sale_pricing_facts.concessions_amount, else
 *               market_fact_sale.concession_amount (set when the compact
 *               copy is built).
 *
 * Coordinates come from public.market_fact_sale (latitude / longitude, copied
 * from listings "Latitude" / "Longitude"), the row each compact sale was built
 * from. A sale without usable coordinates still counts; it is reported in
 * counts.missingCoords and left off the map.
 *
 * The output carries no listing key, street address or person: a point is a
 * coordinate, two flags and a close month.
 *
 * Service role (the report tables are service-role only), read-only.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { REPORT_DEFINITION_ID } from '@/lib/data/market-report/compute'
import type { ReportSegment } from '@/lib/data/market-report/series'

export type LeverageGeoType = 'region' | 'city' | 'neighborhood' | 'quadrant'

export type SaleLeveragePoint = {
  lat: number
  lng: number
  /** Sold after a price cut (the report's price_cut_n rule). */
  priceCut: boolean
  /** Sold with a seller credit (the report's concession_with_n rule). */
  credit: boolean
  /** YYYY-MM of the close date. */
  closeMonth: string
}

export type SaleLeverageCounts = {
  /** Every qualifying closing in the window, mapped or not (closed_n). */
  closed: number
  priceCut: number
  credit: number
  /** Price cut and credit on the same sale. */
  both: number
  /** Qualifying closings with no usable coordinates (not in `points`). */
  missingCoords: number
}

/** A qualifying closing the map cannot draw: its flags and month, no location. */
export type UnmappedSale = Omit<SaleLeveragePoint, 'lat' | 'lng'>

export type SaleLeveragePoints = {
  points: SaleLeveragePoint[]
  counts: SaleLeverageCounts
  /** The counts.missingCoords closings, so a caller can say which kind it could not draw. */
  unmapped: UnmappedSale[]
  /** Latest date the report facts were complete through when this was read. */
  completeThrough: string | null
  /** One-line trace: tables, filters, window, rules, n, fetched_at (CLAUDE.md section 0). */
  source: string
}

export type SaleLeverageInput = {
  geoType: LeverageGeoType
  geoSlug: string
  segment: ReportSegment
  /** First close date, YYYY-MM-DD, inclusive. */
  from: string
  /** Last close date, YYYY-MM-DD, inclusive. */
  to: string
}

/** compute_market_report_period's default p_acreage_min. */
export const ACREAGE_MIN = 1

/** The first close dates each rule applies from, as in compute_market_report_period. */
const PRICE_CUT_FROM = '2002-01-01'
const CREDIT_FROM = '2013-01-01'

const PAGE = 1000
/** Listing keys per market_fact_sale lookup; keeps the request URL short. */
const KEY_CHUNK = 150

const GEO_TYPES: readonly LeverageGeoType[] = ['region', 'city', 'neighborhood', 'quadrant']
const SEGMENTS: readonly ReportSegment[] = ['sfr', 'acreage', 'condo_townhome', 'detached']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** One market_report_sale row, as this module reads it. */
export type LeverageSaleRow = {
  listing_key: string
  close_date: string
  list_price: number | null
  original_list_price: number | null
  sale_to_orig_list: number | null
  exclusion_reasons: string[]
  concessions_yn: string | null
  concession_amount: number | null
  base_segment: string
  lot_acres: number | null
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function toSaleRow(r: Record<string, unknown>): LeverageSaleRow {
  return {
    listing_key: String(r.listing_key),
    close_date: String(r.close_date).slice(0, 10),
    list_price: toNum(r.list_price),
    original_list_price: toNum(r.original_list_price),
    sale_to_orig_list: toNum(r.sale_to_orig_list),
    exclusion_reasons: Array.isArray(r.exclusion_reasons) ? (r.exclusion_reasons as string[]) : [],
    concessions_yn: r.concessions_yn == null ? null : String(r.concessions_yn),
    concession_amount: toNum(r.concession_amount),
    base_segment: String(r.base_segment),
    lot_acres: toNum(r.lot_acres),
  }
}

/** The report segments a sale counts in (the CASE in compute_market_report_period). */
export function reportSegmentsOf(baseSegment: string, lotAcres: number | null): ReportSegment[] {
  if (baseSegment !== 'detached') return ['condo_townhome']
  return [(lotAcres ?? 0) >= ACREAGE_MIN ? 'acreage' : 'sfr', 'detached']
}

/** price_cut_n's FILTER. */
export function isPriceCut(r: LeverageSaleRow): boolean {
  const orig = r.original_list_price
  const list = r.list_price
  return (
    r.sale_to_orig_list != null &&
    orig != null &&
    orig > 0 &&
    list != null &&
    list > 0 &&
    orig > list &&
    !r.exclusion_reasons.includes('auction_list') &&
    r.close_date >= PRICE_CUT_FROM
  )
}

/** concession_with_n's FILTER. */
export function isSellerCredit(r: LeverageSaleRow): boolean {
  return (
    r.concessions_yn === 'Yes' &&
    r.concession_amount != null &&
    r.concession_amount > 0 &&
    r.close_date >= CREDIT_FROM
  )
}

/** A coordinate pair that can be drawn: both finite, in range, neither a 0 placeholder. */
export function usableCoordinates(lat: number | null, lng: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}

function validate(input: SaleLeverageInput): SaleLeverageInput {
  const geoSlug = String(input.geoSlug ?? '').trim()
  if (!GEO_TYPES.includes(input.geoType)) throw new Error(`[getSaleLeveragePoints] unknown geoType ${input.geoType}`)
  if (!/^[a-z0-9-]+$/.test(geoSlug)) throw new Error(`[getSaleLeveragePoints] bad geoSlug ${input.geoSlug}`)
  if (!SEGMENTS.includes(input.segment)) throw new Error(`[getSaleLeveragePoints] unknown segment ${input.segment}`)
  if (!ISO_DATE.test(input.from) || !ISO_DATE.test(input.to)) {
    throw new Error('[getSaleLeveragePoints] from and to take YYYY-MM-DD')
  }
  if (input.from > input.to) throw new Error(`[getSaleLeveragePoints] from ${input.from} is after to ${input.to}`)
  return { geoType: input.geoType, geoSlug, segment: input.segment, from: input.from, to: input.to }
}

/** Every sale in the population for the geography, base segment and window, paged by listing key. */
async function readSales(input: SaleLeverageInput): Promise<LeverageSaleRow[]> {
  const sb = createServiceClient()
  const geo = `${input.geoType}:${input.geoSlug}`
  const out: LeverageSaleRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    let q = sb
      .from('market_report_sale')
      .select(
        'listing_key, close_date, list_price, original_list_price, sale_to_orig_list, exclusion_reasons, concessions_yn, concession_amount, base_segment, lot_acres',
      )
      .gte('close_date', input.from)
      .lte('close_date', input.to)
      .contains('geos', [geo])
    q = input.segment === 'condo_townhome' ? q.in('base_segment', ['condo', 'townhome']) : q.eq('base_segment', 'detached')
    const { data, error } = await q.order('listing_key').range(offset, offset + PAGE - 1)
    if (error) throw new Error(`[getSaleLeveragePoints market_report_sale ${geo} ${input.from}..${input.to}] ${error.message}`)
    const rows = (data ?? []) as Record<string, unknown>[]
    for (const r of rows) out.push(toSaleRow(r))
    if (rows.length < PAGE) break
  }
  return out
}

type Coords = { lat: number | null; lng: number | null }

/** Coordinates of each sale, from the sale fact the compact row was built from. */
async function readCoordinates(keys: string[]): Promise<Map<string, Coords>> {
  const sb = createServiceClient()
  const out = new Map<string, Coords>()
  const unique = [...new Set(keys)]
  for (let i = 0; i < unique.length; i += KEY_CHUNK) {
    const { data, error } = await sb
      .from('market_fact_sale')
      .select('listing_key, latitude, longitude')
      .in('listing_key', unique.slice(i, i + KEY_CHUNK)) // @canonical-key: market_report_sale.listing_key values, the key market_fact_sale is keyed by
    if (error) throw new Error(`[getSaleLeveragePoints market_fact_sale coordinates] ${error.message}`)
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      out.set(String(r.listing_key), { lat: toNum(r.latitude), lng: toNum(r.longitude) })
    }
  }
  return out
}

async function readFactsState(): Promise<{ completeThrough: string | null; refreshedAt: string | null }> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_report_state')
    .select('complete_through, facts_refreshed_at')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw new Error(`[getSaleLeveragePoints market_report_state] ${error.message}`)
  const row = (data ?? null) as { complete_through?: string | null; facts_refreshed_at?: string | null } | null
  return { completeThrough: row?.complete_through ?? null, refreshedAt: row?.facts_refreshed_at ?? null }
}

/**
 * Points and counts from the sale rows and their coordinates. Pure: the
 * counts cover every row, the points only rows with usable coordinates, in
 * close-date order.
 */
export function buildLeveragePoints(
  rows: readonly LeverageSaleRow[],
  coords: ReadonlyMap<string, Coords>,
  segment: ReportSegment,
): { points: SaleLeveragePoint[]; counts: SaleLeverageCounts; unmapped: UnmappedSale[] } {
  const counts: SaleLeverageCounts = { closed: 0, priceCut: 0, credit: 0, both: 0, missingCoords: 0 }
  const placed: { closeDate: string; key: string; point: SaleLeveragePoint }[] = []
  const unmapped: { closeDate: string; key: string; sale: UnmappedSale }[] = []
  for (const r of rows) {
    if (!reportSegmentsOf(r.base_segment, r.lot_acres).includes(segment)) continue
    const priceCut = isPriceCut(r)
    const credit = isSellerCredit(r)
    counts.closed += 1
    if (priceCut) counts.priceCut += 1
    if (credit) counts.credit += 1
    if (priceCut && credit) counts.both += 1
    const closeMonth = r.close_date.slice(0, 7)
    const c = coords.get(r.listing_key)
    if (!c || !usableCoordinates(c.lat, c.lng)) {
      counts.missingCoords += 1
      unmapped.push({ closeDate: r.close_date, key: r.listing_key, sale: { priceCut, credit, closeMonth } })
      continue
    }
    placed.push({
      closeDate: r.close_date,
      key: r.listing_key,
      point: { lat: c.lat as number, lng: c.lng as number, priceCut, credit, closeMonth },
    })
  }
  return {
    points: placed.sort(byCloseThenKey).map((p) => p.point),
    counts,
    unmapped: unmapped.sort(byCloseThenKey).map((u) => u.sale),
  }
}

/** Close date, then listing key: a stable order the key itself never leaves this module in. */
function byCloseThenKey(a: { closeDate: string; key: string }, b: { closeDate: string; key: string }): number {
  if (a.closeDate !== b.closeDate) return a.closeDate < b.closeDate ? -1 : 1
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

async function fetchSaleLeveragePoints(input: SaleLeverageInput): Promise<SaleLeveragePoints> {
  const fetchedAt = new Date().toISOString()
  const [rows, state] = await Promise.all([readSales(input), readFactsState()])
  const coords = await readCoordinates(rows.map((r) => r.listing_key))
  const { points, counts, unmapped } = buildLeveragePoints(rows, coords, input.segment)
  const segmentRule =
    input.segment === 'condo_townhome'
      ? "base_segment in (condo, townhome)"
      : input.segment === 'detached'
        ? "base_segment='detached' (sfr + acreage)"
        : `base_segment='detached' and ${input.segment === 'acreage' ? `lot_acres >= ${ACREAGE_MIN}` : `coalesce(lot_acres, 0) < ${ACREAGE_MIN}`}`
  const source = [
    `public.market_report_sale (the ${REPORT_DEFINITION_ID} compute input: publishable market_fact_sale x market_report_listing, concession amount from sale_pricing_facts else market_fact_sale)`,
    `geos contains ${input.geoType}:${input.geoSlug}`,
    `segment ${input.segment}: ${segmentRule}`,
    `close_date ${input.from}..${input.to}`,
    `price cut: sale_to_orig_list set, original_list_price > list_price > 0, no auction_list exclusion, closed >= ${PRICE_CUT_FROM}`,
    `credit: concessions_yn='Yes' and concession_amount > 0, closed >= ${CREDIT_FROM}`,
    `coordinates public.market_fact_sale latitude/longitude`,
    `n=${counts.closed} (cut ${counts.priceCut}, credit ${counts.credit}, both ${counts.both}, unmapped ${counts.missingCoords})`,
    `facts complete_through ${state.completeThrough ?? 'unknown'}, refreshed ${state.refreshedAt ?? 'unknown'}`,
    `fetched_at ${fetchedAt}`,
  ].join(' · ')
  return { points, counts, unmapped, completeThrough: state.completeThrough, source }
}

/** What the resilient wrapper hands back when the read failed twice. Never cached. */
const READ_FAILED: unique symbol = Symbol('sale-leverage-points-read-failed')

const getSaleLeveragePointsCached = makeResilientCached<[SaleLeverageInput], SaleLeveragePoints | typeof READ_FAILED>(
  fetchSaleLeveragePoints,
  ['market-report-sale-leverage-points-v1'],
  { revalidate: CACHE_WINDOWS.marketReport, tags: [cacheTag.market] },
  READ_FAILED,
)

/**
 * The window's qualifying closings for one report geography and segment, as
 * map points, with counts over every closing (mapped or not) and a source
 * trace. THROWS when the read fails: zero sales is a real answer, a failed
 * read is not.
 *
 *   getSaleLeveragePoints({ geoType: 'city', geoSlug: 'bend', segment: 'detached',
 *                           from: '2026-07-01', to: '2026-09-30' })
 */
export async function getSaleLeveragePoints(input: SaleLeverageInput): Promise<SaleLeveragePoints> {
  const args = validate(input)
  const result = await getSaleLeveragePointsCached(args)
  if (result === READ_FAILED) {
    throw new Error(
      `[getSaleLeveragePoints] ${args.geoType}:${args.geoSlug} ${args.segment} ${args.from}..${args.to}: read failed twice`,
    )
  }
  return result
}
