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
  return (data as MarketReportRow | null) ?? null
}

export const getMarketReportBySlug = makeResilientCached(
  _getMarketReportBySlugUncached,
  ['market-report-by-slug-v1'],
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
