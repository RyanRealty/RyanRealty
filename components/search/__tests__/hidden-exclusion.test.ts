import { describe, it, expect } from 'vitest'
import {
  buildHiddenKeySet,
  excludeHiddenListings,
  isHiddenListing,
  normalizeHiddenKey,
} from '../hidden-exclusion'

const row = (ListingKey: string | null, ListNumber?: string | null) => ({ ListingKey, ListNumber })

describe('normalizeHiddenKey', () => {
  it('trims and string-coerces', () => {
    expect(normalizeHiddenKey('  20240719201753132176000000 ')).toBe('20240719201753132176000000')
    expect(normalizeHiddenKey(null)).toBe('')
    expect(normalizeHiddenKey(undefined)).toBe('')
  })
})

describe('buildHiddenKeySet', () => {
  it('drops empties and nulls, keeps trimmed keys', () => {
    const set = buildHiddenKeySet(['a ', '', null, undefined, ' b'])
    expect(set).toEqual(new Set(['a', 'b']))
  })
})

describe('isHiddenListing', () => {
  const hidden = buildHiddenKeySet(['CANON-1', '220189422'])

  it('matches by canonical ListingKey', () => {
    expect(isHiddenListing(row('CANON-1', '999'), hidden)).toBe(true)
  })

  it('matches by MLS ListNumber when the stored key equals it', () => {
    expect(isHiddenListing(row('OTHER-KEY', '220189422'), hidden)).toBe(true)
  })

  it('does not match unrelated listings', () => {
    expect(isHiddenListing(row('OTHER-KEY', '111'), hidden)).toBe(false)
  })

  it('never hides a row with no identifiers', () => {
    expect(isHiddenListing(row(null, null), hidden)).toBe(false)
    expect(isHiddenListing(row('', ''), hidden)).toBe(false)
  })

  it('empty hidden set hides nothing', () => {
    expect(isHiddenListing(row('CANON-1'), new Set())).toBe(false)
  })
})

describe('excludeHiddenListings', () => {
  const rows = [row('A', '1'), row('B', '2'), row('C', null), row(null, '4')]

  it('removes rows matching under either identifier', () => {
    const out = excludeHiddenListings(rows, buildHiddenKeySet(['B', '4']))
    expect(out.map((r) => r.ListingKey)).toEqual(['A', 'C'])
  })

  it('returns the SAME array reference when nothing matches (stable for React state)', () => {
    expect(excludeHiddenListings(rows, buildHiddenKeySet(['nope']))).toBe(rows)
    expect(excludeHiddenListings(rows, new Set())).toBe(rows)
  })

  it('alert-engine shape: a hidden home is gone before any seen-set diff', () => {
    // Simulates runListingAlerts: matched set minus hidden, THEN the diff.
    const matched = [row('NEW-1', '100'), row('HIDDEN-1', '101'), row('NEW-2', '102')]
    const hidden = buildHiddenKeySet(['HIDDEN-1'])
    const visible = excludeHiddenListings(matched, hidden)
    const seen = new Set<string>(['NEW-1'])
    const fresh = visible.filter((l) => {
      const key = normalizeHiddenKey(l.ListingKey ?? l.ListNumber)
      return !key || !seen.has(key)
    })
    expect(fresh.map((r) => r.ListingKey)).toEqual(['NEW-2'])
  })
})
