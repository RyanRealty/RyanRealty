/**
 * getConcessionsQuarterly — detached closings with seller concessions, by
 * close quarter, region-wide. The concessions card in the approved chart room
 * (whole.fragment, Matt 2026-08-19) runs on exactly this cut.
 *
 * reachability: entry-point — /housing-market long-view section (Unit HUB).
 *
 * MECHANISM. sale_pricing_seller_net (service-role) is paged through
 * PostgREST at three columns per row and aggregated in code. This deliberately
 * differs from getCityYearPricing's RPC: the window here is bounded
 * (CONCESSIONS_FROM forward, ~9k detached closings as of 2026-08-19) and the
 * aggregate is a count plus one median, so a migration buys nothing the page
 * can wait on. If the window ever widens to the full table, move this into an
 * RPC like city_year_pricing.
 *
 * §0 trace, same shape as the audited probe (2026-08-19): product_class =
 * 'detached', close_price > 0, close_date >= CONCESSIONS_FROM, grouped by
 * quarter of close_date; "with concessions" is concessions_yn = 'Yes'; the
 * median concession is the continuous median of concessions_amount over the
 * concession rows with an amount above zero (matches SQL percentile_cont).
 *
 * Errors throw so the resilient cache never stores a blip as no-data.
 *
 * IMPORT BY SUB-PATH: `@/lib/data/pricing/getConcessionsQuarterly`.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

/** First quarter shown. The approved room ran 2024Q1 forward. */
export const CONCESSIONS_FROM = '2024-01-01'

/** PostgREST caps a single response at 1,000 rows. */
const PAGE_SIZE = 1000
/** Hard ceiling on pages, so a runaway window cannot loop forever. */
const MAX_PAGES = 40

export type ConcessionsQuarter = {
  /** ISO first day of the quarter, e.g. '2026-04-01'. */
  quarterStart: string
  closings: number
  withConcessions: number
  /** withConcessions / closings. */
  share: number
  /** Continuous median among concession rows with an amount above zero. */
  medianConcession: number | null
}

export type ConcessionCloseRow = {
  close_date: string | null
  concessions_yn: string | null
  concessions_amount: number | string | null
}

/** Pure: 'YYYY-MM-DD' → that date's quarter start, or null when malformed. */
export function quarterStartOf(isoDate: string): string | null {
  const year = isoDate.slice(0, 4)
  const month = Number(isoDate.slice(5, 7))
  if (!/^\d{4}$/.test(year) || !(month >= 1 && month <= 12)) return null
  const qMonth = Math.floor((month - 1) / 3) * 3 + 1
  return `${year}-${String(qMonth).padStart(2, '0')}-01`
}

/** Pure continuous median (mean of the two middles on an even count). */
function continuousMedian(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Pure aggregation, exported for unit tests. Ascending by quarter. */
export function aggregateConcessionQuarters(
  rows: readonly ConcessionCloseRow[],
): ConcessionsQuarter[] {
  const byQuarter = new Map<string, { closings: number; withConcessions: number; amounts: number[] }>()
  for (const row of rows) {
    if (typeof row.close_date !== 'string') continue
    const quarterStart = quarterStartOf(row.close_date)
    if (!quarterStart) continue
    const bucket =
      byQuarter.get(quarterStart) ?? { closings: 0, withConcessions: 0, amounts: [] }
    bucket.closings += 1
    if (row.concessions_yn === 'Yes') {
      bucket.withConcessions += 1
      const amount = Number(row.concessions_amount)
      if (Number.isFinite(amount) && amount > 0) bucket.amounts.push(amount)
    }
    byQuarter.set(quarterStart, bucket)
  }
  return [...byQuarter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarterStart, b]) => ({
      quarterStart,
      closings: b.closings,
      withConcessions: b.withConcessions,
      share: b.closings > 0 ? b.withConcessions / b.closings : 0,
      medianConcession: continuousMedian(b.amounts),
    }))
}

/**
 * Pure: keep only quarters that ended before `todayKey` (a YYYY-MM-DD day key
 * from zonedDateKey, passed in by the page — nothing here reads the clock).
 * A partial quarter drawn beside complete ones reads as a collapse.
 */
export function dropInProgressQuarter(
  quarters: readonly ConcessionsQuarter[],
  todayKey: string,
): ConcessionsQuarter[] {
  const currentQuarter = quarterStartOf(todayKey)
  if (!currentQuarter) return [...quarters]
  return quarters.filter((q) => q.quarterStart < currentQuarter)
}

async function fetchConcessionsQuarterly(): Promise<ConcessionsQuarter[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('getConcessionsQuarterly: Supabase service environment is not set.')
  }
  const sb = createServiceClient()
  const rows: ConcessionCloseRow[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await sb
      .from('sale_pricing_seller_net')
      .select('close_date, concessions_yn, concessions_amount')
      .eq('product_class', 'detached')
      .gt('close_price', 0)
      .gte('close_date', CONCESSIONS_FROM)
      // Stable order makes range paging correct rather than arbitrary.
      .order('close_date', { ascending: true })
      .order('listing_key', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`getConcessionsQuarterly: ${error.message}`)
    const batch = (data ?? []) as ConcessionCloseRow[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return aggregateConcessionQuarters(rows)
}

/** Every quarter from CONCESSIONS_FROM, ascending. One cached pull (6h). */
export const getConcessionsQuarterly = makeResilientCached(
  fetchConcessionsQuarterly,
  ['pricing-concessions-quarterly-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market, 'pricing-facts'] },
  [] as ConcessionsQuarter[],
)
