import { describe, expect, it } from 'vitest'
import { hasSellerIntent, extractAddressCandidate } from './seller-intent'

describe('hasSellerIntent', () => {
  it('detects the canonical litmus message', () => {
    expect(hasSellerIntent("what's my home at 123 Delaware Ave in Bend worth")).toBe(true)
  })
  it('detects common seller phrasings', () => {
    expect(hasSellerIntent('Can you tell me the value of my house?')).toBe(true)
    expect(hasSellerIntent('Looking to sell my home this spring')).toBe(true)
    expect(hasSellerIntent('Could I get a CMA for my place')).toBe(true)
    expect(hasSellerIntent('need an appraisal estimate')).toBe(true)
    expect(hasSellerIntent('What could this house list for? Home value?')).toBe(true)
  })
  it('does not fire on buyer / general messages', () => {
    expect(hasSellerIntent('Is 456 Elm St still available for showing?')).toBe(false)
    expect(hasSellerIntent('Hi, following up on the open house Sunday')).toBe(false)
    expect(hasSellerIntent(null)).toBe(false)
    expect(hasSellerIntent('')).toBe(false)
  })
})

describe('extractAddressCandidate', () => {
  it('extracts street + "in <city>" from the litmus message', () => {
    expect(extractAddressCandidate("what's my home at 123 Delaware Ave in Bend worth")).toBe(
      '123 Delaware Ave, Bend',
    )
  })
  it('extracts street + comma city', () => {
    expect(extractAddressCandidate('CMA for 61535 Fargo Ln, Bend please')).toBe(
      '61535 Fargo Ln, Bend',
    )
  })
  it('handles a two-word city and lowercase text', () => {
    expect(extractAddressCandidate('what is 456 pine st in la pine worth')).toBe(
      '456 pine st, La Pine',
    )
  })
  it('returns street-only when no city marker exists', () => {
    expect(extractAddressCandidate('value my house 789 Juniper Rd thanks')).toBe('789 Juniper Rd')
  })
  it('never captures a stop word as the city', () => {
    // "worth" directly after the street type with an "in" marker absent city
    expect(extractAddressCandidate('123 Delaware Ave, worth anything?')).toBe('123 Delaware Ave')
  })
  it('returns null when there is no street-shaped address', () => {
    expect(extractAddressCandidate('what is my home worth?')).toBeNull()
    expect(extractAddressCandidate('I paid 450000 for it')).toBeNull()
    expect(extractAddressCandidate(null)).toBeNull()
  })
})
