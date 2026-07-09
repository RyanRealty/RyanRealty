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
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// design-audit #125: this used to fill four generic-advice sections ("What
// buyers should do now," "What sellers should do now," "Neighborhood
// planning checklist") with sentences that only ever changed the city name --
// the exact same real-estate-101 advice for Bend, Redmond, or any of the
// other 9 cities, presented as if it were locally-authored expertise. That's
// a real content-honesty problem (VOICE.md Law 1: show it, don't say it --
// this was SAYING "here's practical guidance for your city" while showing
// nothing city-specific). No template rewrite can fake real local expertise,
// so this generated fallback now only claims what it can actually deliver:
// the live MLS numbers for that city, honestly labeled as a data snapshot.
function buildGuideHtmlFromStats(city: string, stats: CityStatRow): string {
  // Round currency to the nearest $1,000 per brand voice.
  const median =
    stats.median_sale_price != null && Number.isFinite(Number(stats.median_sale_price))
      ? `$${(Math.round(Number(stats.median_sale_price) / 1000) * 1000).toLocaleString()}`
      : null
  const dom =
    stats.median_dom != null && Number.isFinite(Number(stats.median_dom))
      ? `${Math.round(Number(stats.median_dom))} days`
      : null
  const soldCount =
    stats.sold_count != null && Number.isFinite(Number(stats.sold_count))
      ? Math.round(Number(stats.sold_count)).toLocaleString()
      : null
  const period = stats.period_end
    ? new Date(stats.period_end).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'the latest cycle'

  // Only surface stats we actually have. An empty/placeholder figure on a public
  // page reads as broken, so unavailable rows are dropped rather than printed.
  const snapshotRows = [
    median != null ? `<li>Median sale price: ${median}</li>` : '',
    dom != null ? `<li>Median days on market: ${dom}</li>` : '',
    soldCount != null ? `<li>Closed sales in period: ${soldCount}</li>` : '',
  ].filter(Boolean).join('')

  if (!snapshotRows) {
    return `<p>Live single-family sale data for ${city} is being compiled. Check back shortly, or see the current listings directly.</p>`
  }

  return [
    `<p>${city} single-family sales, ${period}. Pulled directly from the regional MLS, not an editorial estimate.</p>`,
    '<h2>Market snapshot</h2>',
    `<ul>${snapshotRows}</ul>`,
    `<p>For neighborhood-level detail, current active listings, and a broker who can answer questions specific to ${city}, ` +
      `<a href="/homes-for-sale/${cityEntityKey(city)}">browse ${city} homes for sale</a> or ` +
      `<a href="/contact">talk to a broker</a>.</p>`,
  ].join('')
}

function normalizeGuideRowFromStats(stats: CityStatRow): GuideRow {
  const city = slugToTitle(stats.geo_slug)
  // published_at/updated_at must be when this HTML was actually generated, not
  // stats.period_end — period_end is the reporting bucket's boundary (the
  // LAST day of the in-progress month, e.g. 2026-07-31 while today is
  // 2026-07-08), so using it here rendered future dates on the guide card's
  // "updated" signal and in the Article JSON-LD dateModified (design-audit
  // #151 follow-up: caught when the guides index started surfacing this
  // field visibly for the first time).
  const generatedAt = new Date().toISOString()
  return {
    id: `generated-${cityEntityKey(city)}`,
    slug: `${cityEntityKey(city)}-housing-market-guide`,
    // Slug keeps "-housing-market-guide" for URL stability (existing links,
    // sitemap, search index); title is honest about what this actually is.
    title: `${city} Housing Market Snapshot`,
    meta_description: `Live single-family market data for ${city}: median sale price, days on market, and closed sales, pulled directly from the regional MLS.`,
    content_html: buildGuideHtmlFromStats(city, stats),
    category: 'Market Guides',
    city,
    status: 'published',
    published_at: generatedAt,
    updated_at: generatedAt,
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

  if (error) {
    // The stats-generated fallback must be reachable on a FAILED query too —
    // before 2026-06-10 a throw here was swallowed by the resilient cache into
    // [], so /guides rendered an empty family for months while the table was
    // missing in prod (migration drift). Degrade to generated guides, log loud.
    console.error(`[getPublishedGuides] ${error.message} — serving stats-generated guides`)
    return getGeneratedGuidesFromStats(12)
  }
  const rows = (data ?? []) as GuideRow[]
  if (rows.length > 0) return rows
  return getGeneratedGuidesFromStats(12)
}

export const getPublishedGuides = makeResilientCached(
  _getPublishedGuidesUncached,
  // v3 (design-audit #125): generated-guide content dropped the generic
  // "advice" boilerplate (identical across all 11 cities) for an honest
  // live-data-only snapshot — evicts v2 rows carrying the old template.
  ['published-guides-v3'],
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
  // v3 — same fix as getPublishedGuides (honest live-data-only content).
  ['guide-by-slug-v3'],
  { revalidate: CACHE_WINDOWS.blog, tags: ['guides'] },
  null,
)
