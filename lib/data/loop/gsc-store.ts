/**
 * The full-fidelity Search Console store (visibility audit 2026-09-22,
 * TRACK-5 + gsc-trend-1): public.gsc_page_daily (page x date) and
 * public.gsc_query_page_daily (query x page x date), every row GSC returns,
 * each stamped with a page_class and market from ./gsc-page-class.
 *
 * Table + RPC: supabase/migrations/20260923150000_gsc_full_store_loop_measurer.sql.
 * Every reader and writer here degrades to a named "missing" result when that
 * migration is not applied, so the weekly cron no-ops instead of failing.
 *
 * Client-injected (no server-only) so the cron route and the CLIs share it.
 * reachability: entry-point app/api/cron/loop-weekly-measure + scripts/loop-weekly-measure.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { chunkDateRange, pullAllGscRows, type GscApiRow, type GscQueryFn } from './gsc-api'
import {
  classifyGscPage,
  isTrackableQuery,
  normalizeGscPath,
  normalizeGscQuery,
  type GscMarket,
  type GscPageClass,
} from './gsc-page-class'

export const GSC_STORE_MIGRATION = 'supabase/migrations/20260923150000_gsc_full_store_loop_measurer.sql'

type PgError = { code?: string | null; message?: string | null } | null | undefined

/** PostgREST / Postgres "that table or function is not there" (migration not applied). */
export function isMissingRelationError(err: PgError): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === '42883') return true
  return /does not exist|could not find the (table|function)|schema cache/i.test(String(err.message ?? ''))
}

export type GscPageDayRow = {
  date: string
  search_type: string
  page: string
  page_class: GscPageClass
  market: GscMarket
  clicks: number
  impressions: number
  position: number | null
  url_variants: number
}

export type GscQueryPageDayRow = {
  date: string
  search_type: string
  query: string
  page: string
  page_class: GscPageClass
  market: GscMarket
  trackable: boolean
  clicks: number
  impressions: number
  position: number | null
}

type Acc = { clicks: number; impressions: number; posWeight: number; variants: number }

function weighted(a: Acc): number | null {
  return a.impressions > 0 ? Number((a.posWeight / a.impressions).toFixed(2)) : null
}

function add(map: Map<string, Acc>, key: string, r: GscApiRow) {
  const a = map.get(key) ?? { clicks: 0, impressions: 0, posWeight: 0, variants: 0 }
  a.clicks += r.clicks
  a.impressions += r.impressions
  a.posWeight += r.position * r.impressions
  a.variants += 1
  map.set(key, a)
}

/**
 * GSC rows keyed [date, page] -> one row per (date, normalized path). Two raw
 * URLs that normalize to one path (trailing slash, ?utm=, www) fold together:
 * clicks and impressions add, position is impression-weighted.
 */
export function foldPageRows(rows: GscApiRow[], searchType = 'web'): GscPageDayRow[] {
  const map = new Map<string, Acc>()
  for (const r of rows) {
    const date = r.keys[0] ?? ''
    const page = normalizeGscPath(r.keys[1])
    if (!date || !page) continue
    add(map, `${date}\u0000${page}`, r)
  }
  return [...map.entries()].map(([key, a]) => {
    const [date, page] = key.split('\u0000') as [string, string]
    const { pageClass, market } = classifyGscPage(page)
    return {
      date,
      search_type: searchType,
      page,
      page_class: pageClass,
      market,
      clicks: a.clicks,
      impressions: a.impressions,
      position: weighted(a),
      url_variants: a.variants,
    }
  })
}

/** GSC rows keyed [date, query, page] -> one row per (date, query, normalized path). */
export function foldQueryPageRows(rows: GscApiRow[], searchType = 'web'): GscQueryPageDayRow[] {
  const map = new Map<string, Acc>()
  for (const r of rows) {
    const date = r.keys[0] ?? ''
    const query = normalizeGscQuery(r.keys[1])
    const page = normalizeGscPath(r.keys[2])
    if (!date || !query || !page) continue
    add(map, `${date}\u0000${query}\u0000${page}`, r)
  }
  return [...map.entries()].map(([key, a]) => {
    const [date, query, page] = key.split('\u0000') as [string, string, string]
    const { pageClass, market } = classifyGscPage(page)
    return {
      date,
      search_type: searchType,
      query,
      page,
      page_class: pageClass,
      market,
      trackable: isTrackableQuery(query),
      clicks: a.clicks,
      impressions: a.impressions,
      position: weighted(a),
    }
  })
}

export type GscStorePull = {
  startDate: string
  endDate: string
  pageRows: GscPageDayRow[]
  queryPageRows: GscQueryPageDayRow[]
  requests: number
  truncated: boolean
}

/**
 * Pull page x date and query x page x date for an inclusive range, chunked so
 * each request stays well inside one GSC response (a settled day is ~500 to
 * ~1,000 page rows and ~200 query x page rows, probe 2026-09-23).
 */
export async function pullGscStoreRange(
  query: GscQueryFn,
  input: { startDate: string; endDate: string; searchType?: 'web'; chunkDays?: number },
): Promise<GscStorePull> {
  const searchType = input.searchType ?? 'web'
  const pageRaw: GscApiRow[] = []
  const qpRaw: GscApiRow[] = []
  let requests = 0
  let truncated = false
  for (const chunk of chunkDateRange(input.startDate, input.endDate, input.chunkDays ?? 14)) {
    const pages = await pullAllGscRows(query, { ...chunk, searchType, dimensions: ['date', 'page'] })
    const qp = await pullAllGscRows(query, { ...chunk, searchType, dimensions: ['date', 'query', 'page'] })
    pageRaw.push(...pages.rows)
    qpRaw.push(...qp.rows)
    requests += pages.requests + qp.requests
    truncated = truncated || pages.truncated || qp.truncated
  }
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    pageRows: foldPageRows(pageRaw, searchType),
    queryPageRows: foldQueryPageRows(qpRaw, searchType),
    requests,
    truncated,
  }
}

export type GscStoreWrite =
  | { status: 'written'; pages: number; queryPages: number }
  | { status: 'missing'; reason: string }
  | { status: 'error'; reason: string; pages: number; queryPages: number }

async function upsertChunks(
  sb: SupabaseClient,
  table: string,
  onConflict: string,
  rows: object[],
  chunk: number,
): Promise<{ written: number; error: PgError }> {
  let written = 0
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await sb.from(table).upsert(slice, { onConflict })
    if (error) return { written, error }
    written += slice.length
  }
  return { written, error: null }
}

/** Idempotent upsert of a pull (re-pulling a day corrects it in place). */
export async function writeGscStore(
  sb: SupabaseClient,
  pull: Pick<GscStorePull, 'pageRows' | 'queryPageRows'>,
  opts: { chunk?: number } = {},
): Promise<GscStoreWrite> {
  const chunk = opts.chunk ?? 1000
  const fetched_at = new Date().toISOString()
  const pages = await upsertChunks(
    sb,
    'gsc_page_daily',
    'date,search_type,page',
    pull.pageRows.map((r) => ({ ...r, fetched_at })),
    chunk,
  )
  if (pages.error) {
    if (isMissingRelationError(pages.error)) {
      return { status: 'missing', reason: `gsc_page_daily missing: apply ${GSC_STORE_MIGRATION}` }
    }
    return { status: 'error', reason: `gsc_page_daily: ${pages.error.message}`, pages: pages.written, queryPages: 0 }
  }
  const qp = await upsertChunks(
    sb,
    'gsc_query_page_daily',
    'date,search_type,query,page',
    pull.queryPageRows.map((r) => ({ ...r, fetched_at })),
    chunk,
  )
  if (qp.error) {
    if (isMissingRelationError(qp.error)) {
      return { status: 'missing', reason: `gsc_query_page_daily missing: apply ${GSC_STORE_MIGRATION}` }
    }
    return { status: 'error', reason: `gsc_query_page_daily: ${qp.error.message}`, pages: pages.written, queryPages: qp.written }
  }
  return { status: 'written', pages: pages.written, queryPages: qp.written }
}

export type GscStoreCoverage =
  | { status: 'ok'; minDate: string; maxDate: string }
  | { status: 'empty' }
  | { status: 'missing'; reason: string }
  | { status: 'error'; reason: string }

/** First and last stored day (two single-row reads, not an aggregate). */
export async function readGscStoreCoverage(sb: SupabaseClient, searchType = 'web'): Promise<GscStoreCoverage> {
  const [first, last] = await Promise.all([
    sb.from('gsc_page_daily').select('date').eq('search_type', searchType).order('date', { ascending: true }).limit(1),
    sb.from('gsc_page_daily').select('date').eq('search_type', searchType).order('date', { ascending: false }).limit(1),
  ])
  const err = first.error ?? last.error
  if (err) {
    if (isMissingRelationError(err)) return { status: 'missing', reason: `gsc_page_daily missing: apply ${GSC_STORE_MIGRATION}` }
    return { status: 'error', reason: String(err.message) }
  }
  const minDate = (first.data?.[0] as { date?: string } | undefined)?.date
  const maxDate = (last.data?.[0] as { date?: string } | undefined)?.date
  if (!minDate || !maxDate) return { status: 'empty' }
  return { status: 'ok', minDate: String(minDate), maxDate: String(maxDate) }
}

export type GscClassRollupRow = {
  pageClass: string
  market: string
  pages: number
  clicks: number
  impressions: number
  /** Impression-weighted average position; null when the class had no impressions. */
  position: number | null
}

/** Per (page_class, market) totals over an inclusive window, via public.gsc_page_class_rollup. */
export async function readGscClassRollup(
  sb: SupabaseClient,
  start: string,
  end: string,
  searchType = 'web',
): Promise<{ rows: GscClassRollupRow[]; error: string | null; missing: boolean }> {
  const { data, error } = await sb.rpc('gsc_page_class_rollup', {
    p_start: start,
    p_end: end,
    p_search_type: searchType,
  })
  if (error) {
    return {
      rows: [],
      error: isMissingRelationError(error) ? `gsc_page_class_rollup missing: apply ${GSC_STORE_MIGRATION}` : String(error.message),
      missing: isMissingRelationError(error),
    }
  }
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    pageClass: String(r.page_class),
    market: String(r.market),
    pages: Number(r.pages ?? 0),
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    position: r.position == null ? null : Number(r.position),
  }))
  return { rows, error: null, missing: false }
}

/**
 * Clicks and impressions for a set of normalized paths over an inclusive
 * window, from the store. `covered` is false unless the store spans the whole
 * window, because a store that starts mid-window would read as a real drop.
 */
export async function readGscStorePageTotals(
  sb: SupabaseClient,
  paths: string[],
  from: string,
  to: string,
): Promise<
  | { covered: true; clicks: number; impressions: number; rows: number }
  | { covered: false; reason: string }
> {
  const coverage = await readGscStoreCoverage(sb)
  if (coverage.status !== 'ok') {
    return { covered: false, reason: coverage.status === 'empty' ? 'gsc_page_daily is empty' : coverage.reason }
  }
  if (coverage.minDate > from || coverage.maxDate < to) {
    return { covered: false, reason: `gsc_page_daily spans ${coverage.minDate}..${coverage.maxDate}, window needs ${from}..${to}` }
  }
  let clicks = 0
  let impressions = 0
  let rows = 0
  const page = 1000
  for (let offset = 0; ; offset += page) {
    const { data, error } = await sb
      .from('gsc_page_daily')
      .select('date,page,clicks,impressions')
      .eq('search_type', 'web')
      .in('page', paths)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('page', { ascending: true })
      .range(offset, offset + page - 1)
    if (error) return { covered: false, reason: String(error.message) }
    for (const r of data ?? []) {
      clicks += Number((r as { clicks: number }).clicks ?? 0)
      impressions += Number((r as { impressions: number }).impressions ?? 0)
    }
    rows += (data ?? []).length
    if (!data || data.length < page) break
  }
  return { covered: true, clicks, impressions, rows }
}
