import { describe, it, expect } from 'vitest'
import {
  moveInList,
  parseOptions,
  serializeOptions,
  capitalizeNoun,
} from './config-editor-helpers'

describe('moveInList', () => {
  it('moves a middle row up', () => {
    expect(moveInList([1, 2, 3], 2, -1)).toEqual([2, 1, 3])
  })

  it('moves a middle row down', () => {
    expect(moveInList([1, 2, 3], 2, 1)).toEqual([1, 3, 2])
  })

  it('returns null at the top edge moving up', () => {
    expect(moveInList([1, 2, 3], 1, -1)).toBeNull()
  })

  it('returns null at the bottom edge moving down', () => {
    expect(moveInList([1, 2, 3], 3, 1)).toBeNull()
  })

  it('returns null for an absent id', () => {
    expect(moveInList([1, 2, 3], 99, -1)).toBeNull()
  })

  it('does not mutate the input array', () => {
    const ids = [1, 2, 3]
    moveInList(ids, 2, -1)
    expect(ids).toEqual([1, 2, 3])
  })
})

describe('parseOptions', () => {
  it('parses a plain value (label defaults to value)', () => {
    expect(parseOptions('buyer')).toEqual([{ value: 'buyer', label: 'buyer' }])
  })

  it('parses value|Label pairs', () => {
    expect(parseOptions('buyer|Buyer\nseller|Seller')).toEqual([
      { value: 'buyer', label: 'Buyer' },
      { value: 'seller', label: 'Seller' },
    ])
  })

  it('drops blank lines and value-less lines', () => {
    expect(parseOptions('buyer|Buyer\n\n|Orphan\nseller')).toEqual([
      { value: 'buyer', label: 'Buyer' },
      { value: 'seller', label: 'seller' },
    ])
  })

  it('keeps a pipe in the label when there are extra pipes', () => {
    expect(parseOptions('a|Foo|Bar')).toEqual([{ value: 'a', label: 'Foo|Bar' }])
  })

  it('returns an empty list for empty input', () => {
    expect(parseOptions('')).toEqual([])
    expect(parseOptions('   \n  ')).toEqual([])
  })
})

describe('serializeOptions', () => {
  it('writes just the value when the label matches', () => {
    expect(serializeOptions([{ value: 'buyer', label: 'buyer' }])).toBe('buyer')
  })

  it('writes value|Label when they differ', () => {
    expect(serializeOptions([{ value: 'buyer', label: 'Buyer' }])).toBe('buyer|Buyer')
  })

  it('round-trips with parseOptions', () => {
    const options = [
      { value: 'buyer', label: 'Buyer' },
      { value: 'seller', label: 'seller' },
    ]
    expect(parseOptions(serializeOptions(options))).toEqual(options)
  })
})

describe('capitalizeNoun', () => {
  it('capitalizes the first letter', () => {
    expect(capitalizeNoun('stage')).toBe('Stage')
    expect(capitalizeNoun('area')).toBe('Area')
  })

  it('handles an empty string', () => {
    expect(capitalizeNoun('')).toBe('')
  })

  it('leaves an already-capitalized word', () => {
    expect(capitalizeNoun('Tag')).toBe('Tag')
  })
})
