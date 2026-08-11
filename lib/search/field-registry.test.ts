import { describe, it, expect } from 'vitest'
import {
  SEARCH_FIELDS,
  SEARCH_FIELD_CATEGORIES,
  searchFieldByKey,
  searchFieldsByCategory,
  urlParamsForField,
  ALL_SEARCH_URL_PARAMS,
  type SearchFieldDef,
} from './field-registry'

describe('field-registry: registry size (update when fields land/leave)', () => {
  it('carries the expected field count per kind', () => {
    const byKind = (kind: string) => SEARCH_FIELDS.filter((f) => f.kind === kind).length
    // Phase 1 tranche (2026-07-30): +9 range, +9 boolean, +6 multi, +2 text.
    // Accuracy audit (2026-07-30): -5 range (walkScore, storiesTotal,
    // fireplacesTotal, carportSpaces, parkingTotal), -3 boolean (spa,
    // carport, homeWarranty), -1 multi (directionFaces), -1 text
    // (schoolDistrict) — all built on StandardFields the feed masks
    // ("********"), so none could ever match a listing.
    // Sub-type tranche (2026-07-30, plan §4): +1 multi (propertySubTypes).
    // P5 long-tail tranche (2026-07-30, plan §12): +3 range (bathsFull,
    // bathsHalf, pricePerSqft), +1 multi (aduType) — existing MV columns,
    // each verified ≥25 live rows before exposure.
    // MV v4 long-tail tranche (2026-07-31, plan §15): +4 range (pricePerAcre,
    // unitsTotal, currentRent, estCompletionYear), +8 boolean (attachedGarage,
    // rented, potentialTaxLiability, specialAssessment, highSpeedInternet,
    // manufacturedAllowed, buildingPermitIssued, secondResidence), +11 multi
    // (utilitiesLocation, homeSiteApproval, powerProduction,
    // greenCertification, landRestrictions, multiUnitFeatures, railroadAccess,
    // soilType, acreageFeatures, irrigationDistribution, waterRightsType).
    // The 24th EXPOSE concept, group:Utilities, merged into the existing
    // `utilities` field as four options rather than adding a field.
    expect(byKind('range')).toBe(22)
    expect(byKind('boolean')).toBe(47)
    expect(byKind('multi')).toBe(56)
    expect(byKind('text')).toBe(6)
    expect(SEARCH_FIELDS).toHaveLength(131)
  })
})

describe('field-registry: keys and URL params', () => {
  it('has no duplicate field keys', () => {
    const keys = SEARCH_FIELDS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no duplicate URL params across the registry', () => {
    expect(new Set(ALL_SEARCH_URL_PARAMS).size).toBe(ALL_SEARCH_URL_PARAMS.length)
  })

  it('boolean, multi, and text fields own exactly their key as the URL param', () => {
    for (const field of SEARCH_FIELDS) {
      if (field.kind === 'range') continue
      expect(urlParamsForField(field)).toEqual([field.key])
    }
  })

  it('range fields with legacy params expose exactly those params', () => {
    const price = searchFieldByKey('price')!
    expect(urlParamsForField(price)).toEqual(['minPrice', 'maxPrice'])

    const garage = searchFieldByKey('garage')!
    expect(urlParamsForField(garage)).toEqual(['garageMin'])

    const dom = searchFieldByKey('dom')!
    expect(urlParamsForField(dom)).toEqual(['daysOnMarket'])
  })

  it('range fields without legacy params fall back to keyMin/keyMax', () => {
    const synthetic: SearchFieldDef = {
      key: 'ceilingHeight',
      label: 'Ceiling height',
      category: 'size_layout',
      kind: 'range',
      mv: 'ceiling_height',
    }
    expect(urlParamsForField(synthetic)).toEqual(['ceilingHeightMin', 'ceilingHeightMax'])
  })
})

describe('field-registry: multi options', () => {
  it('every multi has a non-empty options array', () => {
    for (const field of SEARCH_FIELDS) {
      if (field.kind !== 'multi') continue
      expect(Array.isArray(field.options), `${field.key} missing options`).toBe(true)
      expect(field.options!.length, `${field.key} has empty options`).toBeGreaterThan(0)
    }
  })

  it('every option string is unique within its field', () => {
    for (const field of SEARCH_FIELDS) {
      if (!field.options) continue
      expect(new Set(field.options).size, `${field.key} has duplicate options`).toBe(field.options.length)
    }
  })

  it('drops data-noise values from every options list', () => {
    const noise = ['None', 'Other', 'Unknown', 'See Remarks']
    for (const field of SEARCH_FIELDS) {
      if (!field.options) continue
      for (const value of noise) {
        expect(field.options, `${field.key} still carries "${value}"`).not.toContain(value)
      }
    }
  })

  it('every voiceValues key is a member of the field options', () => {
    for (const field of SEARCH_FIELDS) {
      if (!field.voiceValues) continue
      for (const optionKey of Object.keys(field.voiceValues)) {
        expect(field.options, `${field.key} voiceValues key "${optionKey}" not in options`).toContain(optionKey)
      }
    }
  })
})

describe('field-registry: voice phrases', () => {
  it('voice phrases are lowercase and nonempty', () => {
    for (const field of SEARCH_FIELDS) {
      if (!field.voice) continue
      for (const phrase of field.voice) {
        expect(phrase.length, `${field.key} has an empty voice phrase`).toBeGreaterThan(0)
        expect(phrase, `${field.key} voice phrase "${phrase}" is not lowercase`).toBe(phrase.toLowerCase())
      }
    }
  })

  it('voiceValues phrases are lowercase and nonempty', () => {
    for (const field of SEARCH_FIELDS) {
      if (!field.voiceValues) continue
      for (const [optionKey, phrases] of Object.entries(field.voiceValues)) {
        expect(phrases.length, `${field.key}/${optionKey} has no phrases`).toBeGreaterThan(0)
        for (const phrase of phrases) {
          expect(phrase.length, `${field.key}/${optionKey} has an empty phrase`).toBeGreaterThan(0)
          expect(phrase, `${field.key}/${optionKey} phrase "${phrase}" is not lowercase`).toBe(phrase.toLowerCase())
        }
      }
    }
  })
})

describe('field-registry: categories', () => {
  it('lists all 16 categories exactly once', () => {
    expect(SEARCH_FIELD_CATEGORIES).toHaveLength(16)
    const ids = SEARCH_FIELD_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(16)
  })

  it('every field category resolves to a registered category', () => {
    const ids = new Set(SEARCH_FIELD_CATEGORIES.map((c) => c.id))
    for (const field of SEARCH_FIELDS) {
      expect(ids.has(field.category), `${field.key} has unknown category ${field.category}`).toBe(true)
    }
  })

  it('every category has at least one field', () => {
    for (const cat of SEARCH_FIELD_CATEGORIES) {
      expect(searchFieldsByCategory(cat.id).length, `${cat.id} has no fields`).toBeGreaterThan(0)
    }
  })

  it('labels the schools category "Schools"', () => {
    const schools = SEARCH_FIELD_CATEGORIES.find((c) => c.id === 'schools')
    expect(schools?.label).toBe('Schools')
  })
})

describe('field-registry: helpers and contract fixtures', () => {
  it('searchFieldByKey resolves known fields and misses unknown ones', () => {
    expect(searchFieldByKey('price')?.mv).toBe('list_price')
    expect(searchFieldByKey('shop')?.dalExpression).toBe(true)
    expect(searchFieldByKey('nope')).toBeUndefined()
  })

  it('searchFieldsByCategory returns the school text fields', () => {
    const keys = searchFieldsByCategory('schools').map((f) => f.key)
    expect(keys).toEqual(['elementarySchool', 'middleSchool', 'highSchool'])
  })

  it('flags exactly the contract DAL-expression booleans', () => {
    const flagged = SEARCH_FIELDS.filter((f) => f.dalExpression).map((f) => f.key).sort()
    expect(flagged).toEqual(['adjoinsPublicLand', 'gatedCommunity', 'hasGolfCourse', 'rvParking', 'shop'])
  })

  it('flags exactly the contract single-column IN multis', () => {
    // aduType joined the set in the P5 long-tail tranche (2026-07-30):
    // adu_type is a scalar MV column, IN semantics like county/levels.
    const flagged = SEARCH_FIELDS.filter((f) => f.singleColumnIn).map((f) => f.key).sort()
    expect(flagged).toEqual(['aduType', 'county', 'levelsOptions', 'propertySubTypes'])
  })

  it('keeps matchMode "all" only where the contract requires it', () => {
    const all = SEARCH_FIELDS.filter((f) => f.matchMode === 'all').map((f) => f.key).sort()
    expect(all).toEqual(['appliances', 'interiorFeatures'])
  })

  it('ALL_SEARCH_URL_PARAMS contains the legacy and new params', () => {
    for (const param of ['minPrice', 'maxPrice', 'minSqFt', 'maxSqFt', 'beds', 'maxBeds', 'baths', 'maxBaths', 'garageMin', 'daysOnMarket', 'hoaMonthlyMax', 'hasFireplace', 'shop', 'appliances', 'county', 'keywords']) {
      expect(ALL_SEARCH_URL_PARAMS, `missing ${param}`).toContain(param)
    }
  })
})

describe('field-registry: propertySubTypes (sub-type tranche, plan §4 2026-07-30)', () => {
  const def = searchFieldByKey('propertySubTypes')!

  it('is an enumerated single-column IN multi over property_sub_type', () => {
    expect(def).toBeDefined()
    expect(def.kind).toBe('multi')
    expect(def.label).toBe('Home type')
    expect(def.category).toBe('type_construction')
    expect(def.mv).toBe('property_sub_type')
    expect(def.singleColumnIn).toBe(true)
    expect(def.matchMode).toBeUndefined()
  })

  it('carries the 21 exact live values, grouped by class in count-descending order', () => {
    // Measured in listing_search_mv (all 9,648 on-market rows, 2026-07-30):
    // 21 distinct non-null values. Order: class A, B, C, D; count-descending
    // within class.
    expect(def.options).toEqual([
      'Single Family Residence', 'Manufactured On Land', 'Townhouse', 'Condominium',
      'Tenancy in Common', 'Residential Leased Land', 'Stock Cooperative', 'Timeshare',
      'In Park', 'On Leased Land',
      'Duplex', 'Multi Family', 'Quadruplex', 'Triplex',
      'Residential Lots', 'Commercial', 'Recreational', 'Agriculture',
      'Industrial', 'Rangeland', 'Investment',
    ])
  })

  it('owns the single-target sub-type voice synonyms (plan §4.6)', () => {
    const vv = def.voiceValues!
    expect(vv.Condominium).toContain('condo')
    expect(vv.Townhouse).toContain('townhome')
    expect(vv.Townhouse).toContain('row house')
    expect(vv.Duplex).toContain('duplex')
    expect(vv.Triplex).toContain('triplex')
    expect(vv.Quadruplex).toContain('fourplex')
    expect(vv.Quadruplex).toContain('quadplex')
    expect(vv['In Park']).toContain('mobile home park')
    expect(vv['Stock Cooperative']).toContain('co-op')
    expect(vv['Tenancy in Common']).toContain('tic')
    expect(vv.Timeshare).toContain('timeshare')
    expect(vv['Residential Lots']).toContain('vacant lot')
  })

  it('leaves "double wide" on bodyType and "manufactured" off structureTypes (interplay locks)', () => {
    // 'double wide' stays a manufactured BODY TYPE filter, not a sub-type
    // remap; 'manufactured' moved to the multi-value sub-type grammar in
    // parse-search-query (SUBTYPE_SET_PHRASES), off structureTypes.
    expect(searchFieldByKey('bodyType')?.voiceValues?.['Double Wide']).toContain('double wide')
    const flat = Object.values(def.voiceValues!).flat()
    expect(flat).not.toContain('double wide')
    expect(Object.values(searchFieldByKey('structureTypes')?.voiceValues ?? {}).flat()).not.toContain('manufactured')
  })

  it('registers the propertySubTypes URL param without touching the legacy scalar', () => {
    expect(ALL_SEARCH_URL_PARAMS).toContain('propertySubTypes')
    // The legacy scalar `propertySubType` is a DAL/page param, not a registry
    // field — the registry must not claim it.
    expect(ALL_SEARCH_URL_PARAMS).not.toContain('propertySubType')
  })
})

describe('field-registry: Phase 1 tranche (CustomFields + promoted scalars, 2026-07-30)', () => {
  const EXPECTED_MV: Record<string, string> = {
    // booleans
    adu: 'adu_yn',
    aduPermitted: 'adu_permitted_yn',
    strPermit: 'str_permit_yn',
    ccrs: 'ccrs_yn',
    hasFloorPlan: 'has_floor_plan',
    hasVideo: 'has_video',
    // ranges
    aduSqft: 'adu_sqft',
    irrigationAcres: 'irrigation_acres',
    photosCount: 'photos_count',
    prevListPrice: 'prev_list_price',
    // multis
    floodZone: 'flood_zone',
    governmentOverlay: 'government_overlay',
    easements: 'easements',
    roomsArr: 'rooms_arr',
    bodyType: 'body_types',
    fencing: 'fencing_arr',
    // texts
    zoning: 'zoning',
    irrigationDistrict: 'irrigation_district',
  }

  it('every new field exists with the contracted MV column, a category, and a label', () => {
    for (const [key, mv] of Object.entries(EXPECTED_MV)) {
      const def = searchFieldByKey(key)
      expect(def, `${key} missing from registry`).toBeDefined()
      expect(def!.mv, `${key} mv column`).toBe(mv)
      expect(def!.category.length, `${key} category`).toBeGreaterThan(0)
      expect(def!.label.length, `${key} label`).toBeGreaterThan(0)
    }
  })

  it('new URL params register in ALL_SEARCH_URL_PARAMS (saved-search whitelist)', () => {
    for (const param of ['adu', 'strPermit', 'ccrs', 'hasFloorPlan', 'hasVideo', 'floodZone', 'roomsArr', 'bodyType', 'fencing', 'zoning', 'irrigationDistrict', 'aduSqftMin', 'aduSqftMax', 'photosCountMin', 'prevListPriceMin', 'irrigationAcresMin']) {
      expect(ALL_SEARCH_URL_PARAMS, `missing ${param}`).toContain(param)
    }
  })

  it('CF-derived fields carry the backfill coverage note until the re-pull lands', () => {
    for (const key of ['adu', 'aduPermitted', 'aduSqft', 'strPermit', 'ccrs', 'irrigationDistrict', 'floodZone', 'governmentOverlay', 'easements', 'roomsArr']) {
      expect(searchFieldByKey(key)?.coverageNote, `${key} coverageNote`).toBe('Backfill pending 2026-07-30')
    }
  })

  it('adu owns the accessory-dwelling voice phrases (moved off guestHouse)', () => {
    expect(searchFieldByKey('adu')?.voice).toContain('adu')
    expect(searchFieldByKey('adu')?.voice).toContain('casita')
    expect(searchFieldByKey('guestHouse')?.voice).toEqual(['guest house'])
  })
})

describe('field-registry: MV v4 long-tail tranche (2026-07-31, plan §15)', () => {
  // The 24 EXPOSE concepts from data/search-metadata/longtail-census.json.
  // 23 of them land as new fields; group:Utilities merges into `utilities`.
  const EXPECTED_MV: Record<string, string> = {
    // booleans
    attachedGarage: 'attached_garage_yn',
    rented: 'rented_yn',
    potentialTaxLiability: 'potential_tax_liability_yn',
    specialAssessment: 'special_assessment_yn',
    highSpeedInternet: 'high_speed_internet_yn',
    manufacturedAllowed: 'manufactured_allowed_yn',
    buildingPermitIssued: 'building_permit_issued_yn',
    secondResidence: 'second_residence_yn',
    // ranges
    pricePerAcre: 'price_per_acre',
    unitsTotal: 'units_total',
    currentRent: 'current_rent',
    estCompletionYear: 'est_completion_year',
    // multis
    utilitiesLocation: 'utilities_location',
    homeSiteApproval: 'home_site_approval',
    powerProduction: 'power_production',
    greenCertification: 'green_certification',
    landRestrictions: 'land_restrictions',
    multiUnitFeatures: 'multi_unit_features',
    railroadAccess: 'railroad_access',
    soilType: 'soil_type',
    acreageFeatures: 'acreage_features',
    irrigationDistribution: 'irrigation_distribution',
    waterRightsType: 'water_rights_type',
  }

  it('registers all 23 new fields on their contracted MV columns', () => {
    expect(Object.keys(EXPECTED_MV)).toHaveLength(23)
    for (const [key, mv] of Object.entries(EXPECTED_MV)) {
      const def = searchFieldByKey(key)
      expect(def, `${key} missing from registry`).toBeDefined()
      expect(def!.mv, `${key} mv column`).toBe(mv)
      expect(def!.label.length, `${key} label`).toBeGreaterThan(0)
      // Sentence case, brand voice: no Title Case run-ons in a field label.
      expect(def!.label[0], `${key} label starts uppercase`).toBe(def!.label[0].toUpperCase())
    }
  })

  it('registers every new URL param (saved-search whitelist)', () => {
    for (const param of [
      'attachedGarage', 'rented', 'potentialTaxLiability', 'specialAssessment',
      'highSpeedInternet', 'manufacturedAllowed', 'buildingPermitIssued', 'secondResidence',
      'pricePerAcreMin', 'pricePerAcreMax', 'unitsTotalMin', 'unitsTotalMax',
      'currentRentMin', 'currentRentMax', 'estCompletionYearMin', 'estCompletionYearMax',
      'utilitiesLocation', 'homeSiteApproval', 'powerProduction', 'greenCertification',
      'landRestrictions', 'multiUnitFeatures', 'railroadAccess', 'soilType',
      'acreageFeatures', 'irrigationDistribution', 'waterRightsType',
    ]) {
      expect(ALL_SEARCH_URL_PARAMS, `missing ${param}`).toContain(param)
    }
  })

  it('merges the CF "* Connected" utilities into the existing utilities field', () => {
    // group:Utilities is the 24th EXPOSE concept. Its four members ship as
    // options here, not as a second filter — the MV v4 column unions the RESO
    // feature object with the CF group.
    const utilities = searchFieldByKey('utilities')!
    expect(utilities.mv).toBe('utilities')
    for (const option of ['Electricity Connected', 'Natural Gas Connected', 'Cable Connected', 'Phone Connected']) {
      expect(utilities.options, `utilities missing ${option}`).toContain(option)
    }
    // The pre-existing "* Available" options are untouched.
    expect(utilities.options).toContain('Electricity Available')
    expect(searchFieldByKey('utilitiesConnected'), 'no second utilities filter').toBeUndefined()
  })

  it('leaves "attached garage" with parkingFeatures (first registration wins)', () => {
    // attachedGarage registers in the boolean block, ahead of the parking
    // multi. Giving it the phrase would silently take it off a working filter,
    // so the field ships without voice.
    expect(searchFieldByKey('attachedGarage')?.voice).toBeUndefined()
    expect(searchFieldByKey('parkingFeatures')?.voiceValues?.Attached).toContain('attached garage')
  })

  it('beats the bare "manufactured" sub-type claim with a longer phrase', () => {
    // The parser sorts matchers longest-first, so 'manufactured home allowed'
    // consumes before SUBTYPE_SET_PHRASES' 'manufactured'.
    const voice = searchFieldByKey('manufacturedAllowed')?.voice ?? []
    expect(voice).toContain('manufactured home allowed')
    for (const phrase of voice) expect(phrase.length).toBeGreaterThan('manufactured'.length)
  })

  it('ships pricePerAcre as a computed usd range, not the MLS custom field', () => {
    const def = searchFieldByKey('pricePerAcre')!
    expect(def.kind).toBe('range')
    expect(def.unit).toBe('usd')
    expect(def.mv).toBe('price_per_acre')
  })

  it('ships estCompletionYear as a year range (the CF is a date string)', () => {
    const def = searchFieldByKey('estCompletionYear')!
    expect(def.kind).toBe('range')
    expect(def.unit).toBe('year')
    expect(urlParamsForField(def)).toEqual(['estCompletionYearMin', 'estCompletionYearMax'])
  })

  it('keeps every new multi on array-overlap semantics', () => {
    // None of the v4 multis is a scalar column, so none may carry
    // singleColumnIn, and none needs match-all.
    for (const key of ['utilitiesLocation', 'homeSiteApproval', 'powerProduction', 'greenCertification', 'landRestrictions', 'multiUnitFeatures', 'railroadAccess', 'soilType', 'acreageFeatures', 'irrigationDistribution', 'waterRightsType']) {
      const def = searchFieldByKey(key)!
      expect(def.kind, `${key} kind`).toBe('multi')
      expect(def.singleColumnIn, `${key} singleColumnIn`).toBeUndefined()
      expect(def.matchMode, `${key} matchMode`).toBeUndefined()
      expect(def.options!.length, `${key} options`).toBeGreaterThan(0)
    }
  })

  it('carries Solar Leased on powerProduction (the snapshot drops it)', () => {
    // Census anomaly 2026-07-31: the normalizer folds StandardizedAs members
    // into their parent enum, so group:Power Production's value list loses
    // 'Solar Leased' even though 45 serving rows assert it. Curation
    // allowlists the option; the MV candidate array includes it.
    expect(searchFieldByKey('powerProduction')?.options).toContain('Solar Leased')
  })
})

describe('field-registry: filter-coverage fix (2026-07-31)', () => {
  it('county covers every market carrying 25+ live listings', () => {
    // Measured over listing_search_mv active rows 2026-07-31: Deschutes 2,449 ·
    // Jackson 1,734 · Klamath 1,205 · Josephine 850 · Crook 553 · Jefferson 314
    // · Lake 113 · Grant 55 · Douglas 48 · Lane 29. The 24 remaining counties in
    // the feed all sit under 25 (Lincoln 20 is the highest) and stay out — an
    // option reaching one listing in Gilliam is a dead end, not a filter.
    expect(searchFieldByKey('county')?.options).toEqual([
      'Deschutes', 'Jackson', 'Klamath', 'Josephine', 'Crook',
      'Jefferson', 'Lake', 'Grant', 'Douglas', 'Lane',
    ])
  })

  it('gives every county option a voice phrase', () => {
    const def = searchFieldByKey('county')!
    for (const option of def.options!) {
      expect(def.voiceValues?.[option], `county option ${option} has no voice phrase`).toBeTruthy()
    }
  })

  it('exposes every live value of the closed attribute enums', () => {
    // Live active counts, listing_search_mv 2026-07-31. Options below 25 ship
    // because these are closed vocabularies the MLS publishes in full: showing
    // part of one asserts the hidden values do not exist.
    const EXPECTED: Record<string, string[]> = {
      listingTerms: ['Assumable', 'Trust Deed'],                                  // 35, 13
      specialConditions: [
        'Third Party Approval', 'Short Sale', 'Conservatorship', 'In Foreclosure',
        'Auction', 'Notice Of Default', 'Bankruptcy Property', 'HUD Owned',
      ],                                                                          // 22..4
      architecturalStyles: ['A-Frame', 'Colonial', 'Victorian', 'Tudor'],         // 38, 26, 19, 10
      roofTypes: ['Rubber', 'Shake', 'Rolled/Hot Mop', 'Built-Up', 'Slate'],      // 42..11
      viewTypes: ['Orchard', 'Ocean', 'Beach', 'Bay'],                            // 28, 19, 6, 5
      constructionMaterials: [
        'ICFs (Insulated Concrete Forms)', 'Structural Insulated Panels', 'Straw',
      ],                                                                          // 28, 26, 3
      poolFeatures: [
        'Gas Heat', 'Gunite', 'Waterfall', 'Filtered', 'Salt Water', 'Solar Heat',
        'Pool Sweep', 'Tile', 'Diving Board', 'Electric Heat', 'Solar Cover', 'Liner',
        'ENERGY STAR Qualified Pool Pump', 'Vinyl', 'Cabana', 'Fiberglass', 'Sport',
        'Infinity', 'Black Bottom',
      ],                                                                          // 32..2
    }
    for (const [key, added] of Object.entries(EXPECTED)) {
      const options = searchFieldByKey(key)?.options
      for (const value of added) {
        expect(options, `${key} is missing the live value "${value}"`).toContain(value)
      }
    }
  })

  it('keeps the option counts the coverage fix landed on', () => {
    const sizes: Record<string, number> = {
      county: 10, listingTerms: 12, specialConditions: 12, architecturalStyles: 13,
      roofTypes: 10, viewTypes: 22, constructionMaterials: 10, poolFeatures: 31,
    }
    for (const [key, n] of Object.entries(sizes)) {
      expect(searchFieldByKey(key)?.options?.length, `${key} option count`).toBe(n)
    }
  })

  it('states the exclusion on both filters whose label used to overclaim', () => {
    // noHoa dropped 761 unknown-HOA rows; singleLevel keeps excluding mixed
    // "One, Two" homes. Both say so rather than letting the label imply more
    // than the data asserts.
    expect(searchFieldByKey('noHoa')?.coverageNote).toMatch(/excluded/)
    expect(searchFieldByKey('singleLevel')?.coverageNote).toMatch(/excluded/)
  })

  it('flags levels as the one scalar column the feed multi-selects into', () => {
    const flagged = SEARCH_FIELDS.filter((f) => f.multiValueScalar).map((f) => f.key)
    expect(flagged).toEqual(['levelsOptions'])
  })
})
