import { describe, it, expect } from 'vitest'
import { pageLabel } from './CmaOutcomeCell'

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
