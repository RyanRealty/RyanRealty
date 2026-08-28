import { describe, expect, it } from 'vitest'
import {
  fieldPropertyType,
  fieldPropertyTypeCat,
  filterFieldItems,
  presentFieldTypes,
} from './field-property-type'

describe('fieldPropertyType', () => {
  it('names the buyer-facing types from MLS subtype', () => {
    expect(fieldPropertyType({ propertySubType: 'Single Family Residence' })).toEqual({
      key: 'single-family',
      label: 'Single-family',
    })
    expect(fieldPropertyType({ propertySubType: 'Condominium' })).toEqual({
      key: 'condo',
      label: 'Condo',
    })
    expect(fieldPropertyType({ propertySubType: 'Townhouse' })).toEqual({
      key: 'townhouse',
      label: 'Townhouse',
    })
    expect(fieldPropertyType({ propertySubType: 'Manufactured On Land' })).toEqual({
      key: 'manufactured',
      label: 'Manufactured',
    })
    expect(fieldPropertyType({ propertySubType: 'In Park' })).toEqual({
      key: 'manufactured',
      label: 'Manufactured',
    })
    expect(fieldPropertyType({ propertySubType: 'Residential Lots' })).toEqual({
      key: 'land',
      label: 'Land',
    })
    expect(fieldPropertyType({ propertySubType: 'Duplex' })).toEqual({
      key: 'multi-family',
      label: 'Multi-family',
    })
  })

  it('falls back to the MLS class code when subtype is absent', () => {
    expect(fieldPropertyType({ propertyType: 'A' })?.key).toBe('single-family')
    expect(fieldPropertyType({ propertyType: 'B' })?.key).toBe('manufactured')
    expect(fieldPropertyType({ propertyType: 'C' })?.key).toBe('multi-family')
    expect(fieldPropertyType({ propertyType: 'Land' })?.key).toBe('land')
    expect(fieldPropertyType({ propertyType: 'Commercial' })?.key).toBe('commercial')
  })

  it('returns null when the feed named no type', () => {
    expect(fieldPropertyType({})).toBeNull()
    expect(fieldPropertyType({ propertyType: '', propertySubType: '' })).toBeNull()
  })
})

describe('presentFieldTypes', () => {
  it('keeps only types that exist in this set, in canonical order', () => {
    expect(
      presentFieldTypes([
        { typeKey: 'land', typeLabel: 'Land' },
        { typeKey: 'condo', typeLabel: 'Condo' },
        { typeKey: 'condo', typeLabel: 'Condo' },
        { typeKey: 'single-family', typeLabel: 'Single-family' },
      ]).map((t) => t.key),
    ).toEqual(['single-family', 'condo', 'land'])
  })

  it('omits a type that is absent — no empty Condo chip', () => {
    const keys = presentFieldTypes([
      { typeKey: 'single-family' },
      { typeKey: 'land' },
    ]).map((t) => t.key)
    expect(keys).toEqual(['single-family', 'land'])
    expect(keys).not.toContain('condo')
  })
})

describe('fieldPropertyTypeCat', () => {
  it('assigns --v3-cat-0..4 by present order', () => {
    const present = presentFieldTypes([
      { typeKey: 'single-family' },
      { typeKey: 'condo' },
      { typeKey: 'land' },
    ])
    expect(fieldPropertyTypeCat('single-family', present)).toBe(0)
    expect(fieldPropertyTypeCat('condo', present)).toBe(1)
    expect(fieldPropertyTypeCat('land', present)).toBe(2)
  })
})

describe('filterFieldItems', () => {
  const items = [
    { id: 'a', typeKey: 'single-family' },
    { id: 'b', typeKey: 'condo' },
    { id: 'c', typeKey: 'land' },
  ]

  it('returns the whole set when nothing is selected', () => {
    expect(filterFieldItems(items, []).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('narrows to the selected types', () => {
    expect(filterFieldItems(items, ['condo', 'land']).map((i) => i.id)).toEqual(['b', 'c'])
  })
})
