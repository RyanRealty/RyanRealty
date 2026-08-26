import { describe, expect, it } from 'vitest'
import { isNonProductionPageLocation } from './ga4-measurement-protocol'

describe('isNonProductionPageLocation — our own browsing is not analytics', () => {
  // Measured 2026-08-26: 43 sessions reached the production GA4 property as a
  // `127.0.0.1:8777` referral. Local development, sitting in the reports beside
  // real traffic and counted as a referral source.
  it.each([
    'http://localhost:3000/housing-market/bend',
    'http://127.0.0.1:8777/',
    'http://0.0.0.0:3000/search',
    'http://mac-mini.local:3000/',
    'https://ryanrealty-abc123.vercel.app/listings', // staging-host-ok: fixture asserting we BLOCK this host, not a link we emit
    'http://site.test/',
  ])('blocks %s', (url) => {
    expect(isNonProductionPageLocation(url)).toBe(true)
  })

  it.each([
    'https://ryan-realty.com/',
    'https://www.ryan-realty.com/housing-market/bend',
    'https://ryan-realty.com/lp/seller-home-value?utm_source=facebook',
  ])('allows %s', (url) => {
    expect(isNonProductionPageLocation(url)).toBe(false)
  })

  it('fails OPEN on anything it cannot parse — losing real analytics is worse', () => {
    expect(isNonProductionPageLocation(undefined)).toBe(false)
    expect(isNonProductionPageLocation('')).toBe(false)
    expect(isNonProductionPageLocation('not a url')).toBe(false)
    expect(isNonProductionPageLocation(42)).toBe(false)
  })

  it('does not block a production host that merely CONTAINS a dev word', () => {
    expect(isNonProductionPageLocation('https://localhost.ryan-realty.com/')).toBe(false)
    expect(isNonProductionPageLocation('https://ryan-realty.com/localhost')).toBe(false)
  })
})
