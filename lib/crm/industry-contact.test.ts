import { describe, expect, it } from 'vitest'
import {
  INDUSTRY_CONTACT_TAG,
  classifyIndustryReclass,
  isIndustryContact,
  withIndustryContactTag,
} from './industry-contact'

describe('isIndustryContact', () => {
  it('flags the durable industry:contact tag', () => {
    expect(isIndustryContact({ tags: [INDUSTRY_CONTACT_TAG] })).toBe(true)
  })

  it('flags existing realtor / vendor tags and exact stages', () => {
    expect(isIndustryContact({ tags: ['industry:realtor'] })).toBe(true)
    expect(isIndustryContact({ tags: ['segment:vendor'] })).toBe(true)
    expect(isIndustryContact({ tags: ['Bend realtor'] })).toBe(true)
    expect(isIndustryContact({ tags: [], stage: 'Real Estate Agent' })).toBe(true)
    expect(isIndustryContact({ tags: [], stage: 'Vendor' })).toBe(true)
  })

  it('does not flag a homeowner from a fuzzy agent word or a seller stage', () => {
    expect(isIndustryContact({ tags: ['audience:seller', 'city:bend'] })).toBe(false)
    expect(isIndustryContact({ tags: ['westside', 'owner:occupied'] })).toBe(false)
    expect(isIndustryContact({ tags: [], stage: 'Lead' })).toBe(false)
    expect(isIndustryContact({ tags: ['listing-watch'] })).toBe(false)
    expect(isIndustryContact({ tags: null, stage: null })).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isIndustryContact({ tags: ['INDUSTRY:CONTACT'] })).toBe(true)
    expect(isIndustryContact({ tags: [], stage: 'REAL ESTATE AGENT' })).toBe(true)
  })
})

describe('classifyIndustryReclass', () => {
  it('flags a clear industry identity and leaves ambiguous rows', () => {
    expect(classifyIndustryReclass({ tags: ['industry:realtor'], stage: 'Lead', source: 'import' })).toBe('flag')
    expect(classifyIndustryReclass({ tags: [], stage: null, source: 'realtor' })).toBe('flag')
    expect(classifyIndustryReclass({ tags: ['city:bend'], stage: 'Lead', source: 'import' })).toBe('ambiguous')
    expect(classifyIndustryReclass({ tags: ['agent-lead'], stage: 'Lead', source: 'inbound-sms' })).toBe('ambiguous')
  })
})

describe('withIndustryContactTag', () => {
  it('appends the durable tag once', () => {
    expect(withIndustryContactTag(['city:bend'])).toEqual(['city:bend', INDUSTRY_CONTACT_TAG])
    expect(withIndustryContactTag([INDUSTRY_CONTACT_TAG])).toEqual([INDUSTRY_CONTACT_TAG])
  })
})
