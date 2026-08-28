import { describe, expect, it } from 'vitest'
import {
  classifyHomeFieldType,
  filterHomeFieldByTypes,
  takeHomeFieldByType,
  toggleHomeFieldType,
  typesInHomeField,
  visibleHomeField,
} from './home-field-types'
import type { HomeFieldTypeKey } from './home-field-types'

function item(typeKey: HomeFieldTypeKey, id: string) {
  return { id, typeKey }
}

describe('classifyHomeFieldType', () => {
  it('maps feed subtypes the buyer can toggle', () => {
    expect(classifyHomeFieldType({ propertySubType: 'Single Family Residence' }).key).toBe(
      'house',
    )
    expect(classifyHomeFieldType({ propertySubType: 'Condominium' })).toEqual({
      key: 'condo',
      label: 'Condo',
    })
    expect(classifyHomeFieldType({ propertySubType: 'Townhouse' }).key).toBe('townhouse')
    expect(classifyHomeFieldType({ propertySubType: 'In Park' }).key).toBe('manufactured')
    expect(classifyHomeFieldType({ propertySubType: 'Duplex' }).key).toBe('multi')
    expect(classifyHomeFieldType({ propertySubType: 'Residential Lots' }).key).toBe('land')
  })

  it('falls back to the MLS class when the subtype is blank', () => {
    expect(classifyHomeFieldType({ propertyType: 'A' }).key).toBe('house')
    expect(classifyHomeFieldType({ propertyType: 'B' }).key).toBe('manufactured')
    expect(classifyHomeFieldType({ propertyType: 'C' }).key).toBe('multi')
    expect(classifyHomeFieldType({ propertyType: 'D' }).key).toBe('land')
    expect(classifyHomeFieldType({ propertyType: 'F' }).key).toBe('commercial')
  })
})

describe('homepage Field type set', () => {
  it('emits only types that exist, in canon order, with cat 0–4', () => {
    const types = typesInHomeField([
      item('land', '1'),
      item('house', '2'),
      item('house', '3'),
      item('condo', '4'),
    ])
    expect(types.map((type) => type.key)).toEqual(['house', 'condo', 'land'])
    expect(types.map((type) => type.cat)).toEqual([0, 1, 2])
  })

  it('treats an empty selection as the whole set', () => {
    const items = [item('house', '1'), item('land', '2')]
    expect(filterHomeFieldByTypes(items, []).map((row) => row.id)).toEqual(['1', '2'])
    expect(filterHomeFieldByTypes(items, ['land']).map((row) => row.id)).toEqual(['2'])
  })

  it('multi-selects and caps the visible rows', () => {
    const items = [
      item('house', 'h1'),
      item('condo', 'c1'),
      item('land', 'l1'),
      item('house', 'h2'),
    ]
    expect(visibleHomeField(items, ['house', 'land'], 2).map((row) => row.id)).toEqual([
      'h1',
      'l1',
    ])
  })

  it('round-robins types so a house-heavy feed cannot hide lots', () => {
    const items = [
      item('house', 'h1'),
      item('house', 'h2'),
      item('house', 'h3'),
      item('land', 'l1'),
      item('condo', 'c1'),
    ]
    const mixed = takeHomeFieldByType(items, 3)
    expect(mixed.map((row) => row.typeKey)).toEqual(['house', 'condo', 'land'])
    expect(mixed.map((row) => row.cat)).toEqual([0, 1, 2])
  })

  it('toggles a type on and off', () => {
    expect(toggleHomeFieldType([], 'house')).toEqual(['house'])
    expect(toggleHomeFieldType(['house', 'land'], 'house')).toEqual(['land'])
  })
})
