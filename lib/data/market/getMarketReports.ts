/**
 * getMarketReportBySlug / listMarketReports — READ paths for the market_reports
 * table, moved out of app/actions/market-reports.ts into the cached DAL.
 *
 * WRITE paths (upsert, image generation, admin mutations) stay in
 * app/actions/market-reports.ts.
 *
 * No-poison: throws on Supabase error so makeResilientCached never caches
 * null/[] caused by a transient DB outage.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { scopeReportHtml } from '@/lib/market/report-scope'

export type MarketReportRow = {
  slug: string
  period_type: string
  period_start: string
  period_end: string
  title: string
  image_storage_path: string | null
  content_html: string | null
  created_at: string
}

export type MarketReportListItem = {
  slug: string
  title: string
  period_start: string
  period_end: string
  created_at: string
}

async function _getMarketReportBySlugUncached(slug: string): Promise<MarketReportRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null

  const { data, error } = await sb
    .from('market_reports')
    .select('slug, period_type, period_start, period_end, title, image_storage_path, content_html, created_at')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`[getMarketReportBySlug] ${error.message}`)
  const row = (data as MarketReportRow | null) ?? null
  if (!row) return null

  // GEOGRAPHIC SCOPE (§0, 2026-08-19). Seven published bodies carry Southern
  // Oregon and Willamette Valley city sections under a Central Oregon claim —
  // weekly-2026-05-24 stored 38 cities and 274 closings, 26 of those cities
  // out of area. The generator no longer produces them, but stored rows are
  // stored rows, so the scope is enforced on the way out too. Applying it in
  // this reader means every consumer of a report body — the page prose, the
  // opening statistic, any section parser — works from one scoped document
  // and none of them has to remember.
  const scoped = scopeReportHtml(row.content_html)
  if (scoped.removedCities.length > 0) {
    console.warn(
      `[getMarketReportBySlug] ${row.slug}: dropped ${scoped.removedCities.length} out-of-area section(s): ${scoped.removedCities.join(', ')}`,
    )
  }
  return { ...row, content_html: row.content_html == null ? null : scoped.html }
}

// v2 key: the data cache survives deploys, so without the bump the unscoped
// bodies stay served for a full revalidate window after the fix ships.
export const getMarketReportBySlug = makeResilientCached(
  _getMarketReportBySlugUncached,
  ['market-report-by-slug-v2'],
  { revalidate: CACHE_WINDOWS.marketReport, tags: [cacheTag.market] },
  null,
)

async function _listMarketReportsUncached(limit: number): Promise<MarketReportListItem[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const { data, error } = await sb
    .from('market_reports')
    .select('slug, title, period_start, period_end, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`[listMarketReports] ${error.message}`)
  return (data ?? []) as MarketReportListItem[]
}

export const listMarketReports = makeResilientCached(
  _listMarketReportsUncached,
  ['market-reports-list-v1'],
  { revalidate: CACHE_WINDOWS.marketReport, tags: [cacheTag.market] },
  [],
)

/**
 * Public URL for a report image (storage path in the banners bucket).
 * Pure computation — no DB read, no cache needed.
 */
export function getReportImageUrl(imageStoragePath: string | null): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url?.trim() || !imageStoragePath?.trim()) return null
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/banners/${imageStoragePath}`
}
