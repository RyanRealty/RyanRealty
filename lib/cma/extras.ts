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
  findCmaListingsByMlsNumbers,
  type CmaBandListingRow,
  type CmaClosedSkinnyRow,
  type CmaListingRow,
  type CmaSubdivisionSaleRow,
} from '@/lib/data/cma/builderReads'
import { pickBandRivals, rivalAddress, type CmaBandRival } from '@/lib/cma/band-rivals'
import type { CmaAdjustedComp, CmaSubject, CmaPricing } from '@/lib/cma/types'
import { getCmaMarketAreaRows } from '@/lib/data/cma/marketAreaReads'
import { getPricingSubdivisionCells } from '@/lib/data/pricing/facts'
import { computeMarketArea, type CmaMarketArea } from '@/lib/cma/market-status'
import { resolveParcelRecord, type ParcelRecord } from '@/lib/cma/parcel-record'
import { resolvePurchaseMortgageAssumption } from '@/lib/cma/mortgage-assumption'
import { buildSellerProceeds, type SellerProceeds } from '@/lib/cma/seller-proceeds'
import { parseOwnerNotes } from '@/lib/cma/owner-notes'
import {
  bustZestimate,
  mergeMlsFacts,
  mlsFactsFromPricedComps,
  type ZestimateBust,
  type ZillowSnapshot,
  type MlsCompFact,
} from '@/lib/cma/zestimate-buster'
import {
  liveListingToSale,
  livePassesUsedRungs,
  liveRivalSearchLabel,
  tiersFromUsedNames,
} from '@/lib/pricing/live-rivals'
import { cmaSubjectToPricing } from '@/lib/pricing/subject'
import type { PricingSubject, SubdivisionCell } from '@/lib/pricing/match'

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
  /** Same pricing search as the priced set. Absent on older rows. */
  productLabel?: string | null
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

export interface CmaExtras {
  seasonality: CmaSeasonality | null
  band: CmaBandPosition | null
  subdivisionPulse: CmaSubdivisionPulse | null
  financing: CmaFinancingProfile | null
  photoBench: CmaPhotoBench | null
  /** Status grid and listing trend for admin. Seller HTML does not use the 90-day sold band. */
  marketArea?: CmaMarketArea | null
  /** County deed chain + permits. Optional on older rows. */
  parcel?: ParcelRecord | null
  /** Seller net sheet defaults. Optional on older rows. */
  proceeds?: SellerProceeds | null
  /** Zillow's printed number, graded against closed MLS sales. */
  zillow?: ZestimateBust | null
  /** Owner-reported work on this house. */
  ownerNotes?: string[]
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
    source: `Supabase listings, City='${city}', PropertyType='A', Closed, CloseDate ≥ ${sinceIso}: ${rows.length} sales grouped by close month, median days_to_pending per month (months with at least 12 datapoints)`,
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
    source: `Supabase listings, City='${city}', PropertyType='A', Closed, CloseDate ≥ ${sinceIso12}, buyer_financing non-null: ${recent.length} sales`,
  }
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
    daysOnMarket: row.DaysOnMarket,
    photoUrl: row.PhotoURL,
    latitude: row.Latitude,
    longitude: row.Longitude,
    beds: row.BedroomsTotal ?? null,
    baths: row.BathroomsTotal ?? null,
  }
}

function rowToLiveSale(row: CmaBandListingRow, city: string) {
  const address = rivalAddress(row)
  const sqft = Number(row.TotalLivingAreaSqFt)
  const listPrice = Number(row.ListPrice)
  if (!address || !Number.isFinite(sqft) || sqft < 300 || !Number.isFinite(listPrice) || listPrice <= 0) {
    return null
  }
  return liveListingToSale({
    listingKey: row.ListingKey,
    address,
    city,
    subdivision: row.SubdivisionName,
    latitude: row.Latitude,
    longitude: row.Longitude,
    beds: row.BedroomsTotal,
    baths: row.BathroomsTotal,
    sqft,
    listPrice,
    lotAcres: row.lot_size_acres != null ? Number(row.lot_size_acres) : null,
    yearBuilt: row.year_built != null ? Number(row.year_built) : null,
    levels: row.levels,
    propertySubType: row.property_sub_type,
    water: row.water,
    sewer: row.sewer,
    associationYn: row.association_yn,
    associationFee: row.association_fee ?? row.hoa_monthly,
    newConstruction: row.new_construction_yn,
  })
}

export function computeBandPosition(
  inv: {
    activeAsks: number[]
    activeDaysOnMarket: number[]
    pendingCount: number
    activeRows?: CmaBandListingRow[]
    pendingRows?: CmaBandListingRow[]
  } | null,
  city: string,
  lo: number,
  hi: number,
  opts?: {
    subject?: PricingSubject | null
    tiersUsed?: readonly string[]
    cells?: Map<string, SubdivisionCell>
    asOf?: string
  } | null,
): CmaBandPosition | null {
  if (!inv) return null
  const subject = opts?.subject ?? null
  const tiers = tiersFromUsedNames(opts?.tiersUsed ?? [])
  const asOf = (opts?.asOf ?? new Date().toISOString()).slice(0, 10)
  const cells = opts?.cells ?? new Map()
  const canFilter = Boolean(subject && tiers.length > 0)
  let activeRows = inv.activeRows ?? []
  let pendingRows = inv.pendingRows ?? []
  if (canFilter && subject) {
    const keep = (r: CmaBandListingRow) => {
      const sale = rowToLiveSale(r, city)
      return sale != null && livePassesUsedRungs(subject, sale, tiers, asOf, cells)
    }
    activeRows = activeRows.filter(keep)
    pendingRows = pendingRows.filter(keep)
  }
  const raw = activeRows.map((r) => rowToRival(r, 'Active')).filter((r): r is CmaBandRival => r != null)
  const asks = canFilter
    ? activeRows.map((r) => Number(r.ListPrice)).filter((n) => Number.isFinite(n) && n > 0)
    : inv.activeAsks
  const doms = canFilter
    ? activeRows.map((r) => Number(r.DaysOnMarket)).filter((n) => Number.isFinite(n) && n >= 0)
    : inv.activeDaysOnMarket
  const productLabel = canFilter ? liveRivalSearchLabel(subject?.subdivision, opts?.tiersUsed ?? []) : null
  const rungs = canFilter ? `, pricing rungs ${tiers.map((t) => t.name).join(', ')}` : ''
  return {
    lo,
    hi,
    activeCount: asks.length,
    pendingCount: canFilter ? pendingRows.length : inv.pendingCount,
    activeMedianAsk: median(asks),
    activeMedianDom: median(doms),
    rivals: pickBandRivals(raw, subject),
    productLabel,
    source: `Supabase listings, City='${city}', PropertyType='A', Active${rungs}, pulled at build time`,
  }
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
    source: `Supabase listings, SubdivisionName='${subdivision}', PropertyType='A', Closed, CloseDate ≥ ${sinceIso}: ${prices.length} sales`,
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
export function listingToMlsFact(row: CmaListingRow): MlsCompFact {
  const mlsNumber = String(row.ListNumber ?? '').trim()
  const street = [row.StreetNumber, row.StreetName].filter(Boolean).join(' ')
  return {
    mlsNumber,
    address: street,
    closePrice: row.ClosePrice != null ? Number(row.ClosePrice) : null,
    closeDate: row.CloseDate != null ? String(row.CloseDate).slice(0, 10) : null,
    status: String(row.StandardStatus ?? ''),
    beds: row.BedroomsTotal != null ? Number(row.BedroomsTotal) : null,
    baths: row.BathroomsTotal != null ? Number(row.BathroomsTotal) : null,
    sqft: row.TotalLivingAreaSqFt != null ? Number(row.TotalLivingAreaSqFt) : null,
    yearBuilt: row.year_built != null ? Number(row.year_built) : null,
    subdivision: row.SubdivisionName != null ? String(row.SubdivisionName) : null,
  }
}

export async function buildCmaExtras(args: {
  subject: CmaSubject
  comps: CmaAdjustedComp[]
  pricing: CmaPricing
  subjectPhotosCount: number | null
  asOf?: Date
  tiersUsed?: readonly string[]
  zillow?: ZillowSnapshot | null
  ownerNotes?: readonly string[] | null
  sellerImprovementsText?: string | null
}): Promise<CmaExtras> {
  const asOf = args.asOf ?? new Date()
  const since36 = monthsAgoIso(SEASONALITY_MONTHS, asOf)
  const since12 = monthsAgoIso(SUBDIVISION_MONTHS, asOf)
  const lo = Math.round((args.pricing.recommended * (1 - BAND_HALF_WIDTH_PCT)) / 1000) * 1000
  const hi = Math.round((args.pricing.recommended * (1 + BAND_HALF_WIDTH_PCT)) / 1000) * 1000
  const fetchLo = Math.round((args.pricing.recommended * 0.4) / 1000) * 1000
  const fetchHi = Math.round((args.pricing.recommended * 2.5) / 1000) * 1000
  const pricingSubject = cmaSubjectToPricing(args.subject)
  const sqft = pricingSubject.sqft
  const subdivision = args.subject.subdivision?.trim() ?? ''

  const zillowMls = (args.zillow?.publishedComps ?? [])
    .map((c) => c.mlsNumber?.trim())
    .filter((n): n is string => Boolean(n))

  const [skinny, bandInv, subRows, areaRows, parcel, cells, zillowRows] = await Promise.all([
    getCmaCityClosedSkinny(args.subject.city, since36).catch(() => []),
    getCmaBandInventory(args.subject.city, fetchLo, fetchHi, {
      sqftMin: sqft > 0 ? Math.round(sqft * 0.65) : undefined,
      sqftMax: sqft > 0 ? Math.round(sqft * 1.4) : undefined,
    }).catch(() => null),
    subdivision ? getCmaSubdivisionClosed(subdivision, since12).catch(() => []) : Promise.resolve([]),
    getCmaMarketAreaRows(args.subject.city, since12).catch(() => []),
    resolveParcelRecord(args.subject).catch(() => null),
    getPricingSubdivisionCells(pricingSubject.citySlug).catch(() => new Map()),
    zillowMls.length > 0 ? findCmaListingsByMlsNumbers(zillowMls).catch(() => []) : Promise.resolve([]),
  ])

  const ownerNotes = parseOwnerNotes(args.sellerImprovementsText, args.ownerNotes)
  const zillow =
    args.zillow != null
      ? bustZestimate({
          snapshot: args.zillow,
          mls: mergeMlsFacts(mlsFactsFromPricedComps(args.comps), zillowRows.map(listingToMlsFact)),
          subject: {
            beds: args.subject.beds,
            baths: args.subject.baths,
            sqft: args.subject.sqft,
            yearBuilt: args.subject.yearBuilt,
          },
          recommended: args.pricing.recommended,
          conservative: args.pricing.conservative,
          highEnd: args.pricing.highEnd,
          asOf: asOf.toISOString().slice(0, 10),
          ownerNotes,
        })
      : null

  return {
    seasonality: computeSeasonality(skinny, args.subject.city, since36),
    band: computeBandPosition(bandInv, args.subject.city, lo, hi, {
      subject: pricingSubject,
      tiersUsed: args.tiersUsed ?? [],
      cells,
      asOf: asOf.toISOString().slice(0, 10),
    }),
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
    parcel,
    zillow,
    ownerNotes,
    proceeds: buildSellerProceeds({
      pricing: args.pricing,
      parcel,
      mortgage:
        parcel?.acquiredAt != null && parcel.ownedSince
          ? await resolvePurchaseMortgageAssumption({
              purchasePrice: parcel.acquiredAt,
              purchaseDate: parcel.ownedSince,
              asOf,
            })
          : null,
    }),
  }
}
