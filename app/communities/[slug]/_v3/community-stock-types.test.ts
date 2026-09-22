import { describe, expect, it } from 'vitest'
import { placeBuyerGroup } from '@/lib/place/place-type-style'
import {
  communityFieldTypeIndex,
  communityStockMixSentence,
  communityStockTypesFromListings,
} from './community-stock-types'

describe('community Field type sections', () => {
  it('maps MLS land to lots and cabin sub-type to cabins', () => {
    expect(placeBuyerGroup('A', 'Single Family Residence')).toBe('homes')
    expect(placeBuyerGroup('D', 'Residential Lots')).toBe('lots')
    expect(placeBuyerGroup('A', 'Cabin')).toBe('cabins')
    expect(placeBuyerGroup('A', 'Townhouse')).toBe('attached')
    expect(communityStockTypesFromListings([
      { propertyType: 'A', propertySubType: 'Single Family Residence' },
      { propertyType: 'D', propertySubType: 'Residential Lots' },
    ])).toEqual(['homes', 'lots'])
  })

  it('indexes lots when those rows exist and omits cabins when they do not', () => {
    const index = communityFieldTypeIndex([
      { propertyType: 'A', propertySubType: 'Single Family Residence' },
      { propertyType: 'A', propertySubType: 'Single Family Residence' },
      { propertyType: 'D', propertySubType: 'Residential Lots' },
    ])
    expect(index.map((row) => row.key)).toEqual(['homes', 'lots'])
    expect(index.find((row) => row.key === 'lots')?.heading).toBe('Lots')
    expect(index.find((row) => row.key === 'lots')?.countLabel).toBe('1 for sale')
    expect(index.find((row) => row.key === 'cabins')).toBeUndefined()
  })

  it('mix sentence names only present types', () => {
    expect(communityStockMixSentence(['homes', 'lots'])).toBe('Homes and lots for sale.')
    expect(communityStockMixSentence(['homes', 'cabins', 'lots'])).toBe(
      'Homes, cabins, and lots for sale.',
    )
    expect(communityStockMixSentence([])).toBeNull()
  })
})
