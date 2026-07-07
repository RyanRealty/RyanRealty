/**
 * getMarketReportData — the §0-accurate market figures for a contact's
 * subscribed report areas (Wave 8, market-report subscription product).
 *
 * Every figure returned here traces to the canonical market cache via the
 * EXISTING market DAL. This module NEVER aggregates raw `listings` and NEVER
 * fabricates a placeholder number. A subscribed area with no cache data is
 * omitted (honest empty), not filled with a guess. A wrong stat in a sent
 * email is a compliance failure (CLAUDE.md §0).
 *
 * Source of every block:
 *   - Period-anchored historical analytics: `market_stats_cache` (6h freshness)
 *     read through `getCityMarketDetail` at `period_type='rolling_365d'`. This
 *     is the trailing-12-month window — the most stable, seasonality-neutral
 *     base for the months-of-supply absorption rate, and it is populated for
 *     every subscribable area (cities AND resort communities).
 *   - Live inventory (cities only): `market_pulse_live` (10-15 min) read through
 *     `getMarketPulse`. Carries the cache-computed `monthsOfSupply` and the
 *     current `activeCount`. When present it is the authoritative live MoS and
 *     overrides the historical-derived figure.
 *
 * Months of supply (CLAUDE.md §0): MoS = active / (closed_6mo / 6). With a
 * trailing-12-month close count the monthly close rate is `sold12mo / 12`, so
 * MoS = active / (sold12mo / 12). This is mathematically identical to the
 * 6-month form (sold6mo/6) under a steady close rate, and uses a REAL 12-month
 * count rather than an estimated 6-month one. Thresholds: <= 4 sellers,
 * 4-6 balanced, >= 6 buyers. The returned `marketVerdict` is computed FROM the
 * returned `monthsOfSupply`, so the verdict can never contradict the number.
 *
 * Two MoS bases, and how the displayed numbers self-reconcile: for CITIES the
 * live `market_pulse_live.monthsOfSupply` wins when present. That figure is the
 * canonical absorption rate computed by the cache on a 6-MONTH close base
 * (active / (closed_6mo / 6)). The `soldLast12mo` we ALSO return is the trailing
 * 12-month close count (the historical-cache figure, used as the email's "homes
 * sold" line). So for a city, `monthsOfSupply` is NOT `activeListings /
 * (soldLast12mo / 12)` unless the close pace was steady across the year. This is
 * intentional: the live 6-month MoS is the fresher, seasonally-current
 * absorption signal (10-15 min vs 6h), while the 12-month sold count is the more
 * stable volume figure. For RESORT COMMUNITIES (no live pulse) MoS IS computed
 * from `soldLast12mo` via `computeMonthsOfSupply`, so there the two reconcile
 * exactly: monthsOfSupply == activeListings / (soldLast12mo / 12).
 *
 * Slug resolution: the subscribable areas (lib/data/crm/getContactReportSubscriptions
 * buildMarketReportAreas) are the 7 Central Oregon cities + the 14 resort
 * communities from the registry. A city slug resolves to `geo_type='city'`; any
 * other (resort community) slug resolves to `geo_type='neighborhood'` — the
 * exact convention docs/DATABASE_FOR_AI_AGENTS.md §3a documents the cache uses
 * for resort communities.
 *
 * DAL boundary (G1): this module reads ONLY through other DAL functions
 * (getCityMarketDetail, getMarketPulse). It contains no raw `.from()`.
 */

import { getCityMarketDetail } from '@/lib/data/market/getCityMarketDetail'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { hrefForNeighborhoodSlug } from '@/lib/neighborhood-areas'
import { marketVerdict } from '@/lib/market/classify'
import type { MoSVerdict } from '@/lib/data/types/market'

/** Source tag carried on every block so a reviewer can audit the trace. */
export type MarketReportSource = 'market_stats_cache:rolling_365d' | 'market_pulse_live'

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
  /** Where every figure in this block came from (audit trace). */
  source: MarketReportSource
  /** Canonical web path to the full report for this area. */
  href: string
}

/** The 7 Central Oregon city slugs the report engine serves as cities. */
const CITY_SLUGS = new Set<string>([
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'tumalo',
  'la-pine',
  'terrebonne',
])

/**
 * Compute months of supply from an active count and a trailing-12-month close
 * count, per the canonical absorption formula. Pure — exported for unit tests.
 *
 * Returns null when the inputs cannot produce a real figure (no active count,
 * no closes, or a zero close rate which would divide by zero). Never returns a
 * fabricated number to fill a gap.
 */
export function computeMonthsOfSupply(
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
  // One decimal — matches the precision every market surface renders.
  return Math.round(mos * 10) / 10
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
  return CITY_SLUGS.has(slug) ? 'city' : 'neighborhood'
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

/**
 * Build one area's block from the historical cache row (+ optional live pulse).
 * Pure given the already-fetched rows — exported so the merge logic (which live
 * source wins, when an area is unavailable) is unit-tested without the DB.
 *
 * Returns null when the area has NO usable cache data (no median price AND no
 * active inventory AND no close count) — the caller omits it. We never emit a
 * block whose figures are all null/fabricated.
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
  /** From getMarketPulse (cities only); null for communities or on miss. */
  pulse: {
    activeCount: number
    monthsOfSupply: number | null
    refreshedAt: string | null
  } | null
}): MarketReportAreaBlock | null {
  const { slug, geoType, detail, pulse } = args
  if (!detail) return null

  const medianPrice = toNum(detail.medianSalePrice)
  const soldLast12mo = toNum(detail.soldCount)
  const domMedian = toNum(detail.medianDom)
  const yoyPct = toNum(detail.yoyMedianPriceDeltaPct)
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

  // MoS: prefer the cache-computed live figure (cities; a 6-month absorption
  // base) else compute from the trailing-12mo absorption rate (resort
  // communities). For a city the live 6-month MoS therefore need not equal
  // activeListings / (soldLast12mo / 12) — see the module docstring "Two MoS
  // bases" note. The verdict always derives from the final `monthsOfSupply`, so
  // the verdict can never disagree with the number shown.
  const liveMos = pulse ? toNum(pulse.monthsOfSupply) : null
  const computedMos = computeMonthsOfSupply(activeListings, soldLast12mo)
  const monthsOfSupply = liveMos != null ? Math.round(liveMos * 10) / 10 : computedMos

  const source: MarketReportSource =
    liveMos != null || liveActive != null ? 'market_pulse_live' : 'market_stats_cache:rolling_365d'

  return {
    slug,
    areaLabel: labelForSlug(slug),
    geoType,
    medianPrice,
    activeListings,
    soldLast12mo,
    monthsOfSupply,
    marketVerdict: classifyMarketVerdict(monthsOfSupply),
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
 * (getCityMarketDetail at rolling_365d) and — for cities — the live pulse
 * (getMarketPulse). Areas with no cache data are OMITTED. The result preserves
 * input order, de-duped by slug.
 *
 * The send engine (Phase B) calls this, then renderMarketReportEmail, then the
 * suppression-gated send path.
 */
export async function getMarketReportData(
  areaSlugs: string[],
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

  const blocks = await Promise.all(
    slugs.map(async (slug): Promise<MarketReportAreaBlock | null> => {
      const geoType = resolveAreaGeoType(slug)

      const [detail, pulse] = await Promise.all([
        getCityMarketDetail({ geoType, geoSlug: slug, periodType: 'rolling_365d' }),
        // market_pulse_live carries city + region only — skip the lookup for
        // resort communities (geo_type='neighborhood'), which never have a row.
        geoType === 'city'
          ? getMarketPulse({ geoType: 'city', geoSlug: slug })
          : Promise.resolve(null),
      ])

      return buildAreaBlock({
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
        pulse: pulse
          ? {
              activeCount: pulse.activeCount,
              monthsOfSupply: pulse.monthsOfSupply,
              refreshedAt: pulse.refreshedAt,
            }
          : null,
      })
    }),
  )

  return blocks.filter((b): b is MarketReportAreaBlock => b !== null)
}
