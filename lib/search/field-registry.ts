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
    key: 'noHoa',
    label: 'No HOA',
    category: 'community_hoa',
    kind: 'boolean',
    mv: 'association_yn',
    voice: ['no hoa', 'without an hoa'],
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
    voice: ['guest house', 'casita', 'adu', 'accessory dwelling'],
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
    key: 'singleLevel',
    label: 'Single level',
    category: 'size_layout',
    kind: 'boolean',
    mv: 'levels',
    voice: ['single level', 'single story', 'one level', 'one story', 'no stairs'],
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

  // ── Multi-selects ─────────────────────────────────────────────────────────
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
      'Spa/Hot Tub': ['hot tub'],
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
  {
    key: 'laundryFeatures',
    label: 'Laundry',
    category: 'interior',
    kind: 'multi',
    mv: 'laundry_features',
    options: [],
    coverageNote: 'Laundry detail is not reported on current on-market listings.',
  },
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
    options: ['Territorial', 'Neighborhood', 'Mountain(s)', 'Cascade Mountains', 'Panoramic', 'Forest', 'Valley', 'City', 'Golf Course', 'Lake', 'River', 'Pond', 'Ridge', 'Creek/Stream', 'Park/Greenbelt', 'Desert', 'Canyon', 'Vineyard'],
    voiceValues: {
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
      'Manufactured House': ['manufactured'],
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
    key: 'utilities',
    label: 'Utilities available',
    category: 'water_utilities',
    kind: 'multi',
    mv: 'utilities',
    options: ['Electricity Available', 'Cable Available', 'Phone Available', 'Natural Gas Available', 'Fiber Optics Available'],
    voiceValues: {
      'Fiber Optics Available': ['fiber', 'fiber optic'],
      'Natural Gas Available': ['natural gas'],
      'Cable Available': ['cable'],
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
    options: ['Composition', 'Metal', 'Asphalt', 'Membrane', 'Tile'],
    voiceValues: {
      Metal: ['metal roof'],
      Tile: ['tile roof'],
    },
  },
  {
    key: 'constructionMaterials',
    label: 'Construction',
    category: 'type_construction',
    kind: 'multi',
    mv: 'construction_materials_arr',
    options: ['Frame', 'Concrete', 'Block', 'Double Wall/Staggered Stud', 'Steel Frame', 'Log', 'Brick'],
    voiceValues: {
      Log: ['log home'],
      'Steel Frame': ['steel frame'],
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
    options: ['Northwest', 'Ranch', 'Traditional', 'Craftsman', 'Contemporary', 'Bungalow', 'Log', 'Chalet', 'Prairie'],
    voiceValues: {
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
    key: 'levelsOptions',
    label: 'Stories',
    category: 'size_layout',
    kind: 'multi',
    mv: 'levels',
    singleColumnIn: true,
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
    options: ['Cash', 'Conventional', 'VA Loan', 'FHA', 'USDA Loan', 'Owner Will Carry', 'FMHA', 'Contract', 'Private Financing Available', 'Trade'],
    voiceValues: {
      FHA: ['fha'],
      'VA Loan': ['va loan', 'va eligible'],
      'USDA Loan': ['usda'],
    },
  },
  {
    key: 'specialConditions',
    label: 'Sale conditions',
    category: 'listing_meta',
    kind: 'multi',
    mv: 'special_conditions',
    options: ['Standard', 'Trust', 'Probate Listing', 'Real Estate Owned'],
    voiceValues: {
      'Real Estate Owned': ['foreclosure', 'reo', 'bank owned'],
      'Probate Listing': ['probate'],
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
    options: ['Outdoor Pool', 'In Ground', 'Community', 'Association', 'Heated', 'Fenced', 'Pool Cover', 'Private', 'Above Ground', 'Indoor', 'Lap', 'Pool/Spa Combo'],
    voiceValues: {
      'In Ground': ['in ground pool'],
      Indoor: ['indoor pool'],
    },
  },
  {
    key: 'county',
    label: 'County',
    category: 'listing_meta',
    kind: 'multi',
    mv: 'county',
    singleColumnIn: true,
    options: ['Deschutes', 'Crook', 'Jefferson', 'Klamath', 'Lake'],
    voiceValues: {
      Deschutes: ['deschutes county'],
      Crook: ['crook county'],
      Jefferson: ['jefferson county'],
    },
  },
  {
    key: 'directionFaces',
    label: 'Faces',
    category: 'outdoor_lot',
    kind: 'multi',
    mv: 'direction_faces',
    singleColumnIn: true,
    options: ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'],
    voiceValues: {
      North: ['north facing', 'faces north'],
      Northeast: ['northeast facing', 'faces northeast'],
      East: ['east facing', 'faces east'],
      Southeast: ['southeast facing', 'faces southeast'],
      South: ['south facing', 'faces south'],
      Southwest: ['southwest facing', 'faces southwest'],
      West: ['west facing', 'faces west'],
      Northwest: ['northwest facing', 'faces northwest'],
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
  {
    key: 'schoolDistrict',
    label: 'School district',
    category: 'schools',
    kind: 'text',
    mv: 'school_district',
    coverageNote: 'Reported on some listings only.',
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
