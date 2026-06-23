import { describe, it, expect } from 'vitest'
import {
  addressMatches,
  normalizeStreetName,
  normalizeStreetNumber,
  parseStreetAddress,
  splitStreetName,
} from './addressMatch'

describe('normalizeStreetNumber', () => {
  it('trims and lowercases the civic number', () => {
    expect(normalizeStreetNumber('  123 ')).toBe('123')
  })
  it('drops a unit / fraction tail', () => {
    expect(normalizeStreetNumber('123 1/2')).toBe('123')
    expect(normalizeStreetNumber('123 B')).toBe('123')
  })
  it('returns empty for nullish / blank', () => {
    expect(normalizeStreetNumber(null)).toBe('')
    expect(normalizeStreetNumber(undefined)).toBe('')
    expect(normalizeStreetNumber('   ')).toBe('')
  })
})

describe('normalizeStreetName', () => {
  it('folds Street and St to the same core', () => {
    expect(normalizeStreetName('Bond Street')).toBe('bond st')
    expect(normalizeStreetName('Bond St')).toBe('bond st')
  })
  it('strips a leading directional', () => {
    expect(normalizeStreetName('NW Bond St')).toBe('bond st')
    expect(normalizeStreetName('Northwest Bond Street')).toBe('bond st')
  })
  it('strips a trailing directional after the suffix', () => {
    expect(normalizeStreetName('Bond St NW')).toBe('bond st')
  })
  it('keeps a suffix-less name as-is', () => {
    expect(normalizeStreetName('Bond')).toBe('bond')
  })
  it('does not collapse different suffixes', () => {
    expect(normalizeStreetName('Bond Ave')).not.toBe(normalizeStreetName('Bond St'))
  })
  it('returns empty for nullish / blank', () => {
    expect(normalizeStreetName(null)).toBe('')
    expect(normalizeStreetName(undefined)).toBe('')
    expect(normalizeStreetName('  ')).toBe('')
  })
})

describe('splitStreetName', () => {
  it('separates base from a canonical suffix', () => {
    expect(splitStreetName('NW Bond St')).toEqual({ base: 'bond', suffix: 'st' })
    expect(splitStreetName('Bond Street')).toEqual({ base: 'bond', suffix: 'st' })
  })
  it('leaves suffix empty when the name has none', () => {
    expect(splitStreetName('Bond')).toEqual({ base: 'bond', suffix: '' })
  })
  it('keeps a multi-word base intact', () => {
    expect(splitStreetName('Mount Washington Dr')).toEqual({ base: 'mount washington', suffix: 'dr' })
  })
  it('returns empty parts for nullish / blank', () => {
    expect(splitStreetName(null)).toEqual({ base: '', suffix: '' })
    expect(splitStreetName('  ')).toEqual({ base: '', suffix: '' })
  })
})

describe('parseStreetAddress', () => {
  it('splits a single-line address into number + name', () => {
    expect(parseStreetAddress('123 NW Bond St, Bend, OR 97703')).toEqual({
      streetNumber: '123',
      streetName: 'nw bond st',
    })
  })
  it('discards everything after the first comma', () => {
    expect(parseStreetAddress('456 Galveston Ave, Bend OR')).toEqual({
      streetNumber: '456',
      streetName: 'galveston ave',
    })
  })
  it('returns null parts for nullish / blank', () => {
    expect(parseStreetAddress(null)).toEqual({ streetNumber: null, streetName: null })
    expect(parseStreetAddress('')).toEqual({ streetNumber: null, streetName: null })
  })
  it('handles a name with no leading number', () => {
    expect(parseStreetAddress('Bond Street')).toEqual({ streetNumber: null, streetName: 'bond street' })
  })
})

describe('addressMatches', () => {
  it('matches an exact street address', () => {
    expect(
      addressMatches(
        { streetNumber: '123', streetName: 'Bond St' },
        { streetNumber: '123', streetName: 'Bond St' },
      ),
    ).toBe(true)
  })

  it('matches across suffix + directional variance (123 NW Bond St vs 123 Bond Street)', () => {
    expect(
      addressMatches(
        { streetNumber: '123', streetName: 'NW Bond St' },
        { streetNumber: '123', streetName: 'Bond Street' },
      ),
    ).toBe(true)
  })

  it('matches the owner freeform string against the structured MLS row', () => {
    const owner = parseStreetAddress('123 NW Bond St, Bend, OR')
    expect(addressMatches(owner, { streetNumber: '123', streetName: 'Bond' })).toBe(true)
  })

  it('matches when the MLS row omits the suffix the owner has', () => {
    expect(
      addressMatches(
        { streetNumber: '60870', streetName: 'NW Skyline Ranch Rd' },
        { streetNumber: '60870', streetName: 'Skyline Ranch' },
      ),
    ).toBe(true)
  })

  it('does NOT match a different street number (neighbor next door)', () => {
    expect(
      addressMatches(
        { streetNumber: '125', streetName: 'NW Bond St' },
        { streetNumber: '123', streetName: 'Bond Street' },
      ),
    ).toBe(false)
  })

  it('does NOT match a different street name', () => {
    expect(
      addressMatches(
        { streetNumber: '123', streetName: 'Galveston Ave' },
        { streetNumber: '123', streetName: 'Bond St' },
      ),
    ).toBe(false)
  })

  it('does NOT match when the same name carries a different suffix', () => {
    expect(
      addressMatches(
        { streetNumber: '123', streetName: 'Bond Ave' },
        { streetNumber: '123', streetName: 'Bond St' },
      ),
    ).toBe(false)
  })

  it('does NOT match when the owner street number is missing', () => {
    expect(
      addressMatches(
        { streetNumber: null, streetName: 'Bond St' },
        { streetNumber: '123', streetName: 'Bond St' },
      ),
    ).toBe(false)
  })

  it('does NOT match when the candidate street name is missing', () => {
    expect(
      addressMatches(
        { streetNumber: '123', streetName: 'Bond St' },
        { streetNumber: '123', streetName: null },
      ),
    ).toBe(false)
  })

  it('does NOT match two empty addresses', () => {
    expect(addressMatches({}, {})).toBe(false)
  })
})
