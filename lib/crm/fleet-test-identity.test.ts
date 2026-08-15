import { describe, it, expect } from 'vitest'
import {
  FLEET_TEST_TAG,
  hasFleetTestTag,
  isFleetTestEmail,
  isFleetTestIdentity,
  isFleetTestPhone,
} from './fleet-test-identity'

describe('fleet test identity (bots submit as humans, safely)', () => {
  it('recognizes the designated email marker in any local part', () => {
    expect(isFleetTestEmail('fleet-test+flow@ryan-realty.com')).toBe(true)
    expect(isFleetTestEmail('FLEET-TEST+alerts@gmail.com')).toBe(true)
    expect(isFleetTestEmail('matt@ryan-realty.com')).toBe(false)
    // Marker in the DOMAIN must not match — only the local part marks identity.
    expect(isFleetTestEmail('buyer@fleet-test.com')).toBe(false)
  })

  it('recognizes the designated phone by last-10, any formatting', () => {
    expect(isFleetTestPhone('+1 (500) 555-0106')).toBe(true)
    expect(isFleetTestPhone('5005550106')).toBe(true)
    expect(isFleetTestPhone('541-213-6706')).toBe(false)
  })

  it('identity matches on either key', () => {
    expect(isFleetTestIdentity({ email: 'fleet-test@x.com', phone: null })).toBe(true)
    expect(isFleetTestIdentity({ email: null, phone: '5005550106' })).toBe(true)
    expect(isFleetTestIdentity({ email: 'a@b.com', phone: '1234567890' })).toBe(false)
  })

  it('tag helper reads crm_people.tags arrays', () => {
    expect(hasFleetTestTag([FLEET_TEST_TAG, 'source:newsletter'])).toBe(true)
    expect(hasFleetTestTag(['source:newsletter'])).toBe(false)
    expect(hasFleetTestTag(null)).toBe(false)
  })
})
