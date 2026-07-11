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
  it('every multi has an options array, empty only for laundryFeatures', () => {
    for (const field of SEARCH_FIELDS) {
      if (field.kind !== 'multi') continue
      expect(Array.isArray(field.options), `${field.key} missing options`).toBe(true)
      if (field.key !== 'laundryFeatures') {
        expect(field.options!.length, `${field.key} has empty options`).toBeGreaterThan(0)
      } else {
        expect(field.options).toEqual([])
        expect(field.coverageNote).toBeTruthy()
      }
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
    expect(keys).toEqual(['elementarySchool', 'middleSchool', 'highSchool', 'schoolDistrict'])
  })

  it('flags exactly the contract DAL-expression booleans', () => {
    const flagged = SEARCH_FIELDS.filter((f) => f.dalExpression).map((f) => f.key).sort()
    expect(flagged).toEqual(['adjoinsPublicLand', 'gatedCommunity', 'hasGolfCourse', 'rvParking', 'shop'])
  })

  it('flags exactly the contract single-column IN multis', () => {
    const flagged = SEARCH_FIELDS.filter((f) => f.singleColumnIn).map((f) => f.key).sort()
    expect(flagged).toEqual(['county', 'directionFaces', 'levelsOptions'])
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
