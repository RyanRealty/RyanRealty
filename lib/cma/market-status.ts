/**
 * Status-grid and 90-day sold-band math for CMA chapters.
 * Density from an RPR packet. Our grain and our pricing number.
 * Never a ZIP dump. Never an AVM.
 */

import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'

export type CmaStatusBucket = {
  key: 'selected' | 'active' | 'pending' | 'expired' | 'closed'
  label: string
  count: number
  low: number | null
  median: number | null
  high: number | null
  medianPpsf: number | null
  medianDom: number | null
}

export type CmaSoldBand = {
  count: number
  low: number | null
  median: number | null
  high: number | null
  bedsLabel: string
  source: string
}

export type CmaListingTrendPoint = {
  month: string
  newListings: number
  medianAsk: number | null
}

export type CmaMarketArea = {
  grain: 'subdivision' | 'city-similar'
  label: string
  source: string
  priceLo: number
  priceHi: number
  selected: CmaStatusBucket
  active: CmaStatusBucket | null
  pending: CmaStatusBucket | null
  expired: CmaStatusBucket | null
  closed: CmaStatusBucket | null
  sold90: CmaSoldBand | null
  listingTrend: CmaListingTrendPoint[] | null
}

const TERMINAL_OFF = new Set(['Expired', 'Withdrawn', 'Canceled'])

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

export function marketAreaPriceBand(anchor: number): { lo: number; hi: number } | null {
  if (!Number.isFinite(anchor) || anchor < 50_000) return null
  return {
    lo: Math.round((anchor * 0.55) / 1000) * 1000,
    hi: Math.round((anchor * 1.85) / 1000) * 1000,
  }
}

export function similarBedRange(beds: number | null): { lo: number; hi: number } | null {
  if (beds == null || !Number.isFinite(beds) || beds < 1) return null
  return { lo: Math.max(1, beds - 1), hi: beds + 1 }
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function inBand(price: number | null, lo: number, hi: number): boolean {
  return price != null && price >= lo && price <= hi
}

function inBeds(beds: number | null, range: { lo: number; hi: number } | null): boolean {
  if (!range) return true
  return beds != null && beds >= range.lo && beds <= range.hi
}

function rowPrice(row: CmaMarketAreaRow): number | null {
  if (row.StandardStatus === 'Closed') return num(row.ClosePrice)
  return num(row.ListPrice)
}

function rowDom(row: CmaMarketAreaRow): number | null {
  const d = num(row.CumulativeDaysOnMarket) ?? num(row.DaysOnMarket)
  return d != null && d >= 0 ? d : null
}

function rowSqft(row: CmaMarketAreaRow): number | null {
  const s = num(row.TotalLivingAreaSqFt)
  return s != null && s > 0 ? s : null
}

function bucketFrom(
  key: CmaStatusBucket['key'],
  label: string,
  prices: number[],
  ppsfs: number[],
  doms: number[],
): CmaStatusBucket | null {
  if (prices.length === 0) return null
  return {
    key,
    label,
    count: prices.length,
    low: Math.min(...prices),
    median: median(prices),
    high: Math.max(...prices),
    medianPpsf: median(ppsfs),
    medianDom: median(doms),
  }
}

function selectedBucket(comps: CmaAdjustedComp[]): CmaStatusBucket {
  const prices = comps.map((c) => c.closePrice).filter((n) => n > 0)
  const ppsfs = comps.filter((c) => c.closePrice > 0 && c.sqft > 0).map((c) => c.closePrice / c.sqft)
  const doms = comps.map((c) => c.domTotal).filter((n): n is number => n != null && n >= 0)
  return (
    bucketFrom('selected', 'These sales', prices, ppsfs, doms) ?? {
      key: 'selected',
      label: 'These sales',
      count: comps.length,
      low: null,
      median: null,
      high: null,
      medianPpsf: null,
      medianDom: null,
    }
  )
}

function monthKey(iso: string | null | undefined): string | null {
  if (!iso || iso.length < 7) return null
  return iso.slice(0, 7)
}

function listingTrend(rows: CmaMarketAreaRow[], asOf: Date): CmaListingTrendPoint[] | null {
  const months: CmaListingTrendPoint[] = []
  for (let i = 12; i >= 1; i--) {
    const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const opened = rows.filter((r) => monthKey(r.OnMarketDate ?? r.ListDate) === key)
    const asks = opened.map((r) => num(r.ListPrice)).filter((n): n is number => n != null && n > 0)
    months.push({ month: key, newListings: opened.length, medianAsk: median(asks) })
  }
  return months.some((m) => m.newListings > 0) ? months : null
}

export function computeMarketArea(input: {
  rows: CmaMarketAreaRow[]
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  asOf?: Date
}): CmaMarketArea | null {
  const asOf = input.asOf ?? new Date()
  const anchor = input.pricing.recommended || input.subject.lastListPrice
  const band = marketAreaPriceBand(anchor ?? 0)
  if (!band) return null
  const beds = similarBedRange(input.subject.beds)
  const subdivision = input.subject.subdivision?.trim() ?? ''
  const since90 = new Date(asOf.getTime() - 90 * 24 * 3600e3).toISOString().slice(0, 10)

  const inPriceAndBeds = (row: CmaMarketAreaRow) =>
    inBand(rowPrice(row), band.lo, band.hi) && inBeds(num(row.BedroomsTotal), beds)

  const comparable = input.rows.filter(inPriceAndBeds)
  const subRows = subdivision ? comparable.filter((r) => (r.SubdivisionName ?? '').trim() === subdivision) : []
  const subClosed = subRows.filter((r) => r.StandardStatus === 'Closed')
  const useSub = Boolean(subdivision) && subClosed.length >= 5
  const scoped = useSub ? subRows : comparable
  const grain: CmaMarketArea['grain'] = useSub ? 'subdivision' : 'city-similar'
  const bedsLabel =
    beds != null ? `${beds.lo === beds.hi ? beds.lo : `${beds.lo} to ${beds.hi}`} bedroom` : 'similar'
  const label = useSub ? `${subdivision}` : `${bedsLabel} homes in ${input.subject.city}`

  const live = (status: string) => scoped.filter((r) => r.StandardStatus === status)
  const expired = scoped.filter((r) => TERMINAL_OFF.has(r.StandardStatus))
  const closed = scoped.filter((r) => r.StandardStatus === 'Closed')

  const pack = (key: CmaStatusBucket['key'], label: string, rows: CmaMarketAreaRow[]) => {
    const prices = rows.map(rowPrice).filter((n): n is number => n != null && n > 0)
    const ppsfs = rows
      .map((r) => {
        const p = rowPrice(r)
        const s = rowSqft(r)
        return p != null && s != null ? p / s : null
      })
      .filter((n): n is number => n != null)
    const doms = rows.map(rowDom).filter((n): n is number => n != null)
    return bucketFrom(key, label, prices, ppsfs, doms)
  }

  const sold90Rows = closed.filter((r) => (r.CloseDate ?? '') >= since90)
  const sold90Prices = sold90Rows.map((r) => num(r.ClosePrice)).filter((n): n is number => n != null && n > 0)
  const sold90: CmaSoldBand | null =
    sold90Prices.length >= 3
      ? {
          count: sold90Prices.length,
          low: Math.min(...sold90Prices),
          median: median(sold90Prices),
          high: Math.max(...sold90Prices),
          bedsLabel,
          source: `Oregon Data Share MLS. Closed ${bedsLabel} sales in ${label} in the last 90 days.`,
        }
      : null

  return {
    grain,
    label,
    source: `Oregon Data Share MLS. Single-family homes in ${label}, priced ${band.lo} to ${band.hi}, last 12 months. Not the whole ZIP.`,
    priceLo: band.lo,
    priceHi: band.hi,
    selected: selectedBucket(input.comps),
    active: pack('active', 'For sale now', live('Active')),
    pending: pack('pending', 'Under contract', live('Pending')),
    expired: pack('expired', 'Expired or withdrawn', expired),
    closed: pack('closed', 'Closed, last 12 months', closed),
    sold90,
    listingTrend: listingTrend(scoped, asOf),
  }
}
