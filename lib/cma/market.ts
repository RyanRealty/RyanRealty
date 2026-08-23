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
 * Cache rolling_365d is optional. Market Truth leftover or inventory is
 * enough to assemble a context. Verdict thresholds (CLAUDE.md §0): <= 4
 * seller's, 4-6 balanced, >= 6 buyer's.
 */

import {
  getCmaMarketPulseRow,
  getCmaMarketStatsRow,
  getCmaMarketTrendRows,
  type CmaMarketPulseRow,
  type CmaMarketStatsRow,
  type CmaMarketTrendRow,
} from '@/lib/data/cma/builderReads'
import { getCityDetachedMarket, getDetachedMarket, type SellBendMarket } from '@/lib/data/market-truth/getSellBendMarket'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPace,
  publicPaceHasRow,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'
import { resortSlugForSubdivision } from '@/lib/cma/resort-guard'
import { getCmaMarketBoardYear } from '@/lib/cma/market-board-mart'
import type { CmaMarketContext } from '@/lib/cma/types'
import { isSoldAttributionTrusted, publishMonthsOfSupply } from '@/lib/market/publish-months-of-supply'

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

export type CmaMarketAssembleInput = {
  city: string
  geoType: 'city' | 'neighborhood'
  geoSlug: string
  stats: CmaMarketStatsRow | null
  pulse: CmaMarketPulseRow | null
  detached: SellBendMarket | null
  leftover: PublicPaceRow
  trendRows: CmaMarketTrendRow[]
  yearMart: CmaMarketContext['yearMart']
}

/**
 * Overlay leftover + inventory onto a CMA market board. Leftover fields never
 * fall back to cache/pulse. MOS never falls back to pulse. Cache rolling_365d
 * may be missing.
 */
export function assembleCmaMarketContext(input: CmaMarketAssembleInput): CmaMarketContext {
  const { geoType, geoSlug, stats, pulse, detached, leftover, trendRows, yearMart, city } = input
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
  const monthsOfSupply = publishedMos != null ? +publishedMos.toFixed(1) : null
  const mosFormula =
    publishedMos != null
      ? geoType === 'city'
        ? 'getMetric months_of_supply mt-v1 detached MLS-city (same path as /sell)'
        : 'getMetric months_of_supply mt-v1 detached (source market-truth)'
      : 'withheld: detached cell missing (no pulse fallback)'
  let verdict: CmaMarketContext['marketVerdict'] = null
  if (detached && publishedMos != null) {
    verdict =
      detached.verdictKind === 'sellers'
        ? 'seller'
        : detached.verdictKind === 'buyers'
          ? 'buyer'
          : 'balanced'
  }

  const periodEnd = stats?.period_end ?? detached?.completeThrough ?? pulse?.updated_at?.slice(0, 10) ?? ''
  const periodStart = stats?.period_start ?? (periodEnd ? shiftUtcMonths(periodEnd, -12) : '')
  const cacheSold = isSoldAttributionTrusted(geoType) ? num(stats?.sold_count) : null
  const soldCount365 = leftover.closedCount ?? cacheSold ?? 0

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
    mosFormula,
    marketVerdict: verdict,
    methodologyVersion: stats?.methodology_version ?? null,
    computedAt: stats?.computed_at ?? detached?.computedAt ?? null,
    pulseUpdatedAt: pulse?.updated_at ?? null,
    yearMart,
    trend: trendRows.map((row) => ({
      periodStart: row.period_start,
      medianSalePrice: num(row.median_sale_price),
      soldCount: num(row.sold_count),
      endOfPeriodInventory: num(row.end_of_period_inventory),
    })),
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
  const [trendRows, yearMart] = await Promise.all([
    getCmaMarketTrendRows(geoSlug, geoType),
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
    trendRows,
    yearMart,
  })
}
