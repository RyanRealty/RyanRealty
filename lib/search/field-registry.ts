/**
 * Search field registry — single source of truth for every consumer-facing
 * listing search filter. Drives: URL params, the All-filters sheet, the
 * voice/NL parser, and the saved-search whitelist.
 *
 * Authored from CONTRACT-search-field-exposure (2026-07-11). Option arrays are
 * canonical DB strings harvested live from the on-market feed, in prevalence
 * order. Data-noise values ('None', 'Other', 'Unknown', 'See Remarks') are
 * dropped from UI options.
 *
 * OPTION-EXPOSURE BAR (set 2026-07-31, after a coverage audit found 40 real
 * values with no filter option):
 * - >= 25 live active listings ships unconditionally. That is the same bar the
 *   long-tail census uses to decide whether a CONCEPT earns a filter.
 * - Below 25 ships too, when the field is a CLOSED ATTRIBUTE ENUM whose
 *   vocabulary the MLS publishes in full. Exposing part of such a set asserts
 *   the hidden values do not exist: a sale-conditions list showing Trust and
 *   Real Estate Owned while hiding Short Sale reads as "no short sales here",
 *   which is false. Live facet counts render beside every option, so a 5-row
 *   value labels its own size instead of misleading.
 * - Zero live rows never ships. A filter that can never match is the one thing
 *   the 2026-07-30 accuracy audit removed fields for.
 * - GEOGRAPHY is the deliberate exception: `county` is a 39-value directory,
 *   not an attribute vocabulary, so it keeps the >= 25 bar on its own. See the
 *   note on that field.
 *
 * Voice conventions:
 * - `voice` phrases are lowercase, matched with word boundaries by the parser.
 * - Range-field voice entries use a lowercase `n` as the number slot
 *   (e.g. 'under n') — documentation for the parser's number grammar, not
 *   literal matchers. Literal phrases without `n` (e.g. 'new this week')
 *   compile to fixed values.
 */

export type SearchFieldKind = 'boolean' | 'range' | 'multi' | 'text'
export type SearchFieldCategory =
  | 'price_terms' | 'size_layout' | 'type_construction' | 'interior'
  | 'kitchen' | 'heating_cooling' | 'outdoor_lot' | 'parking'
  | 'outbuildings' | 'water_utilities' | 'community_hoa' | 'views_waterfront'
  | 'land_acreage' | 'listing_meta' | 'accessibility' | 'schools'

export interface SearchFieldDef {
  key: string                     // camelCase; boolean/multi/text: also the URL param. range: urlParam pair `${key}Min`/`${key}Max` unless legacyParams given
  label: string                   // sentence case, brand voice (no banned words)
  category: SearchFieldCategory
  kind: SearchFieldKind
  mv: string                      // listing_search_mv column
  matchMode?: 'any' | 'all'       // multi only; default 'any' (overlaps)
  options?: readonly string[]     // multi: canonical DB values, ordered by prevalence (from HARVEST)
  voice?: readonly string[]       // phrases that turn this field on / target it (lowercase)
  voiceValues?: Readonly<Record<string, readonly string[]>>  // multi: option -> spoken synonyms
  unit?: 'usd' | 'usdMonth' | 'sqft' | 'acres' | 'year' | 'days' | 'spaces' | 'count'
  legacyParams?: { min?: string; max?: string }  // preserve existing URL params (e.g. minPrice/maxPrice)
  presets?: readonly number[]     // range dropdown stops
  coverageNote?: string           // data caveat, shown as muted hint if set
  dalExpression?: true            // predicate is a multi-column DAL expression; mv holds the PRIMARY column
  singleColumnIn?: true           // multi over a scalar column; DAL maps to IN, not array overlap
  /**
   * singleColumnIn only. The scalar column may hold a ', '-joined LIST of
   * option values ("One, Two"), so the DAL matches by TOKEN containment
   * instead of whole-string IN. Set it only where the feed is measured to
   * multi-select into the column — `levels` is the only one (106 on-market
   * rows, 2026-07-31); property_sub_type, county and adu_type all measure 0.
   */
  multiValueScalar?: true
}

export const SEARCH_FIELD_CATEGORIES: readonly { id: SearchFieldCategory; label: string }[] = [
  { id: 'price_terms', label: 'Price and terms' },
  { id: 'size_layout', label: 'Size and layout' },
  { id: 'type_construction', label: 'Type and construction' },
  { id: 'interior', label: 'Interior' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'heating_cooling', label: 'Heating and cooling' },
  { id: 'outdoor_lot', label: 'Outdoor and lot' },
  { id: 'parking', label: 'Parking' },
  { id: 'outbuildings', label: 'Outbuildings' },
  { id: 'water_utilities', label: 'Water and utilities' },
  { id: 'community_hoa', label: 'Community and HOA' },
  { id: 'views_waterfront', label: 'Views and waterfront' },
  { id: 'land_acreage', label: 'Land and acreage' },
  { id: 'listing_meta', label: 'Listing details' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'schools', label: 'Schools' },
]

export const SEARCH_FIELDS: readonly SearchFieldDef[] = [
  // ── Ranges ────────────────────────────────────────────────────────────────
  {
    key: 'price',
    label: 'Price',
    category: 'price_terms',
    kind: 'range',
    mv: 'list_price',
    unit: 'usd',
    legacyParams: { min: 'minPrice', max: 'maxPrice' },
    voice: ['under n', 'over n', 'between n and n'],
  },
  {
    key: 'sqft',
    label: 'Square feet',
    category: 'size_layout',
    kind: 'range',
    mv: 'sqft',
    unit: 'sqft',
    legacyParams: { min: 'minSqFt', max: 'maxSqFt' },
    voice: ['over n square feet', 'n sqft', 'at least n square feet'],
  },
  {
    key: 'lotAcres',
    label: 'Lot size',
    category: 'land_acreage',
    kind: 'range',
    mv: 'lot_size_acres',
    unit: 'acres',
    legacyParams: { min: 'lotAcresMin', max: 'lotAcresMax' },
    voice: ['n acres', 'at least n acres', 'under n acres'],
  },
  {
    key: 'yearBuilt',
    label: 'Year built',
    category: 'type_construction',
    kind: 'range',
    mv: 'year_built',
    unit: 'year',
    legacyParams: { min: 'yearBuiltMin', max: 'yearBuiltMax' },
    voice: ['built after n', 'built before n', 'newer than n', 'n or newer'],
  },
  {
    key: 'beds',
    label: 'Bedrooms',
    category: 'size_layout',
    kind: 'range',
    mv: 'beds',
    unit: 'count',
    legacyParams: { min: 'beds', max: 'maxBeds' },
    voice: ['n bed', 'n bedroom'],
  },
  {
    key: 'baths',
    label: 'Bathrooms',
    category: 'size_layout',
    kind: 'range',
    mv: 'baths',
    unit: 'count',
    legacyParams: { min: 'baths', max: 'maxBaths' },
    voice: ['n bath', 'n bathroom'],
  },
  {
    key: 'garage',
    label: 'Garage spaces',
    category: 'parking',
    kind: 'range',
    mv: 'garage_spaces',
    unit: 'spaces',
    legacyParams: { min: 'garageMin' },
    voice: ['n car garage'],
  },
  {
    key: 'hoaMonthly',
    label: 'HOA per month',
    category: 'community_hoa',
    kind: 'range',
    mv: 'hoa_monthly',
    unit: 'usdMonth',
    legacyParams: { max: 'hoaMonthlyMax' },
    voice: ['hoa under n', 'low hoa'],
  },
  {
    key: 'taxAnnual',
    label: 'Annual taxes',
    category: 'price_terms',
    kind: 'range',
    mv: 'tax_annual_amount',
    unit: 'usd',
    legacyParams: { max: 'taxAnnualMax' },
    voice: ['taxes under n'],
  },
  {
    key: 'monthlyPayment',
    label: 'Est. monthly payment',
    category: 'price_terms',
    kind: 'range',
    mv: 'estimated_monthly_piti',
    unit: 'usdMonth',
    legacyParams: { max: 'monthlyPaymentMax' },
    voice: ['payment under n a month', 'afford n a month'],
  },
  {
    key: 'dom',
    label: 'Days on market',
    category: 'listing_meta',
    kind: 'range',
    mv: 'dom',
    unit: 'days',
    legacyParams: { max: 'daysOnMarket' },
    presets: [7, 30, 90],
    voice: ['new this week', 'listed this month'],
  },
  {
    key: 'aduSqft',
    label: 'ADU square feet',
    category: 'outbuildings',
    kind: 'range',
    mv: 'adu_sqft',
    unit: 'sqft',
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'irrigationAcres',
    label: 'Irrigated acres',
    category: 'land_acreage',
    kind: 'range',
    mv: 'irrigation_acres',
    unit: 'acres',
    coverageNote: 'Land and farm listings only.',
  },
  // REMOVED 2026-07-30 (adversarial accuracy audit): walkScore, storiesTotal,
  // fireplacesTotal, carportSpaces, parkingTotal. Spark masks these
  // StandardFields at our feed access level ("********" on every row), so the
  // MV columns are 100% null and each filter was a guaranteed-zero dead end.
  // A filter that can never match is not exposed — re-add only if the feed
  // access level changes AND observed coverage is nonzero (measured, per plan
  // §5). Same audit removed spa/carport/homeWarranty booleans and
  // directionFaces/schoolDistrict below.
  {
    key: 'photosCount',
    label: 'Photo count',
    category: 'listing_meta',
    kind: 'range',
    mv: 'photos_count',
    unit: 'count',
  },
  {
    key: 'prevListPrice',
    label: 'Previous list price',
    category: 'price_terms',
    kind: 'range',
    mv: 'prev_list_price',
    unit: 'usd',
    coverageNote: 'Reported when a listing has had a price change.',
  },
  // ── P5 long-tail tranche (2026-07-30, plan §12) — existing MV columns only,
  //    each verified ≥25 live rows before exposure (bathsFull/bathsHalf 6,575
  //    of 9,649 MV rows; pricePerSqft 7,277; aduType 335). ──
  {
    key: 'bathsFull',
    label: 'Full baths',
    category: 'size_layout',
    kind: 'range',
    mv: 'baths_full',
    unit: 'count',
  },
  {
    key: 'bathsHalf',
    label: 'Half baths',
    category: 'size_layout',
    kind: 'range',
    mv: 'baths_half',
    unit: 'count',
  },
  {
    key: 'pricePerSqft',
    label: 'Price per square foot',
    category: 'price_terms',
    kind: 'range',
    mv: 'price_per_sqft',
    unit: 'usd',
  },

  // ── MV v4 long-tail tranche (2026-07-31, plan §15) — the 24 EXPOSE concepts
  //    from data/search-metadata/longtail-census.json. Coverage figures below
  //    are live counts on the 9,647 serving rows (on-market minus Coming Soon),
  //    measured 2026-07-31 against listings.details before the columns shipped.
  {
    // COMPUTED in the MV as list_price / lot_size_acres — never the MLS's own
    // 'List Price per Acre' custom field. Measured on the 1,903 rows carrying
    // both: agrees within 1% on 1,879, diverges by more than 10% on 12 (worst
    // 108.3%), and is absent on 6,894 rows we can compute. 8,856 rows carry a
    // computable value.
    key: 'pricePerAcre',
    label: 'Price per acre',
    category: 'land_acreage',
    kind: 'range',
    mv: 'price_per_acre',
    unit: 'usd',
    voice: ['under n per acre', 'n per acre'],
  },
  {
    key: 'unitsTotal',
    label: 'Number of units',
    category: 'size_layout',
    kind: 'range',
    mv: 'units_total',
    unit: 'count',
    voice: ['n units'],
    coverageNote: 'Reported on multi-family and commercial listings.',
  },
  {
    key: 'currentRent',
    label: 'Current rent',
    category: 'price_terms',
    kind: 'range',
    mv: 'current_rent',
    unit: 'usdMonth',
    voice: ['rent under n'],
    coverageNote: 'Reported when a tenant is in place.',
  },
  {
    // The MLS publishes 'Estimated Completion Date' as a YYYY-MM-DD string on
    // 562 serving rows. The registry's range plumbing is numeric on both sides,
    // so the MV projects the YEAR and this filter shops it as a year, the same
    // way yearBuilt does. Stale past dates sort below the current year rather
    // than being rewritten against the clock (MV determinism, F7).
    key: 'estCompletionYear',
    label: 'Completion year',
    category: 'listing_meta',
    kind: 'range',
    mv: 'est_completion_year',
    unit: 'year',
    voice: ['completed by n'],
    coverageNote: 'New construction only.',
  },

  // ── Booleans ──────────────────────────────────────────────────────────────
  {
    key: 'hasFireplace',
    label: 'Fireplace',
    category: 'interior',
    kind: 'boolean',
    mv: 'fireplace_yn',
    voice: ['fireplace'],
  },
  {
    key: 'hasPool',
    label: 'Pool',
    category: 'outdoor_lot',
    kind: 'boolean',
    mv: 'pool_yn',
    voice: ['pool'],
  },
  {
    key: 'hasWaterfront',
    label: 'Waterfront',
    category: 'views_waterfront',
    kind: 'boolean',
    mv: 'waterfront_yn',
    voice: ['waterfront', 'on the water', 'on the river'],
  },
  {
    key: 'hasView',
    label: 'Has a view',
    category: 'views_waterfront',
    kind: 'boolean',
    mv: 'view_types',
    voice: ['view', 'views'],
  },
  {
    key: 'hasGolfCourse',
    label: 'Golf course',
    category: 'views_waterfront',
    kind: 'boolean',
    mv: 'view_types',
    dalExpression: true,
    voice: ['golf', 'golf course'],
  },
  {
    key: 'newConstruction',
    label: 'New construction',
    category: 'type_construction',
    kind: 'boolean',
    mv: 'new_construction_yn',
    voice: ['new construction', 'new build', 'brand new'],
  },
  {
    key: 'basement',
    label: 'Basement',
    category: 'size_layout',
    kind: 'boolean',
    mv: 'basement_yn',
    voice: ['basement'],
  },
  {
    key: 'horseProperty',
    label: 'Horse property',
    category: 'land_acreage',
    kind: 'boolean',
    mv: 'horse_yn',
    voice: ['horse property', 'horses allowed', 'equestrian'],
  },
  {
    key: 'seniorCommunity',
    label: '55+ community',
    category: 'community_hoa',
    kind: 'boolean',
    mv: 'senior_community_yn',
    voice: ['55 plus', '55+', '55 and older', 'senior community', 'age restricted', 'active adult'],
  },
  {
    // Tightened 2026-07-31. The predicate was `association_yn IS DISTINCT FROM
    // TRUE`, which swept in 761 live rows whose HOA answer is NULL. NULL is
    // "unknown", and a filter labelled "No HOA" that returns a home with dues
    // is the same overclaim class §0 exists to prevent. It now matches explicit
    // false only, so the label is exactly what the data asserts.
    key: 'noHoa',
    label: 'No HOA',
    category: 'community_hoa',
    kind: 'boolean',
    mv: 'association_yn',
    voice: ['no hoa', 'without an hoa'],
    coverageNote: 'Matches listings that report no HOA. Listings that leave the HOA question blank are excluded.',
  },
  {
    key: 'irrigationRights',
    label: 'Irrigation water rights',
    category: 'land_acreage',
    kind: 'boolean',
    mv: 'irrigation_water_rights_yn',
    voice: ['irrigation rights', 'water rights'],
  },
  {
    key: 'hasVirtualTour',
    label: 'Virtual tour',
    category: 'listing_meta',
    kind: 'boolean',
    mv: 'has_virtual_tour',
    voice: ['virtual tour', '3d tour'],
  },
  {
    key: 'hasOpenHouse',
    label: 'Open house scheduled',
    category: 'listing_meta',
    kind: 'boolean',
    mv: 'has_open_house',
    voice: ['open house'],
  },
  {
    key: 'priceReduced',
    label: 'Price reduced',
    category: 'price_terms',
    kind: 'boolean',
    mv: 'price_reduced',
    voice: ['price drop', 'price reduced', 'reduced price'],
  },
  {
    key: 'ownerWillCarry',
    label: 'Owner financing',
    category: 'price_terms',
    kind: 'boolean',
    mv: 'listing_terms',
    voice: ['owner will carry', 'owner financing', 'seller financing'],
  },
  {
    key: 'strAllowed',
    label: 'Short-term rentals allowed',
    category: 'community_hoa',
    kind: 'boolean',
    mv: 'community_features',
    voice: ['airbnb', 'short term rental', 'str allowed', 'vacation rental'],
  },
  {
    key: 'gatedCommunity',
    label: 'Gated',
    category: 'community_hoa',
    kind: 'boolean',
    mv: 'hoa_amenities',
    dalExpression: true,
    voice: ['gated'],
  },
  {
    key: 'guestHouse',
    label: 'Guest house',
    category: 'outbuildings',
    kind: 'boolean',
    mv: 'other_structures',
    // 'adu' / 'accessory dwelling' / 'casita' moved to the dedicated `adu`
    // field (CF tranche, 2026-07-30) — first registration wins in the parser.
    voice: ['guest house'],
  },
  {
    key: 'shop',
    label: 'Shop / workshop',
    category: 'outbuildings',
    kind: 'boolean',
    mv: 'other_structures',
    dalExpression: true,
    voice: ['shop', 'workshop', 'shouse'],
  },
  {
    key: 'rvParking',
    label: 'RV parking',
    category: 'parking',
    kind: 'boolean',
    mv: 'parking_features',
    dalExpression: true,
    voice: ['rv parking', 'rv access', 'boat storage', 'room for an rv'],
  },
  {
    key: 'rvGarage',
    label: 'RV garage',
    category: 'parking',
    kind: 'boolean',
    mv: 'parking_features',
    voice: ['rv garage'],
  },
  {
    key: 'evCharging',
    label: 'EV charging',
    category: 'parking',
    kind: 'boolean',
    mv: 'parking_features',
    voice: ['ev charger', 'ev charging', 'tesla charger'],
  },
  {
    key: 'heatedGarage',
    label: 'Heated garage',
    category: 'parking',
    kind: 'boolean',
    mv: 'parking_features',
    voice: ['heated garage'],
  },
  {
    // Deliberately stays an EXACT levels = 'One' match while the levelsOptions
    // multi moved to token containment (2026-07-31). A row listing "One, Two"
    // has a one-story section and a two-story section, so it belongs under
    // Stories = One when a buyer is browsing, but it is not a single-level home
    // and this filter promises 'no stairs'. Widening it would repeat the noHoa
    // overclaim in a different column.
    key: 'singleLevel',
    label: 'Single level',
    category: 'size_layout',
    kind: 'boolean',
    mv: 'levels',
    voice: ['single level', 'single story', 'one level', 'one story', 'no stairs'],
    coverageNote: 'Matches listings whose only level is one. Homes listing more than one level are excluded.',
  },
  {
    key: 'primaryOnMain',
    label: 'Primary on main',
    category: 'size_layout',
    kind: 'boolean',
    mv: 'interior_features',
    voice: ['primary on main', 'master on main', 'main level primary'],
  },
  {
    key: 'inLawFloorplan',
    label: 'In-law floor plan',
    category: 'size_layout',
    kind: 'boolean',
    mv: 'interior_features',
    voice: ['in law', 'mother in law', 'multigenerational'],
  },
  {
    key: 'fencedYard',
    label: 'Fenced yard',
    category: 'outdoor_lot',
    kind: 'boolean',
    mv: 'lot_features_arr',
    voice: ['fenced yard', 'fenced'],
  },
  {
    key: 'onGolfCourse',
    label: 'On the golf course',
    category: 'outdoor_lot',
    kind: 'boolean',
    mv: 'lot_features_arr',
    voice: ['on the golf course'],
  },
  {
    key: 'adjoinsPublicLand',
    label: 'Borders public land',
    category: 'outdoor_lot',
    kind: 'boolean',
    mv: 'lot_features_arr',
    dalExpression: true,
    voice: ['borders public land', 'backs to public land', 'adjoins public land', 'blm'],
  },
  {
    key: 'onWell',
    label: 'Well water',
    category: 'water_utilities',
    kind: 'boolean',
    mv: 'water_source',
    voice: ['well water', 'on a well'],
  },
  {
    key: 'publicWater',
    label: 'Public water',
    category: 'water_utilities',
    kind: 'boolean',
    mv: 'water_source',
    voice: ['public water', 'city water'],
  },
  {
    key: 'onSeptic',
    label: 'Septic',
    category: 'water_utilities',
    kind: 'boolean',
    mv: 'sewer_types',
    voice: ['septic'],
  },
  {
    key: 'publicSewer',
    label: 'Public sewer',
    category: 'water_utilities',
    kind: 'boolean',
    mv: 'sewer_types',
    voice: ['public sewer', 'city sewer'],
  },
  {
    key: 'adu',
    label: 'ADU',
    category: 'outbuildings',
    kind: 'boolean',
    mv: 'adu_yn',
    voice: ['adu', 'accessory dwelling', 'accessory dwelling unit', 'guest quarters', 'casita', 'mother in law suite'],
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'aduPermitted',
    label: 'ADU permitted',
    category: 'outbuildings',
    kind: 'boolean',
    mv: 'adu_permitted_yn',
    voice: ['adu permitted', 'permitted adu'],
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'strPermit',
    label: 'Short-term rental permit',
    category: 'community_hoa',
    kind: 'boolean',
    mv: 'str_permit_yn',
    voice: ['str permit', 'short term rental permit', 'airbnb allowed', 'airbnb permit', 'vacation rental permit'],
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'ccrs',
    label: 'CC&Rs',
    category: 'community_hoa',
    kind: 'boolean',
    mv: 'ccrs_yn',
    voice: ['ccrs', 'cc&rs', "cc&r's", 'covenants'],
    coverageNote: 'Backfill pending 2026-07-30',
  },
  // REMOVED 2026-07-30 (adversarial accuracy audit): spa, carport,
  // homeWarranty. SpaYN/CarportYN/HomeWarrantyYN arrive masked ("********")
  // at our feed level — the *_yn columns are 100% null and the filters could
  // never match. The BUYER INTENT survives through real data: spa/hot tub is
  // exteriorFeatures 'Spa/Hot Tub' + interiorFeatures 'Spa/Hot Tub' (605 live
  // rows); carport is parkingFeatures 'Attached Carport'/'Detached Carport'
  // (188 live rows). Voice phrases moved onto those fields.
  {
    key: 'hasFloorPlan',
    label: 'Floor plan available',
    category: 'listing_meta',
    kind: 'boolean',
    mv: 'has_floor_plan',
    // No bare 'floorplan' synonym: "open floorplan" (no space) would misfire
    // here because the longer interiorFeatures phrase only matches with a
    // separator between 'floor' and 'plan'.
    voice: ['floor plan'],
  },
  {
    key: 'hasVideo',
    label: 'Video tour',
    category: 'listing_meta',
    kind: 'boolean',
    mv: 'has_video',
    voice: ['video tour'],
  },
  // ── MV v4 long-tail tranche booleans (2026-07-31, plan §15) ──
  {
    // No voice phrases on purpose: parkingFeatures 'Attached' already claims
    // "attached garage", and first registration wins in the parser. Booleans
    // register before multis, so adding it here would silently take the phrase
    // off a working filter. 7,277 rows carry the flag, 3,498 of them true.
    key: 'attachedGarage',
    label: 'Attached garage',
    category: 'parking',
    kind: 'boolean',
    mv: 'attached_garage_yn',
  },
  {
    key: 'rented',
    label: 'Tenant in place',
    category: 'listing_meta',
    kind: 'boolean',
    mv: 'rented_yn',
    voice: ['tenant in place', 'tenant occupied', 'currently rented'],
  },
  {
    // 'Potential Tax Liability YN' in the feed: the farm or forest deferral
    // that comes due when the use changes. Named for what it is, since the
    // buyer question is "is this land in deferral", not "is there a liability".
    key: 'potentialTaxLiability',
    label: 'Farm or forest tax deferral',
    category: 'land_acreage',
    kind: 'boolean',
    mv: 'potential_tax_liability_yn',
    voice: ['tax deferral', 'farm deferral', 'forest deferral'],
  },
  {
    key: 'specialAssessment',
    label: 'Special assessment',
    category: 'price_terms',
    kind: 'boolean',
    mv: 'special_assessment_yn',
    voice: ['special assessment'],
  },
  {
    key: 'highSpeedInternet',
    label: 'High-speed internet',
    category: 'water_utilities',
    kind: 'boolean',
    mv: 'high_speed_internet_yn',
    voice: ['high speed internet', 'fast internet'],
  },
  {
    key: 'manufacturedAllowed',
    label: 'Manufactured home allowed',
    category: 'land_acreage',
    kind: 'boolean',
    mv: 'manufactured_allowed_yn',
    // Longest phrase wins in the parser, so these beat the bare 'manufactured'
    // sub-type claim in SUBTYPE_SET_PHRASES.
    voice: ['manufactured home allowed', 'manufactured allowed'],
  },
  {
    key: 'buildingPermitIssued',
    label: 'Building permit issued',
    category: 'land_acreage',
    kind: 'boolean',
    mv: 'building_permit_issued_yn',
    voice: ['building permit issued', 'permit issued'],
  },
  {
    key: 'secondResidence',
    label: 'Second residence',
    category: 'outbuildings',
    kind: 'boolean',
    mv: 'second_residence_yn',
    voice: ['second residence'],
  },

  // ── Multi-selects ─────────────────────────────────────────────────────────
  {
    // Enumerated sub-type filter (plan §4, 2026-07-30). Values are the 21
    // exact live feed strings measured in listing_search_mv (all 9,648
    // on-market rows, verified 2026-07-30), grouped by property class in
    // count-descending order: class A residential, then B manufactured,
    // C multi-family, D land. The DAL applies IN over these exact values —
    // no substring matching (§4.8.4). Registered FIRST among the multis so
    // its voice phrases claim before later fields ('first registration wins'
    // in the parser). Multi-VALUE synonyms ('mobile home' -> the 3-value
    // manufactured set) cannot live in voiceValues (one option per phrase) —
    // they are wired in lib/parse-search-query.ts SUBTYPE_SET_PHRASES.
    // NOTE: 'double wide' stays on bodyType 'Double Wide' (its registry
    // claim), deliberately NOT re-mapped here.
    key: 'propertySubTypes',
    label: 'Home type',
    category: 'type_construction',
    kind: 'multi',
    mv: 'property_sub_type',
    singleColumnIn: true,
    options: [
      // Class A — residential
      'Single Family Residence', 'Manufactured On Land', 'Townhouse', 'Condominium',
      'Tenancy in Common', 'Residential Leased Land', 'Stock Cooperative', 'Timeshare',
      // Class B — manufactured
      'In Park', 'On Leased Land',
      // Class C — multi-family
      'Duplex', 'Multi Family', 'Quadruplex', 'Triplex',
      // Class D — land
      'Residential Lots', 'Commercial', 'Recreational', 'Agriculture',
      'Industrial', 'Rangeland', 'Investment',
    ],
    voiceValues: {
      Condominium: ['condo', 'condominium'],
      Townhouse: ['townhome', 'town home', 'townhouse', 'row house'],
      Duplex: ['duplex', 'two unit', '2 unit'],
      Triplex: ['triplex', 'three unit', '3 unit'],
      Quadruplex: ['fourplex', 'four plex', 'quadplex', '4 unit'],
      'Manufactured On Land': ['manufactured on land', 'manufactured with land'],
      'In Park': ['mobile home park', 'in park'],
      'Stock Cooperative': ['co-op', 'stock cooperative'],
      'Tenancy in Common': ['tic', 'tenancy in common'],
      Timeshare: ['timeshare'],
      'Residential Lots': ['vacant lot', 'buildable lot'],
    },
  },
  {
    key: 'appliances',
    label: 'Kitchen and appliances',
    category: 'kitchen',
    kind: 'multi',
    mv: 'appliances',
    matchMode: 'all',
    options: ['Dishwasher', 'Refrigerator', 'Range', 'Water Heater', 'Microwave', 'Oven', 'Disposal', 'Washer', 'Dryer', 'Range Hood', 'Cooktop', 'Double Oven', 'Tankless Water Heater', 'Instant Hot Water', 'Wine Refrigerator', 'Water Purifier', 'Trash Compactor', 'Water Softener'],
    voiceValues: {
      'Double Oven': ['double oven'],
      'Wine Refrigerator': ['wine fridge', 'wine refrigerator'],
      'Tankless Water Heater': ['tankless'],
    },
  },
  {
    key: 'flooring',
    label: 'Flooring',
    category: 'interior',
    kind: 'multi',
    mv: 'flooring',
    options: ['Carpet', 'Vinyl', 'Tile', 'Laminate', 'Hardwood', 'Simulated Wood', 'Concrete', 'Stone', 'Bamboo'],
    voiceValues: {
      Hardwood: ['hardwood floors', 'hardwood'],
      Carpet: ['carpet'],
      Tile: ['tile'],
    },
  },
  {
    key: 'heatingTypes',
    label: 'Heating',
    category: 'heating_cooling',
    kind: 'multi',
    mv: 'heating_types',
    options: ['Forced Air', 'Electric', 'Heat Pump', 'Natural Gas', 'Wood', 'Fireplace(s)', 'Ductless', 'Propane', 'Zoned', 'ENERGY STAR Qualified Equipment', 'Wall Furnace', 'Pellet Stove', 'Baseboard', 'Radiant', 'Oil', 'Hot Water', 'Geothermal', 'Solar Leased', 'Solar'],
    voiceValues: {
      'Heat Pump': ['heat pump'],
      'Forced Air': ['forced air'],
      Radiant: ['radiant'],
      'Pellet Stove': ['pellet stove'],
      Wood: ['wood stove'],
      Geothermal: ['geothermal'],
      Solar: ['solar'],
    },
  },
  {
    key: 'coolingTypes',
    label: 'Cooling',
    category: 'heating_cooling',
    kind: 'multi',
    mv: 'cooling_types',
    options: ['Central Air', 'Heat Pump', 'Ductless', 'Zoned', 'ENERGY STAR Qualified Equipment', 'Wall/Window Unit(s)', 'Whole House Fan'],
    voiceValues: {
      'Central Air': ['air conditioning', 'central air'],
      Ductless: ['ductless', 'mini split'],
    },
  },
  {
    key: 'interiorFeatures',
    label: 'Interior',
    category: 'interior',
    kind: 'multi',
    mv: 'interior_features',
    matchMode: 'all',
    options: ['Shower/Tub Combo', 'Walk-In Closet(s)', 'Ceiling Fan(s)', 'Open Floorplan', 'Primary Downstairs', 'Pantry', 'Linen Closet', 'Vaulted Ceiling(s)', 'Kitchen Island', 'Double Vanity', 'Breakfast Bar', 'Tile Shower', 'Solid Surface Counters', 'Soaking Tub', 'Granite Counters', 'Fiberglass Stall Shower', 'Built-in Features', 'Laminate Counters', 'Enclosed Toilet(s)', 'Tile Counters', 'Smart Thermostat', 'Stone Counters', 'Central Vacuum', 'Wired for Data', 'Wired for Sound', 'In-Law Floorplan', 'Spa/Hot Tub', 'Smart Lock(s)', 'Wet Bar', 'Solar Tube(s)', 'Dry Bar', 'Smart Light(s)', 'Dual Flush Toilet(s)', 'Bidet', 'Elevator'],
    voiceValues: {
      'Kitchen Island': ['kitchen island'],
      'Granite Counters': ['granite'],
      'Vaulted Ceiling(s)': ['vaulted ceilings'],
      'Walk-In Closet(s)': ['walk in closet'],
      Pantry: ['pantry'],
      'Wet Bar': ['wet bar'],
      'Open Floorplan': ['open floor plan'],
      'Spa/Hot Tub': ['hot tub'],
      Elevator: ['elevator'],
    },
  },
  {
    key: 'exteriorFeatures',
    label: 'Outdoor extras',
    category: 'outdoor_lot',
    kind: 'multi',
    mv: 'exterior_features',
    options: ['Spa/Hot Tub', 'RV Hookup', 'Fire Pit', 'RV Dump', 'Courtyard', 'Built-in Barbecue', 'Outdoor Kitchen', 'Dock'],
    voiceValues: {
      // 'spa'/'jacuzzi' moved here from the removed spa boolean (spa_yn is
      // 100% masked at the feed level; this option carries the real data).
      'Spa/Hot Tub': ['hot tub', 'spa', 'jacuzzi'],
      'Fire Pit': ['fire pit'],
      'Outdoor Kitchen': ['outdoor kitchen'],
      'RV Hookup': ['rv hookup'],
      Dock: ['dock'],
      'Built-in Barbecue': ['built in barbecue'],
    },
  },
  {
    key: 'windowFeatures',
    label: 'Windows',
    category: 'type_construction',
    kind: 'multi',
    mv: 'window_features',
    options: ['Double Pane Windows', 'Vinyl Frames', 'Aluminum Frames', 'ENERGY STAR Qualified Windows', 'Skylight(s)', 'Wood Frames', 'Low-Emissivity Windows', 'Bay Window(s)', 'Garden Window(s)', 'Tinted Windows', 'Triple Pane Windows'],
    voiceValues: {
      'Skylight(s)': ['skylights'],
      'Double Pane Windows': ['double pane'],
    },
  },
  // laundryFeatures was removed 2026-07-29: laundry_features carried zero
  // values across all 9,663 on-market listing_search_mv rows, so the field
  // could never match a listing and the sheet always hid it.
  {
    key: 'securityFeatures',
    label: 'Security',
    category: 'interior',
    kind: 'multi',
    mv: 'security_features',
    options: ['Smoke Detector(s)', 'Carbon Monoxide Detector(s)', 'Security System Owned', 'Fire Sprinkler System', 'Security System Leased'],
    voiceValues: {
      'Security System Owned': ['security system'],
    },
  },
  {
    key: 'parkingFeatures',
    label: 'Parking',
    category: 'parking',
    kind: 'multi',
    mv: 'parking_features',
    options: ['Driveway', 'Attached', 'Garage Door Opener', 'RV Access/Parking', 'Asphalt', 'Concrete', 'Gravel', 'Detached', 'Workshop in Garage', 'On Street', 'Storage', 'Gated', 'No Garage', 'RV Garage', 'Alley Access', 'Attached Carport', 'Heated Garage', 'Detached Carport', 'Parking Lot', 'Shared Driveway', 'Electric Vehicle Charging Station(s)', 'Assigned', 'Tandem', 'Paver Block'],
    voiceValues: {
      Attached: ['attached garage'],
      Detached: ['detached garage'],
      // 'carport' moved here from the removed carport boolean (carport_yn is
      // 100% masked at the feed level; these options carry the real data).
      'Attached Carport': ['carport', 'attached carport'],
      'Detached Carport': ['detached carport'],
    },
  },
  {
    key: 'patioPorch',
    label: 'Patio and porch',
    category: 'outdoor_lot',
    kind: 'multi',
    mv: 'patio_porch_features',
    options: ['Deck', 'Patio', 'Covered', 'Rear Porch', 'Front Porch', 'Porch', 'Covered Deck', 'Side Porch', 'Wrap Around', 'Awning(s)', 'Enclosed', 'Terrace', 'Screened'],
    voiceValues: {
      Covered: ['covered patio'],
      Deck: ['deck'],
      'Wrap Around': ['wrap around porch'],
      'Front Porch': ['front porch'],
    },
  },
  {
    key: 'lotFeatures',
    label: 'Lot',
    category: 'outdoor_lot',
    kind: 'multi',
    mv: 'lot_features_arr',
    options: ['Level', 'Landscaped', 'Fenced', 'Sprinklers In Front', 'Sprinkler Timer(s)', 'Sprinklers In Rear', 'Native Plants', 'Sloped', 'Wooded', 'Drip System', 'Corner Lot', 'Garden', 'Pasture', 'Adjoins Public Lands', 'Water Feature', 'Rock Outcropping', 'Xeriscape Landscape', 'On Golf Course', 'Smart Irrigation', 'Marketable Timber'],
    voiceValues: {
      'Corner Lot': ['corner lot'],
      Level: ['level lot'],
      Wooded: ['wooded'],
      Landscaped: ['landscaped'],
      Garden: ['garden'],
      Pasture: ['pasture'],
      'Sprinklers In Front': ['sprinklers'],
    },
  },
  {
    key: 'viewTypes',
    label: 'View types',
    category: 'views_waterfront',
    kind: 'multi',
    mv: 'view_types',
    // All 22 published View values carry live rows 2026-07-31; the four added
    // in the coverage fix are Orchard 28, Ocean 19, Beach 6, Bay 5 (coastal and
    // orchard views reach this feed through its Southern Oregon counties).
    options: [
      'Territorial', 'Neighborhood', 'Mountain(s)', 'Cascade Mountains', 'Panoramic', 'Forest',
      'Valley', 'City', 'River', 'Golf Course', 'Ridge', 'Lake', 'Pond', 'Creek/Stream',
      'Desert', 'Park/Greenbelt', 'Canyon', 'Vineyard', 'Orchard', 'Ocean', 'Beach', 'Bay',
    ],
    voiceValues: {
      Ocean: ['ocean view'],
      Beach: ['beach view'],
      Bay: ['bay view'],
      Orchard: ['orchard view'],
      'Cascade Mountains': ['cascade views', 'cascade mountain views'],
      'Mountain(s)': ['mountain views'],
      River: ['river view'],
      'Golf Course': ['golf course view'],
      Panoramic: ['panoramic'],
      City: ['city view'],
    },
  },
  {
    key: 'fireplaceTypes',
    label: 'Fireplace type',
    category: 'interior',
    kind: 'multi',
    mv: 'fireplace_types',
    options: ['Gas', 'Living Room', 'Great Room', 'Wood Burning', 'Propane', 'Family Room', 'Primary Bedroom', 'Insert', 'Electric', 'Outside'],
    voiceValues: {
      Gas: ['gas fireplace'],
      'Wood Burning': ['wood burning'],
      Insert: ['wood stove insert'],
    },
  },
  {
    key: 'basementTypes',
    label: 'Basement type',
    category: 'size_layout',
    kind: 'multi',
    mv: 'basement_types',
    options: ['Finished', 'Daylight', 'Full', 'Partial', 'Exterior Entry', 'Unfinished'],
    voiceValues: {
      Finished: ['finished basement'],
      Daylight: ['daylight basement'],
    },
  },
  {
    key: 'otherStructures',
    label: 'Outbuildings',
    category: 'outbuildings',
    kind: 'multi',
    mv: 'other_structures',
    options: ['Shed(s)', 'Storage', 'Workshop', 'RV/Boat Storage', 'Barn(s)', 'Greenhouse', 'Second Garage', 'Poultry Coop', 'Animal Stall(s)', 'Kennel/Dog Run', 'Guest House', 'Corral(s)', 'Gazebo', 'Stable(s)', 'Arena', 'Covered Arena', 'Mobile Home'],
    voiceValues: {
      'Barn(s)': ['barn'],
      Greenhouse: ['greenhouse'],
      'Shed(s)': ['shed'],
      'Second Garage': ['second garage'],
      'Poultry Coop': ['chicken coop'],
      'Corral(s)': ['corral'],
      'Stable(s)': ['stable'],
      Arena: ['arena'],
      'Kennel/Dog Run': ['kennel'],
    },
  },
  {
    key: 'structureTypes',
    label: 'Structure type',
    category: 'type_construction',
    kind: 'multi',
    mv: 'structure_types',
    options: ['House', 'Manufactured House', 'Cabin', 'Mixed Use', 'Office', 'Warehouse', 'Industrial'],
    voiceValues: {
      // 'manufactured' moved to the propertySubTypes multi-value grammar
      // (parse-search-query SUBTYPE_SET_PHRASES, plan §4.6 2026-07-30): the
      // sub-type set {Manufactured On Land, In Park, On Leased Land} is the
      // authoritative model and covers class B, which structure_types missed.
      Cabin: ['cabin'],
    },
  },
  {
    key: 'hoaAmenities',
    label: 'HOA amenities',
    category: 'community_hoa',
    kind: 'multi',
    mv: 'hoa_amenities',
    options: ['Snow Removal', 'Trail(s)', 'Pool', 'Park', 'Playground', 'Clubhouse', 'Landscaping', 'Fitness Center', 'Pickleball Court(s)', 'Tennis Court(s)', 'Resort Community', 'Gated', 'Sport Court', 'Golf Course', 'Restaurant', 'Firewise Certification', 'Water', 'Sewer', 'Trash', 'Road Assessment', 'RV/Boat Storage', 'Stable(s)', 'Security', 'Marina', 'Airport/Runway'],
    voiceValues: {
      Clubhouse: ['clubhouse'],
      'Pickleball Court(s)': ['pickleball'],
      'Tennis Court(s)': ['tennis'],
      Pool: ['community pool'],
      'Fitness Center': ['fitness center', 'gym'],
      Marina: ['marina'],
      'Resort Community': ['resort'],
    },
  },
  {
    key: 'communityFeatures',
    label: 'Community',
    category: 'community_hoa',
    kind: 'multi',
    mv: 'community_features',
    options: ['Trail(s)', 'Park', 'Access to Public Lands', 'Playground', 'Short Term Rentals Allowed', 'Pickleball', 'Tennis Court(s)', 'Pool', 'Sport Court', 'Short Term Rentals Not Allowed', 'Gas Available', 'Road Assessment'],
    voiceValues: {
      'Trail(s)': ['trails'],
      Park: ['park'],
      Playground: ['playground'],
      'Sport Court': ['sport court'],
    },
  },
  {
    key: 'accessibilityFeatures',
    label: 'Accessibility',
    category: 'accessibility',
    kind: 'multi',
    mv: 'accessibility_features',
    options: ['Accessible Bedroom', 'Accessible Hallway(s)', 'Accessible Full Bath', 'Accessible Kitchen', 'Accessible Doors', 'Accessible Entrance', 'Accessible Closets', 'Accessible Approach with Ramp', 'Smart Technology', 'Grip-Accessible Features'],
    voice: ['accessible'],
    voiceValues: {
      'Accessible Entrance': ['wheelchair accessible'],
      'Accessible Approach with Ramp': ['ramp'],
    },
  },
  {
    key: 'waterfrontTypes',
    label: 'Waterfront type',
    category: 'views_waterfront',
    kind: 'multi',
    mv: 'waterfront_types',
    options: ['Pond', 'Creek', 'River Front', 'Waterfront', 'Stream', 'Lake Front'],
    voiceValues: {
      'River Front': ['riverfront'],
      Creek: ['creek'],
      Pond: ['pond'],
      'Lake Front': ['lakefront'],
      Stream: ['stream'],
    },
  },
  {
    // MV v4 (2026-07-31, plan §15): the '* Connected' options come from the CF
    // group:Utilities, merged into this column by the MV rather than shipped as
    // a second filter — "is power available" and "is power already hooked up"
    // are one buyer question with two answers. Available options keep their
    // order; the Connected set appends in live count order (Electricity 6,609 ·
    // Natural Gas 2,612 · Cable 1,451 · Phone 776 serving rows).
    key: 'utilities',
    label: 'Utilities',
    category: 'water_utilities',
    kind: 'multi',
    mv: 'utilities',
    options: ['Electricity Available', 'Cable Available', 'Phone Available', 'Natural Gas Available', 'Fiber Optics Available', 'Electricity Connected', 'Natural Gas Connected', 'Cable Connected', 'Phone Connected'],
    voiceValues: {
      'Fiber Optics Available': ['fiber', 'fiber optic'],
      'Natural Gas Available': ['natural gas'],
      'Cable Available': ['cable'],
      'Electricity Connected': ['power connected', 'electricity connected'],
      'Natural Gas Connected': ['gas connected'],
    },
  },
  {
    key: 'sewerTypes',
    label: 'Sewer detail',
    category: 'water_utilities',
    kind: 'multi',
    mv: 'sewer_types',
    options: ['Public Sewer', 'Septic Tank', 'Standard Leach Field', 'Septic Needed', 'Private Sewer', 'Perc Test On File', 'Sand Filter', 'Alternative Treatment Tech System', 'Capping Fill', 'Holding Tank'],
  },
  {
    key: 'waterSource',
    label: 'Water detail',
    category: 'water_utilities',
    kind: 'multi',
    mv: 'water_source',
    options: ['Public', 'Well', 'Private', 'Shared Well', 'Backflow Domestic', 'Water Meter', 'Backflow Irrigation', 'Cistern', 'Spring'],
  },
  {
    key: 'roadSurface',
    label: 'Road surface',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'road_surface',
    options: ['Paved', 'Gravel', 'Dirt', 'Cinder'],
    voiceValues: {
      Paved: ['paved road'],
      Gravel: ['gravel road'],
      Dirt: ['dirt road'],
    },
  },
  {
    key: 'roofTypes',
    label: 'Roof',
    category: 'type_construction',
    kind: 'multi',
    mv: 'roof_types',
    // All 10 published Roof values carry live rows (2026-07-31): Composition
    // 4,153 · Metal 998 · Asphalt 276 · Membrane 218 · Tile 144 · Rubber 42 ·
    // Shake 25 · Rolled/Hot Mop 24 · Built-Up 20 · Slate 11.
    options: [
      'Composition', 'Metal', 'Asphalt', 'Membrane', 'Tile',
      'Rubber', 'Shake', 'Rolled/Hot Mop', 'Built-Up', 'Slate',
    ],
    voiceValues: {
      Metal: ['metal roof'],
      Tile: ['tile roof'],
      Shake: ['shake roof', 'cedar shake roof'],
      Slate: ['slate roof'],
      Rubber: ['rubber roof'],
    },
  },
  {
    key: 'constructionMaterials',
    label: 'Construction',
    category: 'type_construction',
    kind: 'multi',
    mv: 'construction_materials_arr',
    // Live rows 2026-07-31: Frame 4,170 · Concrete 336 · Block 210 · Double
    // Wall 156 · Steel Frame 139 · Brick 89 · Log 81 · ICFs 28 · Structural
    // Insulated Panels 26 · Straw 3. 'Unknown' (115) is a noise token, dropped.
    // Rammed Earth is published but has zero live rows, so it stays out.
    options: [
      'Frame', 'Concrete', 'Block', 'Double Wall/Staggered Stud', 'Steel Frame', 'Brick', 'Log',
      'ICFs (Insulated Concrete Forms)', 'Structural Insulated Panels', 'Straw',
    ],
    voiceValues: {
      Log: ['log home'],
      'Steel Frame': ['steel frame'],
      'ICFs (Insulated Concrete Forms)': ['icf', 'insulated concrete forms'],
      'Structural Insulated Panels': ['sips', 'structural insulated panels'],
      Straw: ['straw bale'],
    },
  },
  {
    key: 'foundationTypes',
    label: 'Foundation',
    category: 'type_construction',
    kind: 'multi',
    mv: 'foundation_types',
    options: ['Stemwall', 'Concrete Perimeter', 'Slab', 'Block', 'Pillar/Post/Pier', 'Brick/Mortar'],
    voiceValues: {
      Slab: ['slab'],
    },
  },
  {
    key: 'architecturalStyles',
    label: 'Style',
    category: 'type_construction',
    kind: 'multi',
    mv: 'architectural_styles',
    // Every published style with live rows 2026-07-31: Northwest 1,167 · Ranch
    // 1,135 · Traditional 1,092 · Contemporary 783 · Craftsman 781 · Bungalow
    // 189 · Log 93 · Chalet 82 · Prairie 45 · A-Frame 38 · Colonial 26 ·
    // Victorian 19 · Tudor 10. 'Other' (522) is a noise token, dropped.
    options: [
      'Northwest', 'Ranch', 'Traditional', 'Contemporary', 'Craftsman', 'Bungalow',
      'Log', 'Chalet', 'Prairie', 'A-Frame', 'Colonial', 'Victorian', 'Tudor',
    ],
    voiceValues: {
      'A-Frame': ['a frame', 'a-frame'],
      Colonial: ['colonial'],
      Victorian: ['victorian'],
      Tudor: ['tudor'],
      Craftsman: ['craftsman'],
      Ranch: ['ranch style'],
      Log: ['log cabin'],
      Contemporary: ['contemporary'],
      Northwest: ['northwest'],
      Chalet: ['chalet'],
      Bungalow: ['bungalow'],
      Prairie: ['prairie'],
    },
  },
  {
    // `levels` is a scalar column the feed multi-selects into: 106 on-market
    // rows hold ', '-joined lists ("One, Two", "Three Or More, Multi/Split").
    // Whole-string IN matched none of them, so those homes were invisible to
    // every Stories option. multiValueScalar switches the DAL to token
    // containment — a row is found by each level it actually lists.
    key: 'levelsOptions',
    label: 'Stories',
    category: 'size_layout',
    kind: 'multi',
    mv: 'levels',
    singleColumnIn: true,
    multiValueScalar: true,
    options: ['One', 'Two', 'Three Or More', 'Multi/Split'],
    voiceValues: {
      Two: ['two story'],
      'Three Or More': ['three story'],
    },
  },
  {
    key: 'listingTerms',
    label: 'Financing accepted',
    category: 'price_terms',
    kind: 'multi',
    mv: 'listing_terms',
    // All 12 published ListingTerms values carry live rows 2026-07-31: Cash
    // 7,263 · Conventional 6,030 · VA Loan 3,119 · FHA 2,963 · USDA Loan 1,021 ·
    // Owner Will Carry 471 · FMHA 192 · Contract 111 · Private Financing 110 ·
    // Trade 44 · Assumable 35 · Trust Deed 13.
    options: [
      'Cash', 'Conventional', 'VA Loan', 'FHA', 'USDA Loan', 'Owner Will Carry',
      'FMHA', 'Contract', 'Private Financing Available', 'Trade', 'Assumable', 'Trust Deed',
    ],
    voiceValues: {
      FHA: ['fha'],
      'VA Loan': ['va loan', 'va eligible'],
      'USDA Loan': ['usda'],
      Assumable: ['assumable', 'assumable loan', 'assumable mortgage'],
      'Trust Deed': ['trust deed'],
    },
  },
  {
    key: 'specialConditions',
    label: 'Sale conditions',
    category: 'listing_meta',
    kind: 'multi',
    mv: 'special_conditions',
    // All 12 published values carry live rows 2026-07-31: Standard 7,215 ·
    // Trust 99 · Probate Listing 59 · Real Estate Owned 32 · Third Party
    // Approval 22 · Short Sale 19 · Conservatorship 6 · In Foreclosure 5 ·
    // Auction 5 · Notice Of Default 5 · Bankruptcy Property 4 · HUD Owned 4.
    // The tail ships below 25 deliberately: this field IS the distressed-sale
    // vocabulary, and hiding Short Sale or In Foreclosure while showing Real
    // Estate Owned tells a buyer those sales are not in this market.
    options: [
      'Standard', 'Trust', 'Probate Listing', 'Real Estate Owned', 'Third Party Approval',
      'Short Sale', 'Conservatorship', 'In Foreclosure', 'Auction', 'Notice Of Default',
      'Bankruptcy Property', 'HUD Owned',
    ],
    voiceValues: {
      'Real Estate Owned': ['reo', 'bank owned'],
      'Probate Listing': ['probate'],
      'Short Sale': ['short sale'],
      'In Foreclosure': ['in foreclosure', 'foreclosure', 'pre foreclosure'],
      'Notice Of Default': ['notice of default'],
      Auction: ['auction'],
      'HUD Owned': ['hud owned', 'hud home'],
      'Bankruptcy Property': ['bankruptcy'],
      'Third Party Approval': ['third party approval'],
      Conservatorship: ['conservatorship'],
    },
  },
  {
    key: 'currentUse',
    label: 'Land use',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'current_use',
    options: ['Vacant', 'Recreational', 'Agricultural', 'Pasture', 'Grazing', 'Ranch', 'Commercial', 'Timber'],
    voiceValues: {
      Vacant: ['vacant land'],
      Ranch: ['ranch land', 'cattle ranch', 'working ranch'],
      Agricultural: ['agricultural', 'farm'],
      Timber: ['timber'],
      Grazing: ['grazing'],
      Recreational: ['recreational'],
    },
  },
  {
    key: 'irrigationSource',
    label: 'Irrigation source',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'irrigation_source',
    options: ['District', 'On Site Well', 'Creek', 'Pond', 'River', 'Spring'],
    voiceValues: {
      District: ['irrigation district'],
    },
  },
  {
    key: 'commonWalls',
    label: 'Common walls',
    category: 'type_construction',
    kind: 'multi',
    mv: 'common_walls',
    options: ['No Common Walls', 'No One Above', 'No One Below', '1 Common Wall', '2+ Common Walls', 'End Unit'],
    voiceValues: {
      'No Common Walls': ['no shared walls', 'no common walls'],
      'End Unit': ['end unit'],
    },
  },
  {
    key: 'roadFrontage',
    label: 'Road access',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'road_frontage',
    options: ['Shared Access', 'Private Access', 'Easement'],
    voiceValues: {
      'Private Access': ['private access'],
    },
  },
  {
    key: 'poolFeatures',
    label: 'Pool type',
    category: 'outdoor_lot',
    kind: 'multi',
    mv: 'pool_features',
    // Every published PoolFeatures value with live rows 2026-07-31, prevalence
    // order: Outdoor Pool 241 · In Ground 228 · Association 181 · Community 172
    // · Heated 132 · Fenced 112 · Pool Cover 77 · Private 74 · Pool/Spa Combo 59
    // · Indoor 43 · Above Ground 41 · Gas Heat 32 · Gunite 31 · Waterfall 31 ·
    // Filtered 30 · Lap 28 · Salt Water 28 · Solar Heat 28 · Pool Sweep 21 ·
    // Tile 20 · Diving Board 12 · Electric Heat 12 · Solar Cover 12 · Liner 10 ·
    // ENERGY STAR Qualified Pool Pump 9 · Vinyl 9 · Cabana 8 · Fiberglass 5 ·
    // Sport 4 · Infinity 3 · Black Bottom 2. 'None' (622), 'See Remarks' (31)
    // and 'Other' (9) are noise tokens, dropped. Screen Enclosure is published
    // with zero live rows, so it stays out.
    options: [
      'Outdoor Pool', 'In Ground', 'Association', 'Community', 'Heated', 'Fenced',
      'Pool Cover', 'Private', 'Pool/Spa Combo', 'Indoor', 'Above Ground', 'Gas Heat',
      'Gunite', 'Waterfall', 'Filtered', 'Lap', 'Salt Water', 'Solar Heat', 'Pool Sweep',
      'Tile', 'Diving Board', 'Electric Heat', 'Solar Cover', 'Liner',
      'ENERGY STAR Qualified Pool Pump', 'Vinyl', 'Cabana', 'Fiberglass', 'Sport',
      'Infinity', 'Black Bottom',
    ],
    voiceValues: {
      'In Ground': ['in ground pool'],
      Indoor: ['indoor pool'],
      'Salt Water': ['salt water pool', 'saltwater pool'],
      'Solar Heat': ['solar heated pool'],
      Waterfall: ['pool waterfall'],
      'Diving Board': ['diving board'],
      Infinity: ['infinity pool'],
      Cabana: ['pool cabana'],
      Lap: ['lap pool'],
    },
  },
  {
    // Coverage fix 2026-07-31: the five Central Oregon counties reached ~59% of
    // live active inventory. The feed spans 34 counties and the Southern Oregon
    // block (Jackson 1,734 · Josephine 850 — Medford, Ashland, Grants Pass) had
    // no option at all. County keeps the program's >= 25-live-listing bar rather
    // than the "every live value" rule the attribute enums use: this is a
    // geography directory, not a closed attribute vocabulary, and its tail
    // (Gilliam 1, Sherman 1, Hood River 1) is out-of-service-area noise where an
    // option would be a dead end. Counts are active rows in listing_search_mv,
    // measured 2026-07-31, listed in prevalence order.
    key: 'county',
    label: 'County',
    category: 'listing_meta',
    kind: 'multi',
    mv: 'county',
    singleColumnIn: true,
    options: [
      'Deschutes', 'Jackson', 'Klamath', 'Josephine', 'Crook',
      'Jefferson', 'Lake', 'Grant', 'Douglas', 'Lane',
    ],
    voiceValues: {
      Deschutes: ['deschutes county'],
      Jackson: ['jackson county'],
      Klamath: ['klamath county'],
      Josephine: ['josephine county'],
      Crook: ['crook county'],
      Jefferson: ['jefferson county'],
      Lake: ['lake county'],
      Grant: ['grant county'],
      Douglas: ['douglas county'],
      Lane: ['lane county'],
    },
  },
  // REMOVED 2026-07-30 (adversarial accuracy audit): directionFaces.
  // DirectionFaces is masked ("********") on 9,407 of 9,648 MV rows — the
  // feed does not license it, so all 8 compass options returned zero, always.
  {
    key: 'floodZone',
    label: 'Flood zone',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'flood_zone',
    options: ['N/A', 'Plain', 'Way'],
    voiceValues: {
      Plain: ['flood plain'],
    },
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'governmentOverlay',
    label: 'Government overlay',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'government_overlay',
    options: ['Airport Zone', 'Enterprise Zone', 'Foreign Trade', 'Opportunity Zone', 'Urban Renewal', 'Wetlands'],
    voiceValues: {
      'Opportunity Zone': ['opportunity zone'],
      Wetlands: ['wetlands'],
    },
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'easements',
    label: 'Easements',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'easements',
    options: ['Access', 'Conservation', 'Irrigation', 'Utilities', 'View', 'Well'],
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'roomsArr',
    label: 'Rooms',
    category: 'size_layout',
    kind: 'multi',
    mv: 'rooms_arr',
    options: ['Bonus Room', 'Breakfast Nook', 'Dining Room', 'Eating Area', 'Enclosed Porch/Patio', 'Family Room', 'Great Room', 'Jack and Jill Bath', 'Kitchen', 'Laundry', 'Living Room', 'Loft', 'Media Room', 'Mud Room', 'Office', 'Primary Bedroom', 'Sauna', 'Second Primary', 'Solarium', 'Sunroom'],
    voiceValues: {
      'Bonus Room': ['bonus room'],
      Office: ['home office'],
      Loft: ['loft'],
      'Media Room': ['media room', 'theater room'],
      'Mud Room': ['mud room', 'mudroom'],
      Sunroom: ['sunroom', 'sun room'],
      'Great Room': ['great room'],
      Sauna: ['sauna'],
      'Second Primary': ['second primary', 'two primary suites'],
    },
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'bodyType',
    label: 'Manufactured body type',
    category: 'type_construction',
    kind: 'multi',
    mv: 'body_types',
    options: ['Single Wide', 'Double Wide', 'Triple Wide', 'Quad Wide', 'Park Model'],
    voiceValues: {
      'Single Wide': ['single wide'],
      'Double Wide': ['double wide'],
      'Triple Wide': ['triple wide'],
      'Park Model': ['park model'],
    },
  },
  {
    key: 'fencing',
    label: 'Fencing',
    category: 'outdoor_lot',
    kind: 'multi',
    mv: 'fencing_arr',
    options: ['Wire', 'Perimeter', 'Barbed Wire', 'Wood', 'Cross Fenced', 'Split Rail', 'Vinyl', 'Electric'],
    voiceValues: {
      'Barbed Wire': ['barbed wire'],
      'Cross Fenced': ['cross fenced'],
    },
  },
  {
    // P5 long-tail tranche (2026-07-30): CF 'ADU Type', scalar column — the
    // full metadata value set {Attached, Detached}, prevalence order (335
    // live rows: Detached 272, Attached 63, verified 2026-07-30).
    key: 'aduType',
    label: 'ADU type',
    category: 'outbuildings',
    kind: 'multi',
    mv: 'adu_type',
    singleColumnIn: true,
    options: ['Detached', 'Attached'],
    voiceValues: {
      Detached: ['detached adu'],
      Attached: ['attached adu'],
    },
  },

  // ── MV v4 long-tail tranche multis (2026-07-31, plan §15) ──
  // Every option below is a CF group member measured with at least one live
  // serving row on 2026-07-31, in count-descending order. Members the metadata
  // lists but the feed has never used (LEED Gold / Platinum / Silver, railroad
  // 'In', soil 'Land Fill') stay out of the option set until they carry data —
  // the same "no filter that can never match" rule the 2026-07-30 audit set.
  {
    key: 'utilitiesLocation',
    label: 'Utilities location',
    category: 'water_utilities',
    kind: 'multi',
    mv: 'utilities_location',
    options: ['At Street', 'On Property'],
    voiceValues: {
      'At Street': ['power at the street', 'utilities at the street'],
      'On Property': ['power on the property', 'utilities on the property'],
    },
    coverageNote: 'Reported on land listings.',
  },
  {
    key: 'homeSiteApproval',
    label: 'Home site approval',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'home_site_approval',
    options: ['Not Applied For', 'Approved', 'Applied For', 'Denied'],
    voiceValues: {
      Approved: ['home site approved', 'site approved'],
    },
    coverageNote: 'Reported on land listings.',
  },
  {
    key: 'powerProduction',
    label: 'Power production',
    category: 'water_utilities',
    kind: 'multi',
    mv: 'power_production',
    options: ['Solar Owned', 'Generator', 'Solar PV Ready', 'Hydro', 'Solar Leased', 'Wind'],
    voiceValues: {
      'Solar Owned': ['owned solar', 'solar owned'],
      'Solar Leased': ['leased solar', 'solar leased'],
      'Solar PV Ready': ['solar ready'],
      Generator: ['generator', 'backup generator'],
      Hydro: ['micro hydro'],
    },
  },
  {
    key: 'greenCertification',
    label: 'Energy certification',
    category: 'type_construction',
    kind: 'multi',
    mv: 'green_certification',
    options: ['Home Energy Score', 'Earth Advantage', 'ENERGY STAR Certified Homes', 'Energy Performance Score', 'LEED For Homes', 'LEED Certified', 'WaterSense', 'Energy Audit Retrofit'],
    voiceValues: {
      'Home Energy Score': ['home energy score'],
      'Earth Advantage': ['earth advantage'],
      'ENERGY STAR Certified Homes': ['energy star'],
      'LEED Certified': ['leed'],
    },
  },
  {
    key: 'landRestrictions',
    label: 'Land restrictions',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'land_restrictions',
    options: ['Recorded Plat', 'Subject to Zoning', 'Access Recorded', 'Deed Restrictions', 'Easement/Right-of-Way', 'No Access Recorded', 'Zone-Unplatted'],
    voiceValues: {
      'Recorded Plat': ['recorded plat'],
      'Deed Restrictions': ['deed restrictions'],
      'Access Recorded': ['recorded access'],
      'Easement/Right-of-Way': ['right of way'],
    },
  },
  {
    key: 'multiUnitFeatures',
    label: 'Multi-unit features',
    category: 'type_construction',
    kind: 'multi',
    mv: 'multi_unit_features',
    options: ['Office Space', 'Separate Electric Meters', '3 Phase Electric', 'Common Area', 'Separate Gas Meters', 'ADA Comply', 'Laundry Facility', 'Bath Common Area', 'Separate Water Meters', 'Free Span Roof', 'Bus Service or Stop', 'Mezzanine', "Manager's Quarters", 'Living Area in Building', 'Expandable', 'Tanks in Ground', 'Overhead Crane', 'Airport Access'],
    voiceValues: {
      'Separate Electric Meters': ['separate meters', 'separate electric meters'],
      'Separate Gas Meters': ['separate gas meters'],
      'Separate Water Meters': ['separate water meters'],
      'Laundry Facility': ['laundry facility'],
      'Office Space': ['office space'],
    },
  },
  {
    key: 'railroadAccess',
    label: 'Railroad access',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'railroad_access',
    options: ['Not Available', 'Available', 'To Lot'],
    voiceValues: {
      Available: ['rail access', 'railroad access'],
      'To Lot': ['rail spur'],
    },
    coverageNote: 'Reported on land listings.',
  },
  {
    key: 'soilType',
    label: 'Soil type',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'soil_type',
    options: ['Loam', 'Sand', 'Rocky', 'Clay', 'Soil Analysis Done', 'Top Soil Over Other', 'Soil Analysis Ordered', 'Alluvial'],
    voiceValues: {
      Loam: ['loam soil'],
      Sand: ['sandy soil'],
      Rocky: ['rocky soil'],
      Clay: ['clay soil'],
    },
  },
  {
    key: 'acreageFeatures',
    label: 'Acreage details',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'acreage_features',
    options: ['Livestock Allowed', 'Dividable Property', 'Additional Crop/Usage/Acreage Info Attached', 'Conservation Reserve Program'],
    voiceValues: {
      'Livestock Allowed': ['livestock allowed', 'animals allowed'],
      'Dividable Property': ['dividable', 'can be divided'],
      'Conservation Reserve Program': ['conservation reserve'],
    },
  },
  {
    key: 'irrigationDistribution',
    label: 'Irrigation delivery',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'irrigation_distribution',
    options: ['Pump(s)', 'Wheel Line(s)', 'Hand Line(s)', 'Gravity-Flood', 'Center Pivot', 'Mainline', 'Sprinkled', 'In Ground Sprinklers', 'Sprinkler Gun(s)', 'Sub-Irrigated', 'Gated Pipe', 'K-Line', 'Linear', 'Solid Set', 'Water Wheel'],
    voiceValues: {
      'Center Pivot': ['center pivot'],
      'Wheel Line(s)': ['wheel line'],
      'Hand Line(s)': ['hand line'],
      'Gravity-Flood': ['flood irrigation'],
    },
  },
  {
    key: 'waterRightsType',
    label: 'Water rights type',
    category: 'land_acreage',
    kind: 'multi',
    mv: 'water_rights_type',
    options: ['Permitted', 'Adjudicated', 'Class A', 'Riparian', 'Class B', 'Class C'],
    voiceValues: {
      Adjudicated: ['adjudicated water rights'],
      Permitted: ['permitted water rights'],
      Riparian: ['riparian rights'],
    },
  },

  // ── Text ──────────────────────────────────────────────────────────────────
  {
    key: 'elementarySchool',
    label: 'Elementary school',
    category: 'schools',
    kind: 'text',
    mv: 'elementary_school',
  },
  {
    key: 'middleSchool',
    label: 'Middle school',
    category: 'schools',
    kind: 'text',
    mv: 'middle_school',
  },
  {
    key: 'highSchool',
    label: 'High school',
    category: 'schools',
    kind: 'text',
    mv: 'high_school',
  },
  // REMOVED 2026-07-30 (adversarial accuracy audit): schoolDistrict. Every
  // non-null school_district value in the MV (1,596 rows) was the masked
  // marker "********" — the feed does not license SchoolDistrict, and the old
  // coverageNote ("Reported on some listings only") described mask pollution,
  // not data. The elementary/middle/high school name filters remain — those
  // columns carry real values.
  {
    key: 'zoning',
    label: 'Zoning',
    category: 'land_acreage',
    kind: 'text',
    mv: 'zoning',
    coverageNote: 'County zoning code, e.g. R2, EFU.',
  },
  {
    key: 'irrigationDistrict',
    label: 'Irrigation district',
    category: 'land_acreage',
    kind: 'text',
    mv: 'irrigation_district',
    coverageNote: 'Backfill pending 2026-07-30',
  },
  {
    key: 'keywords',
    label: 'Keywords',
    category: 'listing_meta',
    kind: 'text',
    mv: 'public_remarks',
  },
]

const FIELD_BY_KEY: ReadonlyMap<string, SearchFieldDef> = new Map(
  SEARCH_FIELDS.map((field) => [field.key, field]),
)

export function searchFieldByKey(key: string): SearchFieldDef | undefined {
  return FIELD_BY_KEY.get(key)
}

export function searchFieldsByCategory(cat: SearchFieldCategory): SearchFieldDef[] {
  return SEARCH_FIELDS.filter((field) => field.category === cat)
}

export function urlParamsForField(def: SearchFieldDef): string[] {
  if (def.kind !== 'range') return [def.key]
  if (def.legacyParams) {
    const params: string[] = []
    if (def.legacyParams.min) params.push(def.legacyParams.min)
    if (def.legacyParams.max) params.push(def.legacyParams.max)
    return params
  }
  return [`${def.key}Min`, `${def.key}Max`]
}

export const ALL_SEARCH_URL_PARAMS: readonly string[] = SEARCH_FIELDS.flatMap((field) =>
  urlParamsForField(field),
)

/**
 * Coerce raw URL params into typed registry filter values, keyed the way the
 * DAL expects them: booleans `'1'` -> true, multi CSV -> string[], texts ->
 * trimmed string, ranges -> numbers under the DAL-canonical `${key}Min` /
 * `${key}Max` (whatever the URL param was named). One implementation so the
 * server pages, the split-view client, and the count action cannot drift.
 */
export function coerceRegistryParams(
  params: Record<string, string | undefined>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const def of SEARCH_FIELDS) {
    if (def.kind === 'boolean') {
      if (params[def.key] === '1') out[def.key] = true
    } else if (def.kind === 'multi') {
      const raw = params[def.key]
      if (raw?.trim()) {
        const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
        if (values.length > 0) out[def.key] = values
      }
    } else if (def.kind === 'text') {
      const v = params[def.key]?.trim()
      if (v) out[def.key] = v
    } else {
      const urlMin = def.legacyParams ? def.legacyParams.min : `${def.key}Min`
      const urlMax = def.legacyParams ? def.legacyParams.max : `${def.key}Max`
      for (const [urlParam, dalField] of [
        [urlMin, `${def.key}Min`],
        [urlMax, `${def.key}Max`],
      ] as const) {
        if (!urlParam) continue
        const raw = params[urlParam]
        if (raw == null || raw.trim() === '') continue
        const n = Number(raw)
        if (Number.isFinite(n) && n > 0) out[dalField] = n
      }
    }
  }
  return out
}
