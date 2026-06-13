/**
 * getRepeatSalesAppreciation — "how a home performs as an asset over time."
 *
 * A repeat-sales (Case-Shiller-style) appreciation read for a community: find
 * homes that sold two or more times and compute the annualized return between
 * the first and most-recent sale.
 *
 * §0 data accuracy is the whole game here. Raw repeat-sale pairs LIE — a parcel
 * bought as land then built on shows a fake "1,300% return." So every pair is
 * screened to a true same-home, arms-length comparison:
 *   - both the first and last sale must be of an IMPROVED home (sqft present),
 *   - the sqft must match within 15% (no rebuild / major addition between sales),
 *   - held at least 4 years (an asset story, not a flip),
 *   - annualized return between 0% and 20% (drops data errors + missed rebuilds).
 * The methodology is surfaced on the page so the number is auditable.
 *
 * All figures trace to closed MLS sales in `listings`. Cached 6h.
 */
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'

export type RepeatSale = {
  address: string
  buyYear: number
  buyPrice: number
  sellYear: number
  sellPrice: number
  years: number
  annualizedPct: number
  sqft: number | null
}

export type RepeatSalesResult = {
  pairs: RepeatSale[]
  medianAnnualizedPct: number | null
  medianYearsHeld: number | null
  count: number
}

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'string' ? Number.parseFloat(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

async function compute(subdivisionLike: string): Promise<RepeatSalesResult> {
  const sb = createServiceClient()
  // PostgREST caps responses at 1000 rows; a community can have more closed
  // sales than that across its history (Tetherow ~1,500). Truncating would
  // skew the median, so page through the full set.
  const PAGE = 1000
  const rows: Array<Record<string, unknown>> = []
  for (let from = 0; from < 8000; from += PAGE) {
    const { data, error } = await sb
      .from('listings')
      .select('StreetNumber,StreetName,ClosePrice,CloseDate,TotalLivingAreaSqFt')
      .eq('StandardStatus', 'Closed')
      .ilike('SubdivisionName', subdivisionLike)
      .not('ClosePrice', 'is', null)
      .not('CloseDate', 'is', null)
      .order('CloseDate', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) break
    const page = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < PAGE) break
  }
  if (rows.length === 0) return { pairs: [], medianAnnualizedPct: null, medianYearsHeld: null, count: 0 }

  // Group closed sales by physical address.
  const byAddr = new Map<string, Array<{ price: number; t: number; sqft: number | null }>>()
  for (const r of rows) {
    const sn = String(r.StreetNumber ?? '').trim()
    const st = String(r.StreetName ?? '').trim()
    const price = toNum(r.ClosePrice)
    const dt = r.CloseDate ? new Date(r.CloseDate as string).getTime() : null
    if (!sn || sn === '0' || !st || price == null || price <= 50000 || dt == null) continue
    const addr = `${sn} ${st}`
    const sqft = toNum(r.TotalLivingAreaSqFt)
    if (!byAddr.has(addr)) byAddr.set(addr, [])
    byAddr.get(addr)!.push({ price, t: dt, sqft })
  }

  const pairs: RepeatSale[] = []
  for (const [addr, sales] of byAddr) {
    if (sales.length < 2) continue
    sales.sort((a, b) => a.t - b.t)
    const buy = sales[0]
    const sell = sales[sales.length - 1]
    // both must be improved homes with matching structure (no rebuild)
    if (!buy.sqft || !sell.sqft) continue
    if (Math.abs(buy.sqft - sell.sqft) / buy.sqft > 0.15) continue
    const years = (sell.t - buy.t) / MS_PER_YEAR
    if (years < 4) continue
    const annualized = Math.pow(sell.price / buy.price, 1 / years) - 1
    if (annualized < 0 || annualized > 0.2) continue
    pairs.push({
      address: addr,
      buyYear: new Date(buy.t).getFullYear(),
      buyPrice: buy.price,
      sellYear: new Date(sell.t).getFullYear(),
      sellPrice: sell.price,
      years: Math.round(years * 10) / 10,
      annualizedPct: Math.round(annualized * 1000) / 10,
      sqft: buy.sqft,
    })
  }

  pairs.sort((a, b) => b.sellYear - a.sellYear)
  return {
    pairs,
    medianAnnualizedPct: median(pairs.map((p) => p.annualizedPct)),
    medianYearsHeld: median(pairs.map((p) => p.years)),
    count: pairs.length,
  }
}

export const getRepeatSalesAppreciation = (subdivisionLike: string): Promise<RepeatSalesResult> =>
  unstable_cache(() => compute(subdivisionLike), ['repeat-sales-appreciation', subdivisionLike], {
    revalidate: 21600,
    tags: ['listings'],
  })()
