import { describe, it, expect } from 'vitest'
import { clickedLine, deliveredKind, pageLabel } from './CmaOutcomeCell'

/**
 * The broker reads addresses, not URLs. `pageLabel` is the whole difference
 * between "they opened 1299 Ogden" and a path they have to decode.
 */
describe('pageLabel', () => {
  it('reads a canonical listing path back as its address, MLS tail dropped', () => {
    expect(pageLabel('/homes-for-sale/bend/newport-gardens/1299-ogden-220225388')).toBe('1299 ogden')
  })

  it('names a place page by its place', () => {
    expect(pageLabel('/subdivisions/newport-gardens')).toBe('newport gardens')
    expect(pageLabel('/housing-market/bend')).toBe('bend')
  })

  it('calls the root Home rather than an empty string', () => {
    expect(pageLabel('/')).toBe('Home')
    expect(pageLabel('')).toBe('Home')
  })

  it('keeps a by-key listing segment intact when it is only an id', () => {
    expect(pageLabel('/homes-for-sale/listing/20260714190234066850000000')).toBe(
      '20260714190234066850000000',
    )
  })
})

describe('deliveredKind', () => {
  it('marks a Gmail inferred delivery separately from a Resend receipt', () => {
    expect(deliveredKind(true)).toBe('inferred')
    expect(deliveredKind(false)).toBe('receipt')
  })
})

describe('clickedLine', () => {
  it('joins classified labels the way a broker reads the row', () => {
    expect(
      clickedLine([
        { kind: 'letter', label: 'report', url: 'https://ryan-realty.com/cma/cma-x' },
        { kind: 'area', label: 'Diamond Bar Ranch', url: 'https://ryan-realty.com/subdivisions/diamond-bar-ranch' },
        { kind: 'area', label: 'Redmond', url: 'https://ryan-realty.com/cities/redmond' },
        { kind: 'reviews', label: 'reviews', url: 'https://ryan-realty.com/reviews' },
      ]),
    ).toBe('clicked: report, Diamond Bar Ranch, Redmond, reviews')
  })

  it('returns null when nothing was clicked', () => {
    expect(clickedLine([])).toBeNull()
    expect(clickedLine(undefined)).toBeNull()
  })
})
