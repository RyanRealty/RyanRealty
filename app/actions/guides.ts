'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { cityEntityKey } from '@/lib/slug'

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

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  return createClient(url, anonKey)
}

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
  const period = stats.period_end ? new Date(stats.period_end).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'the latest cycle'

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

async function getGeneratedGuidesFromStats(limit: number = 12): Promise<GuideRow[]> {
  const supabase = getPublicClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('market_stats_cache')
    .select('geo_slug, median_sale_price, median_dom, sold_count, period_end')
    .eq('geo_type', 'city')
    .eq('period_type', 'monthly')
    .order('period_end', { ascending: false })
    .limit(Math.max(20, limit * 4))
  if (error || !Array.isArray(data)) return []

  const byCity = new Map<string, CityStatRow>()
  for (const row of data as CityStatRow[]) {
    const city = (row.geo_slug ?? '').trim()
    if (!city || byCity.has(city)) continue
    byCity.set(city, row)
    if (byCity.size >= limit) break
  }
  return [...byCity.values()].map(normalizeGuideRowFromStats)
}

export async function getPublishedGuides(): Promise<GuideRow[]> {
  const supabase = getPublicClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, meta_description, content_html, category, city, status, published_at, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(200)
  const rows = (data ?? []) as GuideRow[]
  if (rows.length > 0) return rows
  return getGeneratedGuidesFromStats(12)
}

export async function getGuideBySlug(slug: string): Promise<GuideRow | null> {
  const supabase = getPublicClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, meta_description, content_html, category, city, status, published_at, updated_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  const existing = (data as GuideRow | null) ?? null
  if (existing) return existing
  const generated = await getGeneratedGuidesFromStats(30)
  return generated.find((guide) => guide.slug === slug) ?? null
}

/**
 * Get published guides filtered by city name.
 * Returns DB guides first; falls back to generated guides if none exist.
 * Used by CityClusterNav for topic-cluster interlinking.
 */
async function _getGuidesByCityUncached(city: string): Promise<GuideRow[]> {
  if (!city?.trim()) return []
  const supabase = getPublicClient()
  if (!supabase) return []
  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, meta_description, content_html, category, city, status, published_at, updated_at')
    .eq('status', 'published')
    .ilike('city', city.trim())
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const rows = (data ?? []) as GuideRow[]
  if (rows.length > 0) return rows
  // Fall back to generated guides filtered by city
  const generated = await getGeneratedGuidesFromStats(30)
  return generated.filter(
    (g) => g.city?.trim().toLowerCase() === city.trim().toLowerCase()
  )
}

const _getGuidesByCityCached = unstable_cache(
  _getGuidesByCityUncached,
  ['guides-by-city-v1'],
  { revalidate: 900, tags: ['guides'] }
)

export async function getGuidesByCity(city: string): Promise<GuideRow[]> {
  return _getGuidesByCityCached(city.trim())
}

export async function getAdminGuides(): Promise<GuideRow[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, meta_description, content_html, category, city, status, published_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(300)
  return (data ?? []) as GuideRow[]
}

export async function saveGuide(input: {
  id?: string
  slug: string
  title: string
  metaDescription?: string
  contentHtml: string
  category?: string
  city?: string
  status: 'draft' | 'published' | 'archived'
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient()
  const payload = {
    id: input.id,
    slug: input.slug.trim().toLowerCase(),
    title: input.title.trim(),
    meta_description: input.metaDescription?.trim() || null,
    content_html: input.contentHtml.trim(),
    category: input.category?.trim() || null,
    city: input.city?.trim() || null,
    status: input.status,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('guides').upsert(payload, { onConflict: 'slug' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
