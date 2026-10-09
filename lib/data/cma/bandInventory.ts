/**
 * Live competition in the subject's list-price band.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §4: PropertyType='A' is the MLS
 * residential bucket, not "detached house." Townhouses and condos sit
 * in A. Same property_sub_type only.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  compAreaBounds,
  compAreaContains,
  type CompArea,
} from '@/lib/pricing/comp-area'
import {
  areaFilterTrace,
  areaPlatOutline,
  mergeRowsByKey,
  rowPlatSlugs,
  rowStreetAddress,
  type CmaAreaReadCitation,
} from '@/lib/data/cma/areaUnsoldReads'
import type { LatLngBounds } from '@/lib/cma/market-area'

// original_on_market_timestamp: the first day a competitor was on the market,
// so a home that came back is measured and labeled on its last stretch (Matt
// 2026-10-08, lib/cma/band-rivals.ts bandRowStretch).
const BAND_SELECT =
  'ListingKey, StreetNumber, StreetName, ListPrice, OriginalListPrice, StandardStatus, DaysOnMarket, OnMarketDate, original_on_market_timestamp, PhotoURL, Latitude, Longitude, property_sub_type, BedroomsTotal, BathroomsTotal, baths_full, baths_half, TotalLivingAreaSqFt, year_built, lot_size_acres'

// The band is one city, one property type, one status, inside a +/- price
// window, so it is bounded in practice. Page it rather than truncating: the
// medians downstream are only correct over the whole band. CEILING exists so a
// pathological band cannot pull the table; when it is hit, `truncated` says so
// and the CMA discloses it instead of quietly publishing a sample.
const PAGE_SIZE = 1000
const CEILING = 4000

export type CmaBandListingRow = {
  ListingKey: string
  StreetNumber: string | null
  StreetName: string | null
  ListPrice: number | null
  OriginalListPrice?: number | null
  StandardStatus: string | null
  DaysOnMarket: number | null
  OnMarketDate: string | null
  /** The first day it was on the market (Active, never Coming Soon). Earlier than OnMarketDate when it came back. */
  original_on_market_timestamp?: string | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  property_sub_type?: string | null
  /** Selected only by the area-scoped read; the city-scoped one already knows the city. */
  City?: string | null
  SubdivisionName?: string | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  /** MLS full / half bath split: printed and room-tested the way the sales are (lib/pricing/bath-count.ts). */
  baths_full?: number | null
  baths_half?: number | null
  TotalLivingAreaSqFt?: number | null
  year_built?: number | null
  lot_size_acres?: number | null
  /** Selected only by the area-scoped read: the competition fit reads it for the multi-unit and ADU walls (rule 24). */
  public_remarks?: string | null
  /**
   * Attached only by the area-scoped read of a plat area: the recorded plat
   * polygon the row's point sits in (null when tested and none holds it), so
   * the competition fit places the row by polygon, not MLS spelling.
   */
  plat_slug?: string | null
}

export type CmaBandInventory = {
  activeAsks: number[]
  activeDaysOnMarket: number[]
  /** Exact row counts from the database, NOT the length of the arrays above. */
  activeCount: number
  pendingCount: number
  /** True if the band exceeded CEILING and the rows are a prefix, not the band. */
  truncated: boolean
  activeRows: CmaBandListingRow[]
  pendingRows: CmaBandListingRow[]
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

function asRows(data: unknown): CmaBandListingRow[] {
  return (Array.isArray(data) ? data : []) as CmaBandListingRow[]
}

export async function getCmaBandInventory(
  city: string,
  lo: number,
  hi: number,
  subjectSubType?: string | null,
): Promise<CmaBandInventory | null> {
  const sb = client()
  if (!sb) return null
  const subType = subjectSubType?.trim() || null

  const scoped = (status: 'Active' | 'Pending', head: boolean) => {
    let q = sb
      .from('listings')
      .select(head ? 'ListingKey' : BAND_SELECT, { count: 'exact', head })
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('StandardStatus', status)
      .gte('ListPrice', lo)
      .lte('ListPrice', hi)
    if (subType) q = q.eq('property_sub_type', subType)
    return q
  }

  // Page the whole band. `.order()` is not decoration: an unordered range is
  // an arbitrary slice, so paging without it can repeat and skip rows.
  const readAll = async (status: 'Active' | 'Pending') => {
    const rows: CmaBandListingRow[] = []
    let truncated = false
    for (let offset = 0; offset < CEILING; offset += PAGE_SIZE) {
      const { data, error } = await scoped(status, false)
        .order('ListPrice', { ascending: true })
        .order('ListingKey', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = asRows(data)
      rows.push(...page)
      if (page.length < PAGE_SIZE) return { rows, truncated }
    }
    truncated = true
    return { rows, truncated }
  }

  try {
    const [activeHead, pendingHead, actives, pendings] = await Promise.all([
      scoped('Active', true),
      scoped('Pending', true),
      readAll('Active'),
      readAll('Pending'),
    ])
    if (activeHead.error || pendingHead.error) {
      throw new Error(activeHead.error?.message ?? pendingHead.error?.message)
    }
    const activeRows = actives.rows
    return {
      activeAsks: activeRows
        .map((r) => Number(r.ListPrice))
        .filter((n) => Number.isFinite(n) && n > 0),
      // Days on market derived from OnMarketDate, not the "DaysOnMarket"
      // column: docs/DATABASE_FOR_AI_AGENTS.md warns that column is
      // list-to-close. Measured on live Active rows 2026-08-26 it tracks
      // days-since-on-market to within 0-4 days (it lags the sync), so the
      // date arithmetic is both exact and free of the canon's objection.
      activeDaysOnMarket: activeRows
        .map((r) => daysOnMarket(r.OnMarketDate))
        .filter((n): n is number => n != null),
      activeCount: activeHead.count ?? activeRows.length,
      pendingCount: pendingHead.count ?? pendings.rows.length,
      truncated: actives.truncated || pendings.truncated,
      activeRows,
      pendingRows: pendings.rows,
    }
  } catch (e) {
    console.error('[getCmaBandInventory]', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** Whole days between OnMarketDate and now. Null when the date is unusable. */
function daysOnMarket(onMarketDate: string | null): number | null {
  if (!onMarketDate) return null
  const then = new Date(onMarketDate)
  if (Number.isNaN(then.getTime())) return null
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  return days >= 0 ? days : null
}

/**
 * THE SAME BAND, READ INSIDE THE AREA (Matt 2026-09-08).
 *
 * `getCmaBandInventory` above is city-wide, which is what put citywide counts
 * under a chapter about one street. This read takes the CompArea the document
 * already resolved — the neighborhood or community polygon the subject sits
 * in, or the radius when it sits in none — and never widens to the city.
 *
 * Geometry goes into the query as a bounding box and is re-tested exactly per
 * row by `compAreaContains`, so the counts reported are counts INSIDE the
 * shape, not inside the box. That is also why there is no `head:true` count
 * here: a database count would count the box.
 */
// public_remarks: the competition passes the same multi-unit and ADU walls as
// the sales (rule 24, Matt 2026-10-08), and those walls read the remarks.
// pending_timestamp + days_to_pending: a home under contract is dated the day
// it went under contract and counts its days to that offer (band-rivals.ts).
const AREA_SELECT = `${BAND_SELECT}, City, SubdivisionName, public_remarks, pending_timestamp, days_to_pending`

export type CmaAreaBandInventory = {
  area: CompArea
  lo: number
  hi: number
  activeRows: CmaBandListingRow[]
  pendingRows: CmaBandListingRow[]
  /** Rows inside the exact shape. Never a bounding-box count. */
  activeCount: number
  pendingCount: number
  activeAsks: number[]
  activeDaysOnMarket: number[]
  truncated: boolean
  citation: CmaAreaReadCitation
}

export async function getCmaAreaBandInventory(input: {
  area: CompArea
  /** The subject's city — the bound when the area is scoped by name rather than shape. */
  city: string
  lo: number
  hi: number
  propertySubType?: string | null
}): Promise<CmaAreaBandInventory | null> {
  const sb = client()
  if (!sb) return null
  const area = input.area
  const subType = input.propertySubType?.trim() || null
  const bounds = compAreaBounds(area)
  // A plat area also reads the rows inside the box around its recorded plats,
  // whatever their MLS spelling (areaPlatOutline, reader review 2026-10-08:
  // 733 Saginaw is "Kenwood" on the MLS and sits in Kenwood First Addition).
  const outline = await areaPlatOutline(area, input.city)

  const scoped = (status: 'Active' | 'Pending', box: LatLngBounds | null) => {
    let q = sb
      .from('listings')
      .select(AREA_SELECT)
      .eq('PropertyType', 'A')
      .eq('StandardStatus', status)
      .gte('ListPrice', input.lo)
      .lte('ListPrice', input.hi)
    if (subType) q = q.eq('property_sub_type', subType)
    if (area.kind === 'subdivision' || area.kind === 'subdivisions') {
      if (!box) q = q.in('SubdivisionName', area.names)
      if (input.city.trim()) q = q.eq('City', input.city.trim())
    } else if (area.kind === 'city') {
      q = q.eq('City', area.names[0] ?? input.city.trim())
    }
    const geo = box ?? bounds
    if (geo) {
      q = q
        .gte('Latitude', geo.latMin)
        .lte('Latitude', geo.latMax)
        .gte('Longitude', geo.lngMin)
        .lte('Longitude', geo.lngMax)
    }
    return q
  }

  const readPages = async (status: 'Active' | 'Pending', box: LatLngBounds | null) => {
    const rows: CmaBandListingRow[] = []
    for (let offset = 0; offset < CEILING; offset += PAGE_SIZE) {
      const { data, error } = await scoped(status, box)
        .order('ListPrice', { ascending: true })
        .order('ListingKey', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = asRows(data)
      rows.push(...page)
      if (page.length < PAGE_SIZE) return { rows, truncated: false }
    }
    return { rows, truncated: true }
  }

  const readAll = async (status: 'Active' | 'Pending') => {
    const [named, boxed] = await Promise.all([
      readPages(status, null),
      outline ? readPages(status, outline) : Promise.resolve({ rows: [] as CmaBandListingRow[], truncated: false }),
    ])
    return { rows: mergeRowsByKey(named.rows, boxed.rows), truncated: named.truncated || boxed.truncated }
  }

  // A plat area tests each row's recorded polygon, and a plat held to the
  // subject's street tests the street (rule 24), the same test the unsold
  // read applies. The polygon rides on the row (plat_slug), so the
  // competition fit tests the same polygon, not the MLS spelling.
  const inside = async (rows: CmaBandListingRow[]) => {
    const plats = await rowPlatSlugs(area, rows)
    return rows.flatMap((r, i) =>
      compAreaContains(area, {
        latitude: r.Latitude,
        longitude: r.Longitude,
        subdivision: r.SubdivisionName ?? null,
        city: r.City ?? null,
        platSlug: plats[i],
        address: rowStreetAddress(r),
      })
        ? [plats[i] === undefined ? r : { ...r, plat_slug: plats[i] }]
        : [],
    )
  }

  const filter = [
    `PropertyType='A'`,
    `StandardStatus IN (Active, Pending)`,
    `ListPrice ${input.lo}..${input.hi}`,
    subType ? `property_sub_type='${subType}'` : 'any residential sub type',
    areaFilterTrace(area, outline),
  ].join(' AND ')

  try {
    const [actives, pendings] = await Promise.all([readAll('Active'), readAll('Pending')])
    const [activeRows, pendingRows] = await Promise.all([inside(actives.rows), inside(pendings.rows)])
    return {
      area,
      lo: input.lo,
      hi: input.hi,
      activeRows,
      pendingRows,
      activeCount: activeRows.length,
      pendingCount: pendingRows.length,
      activeAsks: activeRows.map((r) => Number(r.ListPrice)).filter((n) => Number.isFinite(n) && n > 0),
      // Days on market from OnMarketDate, never the "DaysOnMarket" column —
      // docs/DATABASE_FOR_AI_AGENTS.md §4a: that column is list-to-close.
      activeDaysOnMarket: activeRows
        .map((r) => daysOnMarket(r.OnMarketDate))
        .filter((n): n is number => n != null),
      truncated: actives.truncated || pendings.truncated,
      citation: {
        table: 'listings',
        filter,
        rows: actives.rows.length + pendings.rows.length,
        rowsAfterAreaTest: activeRows.length + pendingRows.length,
        fetchedAt: new Date().toISOString(),
        query: `supabase.from('listings').select(...).where(${filter})`,
        truncated: actives.truncated || pendings.truncated,
      },
    }
  } catch (e) {
    console.error('[getCmaAreaBandInventory]', e instanceof Error ? e.message : String(e))
    return null
  }
}
