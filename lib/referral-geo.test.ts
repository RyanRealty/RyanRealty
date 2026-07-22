import { describe, it, expect } from 'vitest'
import {
  classifyPropertyGeo,
  cityFromListingAddress,
  referralIntakeTags,
  geoReferralEnrollBlock,
  REFERRAL_CANDIDATE_TAG,
  GEO_OUT_OF_AREA_TAG,
  GEO_OUT_OF_STATE_TAG,
  GEO_UNCLASSIFIED_TAG,
} from './referral-geo'

describe('classifyPropertyGeo', () => {
  it('classifies service-area cities as local', () => {
    expect(classifyPropertyGeo('Bend')).toBe('local')
    expect(classifyPropertyGeo('La Pine', 'OR')).toBe('local')
    expect(classifyPropertyGeo('  sisters  ')).toBe('local')
  })
  it('classifies Oregon cities outside the service area as out-of-area', () => {
    expect(classifyPropertyGeo('Medford')).toBe('out-of-area')
    expect(classifyPropertyGeo('Klamath Falls', 'OR')).toBe('out-of-area')
    expect(classifyPropertyGeo('Grants Pass', 'oregon')).toBe('out-of-area')
  })
  it('classifies non-OR states as out-of-state regardless of city', () => {
    expect(classifyPropertyGeo('Vancouver', 'WA')).toBe('out-of-state')
    expect(classifyPropertyGeo('Bend', 'CA')).toBe('out-of-state')
  })
  it('returns unknown on missing city (classification uncertainty)', () => {
    expect(classifyPropertyGeo(null)).toBe('unknown')
    expect(classifyPropertyGeo('')).toBe('unknown')
    expect(classifyPropertyGeo('   ', 'OR')).toBe('unknown')
  })
})

describe('cityFromListingAddress', () => {
  it('parses the standard "street, city, ST zip" shape', () => {
    expect(cityFromListingAddress('123 Main St, Medford, OR 97504')).toEqual({ city: 'Medford', state: 'OR' })
    expect(cityFromListingAddress('61535 SW Lodgepole Dr, Bend, OR 97702')).toEqual({ city: 'Bend', state: 'OR' })
    expect(cityFromListingAddress('10 Elm, Klamath Falls, OR')).toEqual({ city: 'Klamath Falls', state: 'OR' })
  })
  it('fails toward null on anything ambiguous', () => {
    expect(cityFromListingAddress('123 Main St')).toEqual({ city: null, state: null })
    expect(cityFromListingAddress('123 Main St, Bend')).toEqual({ city: null, state: null })
    expect(cityFromListingAddress('')).toEqual({ city: null, state: null })
    expect(cityFromListingAddress(null)).toEqual({ city: null, state: null })
    // Trailing segment that is not a clean state block
    expect(cityFromListingAddress('Lot 4, Phase 2, Somewhere weird')).toEqual({ city: null, state: null })
  })
})

describe('referralIntakeTags', () => {
  it('local: no tags — standard buyer path untouched', () => {
    expect(referralIntakeTags('local', 'Bend')).toEqual([])
  })
  it('out-of-area: enroll-blocking tag + referral candidate + city interest', () => {
    expect(referralIntakeTags('out-of-area', 'Klamath Falls')).toEqual([
      GEO_OUT_OF_AREA_TAG,
      REFERRAL_CANDIDATE_TAG,
      'city-interest:klamath-falls',
    ])
  })
  it('out-of-state: tagged for referral too', () => {
    expect(referralIntakeTags('out-of-state', 'Vancouver')).toEqual([
      GEO_OUT_OF_STATE_TAG,
      REFERRAL_CANDIDATE_TAG,
      'city-interest:vancouver',
    ])
  })
  it('unknown: only the unclassified marker (fail-closed, human reviews)', () => {
    expect(referralIntakeTags('unknown')).toEqual([GEO_UNCLASSIFIED_TAG])
  })
  it('omits city-interest when city is absent', () => {
    expect(referralIntakeTags('out-of-area', null)).toEqual([GEO_OUT_OF_AREA_TAG, REFERRAL_CANDIDATE_TAG])
  })
})

describe('geoReferralEnrollBlock', () => {
  it('blocks referral candidates from the standard drip', () => {
    expect(geoReferralEnrollBlock([GEO_OUT_OF_AREA_TAG, REFERRAL_CANDIDATE_TAG, 'audience:buyer'])).toMatch(/referral/)
    expect(geoReferralEnrollBlock(['Referral:Candidate'])).toMatch(/referral/)
  })
  it('blocks unclassified property inquiries (fail-closed)', () => {
    expect(geoReferralEnrollBlock([GEO_UNCLASSIFIED_TAG, 'audience:buyer'])).toMatch(/unclassified/)
  })
  it('does NOT block on the bare geo:out-of-area tag (legacy seller-LP geocode tag)', () => {
    // lib/lead-geocode.ts has stamped geo:out-of-area on seller leads since
    // before the referral tier; gating on the bare tag would change the live
    // seller funnel. Only the referral tier's own routing tag gates.
    expect(geoReferralEnrollBlock([GEO_OUT_OF_AREA_TAG, 'audience:seller'])).toBeNull()
  })
  it('passes ordinary leads through', () => {
    expect(geoReferralEnrollBlock(['audience:buyer', 'source:buyer-lp'])).toBeNull()
    expect(geoReferralEnrollBlock([])).toBeNull()
    expect(geoReferralEnrollBlock(null)).toBeNull()
    expect(geoReferralEnrollBlock(undefined)).toBeNull()
  })
})
