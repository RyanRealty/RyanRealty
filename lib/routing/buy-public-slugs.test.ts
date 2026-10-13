import { describe, expect, it } from 'vitest'
import { BUY_INTENT_PAGES } from '@/lib/lead-landing-content'
import {
  BUY_INTENT_SLUGS,
  BUY_PUBLIC_SLUGS,
  buyPublicSlugFromPath,
  isKnownBuyPublicSlug,
  isUnknownBuyPublicPath,
} from './buy-public-slugs'

describe('buy public slugs', () => {
  it('lets the live buyer pages through and 404s unknown one-segment paths', () => {
    expect([...BUY_PUBLIC_SLUGS]).toEqual([
      'first-time-home-buyer',
      'relocation',
      'investment',
      'leverage',
    ])
    expect(isUnknownBuyPublicPath('/buy')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/leverage')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/first-time-home-buyer')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/relocation')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/investment')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/first-time')).toBe(true)
    expect(isUnknownBuyPublicPath('/buy/alerts')).toBe(true)
    expect(isUnknownBuyPublicPath('/homes-for-sale')).toBe(false)
  })

  it('keeps BUY_INTENT_SLUGS in lockstep with BUY_INTENT_PAGES', () => {
    expect([...BUY_INTENT_SLUGS].sort()).toEqual(Object.keys(BUY_INTENT_PAGES).sort())
  })

  it('decodes the slug and ignores nested paths', () => {
    expect(buyPublicSlugFromPath('/buy/First-Time')).toBe('first-time')
    expect(buyPublicSlugFromPath('/buy/leverage/extra')).toBeNull()
    expect(isKnownBuyPublicSlug('leverage')).toBe(true)
    expect(isKnownBuyPublicSlug('alerts')).toBe(false)
  })
})
