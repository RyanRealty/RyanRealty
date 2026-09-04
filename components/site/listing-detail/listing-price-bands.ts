/**
 * Closed-sale counts by smart price bands for one leftover grain.
 * Adapted from components/reports/SalesReportCharts.tsx buildPriceBandData:
 * empty tails drop, busy bands split. Do not invent a close. Empty input
 * returns null so the caller omits the chart.
 */
import { v3Text, type V3ChartProps } from '@/components/site/v3'

export type ClosedSalePrice = { price: number | null | undefined }

export type ListingPriceBand = {
  min: number
  max: number
  count: number
  name: string
}

export type LeftoverGrainCloseRow = {
  status: string | null | undefined
  closePrice: number | null | undefined
  city: string | null | undefined
  subdivisionName: string | null | undefined
  propertyType: string | null | undefined
  propertySubType: string | null | undefined
}

const BASE_EDGES_K = [
  0, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1250, 1500, 2000, 3000, 5000,
] as const

function slugifyPlace(raw: string | null | undefined): string {
  return typeof raw === 'string'
    ? raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : ''
}

function isDetachedSfr(row: LeftoverGrainCloseRow): boolean {
  const type = (row.propertyType ?? '').trim().toUpperCase()
  const sub = (row.propertySubType ?? '').trim()
  if (type && type !== 'A') return false
  if (sub && sub !== 'Single Family Residence') return false
  return Boolean(type || sub)
}

export function leftoverClosedFromDate(nowMs = Date.now()): string {
  return new Date(nowMs - 365 * 86_400_000).toISOString().slice(0, 10)
}

export function closedPricesForLeftoverGrain(
  rows: readonly LeftoverGrainCloseRow[],
  grain: { geoType: string; geoSlug: string },
): number[] {
  const want = slugifyPlace(grain.geoSlug)
  if (!want) return []
  const out: number[] = []
  for (const row of rows) {
    if ((row.status ?? '').trim() !== 'Closed') continue
    if (!isDetachedSfr(row)) continue
    const price = row.closePrice
    if (price == null || !(price > 0)) continue
    const city = slugifyPlace(row.city)
    const plat = slugifyPlace(row.subdivisionName)
    if (grain.geoType === 'city') {
      if (city !== want) continue
    } else if (plat !== want && city !== want) {
      continue
    }
    out.push(price)
  }
  return out
}

function formatM(k: number): string {
  const m = k / 1000
  if (Number.isInteger(m)) return String(m)
  return String(Math.round(m * 100) / 100)
}

function formatBandK(k: number): string {
  return k >= 1000 ? `$${formatM(k)}M` : `$${k}K`
}

export function formatPriceBandLabel(min: number, max: number): string {
  const minK = min / 1000
  const maxK = Number.isFinite(max) ? max / 1000 : Infinity
  if (!Number.isFinite(maxK)) return `${formatBandK(minK)}+`
  if (minK === 0) return `under ${formatBandK(maxK)}`
  if (minK >= 1000 && maxK >= 1000) return `$${formatM(minK)}–${formatM(maxK)}M`
  if (minK < 1000 && maxK < 1000) return `$${minK}–${maxK}K`
  if (maxK === 1000) return `${formatBandK(minK)}–$1M`
  return `${formatBandK(minK)}–${formatBandK(maxK)}`
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b)
}

export function buildSmartPriceBandData(
  closed: readonly ClosedSalePrice[],
): ListingPriceBand[] | null {
  const prices = closed
    .map((row) => row.price)
    .filter((p): p is number => p != null && Number.isFinite(p) && p > 0)
  if (prices.length === 0) return null

  let edges = BASE_EDGES_K.map((k) => k * 1000)
  edges.push(Infinity)

  const splits: number[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const min = edges[i]!
    const max = edges[i + 1]!
    const inBand = prices.filter((p) => p >= min && p < max)
    const width = max - min
    if (
      inBand.length >= Math.max(8, prices.length * 0.25) &&
      Number.isFinite(width) &&
      width >= 100_000
    ) {
      const mid = min + width / 2
      const left = inBand.filter((p) => p < mid).length
      const right = inBand.length - left
      if (left >= 2 && right >= 2) splits.push(mid)
    }
  }
  edges = uniqueSorted([...edges.filter((e) => Number.isFinite(e)), ...splits])
  edges.push(Infinity)

  const bands: ListingPriceBand[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const min = edges[i]!
    const max = edges[i + 1]!
    const count = prices.filter((p) => p >= min && p < max).length
    if (count === 0) continue
    bands.push({ min, max, count, name: formatPriceBandLabel(min, max) })
  }
  return bands.length > 0 ? bands : null
}

export function listingPriceBandClaim(grainName: string, bands: readonly ListingPriceBand[]): string | null {
  const name = grainName.trim()
  const n = bands.reduce((sum, band) => sum + band.count, 0)
  if (!name || n <= 0) return null
  const mode = bands.reduce((best, band) => (band.count > best.count ? band : best), bands[0]!)
  if (mode.count === n) return `These ${n} ${name} sales closed in ${mode.name}`
  return `${mode.count} of ${n} ${name} sales closed in ${mode.name}`
}

export function buildListingPriceBandChart(input: {
  grainName: string
  closed: readonly ClosedSalePrice[]
}): V3ChartProps | null {
  const bands = buildSmartPriceBandData(input.closed)
  if (!bands) return null
  const caption = listingPriceBandClaim(input.grainName, bands)
  if (!caption) return null
  return {
    id: 'price-bands',
    caption: v3Text(caption),
    kind: 'bars',
    baselineLabel: v3Text('0'),
    series: [
      {
        name: v3Text('Closed sales'),
        points: bands.map((band) => ({
          value: band.count,
          tick: v3Text(band.name),
          label: v3Text(`${band.count} sold`),
        })),
      },
    ],
  }
}
