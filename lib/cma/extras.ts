/**
 * CMA report extras (Matt 2026-08-05) — five data-backed sections beyond the
 * comp grid: when-to-list seasonality, live price-band competition,
 * subdivision pulse, buyer-financing profile, and the photo bench. Every
 * figure is computed here deterministically from DAL rows and carries a §0
 * source line; a block whose data cannot be verified returns null and its
 * section simply does not render.
 */

import {
  getCmaCityClosedSkinny,
  getCmaBandInventory,
  getCmaSubdivisionClosed,
  type CmaBandListingRow,
  type CmaClosedSkinnyRow,
  type CmaSubdivisionSaleRow,
} from '@/lib/data/cma/builderReads'
import { pickBandRivals, rivalAddress, type CmaBandRival } from '@/lib/cma/band-rivals'
import { bathCountCompatible, keepSameProductType } from '@/lib/cma/market-area'
import type { CmaAdjustedComp, CmaSubject, CmaPricing } from '@/lib/cma/types'
import { getCmaMarketAreaRows, type CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'
import { computeMarketArea, type CmaMarketArea, type CmaSoldBand } from '@/lib/cma/market-status'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export interface CmaSeasonalityMonth {
  month: number
  monthName: string
  closedCount: number
  medianDaysToPending: number | null
}

export interface CmaSeasonality {
  byMonth: CmaSeasonalityMonth[]
  /** Months (names) with the fastest median days-to-pending among months with n ≥ 12. */
  fastestMonths: string[]
  slowestMonths: string[]
  yearsCovered: number
  totalClosed: number
  source: string
}

export interface CmaBandPosition {
  lo: number
  hi: number
  activeCount: number
  pendingCount: number
  activeMedianAsk: number | null
  activeMedianDom: number | null
  source: string
  /** Named houses in the band. Optional on older rows and listing-plan fixtures. */
  rivals?: CmaBandRival[]
}

export interface CmaSubdivisionPulse {
  name: string
  closedCount: number
  medianClose: number | null
  low: number | null
  high: number | null
  months: number
  source: string
}

export interface CmaFinancingProfile {
  sampleCount: number
  cashPct: number
  conventionalPct: number
  fhaVaPct: number
  otherPct: number
  source: string
}

export interface CmaPhotoBench {
  subjectPhotos: number
  compPhotos: Array<{ address: string; photos: number }>
  compMedianPhotos: number
  source: string
}

export interface CmaSubjectPhotos {
  current: string[]
  historical: string[]
}

export interface CmaLegalFacts {
  parcel?: string | null
  taxlot?: string | null
  owner?: string | null
  timeOwned?: string | null
  vesting?: string | null
  flood?: { zone: string | null; inSFHA: boolean | null } | null
}

export interface CmaOwnershipEvent {
  date: string
  owner?: string | null
  event?: string | null
  price?: number | null
}

export interface CmaPermitFact {
  type: string
  permit: string | null
  status: string | null
}

export interface CmaPropertyFactsOverlay {
  propertyType?: string | null
  fireplaces?: number | null
  stories?: string | null
}

export interface CmaExtras {
  seasonality: CmaSeasonality | null
  band: CmaBandPosition | null
  subdivisionPulse: CmaSubdivisionPulse | null
  financing: CmaFinancingProfile | null
  photoBench: CmaPhotoBench | null
  /** Status grid, 90-day sold band, listing trend. Optional on older rows. */
  marketArea?: CmaMarketArea | null
  /** Same beds and whole baths, last 90 days. Null when the set is thin. */
  sold90?: CmaSoldBand | null
  photos?: CmaSubjectPhotos | null
  legal?: CmaLegalFacts | null
  permits?: CmaPermitFact[] | null
  ownershipHistory?: CmaOwnershipEvent[] | null
  propertyFacts?: CmaPropertyFactsOverlay | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Month-of-year read over the skinny city rows. Months with fewer than 12
 *  closes across the window carry no days-to-pending claim. */
export function computeSeasonality(rows: CmaClosedSkinnyRow[], city: string, sinceIso: string): CmaSeasonality | null {
  if (rows.length < 120) return null
  const buckets: Array<{ count: number; dtp: number[] }> = Array.from({ length: 12 }, () => ({ count: 0, dtp: [] }))
  for (const r of rows) {
    const m = Number(r.CloseDate?.slice(5, 7))
    if (!Number.isFinite(m) || m < 1 || m > 12) continue
    buckets[m - 1].count++
    const d = Number(r.days_to_pending)
    if (Number.isFinite(d) && d >= 0 && d <= 730) buckets[m - 1].dtp.push(d)
  }
  const byMonth: CmaSeasonalityMonth[] = buckets.map((b, i) => ({
    month: i + 1,
    monthName: MONTH_NAMES[i],
    closedCount: b.count,
    medianDaysToPending: b.dtp.length >= 12 ? median(b.dtp) : null,
  }))
  const claimable = byMonth.filter((m) => m.medianDaysToPending != null)
  if (claimable.length < 6) return null
  const ranked = [...claimable].sort((a, b) => a.medianDaysToPending! - b.medianDaysToPending!)
  const years = Math.round(((Date.now() - new Date(sinceIso).getTime()) / (365.25 * 24 * 3600e3)) * 10) / 10
  return {
    byMonth,
    fastestMonths: ranked.slice(0, 2).map((m) => m.monthName),
    slowestMonths: ranked.slice(-2).map((m) => m.monthName),
    yearsCovered: years,
    totalClosed: rows.length,
    source: `Supabase listings, City='${city}', detached (PropertyType='A' AND property_sub_type='Single Family Residence'), Closed, CloseDate ≥ ${sinceIso}: ${rows.length} sales grouped by close month, median days_to_pending per month (months with at least 12 datapoints)`,
  }
}

/** The column ships in TWO live formats (verified 2026-08-05): JSON-keyed
 *  text '{"Cash": true}' on newer syncs and the bare word 'Cash' on older
 *  rows. Normalize both to a key list before classifying. */
export function financingKeys(f: string): string[] {
  const t = f.trim()
  if (t.startsWith('{')) {
    try {
      return Object.keys(JSON.parse(t))
    } catch {
      /* fall through to bare-word handling */
    }
  }
  return [t]
}

/** Cash / conventional / FHA-VA shares from buyer_financing over the last 12
 *  months of the same skinny rows. A sale tagged Cash in any key counts as
 *  cash. */
export function computeFinancing(rows: CmaClosedSkinnyRow[], city: string, sinceIso12: string): CmaFinancingProfile | null {
  const recent = rows.filter((r) => r.CloseDate >= sinceIso12 && r.buyer_financing?.trim())
  if (recent.length < 40) return null
  let cash = 0
  let conventional = 0
  let fhaVa = 0
  let other = 0
  for (const r of recent) {
    const keys = financingKeys(r.buyer_financing ?? '')
    if (keys.includes('Cash')) cash++
    else if (keys.includes('Conventional')) conventional++
    else if (keys.includes('FHA') || keys.includes('VA')) fhaVa++
    else other++
  }
  const pct = (n: number) => Math.round((n / recent.length) * 1000) / 10
  return {
    sampleCount: recent.length,
    cashPct: pct(cash),
    conventionalPct: pct(conventional),
    fhaVaPct: pct(fhaVa),
    otherPct: pct(other),
    source: `Supabase listings, City='${city}', detached (PropertyType='A' AND property_sub_type='Single Family Residence'), Closed, CloseDate ≥ ${sinceIso12}, buyer_financing non-null: ${recent.length} sales`,
  }
}

function finiteOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function rowToRival(row: CmaBandListingRow, status: 'Active' | 'Pending'): CmaBandRival | null {
  const address = rivalAddress(row)
  const listPrice = Number(row.ListPrice)
  if (!address || !Number.isFinite(listPrice) || listPrice <= 0) return null
  return {
    listingKey: row.ListingKey,
    address,
    listPrice,
    status,
    daysOnMarket: daysOnMarketOf(row.OnMarketDate) ?? (Number.isFinite(Number(row.DaysOnMarket)) ? Number(row.DaysOnMarket) : null),
    photoUrl: row.PhotoURL,
    latitude: row.Latitude,
    longitude: row.Longitude,
    beds: finiteOrNull(row.BedroomsTotal),
    baths: finiteOrNull(row.BathroomsTotal),
    sqft: finiteOrNull(row.TotalLivingAreaSqFt),
    yearBuilt: finiteOrNull(row.year_built),
    lotAcres: finiteOrNull(row.lot_size_acres),
    propertySubType: row.property_sub_type ?? null,
  }
}

export function computeBandPosition(
  inv: {
    activeAsks: number[]
    activeDaysOnMarket: number[]
    activeCount: number
    pendingCount: number
    truncated: boolean
    activeRows?: CmaBandListingRow[]
    pendingRows?: CmaBandListingRow[]
  } | null,
  city: string,
  lo: number,
  hi: number,
  subject?: { latitude: number | null; longitude: number | null; propertySubType?: string | null } | null,
): CmaBandPosition | null {
  if (!inv) return null
  const sameType = (row: CmaBandListingRow) =>
    keepSameProductType(subject?.propertySubType ?? null, row.property_sub_type ?? null)
  const hasRows = (inv.activeRows?.length ?? 0) + (inv.pendingRows?.length ?? 0) > 0
  const activeRows = hasRows ? (inv.activeRows ?? []).filter(sameType) : []
  const pendingRows = hasRows ? (inv.pendingRows ?? []).filter(sameType) : []
  const raw = [
    ...activeRows.map((r) => rowToRival(r, 'Active')),
    ...pendingRows.map((r) => rowToRival(r, 'Pending')),
  ].filter((r): r is CmaBandRival => r != null)
  const asks = hasRows
    ? activeRows.map((r) => Number(r.ListPrice)).filter((n) => Number.isFinite(n) && n > 0)
    : inv.activeAsks
  const doms = hasRows
    ? activeRows
        .map((r) => daysOnMarketOf(r.OnMarketDate))
        .filter((n): n is number => n != null)
    : inv.activeDaysOnMarket
  // The DAL pages the whole band, so `activeRows` IS the band and these lengths
  // are real counts rather than a page size. They can still differ from the
  // database counts when the subject has no property sub type, because
  // keepSameProductType() then narrows to detached in JS — so report the
  // filtered length and let the source line say what was measured.
  const typeFiltered = hasRows && activeRows.length !== inv.activeCount
  return {
    lo,
    hi,
    activeCount: hasRows ? activeRows.length : inv.activeCount,
    pendingCount: hasRows ? pendingRows.length : inv.pendingCount,
    activeMedianAsk: median(asks),
    activeMedianDom: median(doms),
    rivals: pickBandRivals(raw, subject),
    source: `Supabase listings, City='${city}', same property type${subject?.propertySubType ? ` (${subject.propertySubType})` : ''}, Active + Pending, ListPrice ${lo}..${hi}, pulled at build time — ${
      inv.truncated
        ? `band exceeded the read ceiling, so these figures cover the first ${activeRows.length} of ${inv.activeCount} active listings`
        : `all ${inv.activeCount} active listings in the band${typeFiltered ? `, ${activeRows.length} after the same-product-type filter` : ''}`
    }; days on market measured from OnMarketDate`,
  }
}

/** Whole days since a listing went on market. Null when the date is unusable. */
function daysOnMarketOf(onMarketDate: string | null | undefined): number | null {
  if (!onMarketDate) return null
  const then = new Date(onMarketDate)
  if (Number.isNaN(then.getTime())) return null
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}

export function computeSubdivisionPulse(
  rows: CmaSubdivisionSaleRow[],
  subdivision: string,
  months: number,
  sinceIso: string,
): CmaSubdivisionPulse | null {
  const prices = rows.map((r) => Number(r.ClosePrice)).filter((n) => Number.isFinite(n) && n > 0)
  if (prices.length < 3) return null
  return {
    name: subdivision,
    closedCount: prices.length,
    medianClose: median(prices),
    low: Math.min(...prices),
    high: Math.max(...prices),
    months,
    source: `Supabase listings, SubdivisionName='${subdivision}', detached (PropertyType='A' AND property_sub_type='Single Family Residence'), Closed, CloseDate ≥ ${sinceIso}: ${prices.length} sales`,
  }
}

/** Closed sales in the last 90 days with the same bedroom count and whole baths. Never a ZIP dump. */
export function computeSold90SameBedsBaths(input: {
  rows: CmaMarketAreaRow[]
  subject: Pick<CmaSubject, 'beds' | 'baths' | 'propertySubType' | 'city' | 'subdivision'>
  asOf?: Date
}): CmaSoldBand | null {
  const asOf = input.asOf ?? new Date()
  const beds = input.subject.beds
  const baths = input.subject.baths
  if (beds == null || !Number.isFinite(beds) || beds < 1) return null
  if (baths == null || !Number.isFinite(baths) || baths <= 0) return null
  const since90 = new Date(asOf.getTime() - 90 * 24 * 3600e3).toISOString().slice(0, 10)
  const wholeBaths = Math.floor(baths)
  const same = input.rows.filter((r) => {
    if (r.StandardStatus !== 'Closed') return false
    if ((r.CloseDate ?? '') < since90) return false
    const price = Number(r.ClosePrice)
    if (!Number.isFinite(price) || price <= 0) return false
    if (Number(r.BedroomsTotal) !== beds) return false
    if (!bathCountCompatible(baths, r.BathroomsTotal)) return false
    if (!keepSameProductType(input.subject.propertySubType, r.property_sub_type ?? null)) return false
    return true
  })
  const subdivision = input.subject.subdivision?.trim() ?? ''
  const sub = subdivision ? same.filter((r) => (r.SubdivisionName ?? '').trim() === subdivision) : []
  const used = sub.length >= 3 ? sub : same
  const prices = used.map((r) => Number(r.ClosePrice)).filter((n) => Number.isFinite(n) && n > 0)
  if (prices.length < 3) return null
  const place = sub.length >= 3 ? subdivision : input.subject.city
  const bedsLabel = `${beds} bedroom / ${wholeBaths} bath`
  return {
    count: prices.length,
    low: Math.min(...prices),
    median: median(prices),
    high: Math.max(...prices),
    bedsLabel,
    source: `Oregon Data Share MLS. Closed ${bedsLabel} sales in ${place} in the last 90 days.`,
  }
}

export function computePhotoBench(subjectPhotos: number | null, comps: CmaAdjustedComp[]): CmaPhotoBench | null {
  if (subjectPhotos == null || subjectPhotos <= 0) return null
  const withCounts = comps
    .filter((c) => c.photosCount != null && c.photosCount > 0)
    .map((c) => ({ address: c.address, photos: c.photosCount as number }))
  if (withCounts.length < 3) return null
  return {
    subjectPhotos,
    compPhotos: withCounts,
    compMedianPhotos: median(withCounts.map((c) => c.photos)) as number,
    source: `Supabase listings photos_count: the subject's last listing vs the ${withCounts.length} sold comps in this report`,
  }
}

const SEASONALITY_MONTHS = 36
const SUBDIVISION_MONTHS = 12
const BAND_HALF_WIDTH_PCT = 0.1

function monthsAgoIso(months: number, asOf: Date): string {
  return new Date(asOf.getTime() - months * 30.44 * 24 * 3600e3).toISOString().slice(0, 10)
}

/**
 * Orchestrator: pulls the three DAL reads in parallel and computes every
 * block. Never throws — a failed block is a null block (§0: cut, don't guess).
 */
export async function buildCmaExtras(args: {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  subjectPhotosCount: number | null
  asOf?: Date
}): Promise<CmaExtras> {
  const asOf = args.asOf ?? new Date()
  const since36 = monthsAgoIso(SEASONALITY_MONTHS, asOf)
  const since12 = monthsAgoIso(SUBDIVISION_MONTHS, asOf)
  const lo = Math.round((args.pricing.recommended * (1 - BAND_HALF_WIDTH_PCT)) / 1000) * 1000
  const hi = Math.round((args.pricing.recommended * (1 + BAND_HALF_WIDTH_PCT)) / 1000) * 1000
  const subdivision = args.subject.subdivision?.trim() ?? ''

  const [skinny, bandInv, subRows, areaRows] = await Promise.all([
    getCmaCityClosedSkinny(args.subject.city, since36).catch(() => []),
    getCmaBandInventory(args.subject.city, lo, hi, args.subject.propertySubType).catch(() => null),
    subdivision ? getCmaSubdivisionClosed(subdivision, since12).catch(() => []) : Promise.resolve([]),
    getCmaMarketAreaRows(args.subject.city, since12).catch(() => []),
  ])

  const photoUrl = args.subject.photoUrl?.trim() ?? ''
  return {
    seasonality: computeSeasonality(skinny, args.subject.city, since36),
    band: computeBandPosition(bandInv, args.subject.city, lo, hi, args.subject),
    subdivisionPulse: subdivision ? computeSubdivisionPulse(subRows, subdivision, SUBDIVISION_MONTHS, since12) : null,
    financing: computeFinancing(skinny, args.subject.city, since12),
    photoBench: computePhotoBench(args.subjectPhotosCount, args.comps),
    marketArea: computeMarketArea({
      rows: areaRows,
      subject: args.subject,
      comps: args.comps,
      pricing: args.pricing,
      asOf,
    }),
    sold90: computeSold90SameBedsBaths({ rows: areaRows, subject: args.subject, asOf }),
    photos: photoUrl ? { current: [photoUrl], historical: [] } : null,
  }
}
