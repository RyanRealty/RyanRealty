import { describe, it, expect } from 'vitest'
import { flattenCustomFields, extractPrivateDetails } from './listing-customfields'

describe('confidential CF group redaction (census finding, 2026-07-31)', () => {
  const payload = [{ Main: [
    { 'Showing Requirements': [
      { 'Appointment Only': true }, { 'Combination Lock Box': true },
      { 'To Be Built': true },
    ] },
    { 'Current Use': [ { Vacant: true } ] },
  ] }]

  it('drops confidential group members from the public flatten', () => {
    const pub = flattenCustomFields(payload)
    expect(pub['Appointment Only']).toBeUndefined()
    expect(pub['Combination Lock Box']).toBeUndefined()
  })

  it('keeps mis-homed construction status public', () => {
    expect(flattenCustomFields(payload)['To Be Built']).toBe(true)
  })

  it('keeps a colliding label public when it comes from a public group', () => {
    // 'Vacant' is confidential as occupancy but is a real public Current Use
    // value for land — redacting by bare label would have destroyed it.
    expect(flattenCustomFields(payload)['Vacant']).toBe(true)
  })

  it('diverts confidential members into the private extract', () => {
    const priv = extractPrivateDetails({}, payload)
    expect(priv?.['Appointment Only']).toBe(true)
    expect(priv?.['Combination Lock Box']).toBe(true)
    expect(priv?.['To Be Built']).toBeUndefined()
    expect(priv?.['Vacant']).toBeUndefined()
  })
})
