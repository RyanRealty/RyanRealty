/**
 * Public place-page extra segments (Step 9). Detached stays the HUD.
 * The mixed all-types bucket is omitted (it double-counts). Lease inventory
 * stays out. Extra types overlay inventory, pending/closed counts, and leftover
 * pace (days to contract, sale to original, YoY, price-cut share).
 * MOS only when publishable and > 0 (0.0 months is not a figure).
 * Neighborhood extra MOS/verdict stay omitted; leftover pace is sample-gated.
 * Leftover days-to-contract is never mapped onto DTP.
 * Miss omits the row. Figures go through getMetrics.
 */
import { getMetrics, type MetricResult } from '@/lib/data/market-truth/getMetric'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPaceDelta, formatPaceShare } from '@/lib/data/market-truth/public-pace'
import { BOARD_STATS, type CitySegmentRow } from '@/lib/data/market-truth/city-segment-collapse'

export {
  PUBLIC_PLACE_SEGMENTS,
  publicSegmentBrowseHref,
  publicSegmentFilterParams,
  publicSegmentNoun,
  publicSegmentVerdictLabel,
  type PublicPlaceSegment,
} from '@/lib/data/market-truth/public-segment-view'
import {
  PUBLIC_PLACE_SEGMENTS,
  publicSegmentBrowseHref,
  publicSegmentFilterParams,
  publicSegmentNoun,
  publicSegmentVerdictLabel,
  type PublicPlaceSegment,
} from '@/lib/data/market-truth/public-segment-view'


export const PUBLIC_SEGMENT_LEFTOVER_STATS = [
  'median_days_to_contract',
  'median_sale_to_original_list',
  'yoy_median_price',
  'pct_with_price_cut',
] as const

export const PUBLIC_SEGMENT_STATS = [
  ...BOARD_STATS,
  'pending_count',
  'closed_count',
  ...PUBLIC_SEGMENT_LEFTOVER_STATS,
] as const

export type PublicSegmentRow = CitySegmentRow & {
  segment: PublicPlaceSegment
  daysToContract: number | null
  saleToOriginal: number | null
  yoyMedian: number | null
  priceCutShare: number | null
}

function hyphenSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function publicSegmentDisplayBits(row: {
  medianList: number | null
  monthsOfSupply: number | null
  verdict: string | null
  pendingCount?: number | null
  closedCount?: number | null
  daysToContract?: number | null
  saleToOriginal?: number | null
  yoyMedian?: number | null
  priceCutShare?: number | null
}): string[] {
  return [
    row.medianList != null ? formatPriceExact(row.medianList) : null,
    row.monthsOfSupply != null && row.monthsOfSupply > 0
      ? `${formatMonthsOfSupply(row.monthsOfSupply)} months`
      : null,
    publicSegmentVerdictLabel(row.verdict),
    row.pendingCount != null && row.pendingCount >= 1
      ? `${row.pendingCount.toLocaleString('en-US')} under contract now`
      : null,
    row.closedCount != null && row.closedCount >= 1
      ? `${row.closedCount.toLocaleString('en-US')} sold in the last 12 months`
      : null,
    row.daysToContract != null && row.daysToContract > 0
      ? `${Math.round(row.daysToContract)} days to an offer, last 12 months`
      : null,
    row.saleToOriginal != null ? `${formatPaceShare(row.saleToOriginal)} sale to original · 12 months` : null,
    row.yoyMedian != null ? `${formatPaceDelta(row.yoyMedian)} median sale price against a year ago` : null,
    row.priceCutShare != null
      ? `${formatPaceShare(row.priceCutShare)} closed with a price cut · 12 months`
      : null,
  ].filter((bit): bit is string => Boolean(bit))
}

export type PublicSegmentItem = {
  key: PublicPlaceSegment
  value: string
  label: string
  noun: string
  href: string
}

/** Miss omitted. Detached is never here. */
export function publicSegmentItems(
  rows: readonly PublicSegmentRow[],
  citySlug: string | null,
  opts?: { postalCode?: string | null },
): PublicSegmentItem[] {
  const items: PublicSegmentItem[] = []
  for (const row of rows) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    if (!(PUBLIC_PLACE_SEGMENTS as readonly string[]).includes(row.segment)) continue
    const noun = publicSegmentNoun(row.segment, row.activeCount)
    // Top three only (price, months of supply, verdict) — the full nine-stat
    // run was a run-on wall at 390px on every consumer (sell, seller LP, zip,
    // listing context). Detail lives one tap away on the browse href.
    const bits = publicSegmentDisplayBits(row).slice(0, 3)
    items.push({
      key: row.segment,
      value: row.activeCount.toLocaleString('en-US'),
      label: [`${noun} for sale`, ...bits].join(' · '),
      noun,
      href: publicSegmentBrowseHref(citySlug, row.segment, opts),
    })
  }
  return items
}

function leftoverWindow(stat: string): number | undefined {
  return (PUBLIC_SEGMENT_LEFTOVER_STATS as readonly string[]).includes(stat) ? 12 : undefined
}

function publishedNumber(cell: MetricResult | null | undefined): number | null {
  if (!cell?.isPublishable || cell.value == null || cell.value <= 0) return null
  return cell.value
}

/** YoY and sale-to-original can be below 1 (and YoY can be negative). */
function publishedFinite(cell: MetricResult | null | undefined): number | null {
  if (!cell?.isPublishable || cell.value == null || !Number.isFinite(cell.value)) return null
  return cell.value
}

function publishedText(cell: MetricResult | null | undefined): string | null {
  if (!cell?.isPublishable || cell.valueText == null || cell.valueText.trim() === '') return null
  return cell.valueText
}

function pickSampleN(cells: {
  active?: MetricResult | null
  median?: MetricResult | null
  mos?: MetricResult | null
  verdict?: MetricResult | null
}): number | null {
  for (const cell of [cells.mos, cells.active, cells.median, cells.verdict]) {
    if (cell?.isPublishable && Number.isFinite(cell.provenance.sampleN)) return cell.provenance.sampleN
  }
  return null
}

export async function getPublicPlaceSegments(opts: {
  geoType: 'city' | 'region' | 'zip' | 'neighborhood'
  geoSlug: string
}): Promise<PublicSegmentRow[]> {
  const geoSlug = hyphenSlug(opts.geoSlug)
  if (!geoSlug) return []

  const inputs = PUBLIC_PLACE_SEGMENTS.flatMap((segment) =>
    PUBLIC_SEGMENT_STATS.map((stat) => ({
      stat,
      geoType: opts.geoType,
      geoSlug,
      segment,
      windowMonths: leftoverWindow(stat),
    })),
  )
  const results = await getMetrics(inputs)
  const byKey = new Map<string, MetricResult>()
  results.forEach((result, i) => {
    if (!result) return
    const input = inputs[i]
    if (!input) return
    byKey.set(`${input.segment}:${input.stat}`, result)
  })

  const withholdExtraMos = opts.geoType === 'neighborhood'

  const rows: PublicSegmentRow[] = []
  for (const segment of PUBLIC_PLACE_SEGMENTS) {
    const active = byKey.get(`${segment}:active_count`)
    const activeCount = publishedNumber(active)
    if (activeCount == null || activeCount <= 0) continue
    const median = byKey.get(`${segment}:median_list_active`)
    const mos = byKey.get(`${segment}:months_of_supply`)
    const verdict = byKey.get(`${segment}:market_verdict`)
    const pending = publishedNumber(byKey.get(`${segment}:pending_count`))
    const closed = publishedNumber(byKey.get(`${segment}:closed_count`))
    const daysToContract = publishedNumber(byKey.get(`${segment}:median_days_to_contract`))
    rows.push({
      segment,
      activeCount: Math.round(activeCount),
      medianList: publishedNumber(median),
      monthsOfSupply: withholdExtraMos ? null : publishedNumber(mos),
      verdict: withholdExtraMos ? null : publishedText(verdict),
      pendingCount: pending == null || pending < 1 ? null : Math.round(pending),
      closedCount: closed == null || closed < 1 ? null : Math.round(closed),
      daysToContract: daysToContract == null ? null : Math.round(daysToContract),
      saleToOriginal: publishedFinite(byKey.get(`${segment}:median_sale_to_original_list`)),
      yoyMedian: publishedFinite(byKey.get(`${segment}:yoy_median_price`)),
      priceCutShare: publishedFinite(byKey.get(`${segment}:pct_with_price_cut`)),
      sampleN: pickSampleN({ active, median, mos, verdict }),
    })
  }
  return rows
}
