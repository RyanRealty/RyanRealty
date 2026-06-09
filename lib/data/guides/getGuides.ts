/**
 * getGuides / getGuideBySlug — published guides from the `guides` table,
 * with a generated fallback from market_stats_cache for cities that have
 * no authored guide yet.
 *
 * Pattern mirrors app/actions/guides.ts but wrapped in unstable_cache so
 * /guides and /guides/[slug] do not hit the DB per-request.
 *
 * No-poison: inner fetches throw on Supabase error; makeResilientCached
 * retries once uncached before falling back to []/null.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cityEntityKey } from '@/lib/slug'
import { getMarketStatsCacheRowsByGeoType } from '@/lib/data/market/getMarketStatsCacheRows'

export type GuideRow = {
  id: string
  slug: string
  title: string
  meta_description: string | null
  content_html: string
  category: string | null
  city: string | null
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  updated_at: string
}

const GUIDE_SELECT =
  'id, slug, title, meta_description, content_html, category, city, status, published_at, updated_at'

// ── Generated guide helpers (replicated from the action for self-containment) ──

type CityStatRow = {
  geo_slug: string
  median_sale_price: number | null
  median_dom: number | null
  sold_count: number | null
  period_end: string | null
}

function slugToTitle(slug: string): string {
  return slug
    .trim()
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildGuideHtmlFromStats(city: string, stats: CityStatRow): string {
  const median =
    stats.median_sale_price != null && Number.isFinite(Number(stats.median_sale_price))
      ? `$${Math.round(Number(stats.median_sale_price)).toLocaleString()}`
      : 'Data unavailable'
  const dom =
    stats.median_dom != null && Number.isFinite(Number(stats.median_dom))
      ? `${Math.round(Number(stats.median_dom))} days`
      : 'Data unavailable'
  const soldCount =
    stats.sold_count != null && Number.isFinite(Number(stats.sold_count))
      ? Math.round(Number(stats.sold_count)).toLocaleString()
      : 'Data unavailable'
  const period = stats.period_end
    ? new Date(stats.period_end).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'the latest cycle'

  return [
    `<p>${city} remains one of Central Oregon's most competitive markets. This guide is based on local listing and sold data from ${period} and is designed to help buyers and sellers make practical decisions.</p>`,
    '<h2>Market snapshot</h2>',
    `<ul><li>Median sale price: ${median}</li><li>Median days on market: ${dom}</li><li>Closed sales in period: ${soldCount}</li></ul>`,
    '<h2>What buyers should do now</h2>',
    `<p>In ${city}, homes that are priced correctly still move quickly in the most active ranges. Buyers should lock financing early, track new inventory daily, and write offers that match current demand in the exact neighborhood they target.</p>`,
    '<h2>What sellers should do now</h2>',
    `<p>Sellers in ${city} should focus on launch quality and realistic pricing. Strong photography, clean presentation, and pre-listing prep continue to improve first-week momentum and reduce later price adjustments.</p>`,
    '<h2>Neighborhood planning checklist</h2>',
    `<p>Before deciding where to buy, compare commute patterns, lot sizes, HOA rules, and resale liquidity between neighborhoods. In ${city}, those differences can materially change both monthly costs and long-term flexibility.</p>`,
  ].join('')
}

function normalizeGuideRowFromStats(stats: CityStatRow): GuideRow {
  const city = slugToTitle(stats.geo_slug)
  return {
    id: `generated-${cityEntityKey(city)}`,
    slug: `${cityEntityKey(city)}-housing-market-guide`,
    title: `${city} Housing Market Guide`,
    meta_description: `A practical guide for buying and selling in ${city}, grounded in current pricing, inventory, and pace of sale.`,
    content_html: buildGuideHtmlFromStats(city, stats),
    category: 'Market Guides',
    city,
    status: 'published',
    published_at: stats.period_end,
    updated_at: stats.period_end ?? new Date().toISOString(),
  }
}

async function getGeneratedGuidesFromStats(limit: number): Promise<GuideRow[]> {
  const data = await getMarketStatsCacheRowsByGeoType({
    geoType: 'city',
    periodType: 'monthly',
    limit: Math.max(20, limit * 4),
    columns: 'geo_slug, median_sale_price, median_dom, sold_count, period_end',
  })
  if (!Array.isArray(data)) return []

  const byCity = new Map<string, CityStatRow>()
  for (const row of data as CityStatRow[]) {
    const city = (row.geo_slug ?? '').trim()
    if (!city || byCity.has(city)) continue
    byCity.set(city, row)
    if (byCity.size >= limit) break
  }
  return [...byCity.values()].map(normalizeGuideRowFromStats)
}

// ── Cached readers ──────────────────────────────────────────────────────────

async function _getPublishedGuidesUncached(_limit: number): Promise<GuideRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const { data, error } = await sb
    .from('guides')
    .select(GUIDE_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(200)

  if (error) throw new Error(`[getPublishedGuides] ${error.message}`)
  const rows = (data ?? []) as GuideRow[]
  if (rows.length > 0) return rows
  return getGeneratedGuidesFromStats(12)
}

export const getPublishedGuides = makeResilientCached(
  _getPublishedGuidesUncached,
  ['published-guides-v1'],
  { revalidate: CACHE_WINDOWS.blog, tags: ['guides'] },
  [],
)

async function _getGuideBySlugUncached(slug: string): Promise<GuideRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null

  const { data, error } = await sb
    .from('guides')
    .select(GUIDE_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw new Error(`[getGuideBySlug] ${error.message}`)
  const existing = (data as GuideRow | null) ?? null
  if (existing) return existing

  // Fallback: try generated guides
  const generated = await getGeneratedGuidesFromStats(30)
  return generated.find((guide) => guide.slug === slug) ?? null
}

export const getGuideBySlug = makeResilientCached(
  _getGuideBySlugUncached,
  ['guide-by-slug-v1'],
  { revalidate: CACHE_WINDOWS.blog, tags: ['guides'] },
  null,
)
