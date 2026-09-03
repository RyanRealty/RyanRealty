/**
 * Market-area resolution for CMA comp selection.
 *
 * The professional standard is NOT a radius. USPAP sets no proximity rule, and
 * Fannie Mae B4-1.3-08 requires comps from the subject's MARKET AREA (including
 * subdivision or project) while requiring distance to be *reported* — with a
 * direction, e.g. "1.75 miles NW" — never capped. The old 1-mile/5-mile rule was
 * retired with UAD and survives only as a soft lender overlay. The governing
 * test is buyer substitution: would a typical buyer have considered this
 * property INSTEAD of the subject?
 *
 * So the primitive here is the polygon, not the circle. `data/bend/
 * bend-neighborhood-polygons.json` holds 23 non-overlapping polygons built from
 * the City of Bend GIS neighborhood mesh — authoritative boundaries that already
 * follow the real dividing features. Distance is computed for DISCLOSURE, and
 * used only to order and to bound the last-resort tier.
 *
 * Researched and locked 2026-07-28 — see
 * docs/plans/PROSPECT_TO_CMA_AND_SITE_IA_2026-07-28.md §A5.
 */

import polygonData from '@/data/bend/bend-neighborhood-polygons.json'

type Ring = number[][]
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
type Community = {
  slug: string
  route_slug: string
  name: string
  tier: string
  centroid: { lng: number; lat: number }
  geometry: Geometry
}

const COMMUNITIES = (polygonData as { communities: Community[] }).communities

/** Ray-casting point-in-ring. Coordinates are [lng, lat] (GeoJSON order). */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Outer ring contains the point and no hole excludes it. */
function pointInPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (rings.length === 0 || !pointInRing(lng, lat, rings[0]!)) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i]!)) return false // inside a hole
  }
  return true
}

function pointInGeometry(lng: number, lat: number, g: Geometry): boolean {
  if (g.type === 'Polygon') return pointInPolygon(lng, lat, g.coordinates)
  return g.coordinates.some((poly) => pointInPolygon(lng, lat, poly))
}

export type LatLngBounds = { latMin: number; latMax: number; lngMin: number; lngMax: number }

function extendBounds(b: LatLngBounds, ring: Ring): void {
  for (const [lng, lat] of ring) {
    if (lat < b.latMin) b.latMin = lat
    if (lat > b.latMax) b.latMax = lat
    if (lng < b.lngMin) b.lngMin = lng
    if (lng > b.lngMax) b.lngMax = lng
  }
}

/**
 * Axis-aligned bounding box of a market area, for pushing the geography INTO
 * the comp query.
 *
 * Why this exists: the polygon test is exact but runs in memory, and the pool
 * query returns the 100 most recent citywide sales. Filtering after that limit
 * means the neighborhood tier only sees whichever recent sales happen to fall
 * inside it. Measured on 922 Ogden (River West): 1,026 in-band closed sales
 * citywide, 32 detached inside River West, but the 100-row pool surfaced only
 * 5 of them. The tier starved and the ladder fell through to weaker submarkets.
 *
 * The bbox is a superset of the polygon, so it never drops a comp the polygon
 * would keep — `resolveMarketArea` still makes the exact call afterward.
 */
export function marketAreaBounds(areaId: string | null): LatLngBounds | null {
  if (!areaId) return null
  const community = COMMUNITIES.find((c) => c.slug === areaId)
  if (!community) return null
  const b: LatLngBounds = { latMin: 90, latMax: -90, lngMin: 180, lngMax: -180 }
  const g = community.geometry
  if (g.type === 'Polygon') for (const ring of g.coordinates) extendBounds(b, ring)
  else for (const poly of g.coordinates) for (const ring of poly) extendBounds(b, ring)
  return b.latMin > b.latMax ? null : b
}

/**
 * Bounding box covering a radius in miles around a point — the same
 * push-into-the-query trick for the distance-bounded fallback tiers, which
 * otherwise capped at 100 citywide rows before applying the mileage bound.
 */
export function radiusBounds(
  point: { lat: number | null; lng: number | null },
  miles: number,
): LatLngBounds | null {
  if (point.lat == null || point.lng == null) return null
  const latDelta = miles / 69
  const lngDelta = miles / (69 * Math.max(0.01, Math.cos((point.lat * Math.PI) / 180)))
  return {
    latMin: point.lat - latDelta,
    latMax: point.lat + latDelta,
    lngMin: point.lng - lngDelta,
    lngMax: point.lng + lngDelta,
  }
}

/**
 * The GIS neighborhood/community a coordinate falls in, or null when it is
 * outside every mapped polygon (rural, or a city we have no mesh for).
 * Null is a legitimate answer, not a failure — callers fall back to distance.
 */
export function resolveMarketArea(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  for (const c of COMMUNITIES) {
    if (pointInGeometry(lng, lat, c.geometry)) return c.slug
  }
  return null
}

/** Display name for a market-area slug. */
export function marketAreaName(slug: string | null): string | null {
  if (!slug) return null
  return COMMUNITIES.find((c) => c.slug === slug)?.name ?? null
}

/** GIS polygon for a Bend neighborhood mesh slug, or null. */
export function marketAreaGeometry(slug: string | null): Geometry | null {
  if (!slug) return null
  return COMMUNITIES.find((c) => c.slug === slug)?.geometry ?? null
}

const EARTH_RADIUS_MILES = 3958.7613

/** Straight-line miles between two coordinates — the distance Fannie Mae requires be reported. */
export function distanceMiles(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(s)))
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/** Compass direction from subject to comp, e.g. "NW" — the direction Fannie Mae requires alongside the distance. */
export function bearingLabel(
  from: { lat: number | null; lng: number | null },
  to: { lat: number | null; lng: number | null },
): string | null {
  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat))
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng))
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return COMPASS[Math.round(((deg + 360) % 360) / 45) % 8]!
}

/** "1.75 miles NW" — the disclosure string. Null when either point lacks coordinates. */
export function proximityLabel(
  subject: { lat: number | null; lng: number | null },
  comp: { lat: number | null; lng: number | null },
): string | null {
  const d = distanceMiles(subject, comp)
  if (d == null) return null
  const dir = bearingLabel(subject, comp)
  return `${d.toFixed(2)} miles${dir ? ` ${dir}` : ''}`
}

/**
 * Lot-character comparability (Matt's hard exclusion, 2026-07-28: "different
 * zoning / lot character" is excluded at any distance).
 *
 * An acreage property and an in-town lot are different products with different
 * buyer pools, so they are never comparable however close they sit. The split is
 * drawn at 1 acre: below it is a platted in-town lot, at or above it is acreage.
 * Within acreage, the band still applies so a 1-acre subject is not compared to
 * a 40-acre ranch. A missing lot size on either side is UNKNOWN, and unknown
 * fails open (excluding on absent data would silently drop good comps).
 */
export function lotCharacterCompatible(subjectAcres: number | null, compAcres: number | null): boolean {
  if (subjectAcres == null || compAcres == null) return true
  const ACREAGE = 1
  const subjectIsAcreage = subjectAcres >= ACREAGE
  const compIsAcreage = compAcres >= ACREAGE
  if (subjectIsAcreage !== compIsAcreage) return false
  if (!subjectIsAcreage) return true
  return compAcres >= subjectAcres * 0.4 && compAcres <= subjectAcres * 2.5
}

/** Product class a comp competes in. Null = the MLS did not say. */
export type ProductClass =
  | 'detached'
  | 'attached'
  | 'manufactured'
  | 'leased-land'
  | 'coop'
  // Added 2026-08-26. Each of these used to fall through to null, and null
  // fails closed in productTypeCompatible — so a lot, a duplex or a
  // manufactured-in-park subject drew ZERO comps and could not be valued at
  // all. That was 1,652 closed sales over 12 months, ~15% of inventory.
  | 'lots'
  | 'recreational'
  | 'agriculture'
  | 'rangeland'
  | 'in-park'
  | 'multi-2-4'
  | 'commercial'
  | 'timeshare'

/**
 * Map the MLS `property_sub_type` to a product class.
 *
 * `PropertyType='A'` is the SFR convention (CLAUDE.md §0), but it is NOT
 * "detached house" — it is a bucket. Measured against closed Bend sales over the
 * 12 months to 2026-07-30 (1,000 rows): 818 Single Family Residence, 75
 * Townhouse, 43 Manufactured On Land, 22 Condominium, 3 Tenancy in Common, 39
 * null. So 14.3% of the pool offered to a detached subject is a different
 * product, and the selector took it.
 */
export function productClass(subType: string | null): ProductClass | null {
  if (!subType) return null
  const s = subType.toLowerCase()
  // Order matters: "Residential Leased Land" and "Stock Cooperative" must be
  // caught before any generic residential match, and neither is fee-simple
  // ownership of a house. Leased land means the buyer does not own the ground
  // under it; a co-op conveys shares in a corporation, not real property. Both
  // sit under PropertyType='A' in this MLS (30 and 6 rows), and both used to
  // fall through to null and fail OPEN against a detached subject.
  if (s.includes('leased land')) return 'leased-land'
  if (s.includes('cooperative') || s.includes('co-op')) return 'coop'
  // "In Park" before manufactured: a home in a park sits on ground the buyer
  // does not own, which is the leased-land problem, not the
  // manufactured-on-land one. 429 closed sales in 12 months.
  if (s.includes('in park')) return 'in-park'
  if (s.includes('manufactured') || s.includes('mobile')) return 'manufactured'
  // Land, each type its own class (Matt 2026-08-26). A residential building lot
  // and a rangeland parcel are not the same market, and acreage alone does not
  // bridge them. Thin pools are the honest cost of that: the comp floor will
  // refuse to build rather than reach for a different kind of dirt.
  // 'rangeland' contains "land" but not "leased land", so the guard above
  // leaves it alone.
  if (s.includes('residential lots') || s.includes('lot')) return 'lots'
  if (s.includes('recreational')) return 'recreational'
  if (s.includes('agricult')) return 'agriculture'
  if (s.includes('rangeland')) return 'rangeland'
  // 2-4 units as ONE class (Matt 2026-08-26), matching how conventional
  // financing treats them. Unit count is an adjustment, not a wall. Checked
  // before the detached match because "Multi Family" carries the word family.
  if (
    s.includes('duplex') ||
    s.includes('triplex') ||
    s.includes('quadruplex') ||
    s.includes('fourplex') ||
    s.includes('multi family') ||
    s.includes('multi-family')
  ) {
    return 'multi-2-4'
  }
  if (s.includes('commercial') || s.includes('industrial') || s.includes('investment')) return 'commercial'
  if (s.includes('timeshare')) return 'timeshare'
  if (s.includes('town') || s.includes('condo') || s.includes('tenancy') || s.includes('attached')) return 'attached'
  if (s.includes('single family') || s.includes('detached') || s.includes('residence')) return 'detached'
  // Still null for a subtype nobody has mapped, and null still FAILS CLOSED in
  // productTypeCompatible. That is deliberate and load-bearing: PropertyType='A'
  // once mixed 14% attached/manufactured into a detached pool, which is how
  // Santorini townhomes appeared beside an SFR. A new MLS value gets a class
  // here on purpose, never by falling open.
  return null
}

/**
 * Product-type comparability — a hard exclusion at every tier.
 *
 * A townhome shares walls and usually carries an HOA and no private lot; a
 * manufactured home on land is financed differently. Neither competes with a
 * detached house for the same buyer, so neither is comparable at any distance.
 * Fannie Mae B4-1.3-08 requires comparable property type, and this is the rule
 * the adversarial audit was failing builds on ("violating product-type
 * comparability") after the fact — enforcing it at SELECTION is the fix, since
 * the judge only sees the contaminated set the selector already chose.
 *
 * Unknown fails CLOSED. PropertyType='A' mixes detached houses with
 * townhomes and condos. A missing sub-type used to fail open and that is
 * how attached product entered an SFR set (the rivals page, and any priced
 * sale whose subtype was blank). Same product type only. Townhouse is not
 * a condominium.
 */
export type AttachedKind = 'townhouse' | 'condo' | 'tic' | 'other-attached'

export function attachedKind(subType: string): AttachedKind {
  const s = subType.toLowerCase()
  if (s.includes('town')) return 'townhouse'
  if (s.includes('condo')) return 'condo'
  if (s.includes('tenancy')) return 'tic'
  return 'other-attached'
}

export function productTypeCompatible(subjectSubType: string | null, compSubType: string | null): boolean {
  const subjectClass = productClass(subjectSubType)
  const compClass = productClass(compSubType)
  if (subjectClass == null || compClass == null) return false
  if (subjectClass !== compClass) return false
  if (subjectClass === 'attached') {
    return attachedKind(subjectSubType!) === attachedKind(compSubType!)
  }
  return true
}

/** Rivals and market-area rows. Known subject uses the hard rule. Unknown subject still drops attached product. */
export function keepSameProductType(subjectSubType: string | null, otherSubType: string | null): boolean {
  if (productClass(subjectSubType) != null) return productTypeCompatible(subjectSubType, otherSubType)
  const other = productClass(otherSubType)
  return other == null || other === 'detached'
}

/** D1: detached is this MLS value, not PropertyType A. */
export const DETACHED_PROPERTY_SUB_TYPE = 'Single Family Residence'

/**
 * `property_sub_type` the comps SQL should eq. Detached always pins D1 SFR.
 * Townhouse / condo / manufactured pass through the subject's MLS value.
 * Null subject type does not force SFR — JS keepSameProductType still applies.
 */
export function compPoolPropertySubType(subjectSubType: string | null): string | null {
  const cls = productClass(subjectSubType)
  if (cls === 'detached') return DETACHED_PROPERTY_SUB_TYPE
  // 2-4 unit is ONE class spanning several MLS values, so pinning the SQL to
  // the subject's own value would hide every other size from the pool — a
  // duplex subject would never see a triplex sale. Leave the SQL open and let
  // the JS class check (productTypeCompatible, a hard exclusion at every tier)
  // do the matching. Same reasoning as an unknown subtype: SQL narrows where it
  // safely can, JS is the gate.
  if (cls === 'multi-2-4') return null
  const trimmed = subjectSubType?.trim() || ''
  if (cls != null && trimmed) return trimmed
  return null
}

/**
 * Whole bathroom count must match. A one-bath house and a two-bath house
 * are different buyers. Half baths do not change the whole count (1.0 and
 * 1.5 both count as one). Unknown on the sale fails closed when the
 * subject count is known.
 */
export function bathCountCompatible(subjectBaths: number | null, compBaths: number | null): boolean {
  if (subjectBaths == null || !Number.isFinite(subjectBaths) || subjectBaths <= 0) return true
  if (compBaths == null || !Number.isFinite(compBaths) || compBaths <= 0) return false
  return Math.floor(subjectBaths) === Math.floor(compBaths)
}

/**
 * Year/quality and acreage infrastructure live in lib/pricing/classes.ts —
 * the facts-path source of truth. Re-exported so the listings fallback
 * (lib/cma/comps.ts) stays on the same functions.
 */
export {
  CUSTOM_NEW_YEAR_BAND,
  acreageInfrastructureCompatible,
  acreageInfrastructureFlags,
  isCustomOrNewSubject,
  remarksMarkCustomOrNew,
  yearQualityCompatible,
  type AcreageInfrastructureFlags,
  type YearQualityInput,
} from '@/lib/pricing/classes'
