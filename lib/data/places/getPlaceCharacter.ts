/**
 * getPlaceCharacter — the three listing-derived facts a place page may publish
 * about its housing stock, measured from live MLS data.
 *
 * PLACE_CONTENT_RULES R1, R2 and R3 govern this read
 * (docs/plans/MARKET_TRUTH/PLACE_CONTENT_RULES.md). Each rule exists because
 * the naive version ships a wrong number onto thousands of pages, and each one
 * was measured, not argued:
 *
 *   R1  Year built is the 10th to 90th PERCENTILE, never min to max. Over the
 *       2,422 subdivisions carrying ten or more build years, min-max puts a
 *       false pre-1940 claim on 61 places and 60+ year spans on 214, while
 *       percentiles cut the average span from 23 years to 12. The sample is
 *       stated every time: a range with no denominator is not a fact.
 *
 *   R2  HOA dues are a median WITHIN ONE property type, and the type is named.
 *       Of the 1,288 subdivisions with five or more dues figures, 840 are
 *       mixed-type; computing across types lands 172 of them more than $25 a
 *       month from the detached figure and makes 50 of them print more than
 *       double it.
 *
 *   R3  HOA presence is a count of what listings reported, never an assertion.
 *       association_yn is null on 38.6% of listings, below the 70%
 *       item-response floor, and a buyer who reads "no HOA" and finds dues at
 *       closing has been actively misled.
 *
 * WHAT THIS FILE OWNS. The RPC measures; this file decides what may be said.
 * Every sample floor lives here, next to the copy it gates, so there is one
 * place to read the rule and one place to change it. The RPC returns raw
 * counts precisely so a withheld figure can never be mistaken for a measured
 * zero.
 *
 * WHAT IT REFUSES TO SAY. A place with nothing publishable returns null and the
 * section does not render. Three refusals are deliberate:
 *
 *   - Under ten build years, no range at all.
 *   - Under five reported dues figures inside the segment, no median.
 *   - HOA presence only when at least one listing reported a yes. "0 of 161
 *     reported an HOA" is the closest thing in this data to the sentence R3
 *     forbids, so it is not published. Silence beats a wrong negative.
 *
 * ONE SEGMENT, NAMED. R2 requires the property type on the face of the dues
 * figure, and R4 requires every figure on a mixed place to name the segment it
 * describes. So the whole section speaks about one property type: detached
 * when detached has anything publishable, otherwise the largest dwelling type
 * that does. Lots, commercial and business types are never the lead, because a
 * page describing the character of somewhere people live should not lead with a
 * commercial parcel.
 *
 * GEO KEYS. place_membership carries the polygon and alias membership for every
 * grain, and its neighborhood slugs are the boundaries slugs. So:
 *   /subdivisions/[slug]              -> ('subdivision', slug)
 *   /cities/[city]/[neighborhood]     -> ('neighborhood', `${city}-${nbh}`)
 *   /communities/[slug]               -> ('neighborhood', slug)
 * The last one is not a typo. boundaries holds no community polygons at all;
 * every resort community (sunriver, tetherow, caldera-springs) is stored as a
 * neighborhood boundary, and geo_type='community' membership comes only from a
 * loose SubdivisionName text match that yields slugs like 'na' and 'pla'.
 * Measured 2026-08-26: community/sunriver has 0 member listings,
 * neighborhood/sunriver has 10,228. The community page already reads every
 * other market figure under geo_type 'neighborhood' for the same reason.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

/**
 * R1's floor. Under ten recorded build years a tenth percentile is one or two
 * homes, and the range says more about the sample than the neighbourhood.
 */
export const YEAR_BUILT_MIN_SAMPLE = 10

/** R2's floor, stated in the rule: five reported figures within the segment. */
export const DUES_MIN_REPORTED = 5

/**
 * R3's floor. The rule sets no number, so this matches R2 rather than invent a
 * second one. A ratio out of one or two listings is noise wearing a denominator.
 */
export const HOA_PRESENCE_MIN_REPORTED = 5

/**
 * Dues and HOA status are CURRENT facts. A 2008 dues figure published as this
 * year's median is a wrong number, so both are measured over a recent window
 * rather than over the whole of a place's listing history. Three years is long
 * enough that a small plat still clears the floor and short enough that the
 * figure describes what a buyer would pay now.
 *
 * Build years are not windowed. A house built in 1975 was built in 1975.
 */
export const HOA_WINDOW_MONTHS = 36

/**
 * MLS property sub-types that describe somewhere a person lives. Only these may
 * lead the section. `Residential Lots`, `Commercial`, `Agriculture`,
 * `Investment`, `Business` and `Timeshare` are excluded: a build-year range
 * over bare land is empty by definition, and leading a place page with a
 * commercial parcel is the category error R4 describes.
 */
const DWELLING_SUB_TYPES = new Set<string>([
  'Single Family Residence',
  'Condominium',
  'Townhouse',
  'Manufactured On Land',
  'In Park',
  'Duplex',
  'Triplex',
  'Quadruplex',
  'Multi Family',
  'Tenancy in Common',
  'Stock Cooperative',
  'Residential Leased Land',
])

/** Detached. Bare PropertyType 'A' is a mixed bucket and is never used here. */
const DETACHED_SUB_TYPE = 'Single Family Residence'

/**
 * How each MLS sub-type is named in copy. R2 requires the type on the face of
 * the figure, so the label has to read like English rather than like a RETS
 * enum. An unmapped sub-type falls back to its own lower-cased label, which is
 * clumsy but never wrong.
 */
const SUB_TYPE_NOUN: Record<string, { one: string; many: string }> = {
  'Single Family Residence': { one: 'detached home', many: 'detached homes' },
  Condominium: { one: 'condo', many: 'condos' },
  Townhouse: { one: 'townhome', many: 'townhomes' },
  'Manufactured On Land': {
    one: 'manufactured home on land',
    many: 'manufactured homes on land',
  },
  'In Park': {
    one: 'manufactured home in a park',
    many: 'manufactured homes in parks',
  },
  Duplex: { one: 'duplex', many: 'duplexes' },
  Triplex: { one: 'triplex', many: 'triplexes' },
  Quadruplex: { one: 'fourplex', many: 'fourplexes' },
  'Multi Family': { one: 'multi-family building', many: 'multi-family buildings' },
  'Tenancy in Common': {
    one: 'tenancy-in-common home',
    many: 'tenancy-in-common homes',
  },
  'Stock Cooperative': { one: 'co-op home', many: 'co-op homes' },
  'Residential Leased Land': {
    one: 'home on leased land',
    many: 'homes on leased land',
  },
}

export function placeCharacterNoun(subType: string, count: number): string {
  const n = SUB_TYPE_NOUN[subType]
  if (!n) return subType.toLowerCase()
  return count === 1 ? n.one : n.many
}

/** R1: the 10th to 90th percentile of recorded build years, and its sample. */
export interface PlaceYearBuilt {
  p10: number
  p90: number
  /** Homes with a recorded build year. Homes, not listings: see the RPC. */
  sample: number
}

/** R2: the median monthly dues inside ONE property type. */
export interface PlaceDues {
  medianMonthly: number
  /** Listings inside the window that reported a dues figure. */
  reported: number
  /** ISO date the window opened, so the copy states the real one. */
  windowFrom: string
}

/** R3: what listings reported, never what the place is. */
export interface PlaceHoaPresence {
  yes: number
  /** Listings inside the window that reported whether there is an HOA. */
  reported: number
  windowFrom: string
}

export interface PlaceCharacter {
  /** The MLS sub-type every figure below describes. */
  subType: string
  /** That sub-type in plural copy: "detached homes", "condos". */
  noun: string
  /** Distinct homes of this type with membership in the place. */
  homeCount: number
  yearBuilt: PlaceYearBuilt | null
  dues: PlaceDues | null
  hoaPresence: PlaceHoaPresence | null
}

type RpcRow = {
  segment?: string | null
  home_count?: number | string | null
  year_sample?: number | string | null
  year_p10?: number | string | null
  year_p90?: number | string | null
  hoa_reported?: number | string | null
  hoa_median_monthly?: number | string | null
  assoc_reported?: number | string | null
  assoc_yes?: number | string | null
  window_from?: string | null
}

function int(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : null
}

/**
 * Turn one measured row into what may be said about it. Each of the three
 * facts is decided independently, because a place can honestly have a build
 * range and nothing publishable about dues.
 */
function publishable(row: RpcRow): PlaceCharacter | null {
  const subType = (row.segment ?? '').trim()
  if (!subType) return null

  const homeCount = int(row.home_count) ?? 0
  const windowFrom = (row.window_from ?? '').trim()

  const yearSample = int(row.year_sample) ?? 0
  const p10 = int(row.year_p10)
  const p90 = int(row.year_p90)
  const yearBuilt: PlaceYearBuilt | null =
    yearSample >= YEAR_BUILT_MIN_SAMPLE && p10 != null && p90 != null && p10 <= p90
      ? { p10, p90, sample: yearSample }
      : null

  const duesReported = int(row.hoa_reported) ?? 0
  const duesMedian = int(row.hoa_median_monthly)
  const dues: PlaceDues | null =
    duesReported >= DUES_MIN_REPORTED && duesMedian != null && duesMedian > 0 && windowFrom
      ? { medianMonthly: duesMedian, reported: duesReported, windowFrom }
      : null

  const assocReported = int(row.assoc_reported) ?? 0
  const assocYes = int(row.assoc_yes) ?? 0
  // R3, and the one place this read is deliberately narrower than the rule:
  // a yes-count of zero is not published. It is arithmetically a count, but a
  // reader collapses "0 of 161 reported an HOA" into "no HOA here", which is
  // the sentence the rule forbids and the one that costs a buyer money.
  const hoaPresence: PlaceHoaPresence | null =
    assocReported >= HOA_PRESENCE_MIN_REPORTED && assocYes >= 1 && windowFrom
      ? { yes: assocYes, reported: assocReported, windowFrom }
      : null

  if (!yearBuilt && !dues && !hoaPresence) return null

  return {
    subType,
    noun: placeCharacterNoun(subType, 2),
    homeCount,
    yearBuilt,
    dues,
    hoaPresence,
  }
}

/**
 * Detached leads when detached has anything to say. Otherwise the largest
 * dwelling type that does. The RPC already orders by home count descending, so
 * "first publishable dwelling row" is "largest publishable dwelling type".
 */
export function selectPlaceCharacter(rows: readonly RpcRow[]): PlaceCharacter | null {
  const dwellings = rows.filter((r) => DWELLING_SUB_TYPES.has((r.segment ?? '').trim()))

  const detached = dwellings.find((r) => (r.segment ?? '').trim() === DETACHED_SUB_TYPE)
  if (detached) {
    const picked = publishable(detached)
    if (picked) return picked
  }

  for (const row of dwellings) {
    if ((row.segment ?? '').trim() === DETACHED_SUB_TYPE) continue
    const picked = publishable(row)
    if (picked) return picked
  }
  return null
}

async function fetchPlaceCharacter(
  geoType: string,
  geoSlug: string,
): Promise<PlaceCharacter | null> {
  const type = geoType.trim()
  const slug = geoSlug.trim().toLowerCase()
  if (!type || !slug) return null

  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_place_character', {
    p_geo_type: type,
    p_geo_slug: slug,
    p_hoa_window_months: HOA_WINDOW_MONTHS,
  })

  if (error) {
    // Thrown, never swallowed. A read that returns null on a DB error renders
    // a hard failure as a confident "nothing is known about this place", and
    // makeResilientCached would then cache that for six hours. Same reason
    // getPlaceDocuments throws: a false absence is the failure mode these
    // rules exist to prevent.
    throw new Error(
      `get_place_character RPC failed for ${type}/${slug}: ${error.message}`,
    )
  }

  return selectPlaceCharacter((Array.isArray(data) ? data : []) as RpcRow[])
}

/**
 * Cached 6h. Build years move only when a home is built; dues move only when a
 * listing reports a new figure. Both are slower than the cache window.
 */
export const getPlaceCharacter = makeResilientCached(
  fetchPlaceCharacter,
  ['place-character-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market] },
  null,
)
