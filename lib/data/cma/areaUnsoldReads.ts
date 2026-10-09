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
import { getPlatGroundBounds } from '@/lib/data/cma/platGroundBounds'
import { assignSubdivisionSlugs } from '@/lib/data/geo/subdivision-ring'
import type { LatLngBounds } from '@/lib/cma/market-area'
import { parentOf, platGround } from '@/lib/pricing/plat-ground'
import {
  dropRelistedUnsoldCycles,
  RELIST_OUTCOME_STATUSES,
  type HouseCycleRecord,
} from '@/lib/cma/market-status'
import { getListingAskChanges, getListingStatusChanges } from '@/lib/data/cma/localOutcomeReads'
import type { AskChange, ListingStatusChange } from '@/lib/cma/listing-status'

/** The three MLS statuses that mean "came off without selling". */
export const UNSOLD_STATUSES = ['Expired', 'Withdrawn', 'Canceled'] as const

/** The widest window the peer ladder is allowed to reach (Matt: go back until three). */
export const UNSOLD_MAX_MONTHS = 24

const COLS =
  'ListingKey, StreetNumber, StreetName, City, PhotoURL, OriginalListPrice, Latitude, Longitude, StandardStatus, ListPrice, ClosePrice, CloseDate, ListDate, OnMarketDate, original_on_market_timestamp, TotalLivingAreaSqFt, BedroomsTotal, BathroomsTotal, baths_full, baths_half, DaysOnMarket, CumulativeDaysOnMarket, status_change_timestamp, off_market_date, SubdivisionName, property_sub_type, year_built, lot_size_acres, public_remarks, parcel_number'

/** What the relist test reads of every other record of the same houses. */
const LATER_COLS =
  'ListingKey, StreetNumber, StreetName, City, parcel_number, StandardStatus, OnMarketDate, ListDate, CloseDate, status_change_timestamp'

/** Street numbers per relist read: one short IN list, never a URL the API refuses. */
const LATER_CHUNK = 100

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

/**
 * The second read behind the came-off count: every later record of the same
 * houses that closed or is on the market now (lib/cma/market-status.ts
 * laterOutcomeCycle). `dropped` names each cycle it takes out and the record
 * that took it out, so a reviewer can check the trace (CLAUDE.md §0).
 */
export type CmaRelistCitation = {
  filter: string
  rows: number
  truncated: boolean
  dropped: Array<{
    listingKey: string | null
    address: string | null
    status: string
    laterListingKey: string | null
    laterStatus: string
    laterOnMarket: string | null
    laterCloseDate: string | null
  }>
}

export type CmaAreaUnsoldRead = {
  rows: CmaMarketAreaRow[]
  /**
   * Other records of the same houses that closed or are on the market now.
   * buildExpiredPeerSet drops a cycle whose house relisted later and sold or
   * is listed again: it did not come off unsold.
   */
  laterCycles: HouseCycleRecord[]
  sinceIso: string
  months: number
  citation: CmaAreaReadCitation & { relist?: CmaRelistCitation }
  /**
   * True when a read threw. Its empty rows are not evidence that nothing came
   * off (§0), so the assembly prints no came-off set at all.
   */
  failed?: boolean
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
 * geography than the one that was read. `outline` is the box around the
 * area's recorded plats when the read also took the rows inside it.
 */
export function areaFilterTrace(area: CompArea, outline?: LatLngBounds | null): string {
  switch (area.kind) {
    case 'subdivision':
    case 'subdivisions':
      return `SubdivisionName IN (${area.names.map((n) => `'${n}'`).join(', ')})${
        outline
          ? `, or inside the box around those recorded plats and their subdivision family (lat ${outline.latMin.toFixed(4)}..${outline.latMax.toFixed(4)}, lng ${outline.lngMin.toFixed(4)}..${outline.lngMax.toFixed(4)}) whatever the MLS spelling`
          : ''
      }${
        areaReadsPlats(area)
          ? `, then the recorded plat polygon per row (${[...(area.platSlugs ?? [])].join(', ')}${
              area.street ? `; ${area.street.platSlugs.join(', ') || area.street.names.join(', ')} on ${area.street.key} only` : ''
            }; a phase, an alias-map sibling, or a plat of the same subdivision family inside the subject's neighborhood counts), the MLS name only where no polygon holds the row`
          : ''
      }`
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
      return `within ${area.radiusMiles} mi of ${area.centre?.lat.toFixed(5)}, ${area.centre?.lng.toFixed(5)} (bbox, then great-circle distance per row)`
    case 'city':
      return `City = '${area.names[0] ?? ''}'`
  }
}

/** A plat area that recorded its plats: the exact test reads each row's polygon. */
export function areaReadsPlats(area: CompArea): boolean {
  if (area.kind !== 'subdivision' && area.kind !== 'subdivisions') return false
  return (area.platSlugs?.length ?? 0) > 0 || (area.street?.platSlugs.length ?? 0) > 0
}

/**
 * THE BOX AROUND A PLAT AREA'S RECORDED PLATS (reader review 2026-10-08).
 * The name prefilter (SubdivisionName IN area.names) dropped every row of an
 * area plat filed under another MLS spelling before its polygon was ever
 * tested: 1425 Fresno ("Northwest Townsite Co 2nd Addt") never reached the
 * 1355 Jacksonville came-off read, and 733 Saginaw (MLS "Kenwood", recorded
 * Kenwood First Addition) never reached 915 Saginaw's competition read. The
 * reads take the rows inside this box as well; the polygon test decides.
 * Null when the area reads no plats or no outline could be drawn.
 */
export async function areaPlatOutline(area: CompArea, city: string): Promise<LatLngBounds | null> {
  if (!areaReadsPlats(area)) return null
  const ground = platGround({
    platSlugs: [...(area.platSlugs ?? []), ...(area.street?.platSlugs ?? [])],
    parent: area.centre ? parentOf(area.centre.lat, area.centre.lng) : null,
  })
  return getPlatGroundBounds(ground, { city }).catch(() => null)
}

/** Two reads of one table, each listing once (the first read's row wins). */
export function mergeRowsByKey<T extends { ListingKey?: string | null }>(first: readonly T[], second: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of [...first, ...second]) {
    const key = String(r.ListingKey ?? '').trim()
    if (key) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(r)
  }
  return out
}

/**
 * The recorded plat each row sits in, by index (Matt 2026-10-07, rule 24):
 * membership in a plat area is the polygon, and the MLS name only where no
 * polygon holds the row. Undefined at every index when the area does not read
 * plats, or the read fails; the exact test then falls back to the name.
 */
export async function rowPlatSlugs(
  area: CompArea,
  rows: ReadonlyArray<{ Latitude?: number | null; Longitude?: number | null }>,
): Promise<Array<string | null | undefined>> {
  if (rows.length === 0 || !areaReadsPlats(area)) return rows.map(() => undefined)
  try {
    return await assignSubdivisionSlugs(rows.map((r) => ({ lat: r.Latitude ?? null, lng: r.Longitude ?? null })))
  } catch (e) {
    console.error('[rowPlatSlugs]', e instanceof Error ? e.message : String(e))
    return rows.map(() => undefined)
  }
}

/** "2591 Purcell", the street a street-only plat is held to. Null when the row carries no street. */
export function rowStreetAddress(r: { StreetNumber?: string | null; StreetName?: string | null }): string | null {
  const street = (r.StreetName ?? '').trim()
  if (!street) return null
  return `${(r.StreetNumber ?? '').trim()} ${street}`.trim()
}

async function pageQuery<T = CmaMarketAreaRow>(build: () => ListingQuery): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = []
  for (let from = 0; from < CEILING; from += PAGE_SIZE) {
    // `.order()` is not decoration: an unordered range is an arbitrary slice,
    // so paging without it repeats and skips rows.
    const { data, error } = await build()
      .order('ListingKey', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

/**
 * Every later record of the houses in `rows` that closed or is on the market
 * now: same street number, same city, a status in RELIST_OUTCOME_STATUSES,
 * and a status change on or after the earliest day one of these cycles went
 * on the market (a later cycle changed status after it started, and it
 * started after this one). The street name, the parcel and "later" are
 * decided in memory by laterOutcomeCycle. A record with no status change date
 * is not read, so its cycle stays counted, as before this read existed.
 */
async function readLaterCycles(
  sb: NonNullable<ReturnType<typeof client>>,
  rows: readonly CmaMarketAreaRow[],
): Promise<{ records: HouseCycleRecord[]; filter: string; truncated: boolean }> {
  const numbers = [...new Set(rows.map((r) => (r.StreetNumber ?? '').trim()).filter((n) => n.length > 0))].sort()
  const cities = [...new Set(rows.map((r) => (r.City ?? '').trim()).filter((c) => c.length > 0))].sort()
  const starts = rows
    .map((r) => (r.OnMarketDate ?? r.ListDate ?? r.status_change_timestamp ?? '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
  const since = starts[0] ?? null
  const filter = [
    `StandardStatus IN (${RELIST_OUTCOME_STATUSES.join(', ')})`,
    `StreetNumber IN (${numbers.join(', ')})`,
    cities.length > 0 ? `City IN (${cities.map((c) => `'${c}'`).join(', ')})` : 'any city',
    since ? `status_change_timestamp >= ${since}` : 'any status change date',
    'then the same parcel, or the same street address, on a cycle that went on the market after the unsold one',
  ].join(' AND ')
  if (numbers.length === 0) return { records: [], filter, truncated: false }
  const records: HouseCycleRecord[] = []
  let truncated = false
  for (let i = 0; i < numbers.length; i += LATER_CHUNK) {
    const chunk = numbers.slice(i, i + LATER_CHUNK)
    const page = await pageQuery<HouseCycleRecord>(() => {
      let q = sb
        .from('listings')
        .select(LATER_COLS)
        .in('StandardStatus', RELIST_OUTCOME_STATUSES as unknown as string[])
        .in('StreetNumber', chunk) as unknown as ListingQuery
      if (cities.length > 0) q = q.in('City', cities)
      if (since) q = q.gte('status_change_timestamp', since)
      return q
    })
    records.push(...page.rows)
    truncated = truncated || page.truncated
  }
  return { records, filter, truncated }
}

/**
 * Expired, withdrawn and canceled cycles inside `area`, in the subject's price
 * band and product sub type, over the widest window the peer ladder can reach,
 * with every later record of the same houses (`laterCycles`), so a house that
 * relisted and sold is not counted as one that came off unsold.
 * Returns an empty set (never throws) when Supabase is not configured, and an
 * empty set marked `failed` when a read throws.
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
    laterCycles: [],
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
  // A plat area also reads the rows inside the box around its recorded plats,
  // whatever their MLS spelling (areaPlatOutline). The polygon test decides.
  const outline = await areaPlatOutline(area, input.city)
  const build = (box: LatLngBounds | null = null): ListingQuery => {
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

  const filter = [
    `PropertyType='A'`,
    `StandardStatus IN (${UNSOLD_STATUSES.join(', ')})`,
    `status_change_timestamp >= ${sinceIso}`,
    `ListPrice ${input.priceLo}..${input.priceHi}`,
    subType ? `property_sub_type='${subType}'` : 'any residential sub type',
    areaFilterTrace(area, outline),
  ].join(' AND ')

  try {
    const [named, boxed] = await Promise.all([
      pageQuery(() => build()),
      outline ? pageQuery(() => build(outline)) : Promise.resolve({ rows: [] as CmaMarketAreaRow[], truncated: false }),
    ])
    const rows = mergeRowsByKey(named.rows, boxed.rows)
    const truncated = named.truncated || boxed.truncated
    // The exact shape, after the box. A plat area tests each row's recorded
    // polygon (the SQL name match is only the prefilter), and a plat held to
    // the subject's street tests the street. ONE definition of membership
    // for every read this document makes. The polygon each row sits in rides
    // on the row (plat_slug), so the came-off fit tests the same polygon.
    const plats = await rowPlatSlugs(area, rows)
    const inside = rows.flatMap((r, i) =>
      compAreaContains(area, {
        latitude: r.Latitude ?? null,
        longitude: r.Longitude ?? null,
        subdivision: r.SubdivisionName ?? null,
        city: r.City ?? null,
        platSlug: plats[i],
        address: rowStreetAddress(r),
      })
        ? [plats[i] === undefined ? r : { ...r, plat_slug: plats[i] }]
        : [],
    )
    // WHEN EACH ONE LEFT THE MARKET (reader review 2026-10-08). 3204 Spring
    // Creek was withdrawn Jan 20 and its listing expired Jul 31; its row's
    // DaysOnMarket ran to the expiry, and the letter said it "came off after
    // 288 days" when it was on the market 96. The status log for the homes
    // inside the area says when each left Active. Additive: an unread log
    // leaves each row on its own dates.
    const insideKeys = inside.map((r) => String(r.ListingKey ?? '').trim()).filter(Boolean)
    // And the asks each one's last stretch began at (Matt 2026-10-08, "Last
    // stretch, labeled"). Additive like the status log.
    const [statusChanges, askChanges] = await Promise.all([
      getListingStatusChanges(insideKeys).catch((err) => {
        console.error('[getCmaAreaUnsoldCycles] status changes', err instanceof Error ? err.message : String(err))
        return new Map<string, ListingStatusChange[]>()
      }),
      getListingAskChanges(insideKeys).catch((err) => {
        console.error('[getCmaAreaUnsoldCycles] ask changes', err instanceof Error ? err.message : String(err))
        return new Map<string, AskChange[]>()
      }),
    ])
    const withChanges = inside.map((r) => {
      const key = String(r.ListingKey ?? '').trim()
      const changes = statusChanges.get(key)
      const asks = askChanges.get(key)
      return {
        ...r,
        ...(changes && changes.length > 0 ? { statusChanges: changes } : {}),
        ...(asks && asks.length > 0 ? { askChanges: asks } : {}),
      }
    })
    // A cancel and relist is a re-entry, not a failure: 2639 Harvey and 1382
    // Drost each came off and then sold within weeks (cma-1648-pheasant).
    const later = await readLaterCycles(sb, inside)
    const { dropped } = dropRelistedUnsoldCycles(inside, later.records)
    return {
      rows: withChanges,
      laterCycles: later.records,
      sinceIso,
      months,
      citation: {
        table: 'listings',
        filter,
        rows: rows.length,
        rowsAfterAreaTest: inside.length,
        fetchedAt: new Date().toISOString(),
        query: `supabase.from('listings').select(...).where(${filter}) ;; listing_history (MlsStatus changes) + status_history for the rows inside the area`,
        truncated,
        relist: {
          filter: later.filter,
          rows: later.records.length,
          truncated: later.truncated,
          dropped: dropped.map(({ row, later: by }) => ({
            listingKey: row.ListingKey ?? null,
            address: rowStreetAddress(row),
            status: row.StandardStatus,
            laterListingKey: by.ListingKey ?? null,
            laterStatus: by.StandardStatus,
            laterOnMarket: by.OnMarketDate ?? by.ListDate ?? null,
            laterCloseDate: by.CloseDate ?? null,
          })),
        },
      },
    }
  } catch (e) {
    console.error('[getCmaAreaUnsoldCycles]', e instanceof Error ? e.message : String(e))
    return { ...empty, failed: true, citation: { ...empty.citation, filter, query: filter } }
  }
}
