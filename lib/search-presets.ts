/**
 * Predefined search presets for SEO-friendly, indexable pages.
 * Used for: /homes-for-sale/[city]/[preset] and /homes-for-sale/[city]/[subdivision]/[preset].
 * Each preset maps to search params and a human-readable label for titles and breadcrumbs.
 *
 * Also owns the `viewContains` vocabulary (bottom of file) — the one place that
 * decides which enumerated `view_types` values a view term covers, shared by the
 * DAL routing and the SEO matrix so both answer the same question.
 */

export type SearchPreset = {
  slug: string
  label: string
  /** Short label for "in {place}" e.g. "Under $500K", "Pending" */
  shortLabel: string
  /**
   * When set, the route owner renders a dedicated immersive landing page
   * instead of the generic search results layout. The route branch checks
   * this field before falling through to the default results view.
   * Currently supported values: "golf"
   */
  landing?: 'golf'
  params: {
    maxPrice?: number
    minPrice?: number
    statusFilter?: 'active' | 'active_and_pending' | 'pending' | 'closed' | 'all'
    newListingsDays?: number
    hasOpenHouse?: boolean
    hasPool?: boolean
    hasView?: boolean
    hasFireplace?: boolean
    hasGolfCourse?: boolean
    hasWaterfront?: boolean
    /**
     * View keyword. Resolved to the enumerated `view_types` values it covers
     * (lib/search/view-contains.ts) and served from listing_search_mv on
     * on-market scopes; closed/off-market scopes keep the legacy
     * `view_text ILIKE '%term%'` RPC predicate, which is the same test.
     */
    viewContains?: string
    /** Minimum lot size in acres (details.LotSizeAcres >= value) */
    lotAcresMin?: number
    /** Minimum year built. Use yearBuiltMinOffset for a year relative to "now". */
    yearBuiltMin?: number
    /**
     * Year-built floor expressed as an offset from the current year (e.g. 2 ⇒
     * "built in the last ~2 years"). Resolved at request time by
     * resolvePresetYearBuiltMin so "new construction" stays current without a
     * hard-coded year drifting stale in the source.
     */
    yearBuiltMinOffset?: number
    /**
     * LEGACY scalar sub-type param. No preset carries it anymore (remapped to
     * propertySubTypes 2026-07-30); the key survives so old saved-preset
     * payloads still type-check. The DAL resolves it to EXACT canonical
     * values — the substring contract is gone (plan §4.8.4).
     */
    propertySubType?: string
    /**
     * Enumerated PropertySubType values — exact canonical feed strings from
     * the propertySubTypes registry field, applied as IN (plan §4.4).
     */
    propertySubTypes?: string[]
    /**
     * Property type filter value (Residential / Land / Commercial), mapped to
     * MLS codes by propertyTypeFilterToCodes. Powers the lots-and-land preset
     * (conversion-audit 2026-07-15 #12: "bend buildable lots" demand measured
     * in GSC with no dedicated page).
     */
    propertyType?: string
    /**
     * MLS-verified gated flag (hoa_amenities/parking_features contains
     * 'Gated' — the searchListingsAll registry filter). Powers the
     * gated-community preset (GSC: "bend gated community homes").
     */
    gatedCommunity?: boolean
    /** Free-text keyword matched against the listing's PublicRemarks. */
    keywords?: string
    sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc'
  }
}

/**
 * Resolve the effective yearBuiltMin for a preset. When a preset uses
 * yearBuiltMinOffset (e.g. "new construction" = built in the last 2 years),
 * compute the floor relative to the current year so the filter never goes
 * stale. An explicit yearBuiltMin always wins.
 */
export function resolvePresetYearBuiltMin(preset: SearchPreset, now: Date = new Date()): number | undefined {
  if (preset.params.yearBuiltMin != null) return preset.params.yearBuiltMin
  if (preset.params.yearBuiltMinOffset != null) {
    return now.getFullYear() - preset.params.yearBuiltMinOffset
  }
  return undefined
}

export const SEARCH_PRESETS: SearchPreset[] = [
  // Price tiers
  { slug: 'under-300k', shortLabel: 'Under $300K', label: 'Homes Under $300,000', params: { maxPrice: 300_000, sort: 'newest' } },
  { slug: 'under-400k', shortLabel: 'Under $400K', label: 'Homes Under $400,000', params: { maxPrice: 400_000, sort: 'newest' } },
  { slug: 'under-500k', shortLabel: 'Under $500K', label: 'Homes Under $500,000', params: { maxPrice: 500_000, sort: 'newest' } },
  { slug: 'under-600k', shortLabel: 'Under $600K', label: 'Homes Under $600,000', params: { maxPrice: 600_000, sort: 'newest' } },
  { slug: 'under-750k', shortLabel: 'Under $750K', label: 'Homes Under $750,000', params: { maxPrice: 750_000, sort: 'newest' } },
  { slug: 'under-1m', shortLabel: 'Under $1M', label: 'Homes Under $1 Million', params: { maxPrice: 1_000_000, sort: 'newest' } },
  { slug: 'under-1-5m', shortLabel: 'Under $1.5M', label: 'Homes Under $1.5 Million', params: { maxPrice: 1_500_000, sort: 'newest' } },
  { slug: 'luxury', shortLabel: 'Luxury', label: 'Luxury Homes', params: { minPrice: 1_000_000, sort: 'newest' } },
  { slug: 'over-1-5m', shortLabel: '$1.5M+', label: 'Homes Over $1.5 Million', params: { minPrice: 1_500_000, sort: 'price_desc' } },
  { slug: 'over-2m', shortLabel: '$2M+', label: 'Homes Over $2 Million', params: { minPrice: 2_000_000, sort: 'price_desc' } },
  // Status / recency
  { slug: 'pending', shortLabel: 'Pending', label: 'Pending / Under Contract', params: { statusFilter: 'pending', sort: 'newest' } },
  { slug: 'new-listings', shortLabel: 'New Listings', label: 'New Listings (Last 7 Days)', params: { newListingsDays: 7, sort: 'newest' } },
  { slug: 'new-listings-30', shortLabel: 'New This Month', label: 'New Listings (Last 30 Days)', params: { newListingsDays: 30, sort: 'newest' } },
  { slug: 'open-house', shortLabel: 'Open House', label: 'Open House', params: { hasOpenHouse: true, sort: 'newest' } },
  // New construction — yearBuiltMinOffset keeps the floor current (built in the last ~2 years)
  { slug: 'new-construction', shortLabel: 'New Construction', label: 'New Construction Homes', params: { yearBuiltMinOffset: 2, sort: 'newest' } },
  // Land / lot
  { slug: 'acreage', shortLabel: 'Acreage', label: 'Homes on Acreage (1+ Acres)', params: { lotAcresMin: 1, sort: 'newest' } },
  { slug: 'acreage-5', shortLabel: '5+ Acres', label: 'Homes on 5+ Acres', params: { lotAcresMin: 5, sort: 'newest' } },
  // Bare lots/land (PropertyType D) — GSC-measured demand: "bend buildable
  // lots" ranked /cities/bend at pos 36-55 with no dedicated surface
  // (conversion-audit #12).
  { slug: 'lots-and-land', shortLabel: 'Lots and Land', label: 'Lots and Land for Sale', params: { propertyType: 'Land', sort: 'newest' } },
  // Residential Lots only — the buildable-lot slice of class D, without the
  // commercial / agriculture / rangeland listings lots-and-land sweeps in.
  // Live inventory verified 2026-07-31: 1,501 active (listing_search_mv,
  // property_sub_type = 'Residential Lots', standard_status = 'Active').
  { slug: 'residential-lots', shortLabel: 'Residential Lots', label: 'Residential Lots for Sale', params: { propertySubTypes: ['Residential Lots'], sort: 'newest' } },
  // Community types
  { slug: 'gated-community', shortLabel: 'Gated Community', label: 'Gated Community Homes', params: { gatedCommunity: true, sort: 'newest' } },
  // Property types — exact enumerated sub-type sets (plan §4.4, 2026-07-30).
  // Slugs unchanged (live SEO routes); only the filter contract moved from
  // the substring scalar to explicit canonical value sets.
  { slug: 'condos', shortLabel: 'Condos', label: 'Condos for Sale', params: { propertySubTypes: ['Condominium'], sort: 'newest' } },
  { slug: 'townhomes', shortLabel: 'Townhomes', label: 'Townhomes for Sale', params: { propertySubTypes: ['Townhouse'], sort: 'newest' } },
  // Multi-family / income (MLS PropertyType C — duplex/triplex/fourplex,
  // verified against the live MV in lib/property-type.ts 2026-06-08).
  // "multi-family homes in Redmond" had no reachable surface before this
  // preset existed (W3.2 search-matrix audit, 2026-07-21).
  { slug: 'multi-family', shortLabel: 'Multi-Family', label: 'Multi-Family & Income Properties', params: { propertyType: 'Multi-Family', sort: 'newest' } },
  // Per-sub-type splits of the class-C umbrella above. Each slug targets ONE
  // canonical PropertySubType value from the field registry — exact IN-set
  // filtering, same contract as condos/townhomes. Live inventory verified
  // 2026-07-31 (listing_search_mv, standard_status = 'Active'): Duplex 73,
  // Triplex 13, Quadruplex 20. The fourplex slug uses the search term buyers
  // type; the feed's canonical value is 'Quadruplex'.
  { slug: 'duplex', shortLabel: 'Duplexes', label: 'Duplexes for Sale', params: { propertySubTypes: ['Duplex'], sort: 'newest' } },
  { slug: 'triplex', shortLabel: 'Triplexes', label: 'Triplexes for Sale', params: { propertySubTypes: ['Triplex'], sort: 'newest' } },
  { slug: 'fourplex', shortLabel: 'Fourplexes', label: 'Fourplexes for Sale', params: { propertySubTypes: ['Quadruplex'], sort: 'newest' } },
  // Manufactured homes — ALL THREE manufactured sub types, explicitly. The
  // old substring param ('Manufactured') claimed to cover class B but never
  // did: 'In Park' and 'On Leased Land' do not contain "Manufactured", so the
  // page under-reported by 308 of 895 listings (34%). This value set is the
  // §4.3 defect-1 fix — a deliberate, measured correction (~587 → ~895),
  // approved 2026-07-30.
  { slug: 'manufactured', shortLabel: 'Manufactured', label: 'Manufactured Homes', params: { propertySubTypes: ['Manufactured On Land', 'In Park', 'On Leased Land'], sort: 'newest' } },
  // Layout / lifestyle (PublicRemarks keyword match)
  { slug: 'single-level', shortLabel: 'Single Level', label: 'Single-Level Homes', params: { keywords: 'single level', sort: 'newest' } },
  { slug: 'with-shop', shortLabel: 'With Shop', label: 'Homes with a Shop', params: { keywords: 'shop', sort: 'newest' } },
  { slug: 'rv-parking', shortLabel: 'RV Parking', label: 'Homes with RV Parking', params: { keywords: 'RV', sort: 'newest' } },
  // Features
  { slug: 'with-pool', shortLabel: 'With Pool', label: 'Homes with Pool', params: { hasPool: true, sort: 'newest' } },
  { slug: 'with-view', shortLabel: 'With View', label: 'Homes with View', params: { hasView: true, sort: 'newest' } },
  { slug: 'with-fireplace', shortLabel: 'With Fireplace', label: 'Homes with Fireplace', params: { hasFireplace: true, sort: 'newest' } },
  { slug: 'on-golf-course', shortLabel: 'On Golf Course', label: 'Homes on Golf Course', landing: 'golf', params: { hasGolfCourse: true, sort: 'newest' } },
  // View types. The term resolves to the enumerated view_types values it
  // covers (lib/search/view-contains.ts). Live inventory verified 2026-07-31
  // (listing_search_mv, Active + Active Under Contract, service-area cities):
  // Mountain 1,086 · River 124 · Golf 207 · Lake 51 · Water 332.
  { slug: 'mountain-view', shortLabel: 'Mountain View', label: 'Homes with Mountain View', params: { viewContains: 'Mountain', sort: 'newest' } },
  // Water: the feed never writes the literal string "Water" (0 active rows), it
  // names the body of water. The term maps to those values — see
  // VIEW_CONTAINS_INTENT_VALUES for why that is the honest read, not a stretch.
  { slug: 'water-view', shortLabel: 'Water View', label: 'Homes with Water View', params: { viewContains: 'Water', sort: 'newest' } },
  { slug: 'river-view', shortLabel: 'River View', label: 'Homes with River View', params: { viewContains: 'River', sort: 'newest' } },
  { slug: 'golf-course-view', shortLabel: 'Golf Course View', label: 'Homes with Golf Course View', params: { viewContains: 'Golf', sort: 'newest' } },
  { slug: 'lake-view', shortLabel: 'Lake View', label: 'Homes with Lake View', params: { viewContains: 'Lake', sort: 'newest' } },
  // Sorts
  { slug: 'price-low-to-high', shortLabel: 'Price: Low to High', label: 'Homes by Price (Low to High)', params: { sort: 'price_asc' } },
  { slug: 'price-high-to-low', shortLabel: 'Price: High to Low', label: 'Homes by Price (High to Low)', params: { sort: 'price_desc' } },
]

const PRESET_BY_SLUG = new Map(SEARCH_PRESETS.map((p) => [p.slug, p]))

export function getPresetBySlug(slug: string): SearchPreset | null {
  if (!slug?.trim()) return null
  const key = slug.trim().toLowerCase()
  return PRESET_BY_SLUG.get(key) ?? null
}

export function isPresetSlug(slug: string): boolean {
  return getPresetBySlug(slug) !== null
}

/**
 * A preset whose params ONLY reorder results (no filter) renders the same
 * inventory as its parent page — indexable duplicate content. Sort-only
 * presets stay routable for users, but the sitemap skips them and the search
 * page marks them noindex (price-low-to-high, price-high-to-low).
 */
export function isSortOnlyPreset(preset: SearchPreset): boolean {
  const keys = Object.keys(preset.params)
  return keys.length > 0 && keys.every((k) => k === 'sort')
}

/** All preset slugs (for link generation). */
export function getAllPresetSlugs(): string[] {
  return SEARCH_PRESETS.map((p) => p.slug)
}

/** Preset slugs eligible for sitemap submission — sort-only presets excluded. */
export function getIndexablePresetSlugs(): string[] {
  return SEARCH_PRESETS.filter((p) => !isSortOnlyPreset(p)).map((p) => p.slug)
}

// ─────────────────── viewContains → the view_types vocabulary ───────────────────
//
// WHY THIS EXISTS
// The five view presets above ship `viewContains: '<term>'`. That param used to
// mean ONE thing: `listing_feature_flags.view_text ILIKE '%term%'`, which only
// `search_listings_advanced` can evaluate. With no city to narrow the candidate
// set that RPC has no servable plan (the active-status predicate is an
// unindexable `ILIKE '%Active%'`), so all five pages timed out and rendered
// "No homes match this search right now" — live, indexable, permanently empty.
//
// `listing_search_mv` carries `view_types text[]`: the SAME data as an array, on
// the indexable on-market projection the fast path already uses. Resolving the
// term to the matching vocabulary values lets those searches run there
// (measured 12.1s → timeout/empty, vs ~110-300ms → real rows).
//
// EQUIVALENCE, MEASURED 2026-07-31 BEFORE ANY CODE CHANGED
// `view_text` is the raw JSON rendering of the same key set `view_types` is
// built from (e.g. `{"Mountain(s)": true, "Territorial": true}`), verified over
// the whole on-market set: 0 rows with text but no array, 0 with array but no
// text, 0 array values absent from the text. So "view_text contains T" and
// "some view_types value contains T" are the same predicate. Per-term counts
// (listing_search_mv, standard_status IN ('Active','Active Under Contract'),
// service-area cities — the scope these no-city presets actually run in):
//
//   term      view_text ILIKE '%T%'   view_types && <mapped values>   delta
//   Mountain            1,086                  1,086                    0
//   River                 124                    124                    0
//   Golf                  207                    207                    0
//   Lake                   51                     51                    0
//   Water                   0                    332                   intent map, below
//
// Every term but Water is EXACT in both directions — 0 rows matched by one test
// and not the other.

/**
 * Every value a listing's `view_types` can carry. The first 18 are the registry
 * `viewTypes` options (lib/search/field-registry.ts); the last four are live
 * feed values the registry's UI facet list does not offer. Measured against
 * listing_search_mv 2026-07-31 (22 distinct values in the data, 18 in the
 * registry) — resolution runs against the FULL vocabulary, because matching only
 * the facet subset is exactly how a promoted-column mapping silently
 * under-reports. Kept in lockstep with the registry by a unit test.
 */
const VIEW_TYPE_VOCABULARY: readonly string[] = [
  'Territorial', 'Neighborhood', 'Mountain(s)', 'Cascade Mountains', 'Panoramic',
  'Forest', 'Valley', 'City', 'Golf Course', 'Lake', 'River', 'Pond', 'Ridge',
  'Creek/Stream', 'Park/Greenbelt', 'Desert', 'Canyon', 'Vineyard',
  'Orchard', 'Ocean', 'Beach', 'Bay',
]

/**
 * Terms the MLS View field never spells literally, mapped to the values that
 * carry the same meaning.
 *
 * `water` is the only entry. "Homes with Water View" is a real buyer intent and
 * a real search query, but NO active listing's View contains the string
 * "Water" — the feed names the body of water instead. Matching those values
 * turns a permanently-empty indexable page into the homes that genuinely have
 * an MLS-verified view of water. A deliberate, measured correction (0 → 332),
 * same class as the manufactured sub-type fix (587 → 895, 2026-07-30): the old
 * number was not a smaller true answer, it was the wrong question asked of the
 * data.
 *
 * Waterfront is deliberately NOT here — owning frontage is a different claim
 * from having a view of water, and it has its own filters (hasWaterfront /
 * waterfrontTypes).
 */
const VIEW_CONTAINS_INTENT_VALUES: Record<string, readonly string[]> = {
  water: ['Lake', 'River', 'Pond', 'Creek/Stream', 'Ocean', 'Bay', 'Beach'],
}

/**
 * Resolve a `viewContains` term to the enumerated `view_types` values it covers.
 *
 * Returns null when the term matches nothing — callers MUST treat null as "this
 * filter cannot be served from listing_search_mv" and keep their existing
 * routing, so an unknown term never silently becomes an unfiltered search.
 */
export function resolveViewContainsValues(term: string | null | undefined): readonly string[] | null {
  const needle = String(term ?? '').trim().toLowerCase()
  if (!needle) return null
  const matched = new Set<string>(VIEW_CONTAINS_INTENT_VALUES[needle] ?? [])
  for (const value of VIEW_TYPE_VOCABULARY) {
    if (value.toLowerCase().includes(needle)) matched.add(value)
  }
  return matched.size > 0 ? [...matched] : null
}

/**
 * Row-level form of the same predicate: does this listing's `view_types` array
 * satisfy `viewContains: term`?
 *
 * UNION of the resolved value set and the raw substring test, so a value that
 * exists in the feed but not yet in the vocabulary above still matches — this
 * function can only ever be as wide as the legacy substring semantics, never
 * narrower. Used by the SEO matrix so sitemap emission and the DAL answer the
 * same question (two generation paths disagreeing about one page is a failure
 * mode this repo has already paid for).
 */
export function viewContainsMatchesValues(
  term: string | null | undefined,
  values: readonly (string | null)[] | null | undefined,
): boolean {
  const needle = String(term ?? '').trim().toLowerCase()
  if (!needle) return false
  if (!Array.isArray(values) || values.length === 0) return false
  const resolved = resolveViewContainsValues(needle)
  const resolvedSet = new Set(resolved ?? [])
  return values.some((raw) => {
    const value = raw ?? ''
    return resolvedSet.has(value) || value.toLowerCase().includes(needle)
  })
}

/**
 * viewContains -> the `viewTypes` registry multi listing_search_mv serves
 * natively, as a spreadable filter fragment.
 *
 * An EXPLICIT viewTypes selection wins and this contributes nothing — the same
 * contract every other preset key follows ("a preset only fills filters the
 * visitor has not set in the URL"). Returns {} for an unresolvable term, which
 * never reaches here anyway: that case stays on the legacy RPC.
 */
export function viewContainsAsViewTypes(options: {
  viewContains?: string
  viewTypes?: string[]
}): { viewTypes?: string[] } {
  const term = options.viewContains?.trim()
  if (!term) return {}
  if (Array.isArray(options.viewTypes) && options.viewTypes.length > 0) return {}
  const values = resolveViewContainsValues(term)
  return values ? { viewTypes: [...values] } : {}
}

/** Test-only: the vocabulary the resolver matches against. */
export const __VIEW_TYPE_VOCABULARY_FOR_TESTS = VIEW_TYPE_VOCABULARY
