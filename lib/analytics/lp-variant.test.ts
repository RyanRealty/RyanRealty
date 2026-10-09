import { describe, expect, it } from 'vitest'
import { lpPathForVariant, lpVariantFromPath } from './lp-variant'

describe('lpVariantFromPath', () => {
  it('reads the live landing pages the /lp pages 308 to (2026-09-06), under their old variant names', () => {
    expect(lpVariantFromPath('/sell')).toBe('seller-home-value')
    expect(lpVariantFromPath('https://ryan-realty.com/sell/valuation/?utm_source=facebook')).toBe('seller-home-value')
    expect(lpVariantFromPath('/sell/expired-listings')).toBe('expired-listing')
    expect(lpVariantFromPath('/sell/for-sale-by-owner#form')).toBe('fsbo')
    expect(lpVariantFromPath('/buy/first-time-home-buyer')).toBe('buy-first-time-home-buyer')
  })

  it('keeps reading history: /lp/<slug> and /home-valuation', () => {
    expect(lpVariantFromPath('https://ryan-realty.com/lp/seller-home-value/')).toBe('seller-home-value')
    expect(lpVariantFromPath('/lp/sell-your-home')).toBe('sell-your-home')
    expect(lpVariantFromPath('/home-valuation')).toBe('seller-home-value')
  })

  it('a page that is not a landing page is null', () => {
    for (const p of ['/', '/homes-for-sale', '/sellers-guide', '/sell/inherited-home-guide', '/buy', '/cities/bend', null, undefined, '']) {
      expect(lpVariantFromPath(p)).toBeNull()
    }
  })
})

describe('lpPathForVariant', () => {
  it('opens the live page, never a /lp path that 308s or 404s', () => {
    expect(lpPathForVariant('seller-home-value')).toBe('/sell')
    expect(lpPathForVariant('expired-listing')).toBe('/sell/expired-listings')
    expect(lpPathForVariant('fsbo')).toBe('/sell/for-sale-by-owner')
    expect(lpPathForVariant('buy-first-time-home-buyer')).toBe('/buy/first-time-home-buyer')
    expect(lpPathForVariant('buyer-listing-alerts')).toBe('/homes-for-sale')
  })

  it('round-trips every live landing page', () => {
    for (const path of ['/sell', '/sell/expired-listings', '/sell/for-sale-by-owner', '/buy/relocation']) {
      expect(lpPathForVariant(lpVariantFromPath(path) as string)).toBe(path)
    }
  })

  it('an unknown history slug keeps its /lp path for the redirects to resolve', () => {
    expect(lpPathForVariant('tetherow')).toBe('/lp/tetherow')
  })
})
