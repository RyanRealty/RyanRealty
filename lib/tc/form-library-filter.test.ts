import { describe, expect, it } from 'vitest'
import {
  filterLibraryRows,
  libraryRank,
  matchesFormSearch,
  matchesLibraryFilter,
  parseLibraryFilter,
  sortLibraryCodes,
} from './form-library-filter'

const CODES = ['OREF', 'ODS', 'OR', 'RR'] as const

describe('parseLibraryFilter', () => {
  it('treats empty and All as every library', () => {
    expect(parseLibraryFilter(undefined, CODES)).toBe('all')
    expect(parseLibraryFilter('', CODES)).toBe('all')
    expect(parseLibraryFilter('all', CODES)).toBe('all')
  })
  it('accepts a known library code case-insensitively', () => {
    expect(parseLibraryFilter('ods', CODES)).toBe('ODS')
    expect(parseLibraryFilter('OREF', CODES)).toBe('OREF')
  })
  it('does not invent a library from an unknown code', () => {
    expect(parseLibraryFilter('RMLS', CODES)).toBe('all')
  })
})

describe('sortLibraryCodes', () => {
  it('puts OREF, Oregon Realtors, then ODS first so a new market sorts after', () => {
    expect(sortLibraryCodes(['ZZ', 'ODS', 'OR', 'OREF'])).toEqual(['OREF', 'OR', 'ODS', 'ZZ'])
    expect(libraryRank('OREF')).toBeLessThan(libraryRank('ODS'))
  })
})

describe('filterLibraryRows', () => {
  const rows = [
    { libraryCode: 'OREF', formNumber: '001', name: 'Sale Agreement' },
    { libraryCode: 'ODS', formNumber: null, name: 'ORE Residential Input - ODS' },
    { libraryCode: 'ODS', formNumber: null, name: 'Change Form for Status' },
    { libraryCode: 'OR', formNumber: '1.1', name: 'Purchase And Sale Agreement' },
  ]

  it('keeps every library until a filter is chosen', () => {
    expect(filterLibraryRows(rows, 'all')).toHaveLength(4)
  })
  it('scopes search to one library the way SkySlope All libraries vs ODS does', () => {
    expect(filterLibraryRows(rows, 'ODS').map((r) => r.name)).toEqual([
      'ORE Residential Input - ODS',
      'Change Form for Status',
    ])
    expect(filterLibraryRows(rows, 'ODS', 'change')).toHaveLength(1)
    expect(filterLibraryRows(rows, 'OREF', 'change')).toHaveLength(0)
  })
  it('matches a form number or library code in the search haystack', () => {
    expect(matchesFormSearch(rows[0]!, '001')).toBe(true)
    expect(matchesLibraryFilter('ods', 'ODS')).toBe(true)
  })
})
