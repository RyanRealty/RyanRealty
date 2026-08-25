/**
 * getCityReportSnapshot — the §0 canonical per-city headline block for the
 * /reports hub cards.
 *
 * WHY THIS EXISTS (2026-07-22 consolidation, step 1 of the four-paths fix):
 * the same city could show different numbers on /reports (get_city_period_metrics
 * RPC over raw listings), /cities/<slug> (market_pulse_live + market_stats_cache),
 * /housing-market (pulse snapshots), and the CRM report emails (cache DAL). That
 * is a §0 liability — one metric, one number. This DAL feeds the /reports hub
 * cards from the SAME cache reads the KB city pages use, so the hub card and the
 * city page can never disagree:
 *
 *   - Live figures: leftover HUD (active, median list, months of supply,
 *     Closed · 30 days, Median to pending). Leftover miss omits. Pulse does not fill.
 *   - Trailing-12-month figures: leftover.medianClose / leftover.closedCount /
 *     leftover.yoyMedian overlay `market_stats_cache` rolling_365d sold/median/YoY
 *     on `getCityReportSnapshot` (singular) and `getCityReportSnapshots`. Miss
 *     omits those three fields — never cache. medianDom stays cache (leftover
 *     days-to-contract is not DOM). Live HUD-family cells overlay leftover HUD.
 *     Leftover miss omits. Pulse does not fill.
 *
 * The two groups are kept SEPARATE on the returned shape (live vs trailing12mo)
 * so a renderer cannot mix windows on one unlabeled surface — each group carries
 * its own freshness/period metadata.
 *
 * NEVER aggregates raw `listings`. NEVER fabricates a figure — a missing cache
 * row yields null fields, and a city with no data on either path is omitted.
 *
 * Slug convention: `market_pulse_live` / `market_stats_cache` city rows have
 * historically carried both space-separated ('la pine' — what the live city
 * pages read today) and hyphenated ('la-pine') geo_slug spellings (see
 * lib/cma/market.ts). We resolve by candidates, space-separated first.
 *
 * The market-stat-consistency cron still cross-checks THIS path against the
 * get_city_period_metrics RPC path daily (|delta| > 1% alerts, the §0
 * reconciliation threshold). It no longer guards a rendered RPC table: W8.1
 * moved the range table below these cards onto the same cache (getCityRangeReport),
 * so the two agree by construction. The cron now watches the ADMIN-only RPC path.
 *
 * DAL boundary (G1): reads ONLY through other DAL functions. No raw `.from()`.
 */

import { getCityMarketDetail } from '@/lib/data/market/getCityMarketDetail'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import {
  leftoverHudKpis,
  leftoverHudPublishes,
  type LeftoverHudKpis,
} from '@/lib/market/publish-leftover-hud'
import {
  citySlugCandidates,
  cityUrlSlug,
} from '@/lib/market/city-cache-slug'
import type { MarketDetail, MarketPulse } from '@/lib/data/types/market'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPace,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'

export { citySlugCandidates, cityUrlSlug } from '@/lib/market/city-cache-slug'

/** Live (market_pulse_live) figures — one window: "right now". */
export type CityReportLiveBlock = {
  activeCount: number | null
  medianListPrice: number | null
  /** Canonical MoS from the pulse (active / (closed_6mo / 6)). */
  monthsOfSupply: number | null
  closedLast30Days: number | null
  medianDaysToPending: number | null
  /** Pulse row freshness — the "as of" label for every figure in this block. */
  refreshedAt: string | null
}

/** Trailing-12-month (market_stats_cache rolling_365d) figures — one window. */
export type CityReportTrailingBlock = {
  medianSalePrice: number | null
  soldCount: number | null
  medianDom: number | null
  yoyMedianPriceDeltaPct: number | null
  /** The cache row's OWN period bounds — the §0 label for this block. */
  periodStart: string | null
  periodEnd: string | null
  updatedAt: string | null
}

export type CityReportSnapshot = {
  /** Display name, e.g. 'La Pine'. */
  cityLabel: string
  /** The cache geo_slug that actually resolved (e.g. 'la pine'). */
  geoSlug: string
  /** Hyphenated URL slug for /cities/<slug> links (e.g. 'la-pine'). */
  urlSlug: string
  live: CityReportLiveBlock | null
  trailing12mo: CityReportTrailingBlock | null
}

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Merge the two cache reads into one snapshot. Pure — exported for unit tests.
 * Returns null when BOTH paths are empty (the caller omits the city rather than
 * rendering a wall of dashes — honest empty, never fabricated).
 */
export function buildCityReportSnapshot(args: {
  cityLabel: string
  geoSlug: string
  pulse: Pick<
    MarketPulse,
    'activeCount' | 'medianListPrice' | 'monthsOfSupply' | 'closedLast30Days' | 'medianDaysToPending' | 'refreshedAt'
  > | null
  detail: Pick<
    MarketDetail,
    'medianSalePrice' | 'soldCount' | 'medianDom' | 'yoyMedianPriceDeltaPct' | 'periodStart' | 'periodEnd' | 'updatedAt'
  > | null
}): CityReportSnapshot | null {
  const { cityLabel, geoSlug, pulse, detail } = args
  if (!pulse && !detail) return null

  const live: CityReportLiveBlock | null = pulse
    ? {
        activeCount: toNum(pulse.activeCount),
        medianListPrice: toNum(pulse.medianListPrice),
        monthsOfSupply: toNum(pulse.monthsOfSupply),
        closedLast30Days: toNum(pulse.closedLast30Days),
        medianDaysToPending: toNum(pulse.medianDaysToPending),
        refreshedAt: pulse.refreshedAt ?? null,
      }
    : null

  const trailing12mo: CityReportTrailingBlock | null = detail
    ? {
        medianSalePrice: toNum(detail.medianSalePrice),
        soldCount: toNum(detail.soldCount),
        medianDom: toNum(detail.medianDom),
        yoyMedianPriceDeltaPct: toNum(detail.yoyMedianPriceDeltaPct),
        periodStart: detail.periodStart ? String(detail.periodStart).slice(0, 10) : null,
        periodEnd: detail.periodEnd ? String(detail.periodEnd).slice(0, 10) : null,
        updatedAt: detail.updatedAt ?? null,
      }
    : null

  return { cityLabel, geoSlug, urlSlug: cityUrlSlug(cityLabel), live, trailing12mo }
}

async function readCityLeftover(cityLabel: string): Promise<PublicPaceRow> {
  try {
    return await getPublicDetachedPace({ geoType: 'city', geoSlug: cityUrlSlug(cityLabel) })
  } catch {
    return { ...EMPTY_PUBLIC_PACE }
  }
}

/**
 * Overlay leftover 12-month close onto trailing sold/median/YoY. Miss omits
 * those three cache fields. leftover.yoyMedian is a share (e.g. -0.019 → -1.9).
 * medianDom stays cache — leftover days-to-contract is not DOM. Live pulse is
 * untouched. Singular getCityReportSnapshot and the batch path both call this.
 */
export function overlayCityReportLeftover(
  snapshot: CityReportSnapshot | null,
  leftover: Pick<PublicPaceRow, 'medianClose' | 'closedCount' | 'yoyMedian'> | null,
  hud?: LeftoverHudKpis | null,
  leftoverAsOf?: string | null,
): CityReportSnapshot | null {
  if (!snapshot) return null
  const medianSalePrice = leftover?.medianClose ?? null
  const soldCount = leftover?.closedCount ?? null
  const yoyMedianPriceDeltaPct =
    leftover?.yoyMedian != null ? leftover.yoyMedian * 100 : null
  const trailing = snapshot.trailing12mo
  const trailing12mo =
    trailing || medianSalePrice != null || soldCount != null || yoyMedianPriceDeltaPct != null
      ? {
          medianSalePrice,
          soldCount,
          medianDom: trailing?.medianDom ?? null,
          yoyMedianPriceDeltaPct,
          periodStart: trailing?.periodStart ?? null,
          periodEnd: trailing?.periodEnd ?? null,
          updatedAt: trailing?.updatedAt ?? null,
        }
      : snapshot.trailing12mo
  const live = leftoverHudPublishes(hud)
    ? {
        activeCount: hud?.active ?? null,
        medianListPrice: hud?.medianList ?? null,
        monthsOfSupply: hud?.monthsSupply ?? null,
        closedLast30Days: hud?.closed30 ?? null,
        medianDaysToPending: hud?.daysToPending ?? null,
        refreshedAt: leftoverAsOf ?? null,
      }
    : hud !== undefined
      ? null
      : snapshot.live
  return {
    ...snapshot,
    live,
    trailing12mo,
  }
}

/**
 * True when the snapshot carries at least one real market signal: a median
 * price on either window, live inventory, or closed sales. Mirrors the audited
 * no-signal rule in lib/data/crm/getMarketReportData.ts (buildAreaBlock) — a
 * place with zero active homes, zero sales, and no median has nothing to
 * report, so a renderer drops it rather than showing a wall of dashes. Kept
 * OUT of the fetch path on purpose: the consistency cron still needs the
 * zero/empty snapshot to cross-check against the RPC path. Pure — exported
 * for unit tests.
 */
export function hasReportSignal(s: CityReportSnapshot): boolean {
  const hasPrice = s.live?.medianListPrice != null || s.trailing12mo?.medianSalePrice != null
  const hasInventory = (s.live?.activeCount ?? 0) > 0
  const hasSales = (s.trailing12mo?.soldCount ?? 0) > 0 || (s.live?.closedLast30Days ?? 0) > 0
  return hasPrice || hasInventory || hasSales
}

/**
 * One city's snapshot. Resolves the cache slug by candidates (space-separated
 * first). Underlying reads are already resiliently cached (getMarketPulse
 * 10-15 min, getCityMarketDetail 6h) — no extra cache layer here.
 * Leftover overlays 12-month close/sold/YoY so this path cannot print cache
 * rolling_365d. Live HUD-family cells overlay leftover HUD. Miss omits.
 */
export async function getCityReportSnapshot(cityLabel: string): Promise<CityReportSnapshot | null> {
  const candidates = citySlugCandidates(cityLabel)
  const leftoverP = readCityLeftover(cityLabel)
  const overlayP = getDetachedOverlays([{ geoType: 'city', geoSlug: cityUrlSlug(cityLabel) }]).catch(
    () => new Map(),
  )
  for (const geoSlug of candidates) {
    const [pulse, detail] = await Promise.all([
      getMarketPulse({ geoType: 'city', geoSlug }),
      getCityMarketDetail({ geoType: 'city', geoSlug, periodType: 'rolling_365d' }),
    ])
    if (pulse || detail) {
      const leftover = await leftoverP
      const overlays = await overlayP
      const layers = overlays.get(`city:${cityDetachedSlug(cityUrlSlug(cityLabel))}`)
      const hud = leftoverHudKpis({
        grain: 'city',
        headlines: layers?.headlines ?? null,
        inventory: layers?.inventory ?? null,
        pace: leftover,
      })
      return overlayCityReportLeftover(
        buildCityReportSnapshot({ cityLabel, geoSlug, pulse, detail }),
        leftover,
        hud,
        layers?.headlines?.computedAt ?? layers?.inventory?.computedAt ?? null,
      )
    }
  }
  return null
}

/**
 * Snapshots for many cities, input order preserved, no-data cities omitted.
 * This is what the /reports hub cards render.
 */
export async function getCityReportSnapshots(cityLabels: string[]): Promise<CityReportSnapshot[]> {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const raw of cityLabels) {
    const label = typeof raw === 'string' ? raw.trim() : ''
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  if (labels.length === 0) return []
  const results = await Promise.all(labels.map((label) => getCityReportSnapshot(label)))
  return results.filter((s): s is CityReportSnapshot => s !== null)
}
