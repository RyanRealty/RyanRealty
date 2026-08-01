import { describe, it, expect } from 'vitest'
import {
  flattenCustomFields,
  extractPrivateDetails,
  redactPublicDetails,
  CONFIDENTIAL_CF_MEMBER_KEYS,
  PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS,
} from './listing-customfields'

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

describe('cross-group label collision (anon-key leak, ListNumber 220226199, 2026-07-31)', () => {
  // The exact live shape that leaked: 'Call Listing Agent' arrives TWICE, once
  // from the confidential group and once from a lease group that is not
  // confidential. Group-scoped redaction alone let the second copy through
  // into the anon-readable details.
  const payload = [{ Main: [
    { 'Showing Requirements': [
      { 'Call Listing Agent': true }, { 'Text Listing Agent': true },
    ] },
    { 'Existing Lease Type': [ { 'Call Listing Agent': true } ] },
  ] }]

  it('never lets a confidential member label reach the public flatten, whatever group carried it', () => {
    const pub = flattenCustomFields(payload)
    expect(pub['Call Listing Agent']).toBeUndefined()
    expect(pub['Text Listing Agent']).toBeUndefined()
  })

  it('still diverts the confidential copy to the private extract', () => {
    const priv = extractPrivateDetails({}, payload)
    expect(priv?.['Call Listing Agent']).toBe(true)
    expect(priv?.['Text Listing Agent']).toBe(true)
  })

  it('redactPublicDetails strips member labels by key, so a stale stored details cannot survive a re-merge', () => {
    const out = redactPublicDetails({
      'Call Listing Agent': true,
      'CF Call Listing Agent': true,
      Vacant: true,
      'To Be Built': true,
      PublicRemarks: 'keep me',
    })
    expect(out['Call Listing Agent']).toBeUndefined()
    expect(out['CF Call Listing Agent']).toBeUndefined()
    expect(out.Vacant).toBe(true)
    expect(out['To Be Built']).toBe(true)
    expect(out.PublicRemarks).toBe('keep me')
  })

  it('the deliberate publics are disjoint from the unconditional member list', () => {
    // If these ever overlap, one rule silently cancels the other.
    for (const k of PUBLIC_MEMBERS_IN_CONFIDENTIAL_GROUPS) {
      expect(CONFIDENTIAL_CF_MEMBER_KEYS as readonly string[]).not.toContain(k)
    }
    expect(CONFIDENTIAL_CF_MEMBER_KEYS as readonly string[]).not.toContain('Vacant')
  })
})
