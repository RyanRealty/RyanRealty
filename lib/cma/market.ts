/**
 * CMA market context — verified conditions for the subject's market.
 * Resort subdivisions read geo_type='neighborhood' first (Caldera Springs,
 * Tetherow, …). City is the fallback.
 *
 * Months of supply and live inventory come from getDetachedMarket /
 * getCityDetachedMarket (getMetric mt-v1), the same path /sell uses. A miss
 * omits — pulse MOS is never the CMA figure. Leftover 12-month pace
 * (sale-to-original, YoY, pending, median close, ppsf) comes from
 * getPublicDetachedPace. A leftover miss omits; cache/pulse do not fill
 * those fields. Pulse days-to-pending and 30-day sold stay off this object
 * (do not map them onto 12-month days to contract).
 *
 * ONE POPULATION ON THE PAGE (2026-10-08). The month line is the same
 * Market Truth detached membership as the counts beside it
 * (getPublicDetachedMonthly, one-month median_close and closed_count, the
 * read the public city page draws, D20/D27). It used to be
 * market_stats_cache monthly, which clips a city to its TIGER polygon: on
 * 2026-10-08 Bend's letter printed "712 homes are for sale in Bend" and "an
 * average of 204 sold each month" (MLS City text, 712 active, 1224 closed in
 * 180 days) while its stored month line carried the polygon's 140 to 198
 * sales a month from April to September (978 in all, 163 a month). Two
 * reviewers divided 712 by 163, got 4.4 months, and read a verdict flip that
 * no single population supports. A leftover miss omits the line; the cache
 * does not fill it.
 *
 * Cache rolling_365d is optional. Market Truth leftover or inventory is
 * enough to assemble a context. Verdict thresholds (CLAUDE.md §0): <= 4
 * seller's, 4-6 balanced, >= 6 buyer's.
 */

import {
  getCmaMarketPulseRow,
  getCmaMarketStatsRow,
  CMA_MARKET_TREND_MEASURE,
  type CmaMarketPulseRow,
  type CmaMarketStatsRow,
} from '@/lib/data/cma/builderReads'
import { getCityDetachedMarket, getDetachedMarket, type SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPace,
  publicPaceHasRow,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
import { getPublicDetachedMonthly, type PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import { zonedDateKey } from '@/lib/format/date'
import { resortSlugForSubdivision } from '@/lib/cma/resort-guard'
import { getCmaMarketBoardYear } from '@/lib/cma/market-board-mart'
import type { CmaMarketContext, CmaMarketTrendPoint } from '@/lib/cma/types'
import { isSoldAttributionTrusted, publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'
import { monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'

export { yearMartCite } from '@/lib/cma/market-board-mart'

function slugCandidates(city: string): string[] {
  const lower = city.trim().toLowerCase()
  const hyphen = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  // The cache historically carries both 'la-pine' and 'la pine' spellings.
  return Array.from(new Set([hyphen, lower]))
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function shiftUtcMonths(iso: string, delta: number): string {
  const day = iso.slice(0, 10)
  const d = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return day
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 10)
}

export type CmaMarketTarget = {
  geoType: 'city' | 'neighborhood'
  slugs: string[]
}

/**
 * Resort homes (Caldera, Tetherow, …) read the neighborhood cache first.
 * City-only was the RPR failure mode: a Caldera subject in Bend / 97707
 * inherited Bend's 3.6-month seller's-market read instead of Caldera's own.
 */
export function resolveCmaMarketTargets(input: {
  city: string
  subdivision?: string | null
}): { targets: CmaMarketTarget[] } {
  const citySlugs = slugCandidates(input.city)
  const resort = resortSlugForSubdivision(input.subdivision)
  if (resort) {
    return {
      targets: [
        { geoType: 'neighborhood', slugs: [resort] },
        { geoType: 'city', slugs: citySlugs },
      ],
    }
  }
  return { targets: [{ geoType: 'city', slugs: citySlugs }] }
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

async function readCmaDetached(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
): Promise<SellBendMarket | null> {
  if (!geoSlug.trim()) return null
  try {
    return geoType === 'city'
      ? await getCityDetachedMarket(geoSlug)
      : await getDetachedMarket('neighborhood', geoSlug)
  } catch {
    return null
  }
}

async function readCmaLeftover(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
): Promise<PublicPaceRow> {
  try {
    return await getPublicDetachedPace({ geoType, geoSlug })
  } catch {
    return { ...EMPTY_PUBLIC_PACE }
  }
}

/**
 * The population every market figure in a CMA counts, named for the citation
 * so a reviewer reconciles the letter against the right store (2026-10-08).
 */
export const CMA_MARKET_POPULATION =
  "Market Truth mt-v1 segment detached: PropertyType 'A' and property_sub_type 'Single Family Residence'. " +
  'A city is its MLS City text (D5), a resort community its primary place membership. ' +
  "Active is StandardStatus 'Active' only (Coming Soon and pending are not inventory). " +
  'Months of supply = active / (closed_180d / 6). The month line is one-month median_close and closed_count on the same membership.'

/** The month line covers the last year: twelve complete months. */
export const CMA_TREND_MONTHS = 12

async function readCmaMonthly(
  geoType: 'city' | 'neighborhood',
  geoSlug: string,
): Promise<PublicMonthlyPoint[]> {
  if (!geoSlug.trim()) return []
  try {
    return await getPublicDetachedMonthly({
      geoType,
      geoSlug,
      // Pacific, the same in-progress month the public city page drops.
      currentMonthKey: zonedDateKey(new Date()).slice(0, 7),
      months: CMA_TREND_MONTHS,
    })
  } catch {
    return []
  }
}

/**
 * Market Truth months as the CMA trend, every calendar month kept. A month
 * whose median Market Truth withheld (under its floor of ten sales) keeps its
 * place with a null median, never a value from the cache, so the chart breaks
 * the line there instead of joining across it; the chart needs six priced
 * months. There is no monthly inventory cell, so `endOfPeriodInventory` is
 * null rather than another population's count.
 */
export function cmaTrendFromMonthly(points: readonly PublicMonthlyPoint[]): CmaMarketTrendPoint[] {
  return points.map((p) => ({
    periodStart: p.periodStart,
    medianSalePrice: p.medianClose,
    soldCount: p.closedCount,
    endOfPeriodInventory: null,
  }))
}

export type CmaMarketAssembleInput = {
  city: string
  geoType: 'city' | 'neighborhood'
  geoSlug: string
  stats: CmaMarketStatsRow | null
  pulse: CmaMarketPulseRow | null
  detached: SellBendMarket | null
  leftover: PublicPaceRow
  /** Market Truth detached one-month cells for the same geography (getPublicDetachedMonthly). */
  monthly: PublicMonthlyPoint[]
  yearMart: CmaMarketContext['yearMart']
}

/**
 * Overlay leftover + inventory onto a CMA market board. Leftover fields never
 * fall back to cache/pulse. MOS never falls back to pulse. Cache rolling_365d
 * may be missing.
 */
export function assembleCmaMarketContext(input: CmaMarketAssembleInput): CmaMarketContext {
  const { geoType, geoSlug, stats, pulse, detached, leftover, monthly, yearMart, city } = input
  const publishedMos =
    detached != null
      ? publishMonthsOfSupply({
          grain: geoType,
          source: 'market-truth',
          pulseMos: detached.monthsOfSupply,
          pulseActiveCount: detached.activeCount,
          displayedActiveCount: detached.activeCount,
        })
      : null
  // THE RAW FIGURE IN THE DATA, ONE HELPER AT EVERY PRINT SITE (2026-09-30).
  // This rounded the raw figure on its own while the verdict came from the raw
  // value, so Redmond's raw 4.02 stored and printed "4.0 months" beside
  // "balanced", and CLAUDE.md §0 says 4 or less is a seller's market
  // (cma-5391-frank-redmond-97756, build_summary.market = { months_of_supply:
  // 4, verdict: 'balanced' }). The data, the citation and every figure derived
  // from it (the letter's monthly pace is active / months) keep the RAW value.
  // Each print site formats it with formatMonthsOfSupply, which never lets the
  // rounding cross a threshold the raw value does not (4.02 prints 4.1, 5.97
  // prints 5.9), and the verdict is monthsOfSupplyVerdict on the same raw
  // value, so the printed digits and the verdict cannot disagree. Storing the
  // display value instead moved the printed pace (201 for sale at 4.02 printed
  // 49 a month, not 50).
  const monthsOfSupply = publishedMos
  const mosFormula =
    publishedMos != null
      ? geoType === 'city'
        ? 'getMetric months_of_supply mt-v1 detached MLS-city (same path as /sell)'
        : 'getMetric months_of_supply mt-v1 detached (source market-truth)'
      : 'withheld: detached cell missing (no pulse fallback)'
  const verdict: CmaMarketContext['marketVerdict'] = monthsOfSupplyVerdict(publishedMos)?.key ?? null

  const periodEnd = stats?.period_end ?? detached?.completeThrough ?? pulse?.updated_at?.slice(0, 10) ?? ''
  const periodStart = stats?.period_start ?? (periodEnd ? shiftUtcMonths(periodEnd, -12) : '')
  const cacheSold = isSoldAttributionTrusted(geoType) ? num(stats?.sold_count) : null
  const soldCount365 = leftover.closedCount ?? cacheSold

  return {
    geoSlug: stats?.geo_slug ?? geoSlug,
    geoLabel: stats?.geo_label ?? (geoType === 'neighborhood' ? titleCaseSlug(geoSlug) : city),
    periodStart,
    periodEnd,
    soldCount365,
    medianSalePrice: leftover.medianClose,
    medianDom: num(stats?.median_dom),
    medianPpsf: leftover.medianPpsf,
    saleToListRatio: leftover.saleToOriginal,
    yoyMedianPriceDeltaPct: leftover.yoyMedian != null ? leftover.yoyMedian * 100 : null,
    activeCount: detached?.activeCount ?? null,
    pendingCount: leftover.pendingCount,
    medianListPrice: detached?.medianListPrice ?? num(pulse?.median_list_price),
    monthsOfSupply,
    // The denominator of the printed pace, only beside a published figure.
    closedSixMonths: publishedMos != null ? (detached?.closedSixMonths ?? null) : null,
    mosFormula,
    marketVerdict: verdict,
    methodologyVersion: stats?.methodology_version ?? null,
    computedAt: stats?.computed_at ?? detached?.computedAt ?? null,
    pulseUpdatedAt: pulse?.updated_at ?? null,
    yearMart,
    trendMeasure: CMA_MARKET_TREND_MEASURE,
    trend: cmaTrendFromMonthly(monthly),
  }
}

export async function getCmaMarketContext(
  cityOrSubject: string | { city: string; subdivision?: string | null },
): Promise<CmaMarketContext | null> {
  const city = typeof cityOrSubject === 'string' ? cityOrSubject : cityOrSubject.city
  const subdivision = typeof cityOrSubject === 'string' ? null : cityOrSubject.subdivision
  const { targets } = resolveCmaMarketTargets({ city, subdivision })
  let stats: CmaMarketStatsRow | null = null
  let pulse: CmaMarketPulseRow | null = null
  let detached: SellBendMarket | null = null
  let leftover: PublicPaceRow = { ...EMPTY_PUBLIC_PACE }
  let chosen: CmaMarketTarget | null = null

  for (const target of targets) {
    const slug = target.slugs[0] ?? ''
    const [nextStats, nextPulse, nextDetached, nextLeftover] = await Promise.all([
      getCmaMarketStatsRow(target.slugs, target.geoType),
      getCmaMarketPulseRow(target.slugs, target.geoType),
      readCmaDetached(target.geoType, slug),
      readCmaLeftover(target.geoType, slug),
    ])
    if (nextStats || nextDetached || publicPaceHasRow(nextLeftover)) {
      stats = nextStats
      pulse = nextPulse
      detached = nextDetached
      leftover = nextLeftover
      chosen = target
      break
    }
  }

  if (!chosen) return null

  const geoType =
    stats?.geo_type === 'neighborhood' || chosen.geoType === 'neighborhood' ? 'neighborhood' : 'city'
  const geoSlug = stats?.geo_slug ?? chosen.slugs[0] ?? slugCandidates(city)[0] ?? ''
  // The month line reads the slug the detached counts were read with, so the
  // line and the counts are one membership.
  const [monthly, yearMart] = await Promise.all([
    readCmaMonthly(geoType, chosen.slugs[0] ?? geoSlug),
    getCmaMarketBoardYear({ city }),
  ])

  return assembleCmaMarketContext({
    city,
    geoType,
    geoSlug,
    stats,
    pulse,
    detached,
    leftover,
    monthly,
    yearMart,
  })
}

/**
 * Per-figure source attribution for the CMA's market_context citation.
 *
 * D27: this block used to carry one fixed string, `market_stats_cache
 * (rolling_365d) + market_pulse_live`, which stopped being true as the board
 * migrated onto leftover detached membership. Median close, price per sq ft,
 * sale-to-original, YoY and pending are leftover only; sold count and median
 * list read leftover first and fall back; days on market is still cache under
 * D17's carve-out. A CMA is signed by a broker, and its citation is what a
 * reviewer audits the number against — naming a store that did not produce the
 * figure makes it unauditable, which is a §0 failure, not a cosmetic one.
 */
export function cmaMarketSources(ctx: CmaMarketContext): Record<string, string> {
  const MT = 'market-truth leftover detached membership (mt-v1)'
  const CACHE = 'market_stats_cache rolling_365d'
  const PULSE = 'market_pulse_live'
  return {
    median_sale_price: MT,
    median_ppsf: MT,
    sale_to_list_ratio: MT,
    yoy_median_price_delta_pct: MT,
    pending_count: MT,
    active_count: MT,
    months_of_supply: MT,
    market_verdict: MT,
    // Leftover first, cache only if leftover withheld the closed count.
    sold_count_365: ctx.soldCount365 == null ? 'none' : MT,
    // Leftover first, pulse only if the detached board had no median list.
    median_list_price: ctx.medianListPrice == null ? 'none' : ctx.computedAt ? MT : PULSE,
    // D17 carve-out: days on market stays cache.
    median_dom: ctx.medianDom == null ? 'none' : CACHE,
    // The month line is the counts' own membership (D20/D27), never the cache.
    trend: (ctx.trend ?? []).some((t) => t.medianSalePrice != null)
      ? `${MT}, one-month median_close + closed_count`
      : 'none',
  }
}

