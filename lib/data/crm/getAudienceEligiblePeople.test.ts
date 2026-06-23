import { describe, it, expect } from 'vitest'
import {
  isAudienceExcludedByTag,
  AUDIENCE_EXCLUDED_TAG_PATTERNS,
} from './getAudienceEligiblePeople'

describe('isAudienceExcludedByTag — realtor/agent targeting exclusion', () => {
  it('excludes the real-world realtor tag variants', () => {
    expect(isAudienceExcludedByTag(['industry:realtor'])).toBe(true)
    expect(isAudienceExcludedByTag(['Realtor'])).toBe(true)
    expect(isAudienceExcludedByTag(['realtor'])).toBe(true)
    // mixed with other tags still hits.
    expect(isAudienceExcludedByTag(['city:bend', 'owner:occupied', 'industry:realtor'])).toBe(true)
  })

  it('does NOT exclude ordinary homeowner/seller tags', () => {
    expect(isAudienceExcludedByTag(['city:bend', 'owner:occupied', 'audience:seller'])).toBe(false)
    expect(isAudienceExcludedByTag(['equity:high', 'tenure:long-term', 'SOI'])).toBe(false)
    expect(isAudienceExcludedByTag(['neighborhood:northwest-crossing'])).toBe(false)
  })

  it('is total on junk input (never throws)', () => {
    expect(isAudienceExcludedByTag(null)).toBe(false)
    expect(isAudienceExcludedByTag(undefined)).toBe(false)
    expect(isAudienceExcludedByTag('industry:realtor')).toBe(false) // a string, not an array
    expect(isAudienceExcludedByTag([])).toBe(false)
    expect(isAudienceExcludedByTag([42, null, { tag: 'realtor' }])).toBe(false) // non-string elements ignored
  })

  it('is case-insensitive', () => {
    expect(isAudienceExcludedByTag(['INDUSTRY:REALTOR'])).toBe(true)
    expect(isAudienceExcludedByTag(['ReAlToR'])).toBe(true)
  })

  it('ships with at least the realtor pattern', () => {
    expect(AUDIENCE_EXCLUDED_TAG_PATTERNS.some((re) => re.test('realtor'))).toBe(true)
  })
})
