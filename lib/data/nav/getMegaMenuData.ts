/**
 * getMegaMenuData — the data foundation for the full-width intelligent bento
 * mega-menu in SiteHeader.
 *
 * This renders on EVERY page (the header is global), so it MUST be cheap. Every
 * field is built ONLY from existing, already-cached DAL functions — no new
 * Supabase access patterns, no raw `.from()`, no heavy aggregation. The whole
 * payload is wrapped in `unstable_cache` on the market-stats window (6h) so the
 * header costs one Data Cache read site-wide, not a fan-out per request.
 *
 * Data-accuracy contract (CLAUDE.md §0): every stat is null-guarded. A value
 * that is null, non-finite, or non-positive is OMITTED (left `null`/absent) —
 * the menu shows a real number or nothing, never a 0 or a fabricated figure.
 * The market verdict is derived from months-of-supply against the canonical
 * thresholds (≤4 seller / 4–6 balanced / ≥6 buyer), so the pill can never
 * disagree with the number it sits next to.
 *
 * Per-parent panels (matches the 7 PRIMARY_NAV parents in lib/site-nav.ts):
 *   homes        — a handful of cities (active count + median) + per-city
 *                  popular searches + the all-cities total active count
 *   communities  — top resort/golf communities (active + median + golf image)
 *   cities        — city cards (active + median + median days-to-pending)
 *   market        — Central Oregon region summary + 12-point price sparkline
 *   sell          — region median + verdict + valuation href
 *   learn         — latest blog posts (live) or the static guide routes
 *
 * No panel is built for "Company" — that parent is pure static nav (team /
 * about / contact / reviews / join), so the header renders its child links from
 * site-nav.ts directly and this DAL has nothing data-grounded to add.
 */

import { unstable_cache } from 'next/cache'
import { marketVerdict } from '@/lib/market/classify'

import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { getGeoSnapshot } from '@/lib/data/geo/getGeoSnapshot'
import { getMarketPulse } from '@/lib/data/market/getMarketPulse'
import { getMarketStats } from '@/lib/data/market/getMarketStats'
import { getPriceHistory } from '@/lib/data/market/getPriceHistory'
import { getRecentBlogPosts } from '@/lib/data/blog/getRecentBlogPosts'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import {
  CITY_POPULAR_SEARCHES,
  getPopularSearchesForCity,
} from '@/lib/popular-searches'
import { homesForSalePath } from '@/lib/slug'
import type { MoSVerdict } from '@/lib/data/types/market'

// ───────────────────────── Types ─────────────────────────

/** A single "most popular search" link inside a Homes city block. */
export type MegaMenuPopularSearch = {
  /** e.g. "/homes-for-sale/bend/under-750k" */
  href: string
  /** Short label, e.g. "Under $750K". */
  label: string
}

/** One city block in the Homes panel: stats + its top popular searches. */
export type MegaMenuHomesCity = {
  name: string
  citySlug: string
  /** Canonical browse hub for the city, e.g. "/homes-for-sale/bend". */
  href: string
  /** Active SFR count. Omitted (null) if unavailable or non-positive. */
  activeCount: number | null
  /** Median list price in whole dollars. Omitted (null) if unavailable. */
  medianListPrice: number | null
  /** Top popular searches for this city (may be empty). */
  popularSearches: MegaMenuPopularSearch[]
}

export type MegaMenuHomes = {
  cities: MegaMenuHomesCity[]
  /** Sum of active counts across the cities shown. Omitted if zero/unknown. */
  totalActiveCount: number | null
}

/** One resort/golf community card in the Communities panel. */
export type MegaMenuCommunity = {
  name: string
  slug: string
  /** Community detail page, e.g. "/communities/tetherow". */
  href: string
  /** Active SFR count. Omitted (null) if unavailable or non-positive. */
  activeCount: number | null
  /** Median list price in whole dollars. Omitted (null) if unavailable. */
  medianListPrice: number | null
  /** Golf-LP image path if one exists for this community, else null. */
  imageSrc: string | null
}

export type MegaMenuCommunities = {
  communities: MegaMenuCommunity[]
}

/** One city card in the Cities panel. */
export type MegaMenuCity = {
  name: string
  citySlug: string
  /** City hub page, e.g. "/cities/bend". */
  href: string
  /** Active SFR count. Omitted (null) if unavailable or non-positive. */
  activeCount: number | null
  /** Median list price in whole dollars. Omitted (null) if unavailable. */
  medianListPrice: number | null
  /** Median days from list to pending. Omitted (null) if unavailable. */
  medianDaysToPending: number | null
}

export type MegaMenuCities = {
  cities: MegaMenuCity[]
}

/** One point on the 12-month price sparkline. */
export type MegaMenuSparkPoint = {
  /** ISO period start (month). */
  periodStart: string
  /** Median sale price for the month. Omitted (null) if unavailable. */
  medianSalePrice: number | null
}

export type MegaMenuMarket = {
  /** Region median list price in whole dollars. Omitted (null) if unavailable. */
  medianListPrice: number | null
  /** Region months of supply. Omitted (null) if unavailable. */
  monthsOfSupply: number | null
  /**
   * Verdict derived from monthsOfSupply against the canonical thresholds
   * (≤4 seller / 4–6 balanced / ≥6 buyer). Omitted (null) when MoS is unknown,
   * so the pill never disagrees with the number.
   */
  marketVerdict: MoSVerdict | null
  /** Region median days on market (active DOM). Omitted (null) if unavailable. */
  avgDaysOnMarket: number | null
  /** Year-over-year median change percent (signed). Omitted (null) if unavailable. */
  yoyPct: number | null
  /** Up-to-12-point median-sale-price sparkline, oldest → newest (may be empty). */
  sparkline: MegaMenuSparkPoint[]
}

export type MegaMenuSell = {
  /** Region median list price in whole dollars. Omitted (null) if unavailable. */
  medianListPrice: number | null
  /** Region verdict (same derivation as the market panel). Omitted if unknown. */
  marketVerdict: MoSVerdict | null
  /** Always-present CTA target for the free valuation flow. */
  valuationHref: string
}

/** One guide/blog link in the Learn panel. */
export type MegaMenuGuide = {
  title: string
  href: string
  /** ISO published date if this is a live blog post, else null (static routes). */
  date: string | null
}

export type MegaMenuLearn = {
  guides: MegaMenuGuide[]
  /** true when `guides` came from live blog data; false when static fallback. */
  isLive: boolean
}

export type MegaMenuData = {
  homes: MegaMenuHomes
  communities: MegaMenuCommunities
  cities: MegaMenuCities
  market: MegaMenuMarket
  sell: MegaMenuSell
  learn: MegaMenuLearn
  /** ISO timestamp when this payload was assembled (for a freshness debug pill). */
  generatedAt: string
}

// ───────────────────── Constants / helpers ─────────────────────

const REGION_SLUG = 'central-oregon'

/**
 * Cities surfaced in the Homes mega-menu, in priority order. Drawn from
 * CITY_POPULAR_SEARCHES (the data-grounded popular-search source of truth) so
 * the Homes panel and the popular searches stay in sync. We keep the top set
 * compact so the panel stays scannable and the cold-cache fan-out stays small.
 */
const HOMES_CITY_SLUGS = ['bend', 'redmond', 'sisters', 'sunriver', 'la-pine'] as const

/** Number of popular searches to show per city block in the Homes panel. */
const POPULAR_PER_CITY = 4

/** Number of resort/golf communities to surface in the Communities panel. */
const COMMUNITIES_LIMIT = 8

/**
 * Verified golf-LP imagery, keyed by community slug. ONLY slugs whose image
 * file is confirmed to exist under public/lp/central-oregon-golf/img/ are
 * listed — a community without a confirmed image gets `imageSrc: null` rather
 * than a broken path. (Confirmed on disk 2026-06-03.)
 */
const GOLF_IMAGE_BY_SLUG: Record<string, string> = {
  tetherow: '/lp/central-oregon-golf/img/tetherow-03.jpg',
  pronghorn: '/lp/central-oregon-golf/img/pronghorn-01.jpg',
  sunriver: '/lp/central-oregon-golf/img/sunriver-river.jpg',
  crosswater: '/lp/central-oregon-golf/img/crosswater-02.jpg',
  'black-butte-ranch': '/lp/central-oregon-golf/img/three-sisters-backdrop.jpg',
  'brasada-ranch': '/lp/central-oregon-golf/img/brasada-02.jpg',
  'eagle-crest': '/lp/central-oregon-golf/img/eagle-crest-01.jpg',
  'awbrey-glen': '/lp/central-oregon-golf/img/awbrey-glen-01.jpg',
  'widgi-creek': '/lp/central-oregon-golf/img/widgi-creek-01.jpg',
}

/** Static buyer/seller guide routes — the Learn fallback when no blog data. */
const STATIC_GUIDES: MegaMenuGuide[] = [
  { title: 'Buyer and seller guides', href: '/guides', date: null },
  { title: 'Resources', href: '/resources', date: null },
  { title: 'Frequently asked questions', href: '/faq', date: null },
  { title: 'Video library', href: '/videos', date: null },
]

/** Display name for a city slug, sourced from CITY_POPULAR_SEARCHES. */
const CITY_NAME_BY_SLUG = new Map(
  CITY_POPULAR_SEARCHES.map((c) => [c.citySlug, c.city]),
)

/** Return n only when it is a finite, positive number; otherwise null (OMIT). */
function positiveOrNull(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * Verdict from months-of-supply against the canonical thresholds
 * (CLAUDE.md §0.4): ≤4 seller's, 4–6 balanced, ≥6 buyer's. Null MoS → null
 * verdict so a pill never appears next to an unknown number.
 */
function verdictFromMoS(mos: number | null): MoSVerdict | null {
  // mos<=0 stays "no verdict"; thresholds via lib/market/classify.ts (audit p0.4b).
  if (mos == null || !Number.isFinite(mos) || mos <= 0) return null
  return marketVerdict(mos).kind as MoSVerdict
}

// ───────────────────────── Builders ─────────────────────────

/**
 * Build one Homes city block. Active count + median come from the geo snapshot
 * MV (one indexed row, well-cached); popular searches come from the static,
 * data-grounded popular-search registry.
 */
async function buildHomesCity(citySlug: string): Promise<MegaMenuHomesCity> {
  const name = CITY_NAME_BY_SLUG.get(citySlug) ?? citySlug
  const snapshot = await getGeoSnapshot({ geoType: 'city', geoKey: citySlug })
  const popular = getPopularSearchesForCity(citySlug, POPULAR_PER_CITY).map(
    (p): MegaMenuPopularSearch => ({ href: p.href, label: p.label }),
  )
  return {
    name,
    citySlug,
    href: homesForSalePath(name),
    activeCount: positiveOrNull(snapshot?.activeSfrCount ?? null),
    medianListPrice: positiveOrNull(snapshot?.medianListPrice ?? null),
    popularSearches: popular,
  }
}

async function buildHomes(): Promise<MegaMenuHomes> {
  const cities = await Promise.all(HOMES_CITY_SLUGS.map((slug) => buildHomesCity(slug)))
  const total = cities.reduce((sum, c) => sum + (c.activeCount ?? 0), 0)
  return { cities, totalActiveCount: positiveOrNull(total) }
}

/**
 * Build one Cities card. Stats from the geo snapshot MV; median days-to-pending
 * from market_pulse_live (carries it, the MV does not).
 */
async function buildCity(citySlug: string): Promise<MegaMenuCity> {
  const name = CITY_NAME_BY_SLUG.get(citySlug) ?? citySlug
  const [snapshot, pulse] = await Promise.all([
    getGeoSnapshot({ geoType: 'city', geoKey: citySlug }),
    getMarketPulse({ geoType: 'city', geoSlug: citySlug }),
  ])
  return {
    name,
    citySlug,
    href: `/cities/${citySlug}`,
    activeCount: positiveOrNull(snapshot?.activeSfrCount ?? null),
    medianListPrice: positiveOrNull(snapshot?.medianListPrice ?? null),
    medianDaysToPending: positiveOrNull(pulse?.medianDaysToPending ?? null),
  }
}

async function buildCities(): Promise<MegaMenuCities> {
  // Same compact city set the Homes panel uses, so both panels stay coherent
  // and the cold-cache fan-out stays bounded.
  const cities = await Promise.all(HOMES_CITY_SLUGS.map((slug) => buildCity(slug)))
  return { cities }
}

/**
 * Build the Communities panel from the resort-community registry (top N), each
 * enriched with live active/median from the geo snapshot MV (community keys are
 * "city:subdivision" lowercase) and a verified golf image where one exists.
 */
async function buildCommunities(): Promise<MegaMenuCommunities> {
  const registry = getAllResortCommunities().slice(0, COMMUNITIES_LIMIT)
  const communities = await Promise.all(
    registry.map(async (entry): Promise<MegaMenuCommunity> => {
      // geo_snapshot_mv community keys are the lowercased DISPLAY names joined
      // as "<city>:<subdivision>" — the exact form app/actions/communities.ts
      // builds for the community detail page (`${city}:${subdivision}` lower).
      // Use entry.label (the subdivision display name), NOT entry.slug, so
      // multi-word communities ("Black Butte Ranch") resolve instead of missing
      // (slug "black-butte-ranch" would never match key "black butte ranch").
      const geoKey = `${entry.city.toLowerCase().trim()}:${entry.label.toLowerCase().trim()}`
      const snapshot = await getGeoSnapshot({ geoType: 'community', geoKey })
      return {
        name: entry.label,
        slug: entry.slug,
        href: `/communities/${entry.slug}`,
        activeCount: positiveOrNull(snapshot?.activeSfrCount ?? null),
        medianListPrice: positiveOrNull(snapshot?.medianListPrice ?? null),
        imageSrc: GOLF_IMAGE_BY_SLUG[entry.slug] ?? null,
      }
    }),
  )
  return { communities }
}

/**
 * Build the Market panel: region pulse for live inventory/MoS, region rolling
 * stats for DOM + YoY, and a 12-point monthly price sparkline.
 */
async function buildMarket(): Promise<MegaMenuMarket> {
  const [pulse, stats, history] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: REGION_SLUG }),
    getMarketStats({ geoType: 'region', geoSlug: REGION_SLUG, periodType: 'rolling_365d' }),
    getPriceHistory('region', REGION_SLUG, 'monthly', 12),
  ])

  const monthsOfSupply = positiveOrNull(pulse?.monthsOfSupply ?? stats?.monthsOfSupply ?? null)
  const sparkline: MegaMenuSparkPoint[] = history.map((p) => ({
    periodStart: p.periodStart,
    medianSalePrice: positiveOrNull(p.medianSalePrice),
  }))

  return {
    medianListPrice: positiveOrNull(pulse?.medianListPrice ?? stats?.medianListPrice ?? null),
    monthsOfSupply,
    marketVerdict: verdictFromMoS(monthsOfSupply),
    // Active days-on-market: pulse carries median_days_to_pending; the rolling
    // stats row carries median DOM for sold homes. Prefer the active signal,
    // fall back to the sold-side DOM.
    avgDaysOnMarket: positiveOrNull(pulse?.medianDaysToPending ?? stats?.medianDaysOnMarket ?? null),
    // YoY can legitimately be negative, so it is NOT routed through
    // positiveOrNull — only null/non-finite is omitted.
    yoyPct:
      stats?.yoyChangePct != null && Number.isFinite(stats.yoyChangePct)
        ? stats.yoyChangePct
        : null,
    sparkline,
  }
}

/** Build the Sell panel from the same region figures. */
async function buildSell(): Promise<MegaMenuSell> {
  const [pulse, stats] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: REGION_SLUG }),
    getMarketStats({ geoType: 'region', geoSlug: REGION_SLUG, periodType: 'rolling_365d' }),
  ])
  const monthsOfSupply = positiveOrNull(pulse?.monthsOfSupply ?? stats?.monthsOfSupply ?? null)
  return {
    medianListPrice: positiveOrNull(pulse?.medianListPrice ?? stats?.medianListPrice ?? null),
    marketVerdict: verdictFromMoS(monthsOfSupply),
    valuationHref: '/sell/valuation',
  }
}

/** Build the Learn panel: latest published blog posts, else static guides. */
async function buildLearn(): Promise<MegaMenuLearn> {
  const posts = await getRecentBlogPosts({ limit: 4 })
  if (posts.length > 0) {
    return {
      guides: posts.map((p): MegaMenuGuide => ({
        title: p.title,
        href: `/blog/${p.slug}`,
        date: p.publishedAt,
      })),
      isLive: true,
    }
  }
  return { guides: STATIC_GUIDES, isLive: false }
}

// ─────────────────── Assemble + cache ───────────────────

async function buildMegaMenuData(): Promise<MegaMenuData> {
  const [homes, communities, cities, market, sell, learn] = await Promise.all([
    buildHomes(),
    buildCommunities(),
    buildCities(),
    buildMarket(),
    buildSell(),
    buildLearn(),
  ])
  return {
    homes,
    communities,
    cities,
    market,
    sell,
    learn,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Cached mega-menu data. Wrapped on the market-stats window (6h) and tagged
 * `market` + `cities-index` + `communities-index` + `blog` so a refresh of any
 * upstream cron flushes the header along with the pages it feeds. The header
 * renders on every page, so this is the cheap path: one Data Cache read.
 *
 * Each underlying DAL has its own short cache and its own poison-null guard, so
 * the only thing this wrapper adds is a single combined snapshot per 6h window.
 */
export const getMegaMenuData = unstable_cache(
  buildMegaMenuData,
  ['mega-menu-data-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'cities-index', 'communities-index', cacheTag.blog],
  },
)
