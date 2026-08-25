/**
 * Public detached leftover stats (Step 9). 12-month cells plus point pending
 * and inventory age, plus HUD 30-day closed count and 90-day days-to-contract
 * (list-to-pending). Does not map 12-month days-to-contract onto DTP.
 * Miss omits the stat. Neighborhood leftover is sample-gated; MOS stays off.
 * Figures go through getMetrics.
 */
import { getMetrics, type MetricResult } from '@/lib/data/market-truth/getMetric'
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
  'closed_count_30d',
  'new_listings_30d',
  'median_days_to_contract_90d',
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
  closedCount30d: number | null
  newCount30d: number | null
  daysToPending90d: number | null
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
  closedCount30d: null,
  newCount30d: null,
  daysToPending90d: null,
}

export type PublicPaceItem = { key: string; value: string; label: string }

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function paceWindow(statId: string): number {
  if (
    statId === 'pending_count' ||
    statId === 'median_age_active_inventory' ||
    statId === 'closed_count_30d' ||
    statId === 'new_listings_30d' ||
    statId === 'median_days_to_contract_90d'
  ) {
    return 0
  }
  return PUBLIC_PACE_WINDOW_MONTHS
}

function publishedNumber(cell: MetricResult | null | undefined): number | null {
  if (!cell?.isPublishable || cell.value == null) return null
  return cell.value
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

  const inputs = PUBLIC_PACE_STATS.map((stat) => ({
    stat,
    geoType: opts.geoType,
    geoSlug,
    segment: 'detached',
    windowMonths: paceWindow(stat),
  }))
  const results = await getMetrics(inputs)
  const byStat = new Map<PublicPaceStat, MetricResult>()
  PUBLIC_PACE_STATS.forEach((stat, i) => {
    const result = results[i]
    if (result) byStat.set(stat, result)
  })

  const pick = (id: PublicPaceStat) => publishedNumber(byStat.get(id))
  const closedCount = pick('closed_count')
  const newListings = pick('new_listings')
  const pendingCount = pick('pending_count')
  const closedCount30d = pick('closed_count_30d')
  const newCount30d = pick('new_listings_30d')
  const daysToPending90d = pick('median_days_to_contract_90d')
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
    closedCount30d: closedCount30d == null || closedCount30d <= 0 ? null : Math.round(closedCount30d),
    // D27: a zero new-listings count is a real answer (nothing came on market), but it is
    // not a figure worth a tile, so it omits like the other counts rather than printing 0.
    newCount30d: newCount30d == null || newCount30d <= 0 ? null : Math.round(newCount30d),
    daysToPending90d: daysToPending90d == null ? null : Math.round(daysToPending90d),
  }
}
