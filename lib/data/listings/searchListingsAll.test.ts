import { describe, it, expect } from 'vitest'
import { SEARCH_FIELDS, urlParamsForField, coerceRegistryParams } from '@/lib/search/field-registry'
import { SearchListingsAllFilterSchema, SEARCH_FEATURE_FILTER_KEYS } from './searchListingsAll'
import {
  BOOLEAN_PREDICATES,
  MULTI_FIELD_DEFS,
  TEXT_FIELD_COLUMNS,
  RANGE_FIELD_COLUMNS,
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
