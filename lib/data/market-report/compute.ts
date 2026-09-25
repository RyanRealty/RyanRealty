/**
 * Monthly market report: the write side of the series store.
 *
 * All service-role (migrations 20260925010000_market_report_monthly,
 * 20260925020000_market_report_compact_facts and
 * 20260925040000_market_report_incremental_refresh):
 *   refresh_market_report_listing        one batch of per-listing report attributes
 *   refresh_market_report_listing_since  the same, for listings that moved since a time
 *   refresh_market_report_geo            the geography universe a period writes rows for
 *   refresh_market_report_facts          rebuild the compact sale and span copies
 *   refresh_market_report_facts_since    rebuild them for a window
 *   compute_market_report_period         one period (month, trailing 3 or 12 months,
 *                                        quarter) for every geography and segment
 * and the Market Truth fact refreshes the daily run leans on:
 *   prune_market_fact_sale               drop sale facts whose listing is no longer Closed
 *   refresh_market_fact_sale             upsert sale facts closing (or modified) since a date
 *   refresh_market_fact_listing_span     rebuild on-market episodes, one batch of listings
 *
 * These are called by scripts/market-report-compute.ts (backfill) and by the
 * report crons. Nothing here reads a figure for display; readers live in
 * ./series.ts and ./editions.ts.
 */
import { createServiceClient } from '@/lib/data/client'

export const REPORT_DEFINITION_ID = 'mr-v1'

export type ReportPeriodKind = 'month' | 'trailing3' | 'trailing12' | 'quarter'

export type RefreshListingBatchResult = {
  ok: boolean
  upserted: number
  lastKey: string
  done: boolean
}

export async function refreshMarketReportListingBatch(
  after: string,
  limit = 5000,
): Promise<RefreshListingBatchResult> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('refresh_market_report_listing', { p_after: after, p_limit: limit })
  if (error) throw new Error(`[refreshMarketReportListingBatch] ${error.message}`)
  const d = (data ?? {}) as { ok?: boolean; upserted?: number; last_key?: string; done?: boolean }
  return {
    ok: d.ok === true,
    upserted: Number(d.upserted ?? 0),
    lastKey: String(d.last_key ?? after),
    done: d.done === true,
  }
}

export async function refreshMarketReportGeo(): Promise<number> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('refresh_market_report_geo')
  if (error) throw new Error(`[refreshMarketReportGeo] ${error.message}`)
  return Number((data as { geos?: number } | null)?.geos ?? 0)
}

export async function refreshMarketReportFacts(): Promise<{ sales: number; spans: number; completeThrough: string | null }> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('refresh_market_report_facts')
  if (error) throw new Error(`[refreshMarketReportFacts] ${error.message}`)
  const d = (data ?? {}) as { sales?: number; spans?: number; complete_through?: string }
  return { sales: Number(d.sales ?? 0), spans: Number(d.spans ?? 0), completeThrough: d.complete_through ?? null }
}

export type ComputePeriodResult = {
  ok: boolean
  error?: string
  kind?: ReportPeriodKind
  periodStart?: string
  periodEnd?: string
  rows?: number
  bandRows?: number
  completeThrough?: string
}

export async function computeMarketReportPeriod(
  kind: ReportPeriodKind,
  periodEnd: string,
  opts: { definitionId?: string; acreageMin?: number } = {},
): Promise<ComputePeriodResult> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('compute_market_report_period', {
    p_kind: kind,
    p_period_end: periodEnd,
    p_definition_id: opts.definitionId ?? REPORT_DEFINITION_ID,
    p_acreage_min: opts.acreageMin ?? 1,
  })
  if (error) throw new Error(`[computeMarketReportPeriod ${kind} ${periodEnd}] ${error.message}`)
  const d = (data ?? {}) as Record<string, unknown>
  return {
    ok: d.ok === true,
    error: typeof d.error === 'string' ? d.error : undefined,
    kind: d.kind as ReportPeriodKind | undefined,
    periodStart: typeof d.period_start === 'string' ? d.period_start : undefined,
    periodEnd: typeof d.period_end === 'string' ? d.period_end : undefined,
    rows: typeof d.rows === 'number' ? d.rows : undefined,
    bandRows: typeof d.band_rows === 'number' ? d.band_rows : undefined,
    completeThrough: typeof d.complete_through === 'string' ? d.complete_through : undefined,
  }
}

type BatchJson = { ok?: boolean; upserted?: number; last_key?: string; done?: boolean }

/** Every listing whose report attributes may have moved since `sinceIso` (all batches). */
export async function refreshMarketReportListingSince(sinceIso: string, limit = 5000): Promise<number> {
  const sb = createServiceClient()
  let after = ''
  let total = 0
  for (let i = 0; i < 200; i++) {
    const { data, error } = await sb.rpc('refresh_market_report_listing_since', {
      p_since: sinceIso,
      p_after: after,
      p_limit: limit,
    })
    if (error) throw new Error(`[refreshMarketReportListingSince] ${error.message}`)
    const d = (data ?? {}) as BatchJson
    total += Number(d.upserted ?? 0)
    if (d.done === true) return total
    after = String(d.last_key ?? after)
  }
  throw new Error('[refreshMarketReportListingSince] did not finish in 200 batches')
}

export async function refreshMarketReportFactsSince(
  since: string,
): Promise<{ salesRebuilt: number; spansRebuilt: number; completeThrough: string | null }> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('refresh_market_report_facts_since', { p_since: since })
  if (error) throw new Error(`[refreshMarketReportFactsSince] ${error.message}`)
  const d = (data ?? {}) as { sales_rebuilt?: number; spans_rebuilt?: number; complete_through?: string }
  return {
    salesRebuilt: Number(d.sales_rebuilt ?? 0),
    spansRebuilt: Number(d.spans_rebuilt ?? 0),
    completeThrough: d.complete_through ?? null,
  }
}

/** Drop sale facts closing on or after `since` whose listing is no longer Closed. */
export async function pruneMarketFactSale(since: string): Promise<number> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('prune_market_fact_sale', { p_since: since })
  if (error) throw new Error(`[pruneMarketFactSale] ${error.message}`)
  return Number(data ?? 0)
}

/**
 * Upsert sale facts for closings on or after `since` (and listings modified
 * since). With `until` the window closes before that date and the
 * modified-since clause is off: a year at a time for a historical rebuild,
 * inside the function's 120 s statement limit.
 */
export async function refreshMarketFactSale(since: string, until?: string): Promise<unknown> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc(
    'refresh_market_fact_sale',
    until ? { p_since: since, p_until: until } : { p_since: since },
  )
  if (error) throw new Error(`[refreshMarketFactSale] ${error.message}`)
  return data
}

/** Rebuild on-market episodes for every listing modified since `since` (all batches). */
export async function refreshMarketFactSpans(since: string, limit = 2000): Promise<number> {
  const sb = createServiceClient()
  let after = ''
  let total = 0
  for (let i = 0; i < 500; i++) {
    const { data, error } = await sb.rpc('refresh_market_fact_listing_span', {
      p_after: after,
      p_limit: limit,
      p_modified_since: since,
    })
    if (error) throw new Error(`[refreshMarketFactSpans] ${error.message}`)
    const d = (data ?? {}) as BatchJson
    total += Number(d.upserted ?? 0)
    if (d.done === true) return total
    after = String(d.last_key ?? after)
  }
  throw new Error('[refreshMarketFactSpans] did not finish in 500 batches')
}

/**
 * Rebuild on-market episodes for specific listings (a drift repair's keys).
 *
 * refresh_market_fact_listing_span pages by listing key; with no modified-since
 * filter a page starting just below a key begins at that key. Listing keys are
 * fixed-length digit strings, so the key minus its last character sorts below
 * the key and above every shorter-suffixed sibling but at most nine, and a page
 * of 10 always covers it. Returns the keys a page did not reach (reported by the
 * caller, never silently dropped).
 */
export async function refreshMarketFactSpansForKeys(keys: string[]): Promise<{ rebuilt: number; missed: string[] }> {
  const sb = createServiceClient()
  let rebuilt = 0
  const missed: string[] = []
  for (const key of [...new Set(keys)].sort()) {
    // A dropped connection on one key must not end a long repair run: three tries, 1 and 2 s apart.
    let data: unknown = null
    let error: { message: string } | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await sb.rpc('refresh_market_fact_listing_span', {
          p_after: key.slice(0, -1),
          p_limit: 10,
          p_modified_since: null,
        })
        data = r.data
        error = r.error
      } catch (err) {
        error = { message: err instanceof Error ? err.message : String(err) }
      }
      if (!error) break
      if (attempt < 2) await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)))
    }
    if (error) throw new Error(`[refreshMarketFactSpansForKeys ${key}] ${error.message}`)
    const d = (data ?? {}) as BatchJson
    rebuilt += Number(d.upserted ?? 0)
    if (!(typeof d.last_key === 'string' && d.last_key >= key)) missed.push(key)
  }
  return { rebuilt, missed }
}

/** Refresh report attributes for specific listings (a drift repair's keys), in pages of 1,000. */
export async function upsertMarketReportListings(keys: string[]): Promise<number> {
  const sb = createServiceClient()
  const unique = [...new Set(keys)]
  let total = 0
  for (let i = 0; i < unique.length; i += 1000) {
    const { data, error } = await sb.rpc('market_report_listing_upsert', { p_keys: unique.slice(i, i + 1000) })
    if (error) throw new Error(`[upsertMarketReportListings] ${error.message}`)
    total += Number(data ?? 0)
  }
  return total
}
