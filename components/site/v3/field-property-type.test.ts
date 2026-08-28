import { describe, expect, it } from 'vitest'
import {
  classifyFieldType,
  filterFieldByTypes,
  toggleFieldType,
  typesInField,
  withFieldCats,
} from './field-property-type'

describe('classifyFieldType', () => {
  it('reads the feed subtype before the letter class', () => {
    expect(
      classifyFieldType({
        propertyType: 'A',
        propertySubType: 'Condominium',
      }),
    ).toEqual({ key: 'condo', label: 'Condo' })
    expect(
      classifyFieldType({
        propertyType: 'A',
        propertySubType: 'Single Family Residence',
      }),
    ).toEqual({ key: 'house', label: 'House' })
    expect(
      classifyFieldType({
        propertyType: 'A',
        propertySubType: 'Townhouse',
      }),
    ).toEqual({ key: 'townhouse', label: 'Townhouse' })
  })

  it('falls back to the MLS letter when subtype is empty', () => {
    expect(classifyFieldType({ propertyType: 'D' })).toEqual({
      key: 'land',
      label: 'Land',
    })
    expect(classifyFieldType({ propertyType: 'C' })).toEqual({
      key: 'multi',
      label: 'Multi-family',
    })
    expect(classifyFieldType({ propertyType: 'F' })).toEqual({
      key: 'commercial',
      label: 'Commercial',
    })
  })
})

describe('typesInField', () => {
  it('returns only types that exist, in Field order, with navy cats', () => {
    const chips = typesInField([
      { typeKey: 'land' },
      { typeKey: 'house' },
      { typeKey: 'house' },
      { typeKey: 'condo' },
    ])
    expect(chips.map((chip) => chip.key)).toEqual(['house', 'condo', 'land'])
    expect(chips.map((chip) => chip.cat)).toEqual([0, 1, 2])
  })

  it('ignores a key the Field does not know', () => {
    expect(typesInField([{ typeKey: 'spaceship' }])).toEqual([])
  })
})

describe('filterFieldByTypes', () => {
  const items = [
    { id: 'a', typeKey: 'house' },
    { id: 'b', typeKey: 'condo' },
    { id: 'c', typeKey: 'house' },
  ]

  it('returns the whole set when nothing is selected', () => {
    expect(filterFieldByTypes(items, [])).toEqual(items)
  })

  it('keeps only the selected types', () => {
    expect(filterFieldByTypes(items, ['condo']).map((item) => item.id)).toEqual(['b'])
    expect(filterFieldByTypes(items, ['house', 'condo'])).toEqual(items)
  })
})

describe('withFieldCats + toggleFieldType', () => {
  it('stamps the chip cat onto each item', () => {
    const stamped = withFieldCats([
      { id: 'a', typeKey: 'house' as const },
      { id: 'b', typeKey: 'condo' as const },
    ])
    expect(stamped[0]?.cat).toBe(0)
    expect(stamped[1]?.cat).toBe(1)
  })

  it('toggles a type on and off', () => {
    expect(toggleFieldType([], 'house')).toEqual(['house'])
    expect(toggleFieldType(['house'], 'house')).toEqual([])
    expect(toggleFieldType(['house'], 'condo')).toEqual(['house', 'condo'])
  })
})
