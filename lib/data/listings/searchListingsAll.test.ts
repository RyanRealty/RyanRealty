import { describe, it, expect } from 'vitest'
import { SEARCH_FIELDS, urlParamsForField, coerceRegistryParams } from '@/lib/search/field-registry'
import { SearchListingsAllFilterSchema, SEARCH_FEATURE_FILTER_KEYS } from './searchListingsAll'
import {
  BOOLEAN_PREDICATES,
  MULTI_FIELD_DEFS,
  TEXT_FIELD_COLUMNS,
  RANGE_FIELD_COLUMNS,
  LEGACY_PROPERTY_SUB_TYPE_MAP,
  resolveLegacyPropertySubType,
} from './searchPredicates'

/**
 * Registry ↔ DAL parity — the drift gate.
 *
 * lib/search/field-registry.ts is the single source of truth for the filter
 * surface. Every field it declares must be (a) accepted by the
 * searchListingsAll FilterSchema under the DAL-canonical key names that
 * coerceRegistryParams produces, and (b) resolvable to a listing_search_mv
 * predicate through the tables in searchPredicates.ts. Without this test, a
 * registry addition that skips the DAL silently never filters (the 2026-07-30
 * CF tranche added 26 fields — this is what catches the next tranche).
 */

const SCHEMA_KEYS = new Set(Object.keys(SearchListingsAllFilterSchema.shape))

/** DAL-canonical filter keys coerceRegistryParams emits for a field. */
function dalKeysFor(def: (typeof SEARCH_FIELDS)[number]): string[] {
  if (def.kind !== 'range') return [def.key]
  const keys: string[] = []
  if (!def.legacyParams || def.legacyParams.min) keys.push(`${def.key}Min`)
  if (!def.legacyParams || def.legacyParams.max) keys.push(`${def.key}Max`)
  return keys
}

describe('registry ↔ FilterSchema parity', () => {
  for (const def of SEARCH_FIELDS) {
    it(`${def.kind} '${def.key}' -> FilterSchema accepts [${dalKeysFor(def).join(', ')}]`, () => {
      for (const key of dalKeysFor(def)) {
        expect(SCHEMA_KEYS, `FilterSchema is missing '${key}' (registry field '${def.key}')`).toContain(key)
      }
    })
  }

  it('every registry urlParam coerces onto a FilterSchema key', () => {
    for (const def of SEARCH_FIELDS) {
      const params: Record<string, string> = {}
      for (const p of urlParamsForField(def)) {
        params[p] = def.kind === 'boolean' ? '1' : def.kind === 'range' ? '2' : 'x,y'
      }
      const coerced = coerceRegistryParams(params)
      expect(Object.keys(coerced).length, `coerceRegistryParams produced nothing for '${def.key}'`).toBeGreaterThan(0)
      for (const key of Object.keys(coerced)) {
        expect(SCHEMA_KEYS, `coerced key '${key}' (registry '${def.key}') not in FilterSchema`).toContain(key)
      }
    }
  })
})

describe('registry ↔ predicate-table parity', () => {
  const booleans = SEARCH_FIELDS.filter((d) => d.kind === 'boolean')
  const multis = SEARCH_FIELDS.filter((d) => d.kind === 'multi')
  const texts = SEARCH_FIELDS.filter((d) => d.kind === 'text' && d.key !== 'keywords')
  const ranges = SEARCH_FIELDS.filter((d) => d.kind === 'range')

  it('every registry boolean has a predicate (and no orphan predicates)', () => {
    const predicateKeys = new Set(Object.keys(BOOLEAN_PREDICATES))
    for (const def of booleans) {
      expect(predicateKeys, `BOOLEAN_PREDICATES missing '${def.key}'`).toContain(def.key)
    }
    const registryBooleanKeys = new Set(booleans.map((d) => d.key))
    for (const key of predicateKeys) {
      expect(registryBooleanKeys, `predicate '${key}' has no registry boolean field`).toContain(key)
    }
  })

  it('simple boolean predicates (isTrue) target the registry mv column', () => {
    for (const def of booleans) {
      const predicate = BOOLEAN_PREDICATES[def.key as keyof typeof BOOLEAN_PREDICATES]
      if (predicate.op === 'isTrue') {
        expect(predicate.col, `'${def.key}' isTrue column drifted from registry mv`).toBe(def.mv)
      }
    }
  })

  it('every registry multi resolves through MULTI_FIELD_DEFS with its mv column', () => {
    const byKey = new Map(MULTI_FIELD_DEFS.map((d) => [d.key, d]))
    for (const def of multis) {
      expect(byKey.get(def.key)?.mv, `multi '${def.key}' not wired`).toBe(def.mv)
    }
  })

  it('every registry text field (except keywords) maps to its mv column', () => {
    for (const def of texts) {
      expect(TEXT_FIELD_COLUMNS[def.key], `text '${def.key}' not wired`).toBe(def.mv)
    }
    expect(TEXT_FIELD_COLUMNS).not.toHaveProperty('keywords')
  })

  it('every registry range maps to its mv column', () => {
    for (const def of ranges) {
      expect(RANGE_FIELD_COLUMNS[def.key], `range '${def.key}' not wired`).toBe(def.mv)
    }
  })
})

describe('sub types (plan §4, 2026-07-30)', () => {
  const MANUFACTURED_SET = ['Manufactured On Land', 'In Park', 'On Leased Land']

  it('FilterSchema accepts the propertySubTypes array (max 25)', () => {
    const parsed = SearchListingsAllFilterSchema.parse({
      propertySubTypes: ['Condominium', 'Townhouse'],
    })
    expect(parsed.propertySubTypes).toEqual(['Condominium', 'Townhouse'])
    // Over the cap -> catch(undefined), never a thrown query.
    const over = SearchListingsAllFilterSchema.parse({
      propertySubTypes: Array.from({ length: 26 }, (_, i) => `V${i}`),
    })
    expect(over.propertySubTypes).toBeUndefined()
  })

  it('propertySubTypes applies as IN via the singleColumnIn registry contract', () => {
    // Same mechanism the county/levelsOptions multis use: applySearchFilters
    // routes singleColumnIn defs to query.in(def.mv, values).
    const def = MULTI_FIELD_DEFS.find((d) => d.key === 'propertySubTypes')
    expect(def).toBeDefined()
    expect(def!.mv).toBe('property_sub_type')
    expect(def!.singleColumnIn).toBe(true)
    expect(SEARCH_FEATURE_FILTER_KEYS).toContain('propertySubTypes')
  })

  it('legacy scalar strings resolve to EXACT canonical value sets', () => {
    // The mapping table the old substring contract papered over, now explicit.
    const cases: Array<[string, string[]]> = [
      ['Condo', ['Condominium']],
      ['condo', ['Condominium']],
      ['Condominium', ['Condominium']],
      ['Townhouse', ['Townhouse']],
      ['townhome', ['Townhouse']],
      ['Manufactured', MANUFACTURED_SET],
      ['manufactured', MANUFACTURED_SET],
    ]
    for (const [input, values] of cases) {
      expect(resolveLegacyPropertySubType(input), input).toEqual({ kind: 'in', values })
    }
    expect(LEGACY_PROPERTY_SUB_TYPE_MAP.manufactured).toEqual(MANUFACTURED_SET)
  })

  it('canonical values pass through as single-value IN sets, case-insensitively', () => {
    expect(resolveLegacyPropertySubType('Duplex')).toEqual({ kind: 'in', values: ['Duplex'] })
    expect(resolveLegacyPropertySubType('duplex')).toEqual({ kind: 'in', values: ['Duplex'] })
    expect(resolveLegacyPropertySubType('residential lots')).toEqual({ kind: 'in', values: ['Residential Lots'] })
  })

  it('unknown strings become case-insensitive EQUALITY, never substring', () => {
    const resolved = resolveLegacyPropertySubType('Mystery Value')
    expect(resolved).toEqual({ kind: 'ciEquals', value: 'Mystery Value' })
    // Wildcards are stripped BEFORE lookup, so an injected pattern cannot
    // widen the match ('Condo%' -> the Condo legacy set, not an ilike scan).
    expect(resolveLegacyPropertySubType('Condo%')).toEqual({ kind: 'in', values: ['Condominium'] })
    expect(resolveLegacyPropertySubType('*Land*')).toEqual({ kind: 'ciEquals', value: 'Land' })
    expect(resolveLegacyPropertySubType('%_*\\')).toEqual({ kind: 'none' })
  })
})

describe('CF tranche 2026-07-30 wiring (spot checks)', () => {
  it('parses and keeps the new filter keys', () => {
    const parsed = SearchListingsAllFilterSchema.parse({
      adu: true,
      strPermit: true,
      floodZone: ['Plain'],
      fencing: ['Wood'],
      zoning: 'EFU',
      irrigationDistrict: 'COID',
      aduSqftMin: 400,
      prevListPriceMax: 900000,
    })
    expect(parsed.adu).toBe(true)
    expect(parsed.strPermit).toBe(true)
    expect(parsed.floodZone).toEqual(['Plain'])
    expect(parsed.fencing).toEqual(['Wood'])
    expect(parsed.zoning).toBe('EFU')
    expect(parsed.irrigationDistrict).toBe('COID')
    expect(parsed.aduSqftMin).toBe(400)
    expect(parsed.prevListPriceMax).toBe(900000)
  })

  it('new keys ride SEARCH_FEATURE_FILTER_KEYS so action routers forward them', () => {
    for (const key of [
      'adu', 'aduPermitted', 'strPermit', 'ccrs',
      'hasFloorPlan', 'hasVideo', 'floodZone', 'governmentOverlay', 'easements',
      'roomsArr', 'bodyType', 'fencing', 'zoning', 'irrigationDistrict',
      'aduSqftMin', 'aduSqftMax', 'irrigationAcresMin', 'irrigationAcresMax',
      'photosCountMin', 'photosCountMax',
      'prevListPriceMin', 'prevListPriceMax',
    ]) {
      expect(SEARCH_FEATURE_FILTER_KEYS, `'${key}' missing from feature-filter keys`).toContain(key)
    }
  })
})

describe('P5 long-tail tranche 2026-07-30 wiring (spot checks)', () => {
  it('parses and keeps the new filter keys', () => {
    const parsed = SearchListingsAllFilterSchema.parse({
      bathsFullMin: 2,
      bathsHalfMin: 1,
      pricePerSqftMin: 200,
      pricePerSqftMax: 450,
      aduType: ['Detached'],
    })
    expect(parsed.bathsFullMin).toBe(2)
    expect(parsed.bathsHalfMin).toBe(1)
    expect(parsed.pricePerSqftMin).toBe(200)
    expect(parsed.pricePerSqftMax).toBe(450)
    expect(parsed.aduType).toEqual(['Detached'])
  })

  it('aduType applies as IN via the singleColumnIn registry contract', () => {
    const def = MULTI_FIELD_DEFS.find((d) => d.key === 'aduType')
    expect(def).toBeDefined()
    expect(def!.mv).toBe('adu_type')
    expect(def!.singleColumnIn).toBe(true)
  })

  it('new keys ride SEARCH_FEATURE_FILTER_KEYS so action routers forward them', () => {
    for (const key of [
      'bathsFullMin', 'bathsFullMax', 'bathsHalfMin', 'bathsHalfMax',
      'pricePerSqftMin', 'pricePerSqftMax', 'aduType',
    ]) {
      expect(SEARCH_FEATURE_FILTER_KEYS, `'${key}' missing from feature-filter keys`).toContain(key)
    }
  })
})

describe('MV v4 long-tail tranche 2026-07-31 wiring (spot checks)', () => {
  it('parses and keeps the new filter keys', () => {
    const parsed = SearchListingsAllFilterSchema.parse({
      attachedGarage: true,
      rented: true,
      potentialTaxLiability: true,
      specialAssessment: true,
      highSpeedInternet: true,
      manufacturedAllowed: true,
      buildingPermitIssued: true,
      secondResidence: true,
      pricePerAcreMin: 10000,
      pricePerAcreMax: 250000,
      unitsTotalMin: 2,
      currentRentMax: 2500,
      estCompletionYearMax: 2026,
      soilType: ['Loam'],
      powerProduction: ['Solar Owned'],
      waterRightsType: ['Adjudicated'],
      utilities: ['Electricity Connected'],
    })
    expect(parsed.attachedGarage).toBe(true)
    expect(parsed.secondResidence).toBe(true)
    expect(parsed.pricePerAcreMin).toBe(10000)
    expect(parsed.pricePerAcreMax).toBe(250000)
    expect(parsed.unitsTotalMin).toBe(2)
    expect(parsed.currentRentMax).toBe(2500)
    expect(parsed.estCompletionYearMax).toBe(2026)
    expect(parsed.soilType).toEqual(['Loam'])
    expect(parsed.powerProduction).toEqual(['Solar Owned'])
    expect(parsed.waterRightsType).toEqual(['Adjudicated'])
    expect(parsed.utilities).toEqual(['Electricity Connected'])
  })

  it('wires all eight new booleans to their v4 MV columns as IS TRUE', () => {
    const expected: Record<string, string> = {
      attachedGarage: 'attached_garage_yn',
      rented: 'rented_yn',
      potentialTaxLiability: 'potential_tax_liability_yn',
      specialAssessment: 'special_assessment_yn',
      highSpeedInternet: 'high_speed_internet_yn',
      manufacturedAllowed: 'manufactured_allowed_yn',
      buildingPermitIssued: 'building_permit_issued_yn',
      secondResidence: 'second_residence_yn',
    }
    for (const [key, col] of Object.entries(expected)) {
      const predicate = BOOLEAN_PREDICATES[key as keyof typeof BOOLEAN_PREDICATES]
      expect(predicate, `'${key}' missing from BOOLEAN_PREDICATES`).toBeDefined()
      expect(predicate.op, `'${key}' op`).toBe('isTrue')
      expect((predicate as { col: string }).col, `'${key}' column`).toBe(col)
    }
  })

  it('wires the new ranges and multis through the registry-derived tables', () => {
    expect(RANGE_FIELD_COLUMNS.pricePerAcre).toBe('price_per_acre')
    expect(RANGE_FIELD_COLUMNS.unitsTotal).toBe('units_total')
    expect(RANGE_FIELD_COLUMNS.currentRent).toBe('current_rent')
    expect(RANGE_FIELD_COLUMNS.estCompletionYear).toBe('est_completion_year')
    const byKey = new Map(MULTI_FIELD_DEFS.map((d) => [d.key, d]))
    for (const [key, col] of [
      ['utilitiesLocation', 'utilities_location'],
      ['homeSiteApproval', 'home_site_approval'],
      ['powerProduction', 'power_production'],
      ['greenCertification', 'green_certification'],
      ['landRestrictions', 'land_restrictions'],
      ['multiUnitFeatures', 'multi_unit_features'],
      ['railroadAccess', 'railroad_access'],
      ['soilType', 'soil_type'],
      ['acreageFeatures', 'acreage_features'],
      ['irrigationDistribution', 'irrigation_distribution'],
      ['waterRightsType', 'water_rights_type'],
    ] as const) {
      expect(byKey.get(key)?.mv, `multi '${key}' not wired`).toBe(col)
      expect(byKey.get(key)?.singleColumnIn, `'${key}' must overlap, not IN`).toBeUndefined()
    }
  })

  it('new keys ride SEARCH_FEATURE_FILTER_KEYS so action routers forward them', () => {
    for (const key of [
      'attachedGarage', 'rented', 'potentialTaxLiability', 'specialAssessment',
      'highSpeedInternet', 'manufacturedAllowed', 'buildingPermitIssued', 'secondResidence',
      'pricePerAcreMin', 'pricePerAcreMax', 'unitsTotalMin', 'unitsTotalMax',
      'currentRentMin', 'currentRentMax', 'estCompletionYearMin', 'estCompletionYearMax',
      'utilitiesLocation', 'homeSiteApproval', 'powerProduction', 'greenCertification',
      'landRestrictions', 'multiUnitFeatures', 'railroadAccess', 'soilType',
      'acreageFeatures', 'irrigationDistribution', 'waterRightsType',
    ]) {
      expect(SEARCH_FEATURE_FILTER_KEYS, `'${key}' missing from feature-filter keys`).toContain(key)
    }
  })
})
