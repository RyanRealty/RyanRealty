/**
 * Public detached leftover stats (Step 9). 12-month cells plus point pending
 * and inventory age. Does not replace pulse 30-day / this-week figures.
 * Miss omits the stat. Neighborhood leftover is sample-gated; MOS stays off.
 */
import { createServiceClient } from '@/lib/data/client'
import { DEFINITION_ID } from '@/lib/data/market-truth/registry'
import { staleReason } from '@/lib/data/market-truth/getMetric'
import { formatPriceExact } from '@/lib/format/money'

export const PUBLIC_PACE_WINDOW_MONTHS = 12

export const PUBLIC_PACE_STATS = [
  'median_days_to_contract',
  'median_days_to_close',
  'closed_count',
  'new_listings',
  'pct_with_price_cut',
  'median_price_cut_pct',
  'median_sale_to_original_list',
  'median_sale_to_final_list',
  'yoy_median_price',
  'yoy_sold_count',
  'cash_share',
  'median_close',
  'median_ppsf',
  'pending_count',
  'median_age_active_inventory',
] as const

export type PublicPaceStat = (typeof PUBLIC_PACE_STATS)[number]

export type PublicPaceRow = {
  daysToContract: number | null
  daysToClose: number | null
  closedCount: number | null
  newListings: number | null
  priceCutShare: number | null
  medianPriceCut: number | null
  saleToOriginal: number | null
  saleToFinal: number | null
  yoyMedian: number | null
  yoySold: number | null
  cashShare: number | null
  medianClose: number | null
  medianPpsf: number | null
  pendingCount: number | null
  medianAgeActive: number | null
}

export const EMPTY_PUBLIC_PACE: PublicPaceRow = {
  daysToContract: null,
  daysToClose: null,
  closedCount: null,
  newListings: null,
  priceCutShare: null,
  medianPriceCut: null,
  saleToOriginal: null,
  saleToFinal: null,
  yoyMedian: null,
  yoySold: null,
  cashShare: null,
  medianClose: null,
  medianPpsf: null,
  pendingCount: null,
  medianAgeActive: null,
}

export type PublicPaceItem = { key: string; value: string; label: string }

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

type PaceCell = {
  stat_id: string
  value: number | string | null
  period_end: string
  computed_at: string
  complete_through: string
  window_months: number | string
  is_publishable: boolean
}

function preferredWindow(statId: string): number {
  if (statId === 'pending_count' || statId === 'median_age_active_inventory') return 0
  return PUBLIC_PACE_WINDOW_MONTHS
}

function prefer(next: PaceCell, prev: PaceCell): boolean {
  const want = preferredWindow(next.stat_id)
  const wN = Number(next.window_months)
  const wP = Number(prev.window_months)
  if (wN !== wP) {
    if (wN === want) return true
    if (wP === want) return false
    return wN < wP
  }
  const peN = String(next.period_end)
  const peP = String(prev.period_end)
  if (peN !== peP) return peN > peP
  return String(next.computed_at) > String(prev.computed_at)
}

export function formatPaceShare(share: number): string {
  const pct = Math.round(share * 1000) / 10
  return `${pct.toFixed(1)}%`
}

export function formatPaceDelta(share: number): string {
  const pct = Math.round(share * 1000) / 10
  const abs = Math.abs(pct).toFixed(1)
  if (pct > 0) return `+${abs}%`
  if (pct < 0) return `-${abs}%`
  return '0.0%'
}

export function publicPaceHasRow(row: PublicPaceRow): boolean {
  return publicPaceItems(row).length > 0
}

export function publicPaceItems(row: PublicPaceRow): PublicPaceItem[] {
  const items: PublicPaceItem[] = []
  if (row.pendingCount != null) {
    items.push({ key: 'pending', value: row.pendingCount.toLocaleString('en-US'), label: 'pending · now' })
  }
  if (row.medianAgeActive != null) {
    items.push({
      key: 'age',
      value: String(row.medianAgeActive),
      label: 'days median age of actives · now',
    })
  }
  if (row.daysToContract != null) {
    items.push({ key: 'dtc', value: String(row.daysToContract), label: 'days to contract · 12 months' })
  }
  if (row.closedCount != null) {
    items.push({
      key: 'closed',
      value: row.closedCount.toLocaleString('en-US'),
      label: 'closed sales · 12 months',
    })
  }
  if (row.medianClose != null) {
    items.push({
      key: 'medClose',
      value: formatPriceExact(row.medianClose),
      label: 'median close · 12 months',
    })
  }
  if (row.medianPpsf != null) {
    items.push({
      key: 'ppsf',
      value: formatPriceExact(row.medianPpsf),
      label: 'median close per sq ft · 12 months',
    })
  }
  if (row.newListings != null) {
    items.push({
      key: 'new',
      value: row.newListings.toLocaleString('en-US'),
      label: 'new listings · 12 months',
    })
  }
  if (row.priceCutShare != null) {
    items.push({
      key: 'cut',
      value: formatPaceShare(row.priceCutShare),
      label: 'closed with a price cut · 12 months',
    })
  }
  if (row.medianPriceCut != null) {
    items.push({
      key: 'cutSize',
      value: formatPaceShare(row.medianPriceCut),
      label: 'median price cut · 12 months',
    })
  }
  if (row.saleToOriginal != null) {
    items.push({
      key: 'sto',
      value: formatPaceShare(row.saleToOriginal),
      label: 'sale to original list · 12 months',
    })
  }
  if (row.saleToFinal != null) {
    items.push({
      key: 'stf',
      value: formatPaceShare(row.saleToFinal),
      label: 'sale to final list · 12 months',
    })
  }
  if (row.cashShare != null) {
    items.push({
      key: 'cash',
      value: formatPaceShare(row.cashShare),
      label: 'cash closes · 12 months',
    })
  }
  if (row.daysToClose != null) {
    items.push({ key: 'close', value: String(row.daysToClose), label: 'days to close · 12 months' })
  }
  if (row.yoyMedian != null) {
    items.push({
      key: 'yoy',
      value: formatPaceDelta(row.yoyMedian),
      label: 'YoY median close · 12 months',
    })
  }
  if (row.yoySold != null) {
    items.push({
      key: 'yoySold',
      value: formatPaceDelta(row.yoySold),
      label: 'YoY closed sales · 12 months',
    })
  }
  return items
}

export async function getPublicDetachedPace(opts: {
  geoType: 'city' | 'region' | 'zip' | 'neighborhood'
  geoSlug: string
}): Promise<PublicPaceRow> {
  const geoSlug = hyphenSlug(opts.geoSlug)
  if (!geoSlug) return { ...EMPTY_PUBLIC_PACE }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('market_metric')
    .select('stat_id, value, period_end, computed_at, complete_through, window_months, is_publishable')
    .eq('definition_id', DEFINITION_ID)
    .eq('geo_type', opts.geoType)
    .eq('geo_slug', geoSlug)
    .eq('segment', 'detached')
    .in('stat_id', [...PUBLIC_PACE_STATS])
    .eq('is_publishable', true)
    .not('value', 'is', null)

  if (error) throw new Error(`getPublicDetachedPace: ${error.message}`)

  const best = new Map<string, PaceCell>()
  for (const raw of (data ?? []) as PaceCell[]) {
    if (
      staleReason({
        completeThrough: String(raw.complete_through ?? ''),
        periodEnd: String(raw.period_end ?? ''),
        windowMonths: Number(raw.window_months),
      })
    ) {
      continue
    }
    const prev = best.get(raw.stat_id)
    if (!prev || prefer(raw, prev)) best.set(raw.stat_id, raw)
  }

  const pick = (id: PublicPaceStat) => asNumber(best.get(id)?.value)
  const closedCount = pick('closed_count')
  const newListings = pick('new_listings')
  const pendingCount = pick('pending_count')
  const priceCutShare = pick('pct_with_price_cut')
  const medianPriceCut = pick('median_price_cut_pct')
  const saleToOriginal = pick('median_sale_to_original_list')
  const saleToFinal = pick('median_sale_to_final_list')
  const cashShare = pick('cash_share')
  const medianClose = pick('median_close')
  const medianPpsf = pick('median_ppsf')
  const daysToContract = pick('median_days_to_contract')
  const daysToClose = pick('median_days_to_close')
  const medianAgeActive = pick('median_age_active_inventory')

  return {
    daysToContract: daysToContract == null ? null : Math.round(daysToContract),
    daysToClose: daysToClose == null ? null : Math.round(daysToClose),
    closedCount: closedCount == null || closedCount <= 0 ? null : Math.round(closedCount),
    newListings: newListings == null || newListings <= 0 ? null : Math.round(newListings),
    priceCutShare: priceCutShare == null || priceCutShare <= 0 ? null : priceCutShare,
    medianPriceCut: medianPriceCut == null || medianPriceCut <= 0 ? null : medianPriceCut,
    saleToOriginal: saleToOriginal == null || saleToOriginal <= 0 ? null : saleToOriginal,
    saleToFinal: saleToFinal == null || saleToFinal <= 0 ? null : saleToFinal,
    yoyMedian: pick('yoy_median_price'),
    yoySold: pick('yoy_sold_count'),
    cashShare: cashShare == null || cashShare <= 0 ? null : cashShare,
    medianClose: medianClose == null || medianClose <= 0 ? null : medianClose,
    medianPpsf: medianPpsf == null || medianPpsf <= 0 ? null : medianPpsf,
    pendingCount: pendingCount == null || pendingCount <= 0 ? null : Math.round(pendingCount),
    medianAgeActive: medianAgeActive == null ? null : Math.round(medianAgeActive),
  }
}
