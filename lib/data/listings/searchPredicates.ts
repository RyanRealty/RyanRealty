/**
 * searchPredicates — the predicate tables behind searchListingsAll.
 *
 * Pure extraction from searchListingsAll.ts (file-size budget, 2026-07-30):
 * the boolean predicate table, the registry-derived multi/text/range column
 * maps, and the two PostgREST literal escapers. No query execution lives here —
 * searchListingsAll.ts owns the builder; this module owns the
 * filter-key -> listing_search_mv column contract.
 *
 * Drift gate: lib/data/listings/searchListingsAll.test.ts asserts every
 * registry field (lib/search/field-registry.ts) resolves through these tables
 * and through the zod FilterSchema — a registry addition that is not wired
 * here fails the suite instead of silently not filtering.
 */

import { SEARCH_FIELDS } from '@/lib/search/field-registry'

/**
 * PostgREST array literal with every element quoted — safe for values carrying
 * spaces, slashes, or parens ("RV Access/Parking", "Skylight(s)"). Braces,
 * quotes, and backslashes are stripped from elements: no registry vocabulary
 * uses them, so a URL-injected value simply matches nothing.
 */
export function arrayLiteral(values: readonly string[]): string {
  return `{${values.map((v) => `"${v.replace(/[\\"{}]/g, '').trim()}"`).join(',')}}`
}

/** Strip ILIKE wildcards + escapes for exact case-insensitive matching. */
export function ilikeExact(value: string): string {
  // * is a PostgREST wildcard (translated to %) — strip it along with SQL's.
  return value.replace(/[%_*\\]/g, '').trim()
}

/**
 * Sanitize a value for embedding inside a DOUBLE-QUOTED PostgREST `or()`
 * literal. On top of the LIKE wildcards, the or() grammar itself reserves
 * `"` , `,` , `(` and `)` — a URL-injected one would close the quote and
 * rewrite the filter tree. No registry vocabulary uses any of them, so a
 * stripped value simply matches nothing.
 */
export function orLiteral(value: string): string {
  return value.replace(/[%_*\\"(),]/g, '').trim()
}

/**
 * PostgREST `or()` branch set matching a ', '-joined SCALAR list column by
 * TOKEN, for registry fields flagged `multiValueScalar`.
 *
 * `levels` is the one such column: the feed multi-selects into it, so 106
 * on-market rows read "One, Two" or "Three Or More, Multi/Split". Whole-string
 * IN matched none of them and those homes were unreachable from every Stories
 * option. Four branches per value cover the four positions a token can hold —
 * sole value, first, last, interior. Each value is double-quoted so the comma
 * inside a pattern is not read as an or() separator, and `*` is PostgREST's
 * LIKE wildcard.
 *
 * Exact by construction, never substring: every branch anchors the token
 * against ', ' or a string boundary, so 'One' cannot match inside another
 * value the way a bare `*One*` would.
 */
export function tokenScalarOrExpr(col: string, values: readonly string[]): string {
  return values
    .map(orLiteral)
    .filter(Boolean)
    .flatMap((v) => [
      `${col}.eq."${v}"`,
      `${col}.like."${v}, *"`,
      `${col}.like."*, ${v}"`,
      `${col}.like."*, ${v}, *"`,
    ])
    .join(',')
}

export type BooleanPredicate =
  | { op: 'isTrue'; col: string }
  /**
   * col IS FALSE (noHoa). Explicit false only — NULL is "the listing did not
   * answer", never "no". Replaced `notTrue` (IS DISTINCT FROM true) on
   * 2026-07-31: that swept 761 live unknown-HOA rows into a filter labelled
   * "No HOA".
   */
  | { op: 'isFalse'; col: string }
  | { op: 'eqValue'; col: string; value: string }
  | { op: 'containsAll'; col: string; values: readonly string[] }
  | { op: 'overlapsAny'; col: string; values: readonly string[] }
  /** Multi-column OR in PostgREST syntax (contract "DAL expression" fields). */
  | { op: 'orExpr'; expr: string }
  /** view_types is a real non-empty view beyond bare 'Neighborhood'. */
  | { op: 'hasView' }

/** Boolean predicates, 1:1 with the registry's boolean fields. */
export const BOOLEAN_PREDICATES = {
  hasFireplace: { op: 'isTrue', col: 'fireplace_yn' },
  hasPool: { op: 'isTrue', col: 'pool_yn' },
  hasWaterfront: { op: 'isTrue', col: 'waterfront_yn' },
  hasView: { op: 'hasView' },
  hasGolfCourse: {
    op: 'orExpr',
    expr: `view_types.cs.${arrayLiteral(['Golf Course'])},lot_features_arr.cs.${arrayLiteral(['On Golf Course'])}`,
  },
  newConstruction: { op: 'isTrue', col: 'new_construction_yn' },
  basement: { op: 'isTrue', col: 'basement_yn' },
  horseProperty: { op: 'isTrue', col: 'horse_yn' },
  seniorCommunity: { op: 'isTrue', col: 'senior_community_yn' },
  noHoa: { op: 'isFalse', col: 'association_yn' },
  irrigationRights: { op: 'isTrue', col: 'irrigation_water_rights_yn' },
  hasVirtualTour: { op: 'isTrue', col: 'has_virtual_tour' },
  hasOpenHouse: { op: 'isTrue', col: 'has_open_house' },
  priceReduced: { op: 'isTrue', col: 'price_reduced' },
  ownerWillCarry: { op: 'containsAll', col: 'listing_terms', values: ['Owner Will Carry'] },
  strAllowed: { op: 'containsAll', col: 'community_features', values: ['Short Term Rentals Allowed'] },
  gatedCommunity: {
    op: 'orExpr',
    expr: `hoa_amenities.cs.${arrayLiteral(['Gated'])},parking_features.cs.${arrayLiteral(['Gated'])}`,
  },
  guestHouse: { op: 'containsAll', col: 'other_structures', values: ['Guest House'] },
  shop: {
    op: 'orExpr',
    expr: `other_structures.cs.${arrayLiteral(['Workshop'])},parking_features.cs.${arrayLiteral(['Workshop in Garage'])}`,
  },
  rvParking: {
    op: 'orExpr',
    expr: `parking_features.ov.${arrayLiteral(['RV Access/Parking', 'RV Garage'])},other_structures.cs.${arrayLiteral(['RV/Boat Storage'])}`,
  },
  rvGarage: { op: 'containsAll', col: 'parking_features', values: ['RV Garage'] },
  evCharging: { op: 'containsAll', col: 'parking_features', values: ['Electric Vehicle Charging Station(s)'] },
  heatedGarage: { op: 'containsAll', col: 'parking_features', values: ['Heated Garage'] },
  singleLevel: { op: 'eqValue', col: 'levels', value: 'One' },
  primaryOnMain: { op: 'containsAll', col: 'interior_features', values: ['Primary Downstairs'] },
  inLawFloorplan: { op: 'containsAll', col: 'interior_features', values: ['In-Law Floorplan'] },
  fencedYard: { op: 'containsAll', col: 'lot_features_arr', values: ['Fenced'] },
  onGolfCourse: { op: 'containsAll', col: 'lot_features_arr', values: ['On Golf Course'] },
  adjoinsPublicLand: {
    op: 'orExpr',
    expr: `lot_features_arr.cs.${arrayLiteral(['Adjoins Public Lands'])},community_features.cs.${arrayLiteral(['Access to Public Lands'])}`,
  },
  onWell: { op: 'overlapsAny', col: 'water_source', values: ['Well', 'Shared Well'] },
  publicWater: { op: 'containsAll', col: 'water_source', values: ['Public'] },
  onSeptic: {
    op: 'overlapsAny',
    col: 'sewer_types',
    values: [
      'Septic Tank',
      'Standard Leach Field',
      'Sand Filter',
      'Alternative Treatment Tech System',
      'Holding Tank',
      'Capping Fill',
    ],
  },
  publicSewer: { op: 'containsAll', col: 'sewer_types', values: ['Public Sewer'] },
  // ── CF tranche (2026-07-30) — promoted *_yn columns, MV v3 migration.
  //    spa/carport/homeWarranty were removed 2026-07-30: their source
  //    StandardFields are masked ("********") at our feed level, the columns
  //    are 100% null, and the filters could never match (accuracy audit). ──
  adu: { op: 'isTrue', col: 'adu_yn' },
  aduPermitted: { op: 'isTrue', col: 'adu_permitted_yn' },
  strPermit: { op: 'isTrue', col: 'str_permit_yn' },
  ccrs: { op: 'isTrue', col: 'ccrs_yn' },
  hasFloorPlan: { op: 'isTrue', col: 'has_floor_plan' },
  hasVideo: { op: 'isTrue', col: 'has_video' },
  // ── MV v4 long-tail tranche (2026-07-31, plan §15). Every column is a
  //    v4 addition to listing_search_mv; all eight are plain IS TRUE. The two
  //    single-member CF groups (high_speed_internet_yn, second_residence_yn)
  //    are true/false rather than true/null — presence of the member key IS
  //    the assertion, there is no "No" side in the feed — which changes
  //    nothing here because only the true side is ever filtered. ──
  attachedGarage: { op: 'isTrue', col: 'attached_garage_yn' },
  rented: { op: 'isTrue', col: 'rented_yn' },
  potentialTaxLiability: { op: 'isTrue', col: 'potential_tax_liability_yn' },
  specialAssessment: { op: 'isTrue', col: 'special_assessment_yn' },
  highSpeedInternet: { op: 'isTrue', col: 'high_speed_internet_yn' },
  manufacturedAllowed: { op: 'isTrue', col: 'manufactured_allowed_yn' },
  buildingPermitIssued: { op: 'isTrue', col: 'building_permit_issued_yn' },
  secondResidence: { op: 'isTrue', col: 'second_residence_yn' },
} satisfies Record<string, BooleanPredicate>

export type BooleanFilterKey = keyof typeof BOOLEAN_PREDICATES

export const BOOLEAN_FILTER_KEYS = Object.keys(BOOLEAN_PREDICATES) as BooleanFilterKey[]

/** Registry multi defs, resolved once at module load. */
export const MULTI_FIELD_DEFS = SEARCH_FIELDS.filter((def) => def.kind === 'multi')

// ── Legacy propertySubType scalar → exact value sets (plan §4.4, 2026-07-30) ──

/** The 21 canonical sub-type values, straight from the registry field. */
const PROPERTY_SUB_TYPE_OPTIONS: readonly string[] =
  SEARCH_FIELDS.find((def) => def.key === 'propertySubTypes')?.options ?? []

const CANONICAL_SUB_TYPE_BY_LOWER: ReadonlyMap<string, string> = new Map(
  PROPERTY_SUB_TYPE_OPTIONS.map((value) => [value.toLowerCase(), value])
)

/**
 * The legacy scalar `propertySubType` param's KNOWN historical vocabulary —
 * strings old URLs and pre-remap presets actually sent — mapped to the exact
 * canonical value sets they meant. 'Manufactured' expands to all three
 * manufactured sub types (classes A + B), the §4.3 defect-1 fix: the old
 * substring contract missed In Park / On Leased Land entirely.
 */
export const LEGACY_PROPERTY_SUB_TYPE_MAP: Readonly<Record<string, readonly string[]>> = {
  condo: ['Condominium'],
  condominium: ['Condominium'],
  condos: ['Condominium'],
  townhome: ['Townhouse'],
  townhouse: ['Townhouse'],
  manufactured: ['Manufactured On Land', 'In Park', 'On Leased Land'],
}

export type PropertySubTypeResolution =
  /** Apply as IN over these exact canonical values. */
  | { kind: 'in'; values: readonly string[] }
  /** Unknown string: case-insensitive EQUALITY (ilike with no wildcards). */
  | { kind: 'ciEquals'; value: string }
  /** Nothing usable after sanitizing — apply no sub-type predicate. */
  | { kind: 'none' }

/**
 * Resolve the legacy scalar `propertySubType` param to an EXACT-match
 * predicate. Never substring (§4.8.4): known legacy strings and canonical
 * values become IN sets; anything else becomes case-insensitive equality,
 * which for a value outside the feed vocabulary matches nothing — loudly
 * empty beats silently wrong.
 */
export function resolveLegacyPropertySubType(raw: string): PropertySubTypeResolution {
  const cleaned = ilikeExact(raw)
  if (!cleaned) return { kind: 'none' }
  const lower = cleaned.toLowerCase()
  const legacy = LEGACY_PROPERTY_SUB_TYPE_MAP[lower]
  if (legacy) return { kind: 'in', values: legacy }
  const canonical = CANONICAL_SUB_TYPE_BY_LOWER.get(lower)
  if (canonical) return { kind: 'in', values: [canonical] }
  return { kind: 'ciEquals', value: cleaned }
}

/**
 * Text fields (case-insensitive exact match on the MV column), straight from
 * the registry. `keywords` is excluded — it gets the word-AND address/remarks
 * OR treatment in applySearchFilters, not an exact ilike.
 */
export const TEXT_FIELD_COLUMNS: Readonly<Record<string, string>> = Object.fromEntries(
  SEARCH_FIELDS.filter((def) => def.kind === 'text' && def.key !== 'keywords').map((def) => [
    def.key,
    def.mv,
  ])
)

/**
 * Range predicates straight from the registry: filter key -> MV column, applied
 * as gte on the DAL-canonical `${key}Min` and lte on `${key}Max`. Legacy
 * one-sided fields (garageMin, domMax, hoaMonthlyMax, ...) resolve naturally —
 * the missing side is simply absent from the FilterSchema and skipped.
 */
export const RANGE_FIELD_COLUMNS: Readonly<Record<string, string>> = Object.fromEntries(
  SEARCH_FIELDS.filter((def) => def.kind === 'range').map((def) => [def.key, def.mv])
)
