/**
 * THE UNSOLD CYCLES INSIDE THE AREA THE COMPS CAME FROM.
 *
 * Matt 2026-09-08: "when we show expired listings, we want to use the same area
 * that we searched and where we actually retrieved comps. [...] When we're
 * looking at expireds, we can go back until we have at least 3 expired,
 * withdrawn, or canceled."
 *
 * The peers used to come out of `getCmaMarketAreaRows` — a CITY-WIDE twelve
 * month pull narrowed in JS to a price band — so a seller whose price was built
 * from five sales on their own street was shown homes that failed anywhere in
 * Redmond, on a window fixed at twelve months whether that held three of them
 * or thirty.
 *
 * This reader takes the derived `CompArea` and reads only inside it. One read,
 * at the WIDEST window (24 months), because the window ladder — 3, 6, 9, 12,
 * 18, 24, stopping at the first with three peers — is a walk over the rows,
 * not six round trips. Every row carries `status_change_timestamp`, which is
 * the day the cycle came off, so the ladder is exact.
 *
 * Geometry is pushed into the query as a bounding box and then re-tested
 * exactly by `compAreaContains`, which runs the same point-in-polygon that
 * placed the subject. The box is a superset, never a subset, so the exact test
 * can only remove rows the polygon or the circle does not hold.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  compAreaBounds,
  compAreaContains,
  compAreaSlug,
  type CompArea,
} from '@/lib/pricing/comp-area'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'

/** The three MLS statuses that mean "came off without selling". */
export const UNSOLD_STATUSES = ['Expired', 'Withdrawn', 'Canceled'] as const

/** The widest window the peer ladder is allowed to reach (Matt: go back until three). */
export const UNSOLD_MAX_MONTHS = 24

const COLS =
  'ListingKey, StreetNumber, StreetName, City, PhotoURL, OriginalListPrice, Latitude, Longitude, StandardStatus, ListPrice, ClosePrice, CloseDate, ListDate, OnMarketDate, TotalLivingAreaSqFt, BedroomsTotal, BathroomsTotal, DaysOnMarket, CumulativeDaysOnMarket, status_change_timestamp, SubdivisionName, property_sub_type, year_built, lot_size_acres'

const PAGE_SIZE = 1000
const CEILING = 4000

/** One §0 citation entry: what was read, under what filter, and how much came back. */
export type CmaAreaReadCitation = {
  table: 'listings'
  filter: string
  rows: number
  rowsAfterAreaTest: number
  fetchedAt: string
  query: string
  truncated: boolean
}

export type CmaAreaUnsoldRead = {
  rows: CmaMarketAreaRow[]
  sinceIso: string
  months: number
  citation: CmaAreaReadCitation
}

type ListingQuery = {
  eq: (col: string, val: string | number) => ListingQuery
  in: (col: string, val: readonly string[]) => ListingQuery
  gte: (col: string, val: string | number) => ListingQuery
  lte: (col: string, val: string | number) => ListingQuery
  order: (col: string, opts: { ascending: boolean }) => ListingQuery
  range: (
    from: number,
    to: number,
  ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

function monthsAgoIso(months: number, asOf: Date): string {
  return new Date(asOf.getTime() - months * 30.44 * 24 * 3600e3).toISOString().slice(0, 10)
}

/**
 * Empty area scope, in words, for the citation. Written from the SAME area
 * object the query was built from, so the trace cannot describe a different
 * geography than the one that was read.
 */
export function areaFilterTrace(area: CompArea): string {
  switch (area.kind) {
    case 'subdivision':
    case 'subdivisions':
      return `SubdivisionName IN (${area.names.map((n) => `'${n}'`).join(', ')})`
    case 'neighborhood':
    case 'community': {
      const slug = compAreaSlug(area)
      const b = compAreaBounds(area)
      return `inside the ${area.kind} polygon ${slug ?? 'unknown'}${
        b
          ? ` (bbox lat ${b.latMin.toFixed(4)}..${b.latMax.toFixed(4)}, lng ${b.lngMin.toFixed(4)}..${b.lngMax.toFixed(4)}, then point-in-polygon per row)`
          : ''
      }`
    }
    case 'radius':
      return `within ${area.radiusMiles} miles of ${area.centre?.lat.toFixed(5)}, ${area.centre?.lng.toFixed(5)} (bbox, then great-circle distance per row)`
    case 'city':
      return `City = '${area.names[0] ?? ''}'`
  }
}

async function pageQuery(build: () => ListingQuery): Promise<{ rows: CmaMarketAreaRow[]; truncated: boolean }> {
  const rows: CmaMarketAreaRow[] = []
  for (let from = 0; from < CEILING; from += PAGE_SIZE) {
    // `.order()` is not decoration: an unordered range is an arbitrary slice,
    // so paging without it repeats and skips rows.
    const { data, error } = await build()
      .order('ListingKey', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as CmaMarketAreaRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

/**
 * Expired, withdrawn and canceled cycles inside `area`, in the subject's price
 * band and product sub type, over the widest window the peer ladder can reach.
 * Returns an empty set (never throws) when Supabase is not configured.
 */
export async function getCmaAreaUnsoldCycles(input: {
  area: CompArea
  /** The subject's city — the bound on a subdivision-scoped read, since names repeat between towns. */
  city: string
  propertySubType: string | null
  priceLo: number
  priceHi: number
  months?: number
  asOf?: Date
}): Promise<CmaAreaUnsoldRead> {
  const asOf = input.asOf ?? new Date()
  const months = input.months ?? UNSOLD_MAX_MONTHS
  const sinceIso = monthsAgoIso(months, asOf)
  const area = input.area
  const subType = input.propertySubType?.trim() || null
  const empty: CmaAreaUnsoldRead = {
    rows: [],
    sinceIso,
    months,
    citation: {
      table: 'listings',
      filter: 'not read',
      rows: 0,
      rowsAfterAreaTest: 0,
      fetchedAt: asOf.toISOString(),
      query: 'not read',
      truncated: false,
    },
  }

  const sb = client()
  if (!sb) return empty

  const bounds = compAreaBounds(area)
  const build = (): ListingQuery => {
    let q = sb
      .from('listings')
      .select(COLS)
      .eq('PropertyType', 'A')
      .in('StandardStatus', UNSOLD_STATUSES as unknown as string[])
      .gte('status_change_timestamp', sinceIso)
      .gte('ListPrice', input.priceLo)
      .lte('ListPrice', input.priceHi) as unknown as ListingQuery
    if (subType) q = q.eq('property_sub_type', subType)
    if (area.kind === 'subdivision' || area.kind === 'subdivisions') {
      q = q.in('SubdivisionName', area.names)
      if (input.city.trim()) q = q.eq('City', input.city.trim())
    } else if (area.kind === 'city') {
      q = q.eq('City', area.names[0] ?? input.city.trim())
    }
    if (bounds) {
      q = q
        .gte('Latitude', bounds.latMin)
        .lte('Latitude', bounds.latMax)
        .gte('Longitude', bounds.lngMin)
        .lte('Longitude', bounds.lngMax)
    }
    return q
  }

  const filter = [
    `PropertyType='A'`,
    `StandardStatus IN (${UNSOLD_STATUSES.join(', ')})`,
    `status_change_timestamp >= ${sinceIso}`,
    `ListPrice ${input.priceLo}..${input.priceHi}`,
    subType ? `property_sub_type='${subType}'` : 'any residential sub type',
    areaFilterTrace(area),
  ].join(' AND ')

  try {
    const { rows, truncated } = await pageQuery(build)
    // The exact shape, after the box. A subdivision or city read is already
    // exact in SQL; running it again costs nothing and keeps ONE definition of
    // membership for every read this document makes.
    const inside = rows.filter((r) =>
      compAreaContains(area, {
        latitude: r.Latitude ?? null,
        longitude: r.Longitude ?? null,
        subdivision: r.SubdivisionName ?? null,
        city: r.City ?? null,
      }),
    )
    return {
      rows: inside,
      sinceIso,
      months,
      citation: {
        table: 'listings',
        filter,
        rows: rows.length,
        rowsAfterAreaTest: inside.length,
        fetchedAt: new Date().toISOString(),
        query: `supabase.from('listings').select(...).where(${filter})`,
        truncated,
      },
    }
  } catch (e) {
    console.error('[getCmaAreaUnsoldCycles]', e instanceof Error ? e.message : String(e))
    return { ...empty, citation: { ...empty.citation, filter, query: filter } }
  }
}
