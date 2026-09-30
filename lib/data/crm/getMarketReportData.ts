/**
 * getMarketReportData — the §0-accurate market figures for a contact's
 * subscribed report areas (Wave 8, market-report subscription product;
 * migrated onto leftover detached membership for the trailing-12-month
 * close figures under D27, docs/plans/MARKET_TRUTH/DECISIONS.md).
 *
 * Every figure returned here traces to a NAMED source, never a blend: the
 * trailing-12-month median/sold/YoY come from leftover Market Truth pace
 * cells, live inventory + MoS come from Market Truth city overlays (falling
 * back to pulse for resort neighborhoods, then to the historical cache row),
 * and DOM + the monthly trend chart stay on `market_stats_cache` — see the
 * per-field breakdown below. This module NEVER aggregates raw `listings` and
 * NEVER fabricates a placeholder number. A subscribed area with NO usable
 * signal at all is omitted entirely (honest empty); a single figure missing
 * inside an otherwise-usable area is nulled and the caller omits that one
 * line — it is never filled from a different source, and a missing figure
 * never blocks the rest of the document from sending (D27). A wrong stat in
 * a sent email is a compliance failure (CLAUDE.md §0).
 *
 * Source of every block:
 *   - Trailing 12-month median / sold / YoY (D27): leftover Market Truth
 *     cells via `getPublicDetachedPace` (`medianClose`, `closedCount`,
 *     `yoyMedian`). Miss omits those fields — never cache fill, never pulse
 *     fill, and a miss never stops the rest of the block (or the send) from
 *     going out. `medianDom` stays `market_stats_cache` rolling_365d;
 *     leftover days-to-contract is a different measurement and is never
 *     mapped onto it (D2/D17) — see `readAreaLeftover` / the `leftover`
 *     param of `buildAreaBlock`.
 *   - Cache `getCityMarketDetail(rolling_365d)` still supplies DOM, health
 *     label, historical inventory, and the existence row the block needs.
 *     Unchanged by D27 (D17's carve-out: DOM stays pulse/cache).
 *   - Live inventory + MoS for cities: `getDetachedMarkets` (Market Truth
 *     detached, same three figures as `/sell`). A city miss does not fall
 *     back to pulse 488 / 3.54 / seller — live headlines stay empty and the
 *     block uses rolling_365d inventory/MOS. A neighborhood (a Bend district or
 *     a resort community) reads Market Truth's detached active_count directly
 *     (`getDetachedInventories`, the cell getMarketPulse overlays; the pulse's
 *     own count includes Coming Soon); MoS at that grain is withheld
 *     (`geo-grain-trust`). Do not invent MOS from leftover sold.
 *     Unchanged by D27 (D17's carve-out: core inventory/MOS stay pulse/cache).
 *
 * Months of supply (CLAUDE.md §0): MoS = active / (closed_6mo / 6). Thresholds:
 * <= 4 sellers, 4-6 balanced, >= 6 buyers. The returned `marketVerdict` is
 * computed FROM the returned `monthsOfSupply`, so the verdict can never
 * contradict the number.
 *
 * W8.1a (Matt 2026-07-27: "switch resorts to 6mo"): cities and resorts both
 * prefer live pulse MoS (6-month base) when the row exists. `soldLast12mo`
 * is leftover 12-month closed count when publishable, so `monthsOfSupply`
 * need not equal `activeListings / (soldLast12mo / 12)`. Pulse MOS still
 * withholds when the implied six-month closes cannot sit inside the printed
 * 12-month sold count, or when the live numerator is not the count on the
 * block (`publishMonthsOfSupply`). Neighborhood MOS stays unpublished unless
 * that helper's source is market-truth — do not invent MOS from leftover
 * sold. When pulse MoS is null or withheld (sparse slow-turnover geos, or
 * impossible arithmetic), city grain may fall back to `rawMonthsOfSupply`
 * on the cache rolling_365d sold count so leftover closed is not a MOS
 * formula.
 *
 * Slug resolution: the subscribable areas (lib/data/crm/getContactReportSubscriptions
 * buildMarketReportAreas) are the 7 Central Oregon cities + the 14 resort
 * communities from the registry. A city slug resolves to `geo_type='city'`; any
 * other (resort community) slug resolves to `geo_type='neighborhood'` — the
 * exact convention docs/DATABASE_FOR_AI_AGENTS.md §3a documents the cache uses
 * for resort communities.
 *
 * DAL boundary (G1): this module reads ONLY through other DAL functions
 * (getCityMarketDetail, getDetachedMarkets, getDetachedInventories,
 * getMarketTrend, getPublicDetachedPace). It contains no raw `.from()`.
 */

import { getCityMarketDetail } from '@/lib/data/market/getCityMarketDetail'
import { getMarketTrend, type MarketTrendPoint } from '@/lib/data/market/getMarketTrend'
import {
  cityDetachedSlug,
  getDetachedInventories,
  getDetachedMarkets,
  type DetachedInventory,
  type SellBendMarket,
} from '@/lib/data/market-truth/getSellBendMarket'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPaceDetailed,
  type PublicPaceProvenance,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
import type { MetricProvenance } from '@/lib/data/market-truth/getMetric'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { hrefForNeighborhoodSlug } from '@/lib/neighborhood-areas'
import { REPORT_CITY_SLUG_SET } from '@/lib/data/geo/report-cities'
import { marketVerdict } from '@/lib/market/classify'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { isSoldAttributionTrusted } from '@/lib/market/geo-grain-trust'
import type { MoSVerdict } from '@/lib/data/types/market'
import { formatDate } from '@/lib/format/date'

/**
 * Source tag for a block's LIVE inventory + months-of-supply figures ONLY
 * (`activeListings`, `monthsOfSupply`): whether that live pair came from
 * Market Truth (`market_metric`: a city's headlines, a neighborhood's
 * inventory) or fell back to the `market_stats_cache` rolling_365d row. The
 * value was `market_pulse_live` until 2026-09-30, when the report stopped
 * reading the pulse at all; it named a table no figure came from. It does NOT describe
 * `medianPrice` / `soldLast12mo` / `yoyPct`, which are leftover Market Truth
 * pace cells (D27) when present and null on a miss — never this tag's two
 * values — nor `domMedian`, which always stays `market_stats_cache`
 * rolling_365d regardless of this tag.
 */
export type MarketReportSource = 'market_stats_cache:rolling_365d' | 'market_metric'

/**
 * Month-over-month context derived from the monthly cache series (completed
 * months only — getMarketTrend drops the in-progress month). Every figure here
 * traces to `market_stats_cache` period_type='monthly' rows; nothing is
 * estimated. A field is null when the underlying months do not carry it.
 */
export type MarketTrendSummary = {
  /** Chronological completed-month points (oldest → newest). */
  points: MarketTrendPoint[]
  /** Display label of the latest completed month, e.g. "June". */
  latestMonthLabel: string | null
  /** Display label of the month before it, e.g. "May". */
  prevMonthLabel: string | null
  /** Latest completed month's median sale price (whole dollars). */
  latestMedianPrice: number | null
  /** The prior month's median sale price. */
  prevMedianPrice: number | null
  /** Median price change, latest vs prior month, percent (signed). */
  momPricePct: number | null
  /** Latest completed month's end-of-period active inventory. */
  latestInventory: number | null
  /** Inventory change vs the prior month (signed count). */
  momInventoryDelta: number | null
  /** Latest completed month's median days on market. */
  latestDom: number | null
  /** DOM change vs the prior month (signed days). */
  momDomDelta: number | null
}

/**
 * Where each group of a block's figures came from, with the clock and the
 * sample behind it. The email's figures trace (lib/crm/market-report-figures)
 * prints `as_of` and `n` from here, and the sender's freshness hold
 * (lib/crm/market-report-freshness) reads the clocks. Attached on the fetch
 * path only; a block built without it simply carries no trace clocks.
 */
export type MarketReportProvenance = {
  /**
   * The market_stats_cache rolling_365d row: median days on market, and the
   * row whose existence keeps an area in the report.
   */
  cache: {
    updatedAt: string | null
    periodStart: string | null
    periodEnd: string | null
    soldCount: number | null
    methodologyVersion: string | null
  } | null
  /**
   * The live inventory (and, for a city, months of supply) source: Market
   * Truth's detached active_count at both grains, a city through
   * getDetachedMarkets and a neighborhood through getDetachedInventories. The
   * pulse's own count (which includes Coming Soon) is never read here.
   */
  live: {
    table: 'market_metric'
    /** When the row was computed or refreshed. */
    computedAt: string | null
    /** Market Truth only: the last day the underlying data is complete through. */
    completeThrough: string | null
    /**
     * Market Truth city only: the months_of_supply cell's period_end, the end
     * of its six-month closed window. Null when not recorded.
     */
    periodEnd?: string | null
  } | null
  /** The Market Truth leftover twelve-month cells (median, closed count, YoY). */
  twelveMonth: {
    medianClose: MetricProvenance | null
    closedCount: MetricProvenance | null
    yoyMedian: MetricProvenance | null
  } | null
}

/**
 * One subscribed area's verified market figures. Every numeric field is sourced
 * from the cache; a field is `null` when the cache row does not carry it (never
 * a fabricated stand-in).
 */
export type MarketReportAreaBlock = {
  /** geo slug (e.g. 'bend', 'tetherow'). */
  slug: string
  /** Display label (e.g. 'Bend', 'Tetherow'). */
  areaLabel: string
  /** 'city' | 'neighborhood' — how the slug resolved against the cache. */
  geoType: 'city' | 'neighborhood'
  /** Median CLOSED sale price over the trailing 12 months, whole dollars. */
  medianPrice: number | null
  /** Current active SFR listing count. */
  activeListings: number | null
  /** Real closed-sale count over the trailing 12 months (the MoS close base). */
  soldLast12mo: number | null
  /** Months of supply = active / (soldLast12mo / 12). Computed, not stored. */
  monthsOfSupply: number | null
  /**
   * Which path produced `monthsOfSupply`: the live source's own figure
   * (Market Truth / pulse, six-month absorption) or the trailing-12-month
   * fallback computed from the cache sold count. Null when withheld. The
   * figures trace names it, so a reviewer can tell the two formulas apart.
   */
  monthsOfSupplySource?: 'live' | 'computed-12mo' | null
  /** Verdict derived FROM monthsOfSupply against the §0 thresholds. */
  marketVerdict: MoSVerdict | null
  /** Median days on market (closed), trailing 12 months. */
  domMedian: number | null
  /** Year-over-year median sale price change, percent (signed). */
  yoyPct: number | null
  /** The cache's market-health label (e.g. 'Hot', 'Warm', 'Cool'), if present. */
  marketHealthLabel: string | null
  /** ISO timestamp of the underlying cache row's freshness. */
  refreshedAt: string | null
  /**
   * Where this block's live `activeListings` + `monthsOfSupply` came from
   * (Market Truth vs cache) — see the `MarketReportSource` doc for what this does
   * NOT cover: `medianPrice` / `soldLast12mo` / `yoyPct` are leftover when
   * present (D27), and `domMedian` is always cache, independent of this tag.
   */
  source: MarketReportSource
  /**
   * Which store actually produced `medianPrice` / `soldLast12mo` / `yoyPct` on
   * THIS block. D27: the audit trace on a client-facing document must name the
   * store the number came from. These three are leftover on the fetch path and
   * cache for legacy callers that pass no `leftover`, so a fixed trace string
   * would be false half the time — and a false source trace on a document a
   * client reads is a §0 defect, not a cosmetic one.
   */
  twelveMonthSource: 'market-truth' | 'market_stats_cache'
  /** Canonical web path to the full report for this area. */
  href: string
  /**
   * Monthly trend context (charts + month-over-month lines). Optional so pure
   * consumers built before Wave 8's chart upgrade keep compiling; null/absent
   * when the geo has no monthly cache series.
   */
  trend?: MarketTrendSummary | null
  /** Clocks and samples behind the figures (fetch path only). */
  provenance?: MarketReportProvenance | null
}

/**
 * Raw (UNROUNDED) months of supply from an active count and a trailing-12-month
 * close count, per the canonical absorption formula. Pure — exported for unit
 * tests. This is the value the verdict must classify from: rounding to one
 * decimal BEFORE classifying misbins a true 4.04 as a seller's market (4.0 <= 4)
 * and a true 5.96 as a buyer's market (6.0 >= 6). The display figure rounds; the
 * classification does not.
 *
 * Returns null when the inputs cannot produce a real figure (no active count,
 * no closes, or a zero close rate which would divide by zero). Never returns a
 * fabricated number to fill a gap.
 */
export function rawMonthsOfSupply(
  activeCount: number | null | undefined,
  soldLast12mo: number | null | undefined,
): number | null {
  if (activeCount == null || soldLast12mo == null) return null
  if (!Number.isFinite(activeCount) || !Number.isFinite(soldLast12mo)) return null
  if (soldLast12mo <= 0) return null
  const closesPerMonth = soldLast12mo / 12
  if (closesPerMonth <= 0) return null
  const mos = activeCount / closesPerMonth
  if (!Number.isFinite(mos)) return null
  return mos
}

/**
 * Compute months of supply, rounded to one decimal — the precision every market
 * surface renders. Pure — exported for unit tests. Wraps rawMonthsOfSupply so
 * the display value and the classification value derive from the same figure.
 *
 * Returns null when the inputs cannot produce a real figure. Never returns a
 * fabricated number to fill a gap.
 */
export function computeMonthsOfSupply(
  activeCount: number | null | undefined,
  soldLast12mo: number | null | undefined,
): number | null {
  const raw = rawMonthsOfSupply(activeCount, soldLast12mo)
  if (raw == null) return null
  // One decimal — matches the precision every market surface renders.
  return Math.round(raw * 10) / 10
}

/**
 * Classify a months-of-supply figure into the §0 verdict using the canonical
 * classifier from lib/market/classify.ts (the single threshold source of truth).
 * Pure — exported for unit tests. Returns null when the figure is unavailable.
 */
export function classifyMarketVerdict(mos: number | null | undefined): MoSVerdict | null {
  const v = marketVerdict(mos)
  return v.kind === 'unknown' ? null : v.kind
}

/**
 * Resolve an area slug to its cache geo_type. A Central Oregon city slug is a
 * 'city'; any other (resort community) slug is a 'neighborhood' — the exact
 * convention the cache uses for resort communities. Pure — exported for tests.
 */
export function resolveAreaGeoType(slug: string): 'city' | 'neighborhood' {
  return REPORT_CITY_SLUG_SET.has(slug) ? 'city' : 'neighborhood'
}

/** UTC month name for an ISO date, e.g. "June". Null when unparseable. */
export function monthLabel(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const label = formatDate(isoDate, { month: 'long', day: undefined, year: undefined, timeZone: 'UTC' })
  return label === '—' ? null : label
}

/**
 * Summarize a monthly trend series into the email's month-over-month context.
 * Pure — exported for unit tests and the sample-render script. Returns null
 * when fewer than 2 completed months exist (no honest comparison possible).
 * Every derived delta is computed from two REAL cache rows, never estimated.
 */
export function buildTrendSummary(points: MarketTrendPoint[]): MarketTrendSummary | null {
  if (!Array.isArray(points) || points.length < 2) return null
  const latest = points[points.length - 1]
  const prev = points[points.length - 2]

  const latestPrice = toNum(latest.medianSalePrice)
  const prevPrice = toNum(prev.medianSalePrice)
  const momPricePct =
    latestPrice != null && prevPrice != null && prevPrice > 0
      ? Math.round(((latestPrice - prevPrice) / prevPrice) * 1000) / 10
      : null

  const latestInv = toNum(latest.endOfPeriodInventory)
  const prevInv = toNum(prev.endOfPeriodInventory)
  const momInventoryDelta = latestInv != null && prevInv != null ? latestInv - prevInv : null

  const latestDom = toNum(latest.medianDom)
  const prevDom = toNum(prev.medianDom)
  const momDomDelta =
    latestDom != null && prevDom != null ? Math.round(latestDom) - Math.round(prevDom) : null

  return {
    points,
    latestMonthLabel: monthLabel(latest.periodStart),
    prevMonthLabel: monthLabel(prev.periodStart),
    latestMedianPrice: latestPrice,
    prevMedianPrice: prevPrice,
    momPricePct,
    latestInventory: latestInv,
    momInventoryDelta,
    latestDom: latestDom != null ? Math.round(latestDom) : null,
    momDomDelta,
  }
}

/** Look up the registry display label for a slug, falling back to a titleized slug. */
function labelForSlug(slug: string): string {
  const match = buildMarketReportAreas().find((a) => a.slug === slug)
  if (match) return match.label
  return slug
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function hrefForArea(slug: string, geoType: 'city' | 'neighborhood'): string {
  if (geoType === 'city') return `/cities/${slug}`
  // Neighborhood slugs split by kind: Bend districts ('bend-river-west') live
  // under /cities/bend/<district>; resort communities under /communities/<slug>.
  return hrefForNeighborhoodSlug(slug)
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

async function readAreaLeftover(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
): Promise<{ row: PublicPaceRow; provenance: PublicPaceProvenance }> {
  try {
    return await getPublicDetachedPaceDetailed({ geoType, geoSlug })
  } catch {
    return { row: { ...EMPTY_PUBLIC_PACE }, provenance: {} }
  }
}

/**
 * The neighborhoods' live inventory: Market Truth's detached active_count
 * (StandardStatus Active, primary place membership), the same cell
 * getMarketPulse overlays on the pulse row, read for every neighborhood of the
 * report in ONE call. Read directly so the report names the source it reads:
 * the pulse's own active_count includes Coming Soon, and a public count must
 * not (lib/listing-status-public.ts). A miss or a failed read withholds the
 * count (unknown is not zero) and the block falls back to the cache row's
 * inventory, traced as such.
 */
async function readNeighborhoodInventories(slugs: readonly string[]): Promise<Map<string, DetachedInventory>> {
  if (slugs.length === 0) return new Map()
  try {
    return await getDetachedInventories(slugs.map((geoSlug) => ({ geoType: 'neighborhood' as const, geoSlug })))
  } catch {
    return new Map()
  }
}

/** Leftover YoY is a fraction; the email field is percent. Miss omits. */
function leftoverYoyPct(yoyMedian: number | null | undefined): number | null {
  const n = toNum(yoyMedian)
  return n == null ? null : n * 100
}

/**
 * Build one area's block from the historical cache row (+ optional live pulse
 * and leftover 12-month pace). Pure given the already-fetched rows — exported
 * so the merge logic (which live source wins, leftover overlay, when an area
 * is unavailable) is unit-tested without the DB.
 *
 * Returns null when the area has NO usable cache data (no median price AND no
 * active inventory AND no close count) — the caller omits it. We never emit a
 * block whose figures are all null/fabricated.
 *
 * When `leftover` is passed (including an empty/miss row), median / sold / YoY
 * overlay leftover and miss nulls those fields — never cache fill. Omit
 * `leftover` to keep cache figures (unit tests of pulse/MOS merge).
 * `medianDom` always stays cache.
 */
export function buildAreaBlock(args: {
  slug: string
  geoType: 'city' | 'neighborhood'
  /** From getCityMarketDetail(rolling_365d). */
  detail: {
    medianSalePrice: number | null
    soldCount: number | null
    medianDom: number | null
    yoyMedianPriceDeltaPct: number | null
    marketHealthLabel: string | null
    endOfPeriodInventory: number | null
    updatedAt: string | null
  } | null
  /**
   * The live pair (named `pulse` for history): a city's Market Truth headlines
   * (active count and months of supply), or a neighborhood's Market Truth
   * inventory (active count only). Null on a miss.
   */
  pulse: {
    activeCount: number | null
    monthsOfSupply: number | null
    refreshedAt: string | null
  } | null
  /** From getPublicDetachedPace. Passed on the fetch path; miss omits 12-month close figures. */
  leftover?: Pick<PublicPaceRow, 'medianClose' | 'closedCount' | 'yoyMedian'> | null
}): MarketReportAreaBlock | null {
  const { slug, geoType, detail, pulse, leftover } = args
  if (!detail) return null

  const overlay = leftover !== undefined
  const cacheSold = toNum(detail.soldCount)
  const medianPrice = overlay ? toNum(leftover?.medianClose) : toNum(detail.medianSalePrice)
  const soldLast12mo = overlay ? toNum(leftover?.closedCount) : cacheSold
  const domMedian = toNum(detail.medianDom)
  const yoyPct = overlay ? leftoverYoyPct(leftover?.yoyMedian) : toNum(detail.yoyMedianPriceDeltaPct)
  const historicalActive = toNum(detail.endOfPeriodInventory)

  // Live pulse wins for active inventory + MoS when present (10-15 min vs 6h).
  const liveActive = pulse ? toNum(pulse.activeCount) : null
  const activeListings = liveActive ?? historicalActive

  // An area with no real market signal is omitted (never emitted as an all-empty
  // block). "No signal" = no median price AND no live inventory AND no closes.
  // Zero counts the same as null here: a place with zero active homes and zero
  // sales and no median price has nothing to report, so it is dropped rather
  // than shown as a wall of dashes and zeros.
  const hasPrice = medianPrice != null
  const hasInventory = activeListings != null && activeListings > 0
  const hasSales = soldLast12mo != null && soldLast12mo > 0
  if (!hasPrice && !hasInventory && !hasSales) {
    return null
  }

  // MoS: prefer the cache-computed live figure (cities + resorts; canonical
  // 6-month absorption base per W8.1a). Fall back to trailing-12mo absorption
  // only when pulse MoS is unavailable (sparse slow-turnover geos). Live
  // 6-month MoS need not equal activeListings / (soldLast12mo / 12) — see the
  // module docstring. The verdict derives from the RAW (unrounded) figure while
  // the number shown is rounded to one decimal, so a true 4.04 bins as balanced
  // (not seller's) and a true 5.96 as balanced (not buyer's) — the pill can
  // never contradict the underlying absorption rate.
  const liveMos = publishMonthsOfSupply({
    grain: geoType,
    pulseMos: pulse ? toNum(pulse.monthsOfSupply) : null,
    pulseActiveCount: liveActive,
    displayedActiveCount: activeListings,
    soldCount12mo: soldLast12mo,
  })
  // The trailing-12 absorption fallback reads cache sold, not leftover
  // closedCount — leftover is not a MOS formula. An untrusted grain cannot
  // reach it either: a resort-community report would otherwise mail a computed
  // figure in place of the withheld one, off a sold count that finds a
  // fraction of the sales.
  const rawMos =
    liveMos != null
      ? liveMos
      : isSoldAttributionTrusted(geoType)
        ? rawMonthsOfSupply(activeListings, cacheSold)
        : null
  // Keep two-decimal precision so the display can stay consistent with the
  // raw-derived verdict at the 4.0 / 6.0 boundaries (formatMonths shows the
  // extra decimal only in the narrow boundary band). Verdict is from rawMos.
  const monthsOfSupply = rawMos != null ? Math.round(rawMos * 100) / 100 : null

  const source: MarketReportSource =
    liveMos != null || liveActive != null ? 'market_metric' : 'market_stats_cache:rolling_365d'

  return {
    slug,
    areaLabel: labelForSlug(slug),
    geoType,
    medianPrice,
    twelveMonthSource: overlay ? 'market-truth' : 'market_stats_cache',
    activeListings,
    soldLast12mo,
    monthsOfSupply,
    monthsOfSupplySource: liveMos != null ? 'live' : rawMos != null ? 'computed-12mo' : null,
    marketVerdict: classifyMarketVerdict(rawMos),
    domMedian,
    yoyPct,
    marketHealthLabel: detail.marketHealthLabel ?? null,
    refreshedAt: pulse?.refreshedAt ?? detail.updatedAt ?? null,
    source,
    href: hrefForArea(slug, geoType),
  }
}

/**
 * Fetch the §0-accurate market blocks for a contact's subscribed areas.
 *
 * For each slug: resolve geo_type, pull the trailing-12-month historical row
 * (getCityMarketDetail at rolling_365d), leftover 12-month pace
 * (getPublicDetachedPace), and live inventory (Market Truth detached at both
 * grains, never the pulse's own count: city getDetachedMarkets, neighborhood
 * getDetachedInventories).
 * Areas with no usable signal at all are OMITTED. The result preserves input
 * order, de-duped by slug.
 *
 * D27: a leftover fetch failure or miss NEVER throws out of this function
 * and NEVER blocks the areas that do have leftover data — `readAreaLeftover`
 * catches per-area, so one area's miss nulls that area's three leftover
 * fields (never a pulse/cache fill) while every other area, and every other
 * figure on the SAME area, builds normally. The document always sends.
 *
 * The send engine (Phase B) calls this, then renderMarketReportEmail, then the
 * suppression-gated send path.
 */
export async function getMarketReportData(
  areaSlugs: readonly string[],
): Promise<MarketReportAreaBlock[]> {
  if (!Array.isArray(areaSlugs) || areaSlugs.length === 0) return []

  // De-dupe, preserve order, drop empties.
  const seen = new Set<string>()
  const slugs: string[] = []
  for (const raw of areaSlugs) {
    const s = typeof raw === 'string' ? raw.trim() : ''
    if (!s || seen.has(s)) continue
    seen.add(s)
    slugs.push(s)
  }
  if (slugs.length === 0) return []

  const citySlugs = slugs.filter((s) => resolveAreaGeoType(s) === 'city')
  const neighborhoodSlugs = slugs.filter((s) => resolveAreaGeoType(s) === 'neighborhood')
  const readCities = async (): Promise<Map<string, SellBendMarket>> => {
    if (citySlugs.length === 0) return new Map()
    try {
      return await getDetachedMarkets(citySlugs.map((s) => ({ geoType: 'city' as const, geoSlug: s })))
    } catch {
      return new Map()
    }
  }
  const [detached, inventories] = await Promise.all([readCities(), readNeighborhoodInventories(neighborhoodSlugs)])

  const blocks = await Promise.all(
    slugs.map(async (slug): Promise<MarketReportAreaBlock | null> => {
      const geoType = resolveAreaGeoType(slug)
      const cacheSlug = geoType === 'city' ? canonicalCityCacheSlug(slug) : slug
      const mt =
        geoType === 'city'
          ? detached.get(`city:${cityDetachedSlug(slug)}`) ??
            detached.get(`city:${cityDetachedSlug(cacheSlug)}`)
          : undefined
      const inventory = geoType === 'neighborhood' ? inventories.get(`neighborhood:${cityDetachedSlug(slug)}`) ?? null : null

      const [detail, trendPoints, leftoverRead] = await Promise.all([
        getCityMarketDetail({ geoType, geoSlug: cacheSlug, periodType: 'rolling_365d' }),
        getMarketTrend(geoType, cacheSlug, 12),
        readAreaLeftover(geoType, slug),
      ])
      const leftover = leftoverRead.row

      // Months of supply is never read at neighborhood grain: the pulse and
      // Market Truth figures there were withheld by publishMonthsOfSupply
      // (an untrusted sold attribution) before this read went direct.
      const live = mt
        ? {
            activeCount: mt.activeCount,
            monthsOfSupply: mt.monthsOfSupply,
            refreshedAt: mt.computedAt,
          }
        : inventory
          ? { activeCount: inventory.activeCount, monthsOfSupply: null, refreshedAt: inventory.computedAt }
          : null

      const provenance: MarketReportProvenance = {
        cache: detail
          ? {
              updatedAt: detail.updatedAt ?? null,
              periodStart: detail.periodStart ?? null,
              periodEnd: detail.periodEnd ?? null,
              soldCount: toNum(detail.soldCount),
              methodologyVersion: detail.methodologyVersion ?? null,
            }
          : null,
        live: mt
          ? {
              table: 'market_metric',
              computedAt: mt.computedAt ?? null,
              completeThrough: mt.completeThrough ?? null,
              periodEnd: mt.periodEnd ?? null,
            }
          : inventory
            ? { table: 'market_metric', computedAt: inventory.computedAt ?? null, completeThrough: null, periodEnd: null }
            : null,
        twelveMonth: {
          medianClose: leftoverRead.provenance.median_close ?? null,
          closedCount: leftoverRead.provenance.closed_count ?? null,
          yoyMedian: leftoverRead.provenance.yoy_median_price ?? null,
        },
      }

      const block = buildAreaBlock({
        slug,
        geoType,
        detail: detail
          ? {
              medianSalePrice: detail.medianSalePrice,
              soldCount: detail.soldCount,
              medianDom: detail.medianDom,
              yoyMedianPriceDeltaPct: detail.yoyMedianPriceDeltaPct,
              marketHealthLabel: detail.marketHealthLabel,
              endOfPeriodInventory: detail.endOfPeriodInventory,
              updatedAt: detail.updatedAt,
            }
          : null,
        pulse: live,
        leftover,
      })
      if (!block) return null
      return { ...block, trend: buildTrendSummary(trendPoints), provenance }
    }),
  )

  return blocks.filter((b): b is MarketReportAreaBlock => b !== null)
}
