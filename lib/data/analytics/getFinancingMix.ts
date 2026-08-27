/**
 * getFinancingMix — how homes here actually get bought, by financing method.
 *
 * WHY THIS EXISTS. The 2026-08-27 six-brokerage competitor sweep found that no
 * local Bend competitor publishes financing mix as data: Ladd states one
 * cash-share sentence a month in prose; the other five publish nothing. We hold
 * it for every CO closed sale (buyer_financing coverage 81.1%, measured), and
 * the annual mart drops the field — so this is the pipeline step that turns it
 * into a publishable stat: RPC aggregate -> this DAL reader -> a page figure
 * with the trace.
 *
 * The RPC (analytics_financing_mix_co) owns the normalisation: the source field
 * arrives in TWO formats ('Cash' and '{"Cash": true}'), and grouped naively the
 * same method splits into two rows and every share is wrong -- Conventional
 * reads 32% when it is 56.5% (Bend, last 365d, measured 2026-08-27). VA is
 * word-boundary matched so 'Private' cannot count toward it.
 *
 * The window is DAYS, not a calendar year, so the figure is a rolling 12 months
 * and never a partial-year comparison (CLAUDE.md section 0).
 */
import 'server-only'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

const InputSchema = z.object({
  /** Canonical city proper ('Bend'). Omit for the whole service area. */
  city: z.string().trim().min(1).max(60).optional(),
  /** Rolling window; the RPC clamps to 30..1830. */
  days: z.number().int().min(30).max(1830).default(365),
})
export type FinancingMixInput = z.input<typeof InputSchema>

export type FinancingMixRow = {
  financing: 'Conventional' | 'Cash' | 'FHA' | 'USDA' | 'VA' | 'Other'
  sales: number
  pctOfSales: number
  medianDaysToPending: number | null
  /** 0..1+ ratio, as stored; the caller formats (96.9%). */
  medianSaleToList: number | null
}

export type FinancingMixResult = {
  rows: FinancingMixRow[]
  /** Sales the mix covers — the denominator, for the trace. */
  totalSales: number
  city: string | null
  days: number
  source: 'rpc' | 'empty'
  computedAt: string
}

const FIN = ['Conventional', 'Cash', 'FHA', 'USDA', 'VA', 'Other'] as const

async function fetchFinancingMix(input: FinancingMixInput): Promise<FinancingMixResult> {
  const f = InputSchema.parse(input)
  const sb = supabaseAnon()
  if (!sb) throw new Error('[getFinancingMix] no supabase client (missing env)')
  const { data, error } = await sb.rpc('analytics_financing_mix_co', {
    p_city: f.city ?? null,
    p_days: f.days,
  })
  if (error) throw new Error(`[getFinancingMix rpc] ${error.message}`)

  const rows: FinancingMixRow[] = (Array.isArray(data) ? data : [])
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .flatMap((r) => {
      const financing = FIN.find((x) => x === r.financing)
      const sales = Number(r.sales)
      if (!financing || !Number.isFinite(sales) || sales <= 0) return []
      const num = (v: unknown) => (v == null || Number.isNaN(Number(v)) ? null : Number(v))
      return [{
        financing,
        sales,
        pctOfSales: Number(r.pct_of_sales) || 0,
        medianDaysToPending: num(r.median_days_to_pending),
        medianSaleToList: num(r.median_sale_to_list),
      }]
    })

  return {
    rows,
    totalSales: rows.reduce((s, r) => s + r.sales, 0),
    city: f.city ?? null,
    days: f.days,
    source: rows.length > 0 ? 'rpc' : 'empty',
    computedAt: new Date().toISOString(),
  }
}

export const getFinancingMix = makeResilientCached(
  fetchFinancingMix,
  ['analytics-financing-mix-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-financing-mix'],
  },
  {
    rows: [],
    totalSales: 0,
    city: null,
    days: 365,
    source: 'empty' as const,
    computedAt: '',
  },
)
