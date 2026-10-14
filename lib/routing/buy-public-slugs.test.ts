import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUY_INTENT_PAGES } from '@/lib/lead-landing-content'
import {
  BUY_INTENT_SLUGS,
  BUY_PUBLIC_SLUGS,
  BUY_STATIC_SLUGS,
  buyPublicSlugFromPath,
  isKnownBuyPublicSlug,
  isUnknownBuyPublicPath,
} from './buy-public-slugs'

function shippedBuyStaticSlugs(): string[] {
  const root = join(process.cwd(), 'app/buy')
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('[') && !name.startsWith('_'))
    .filter((name) => existsSync(join(root, name, 'page.tsx')))
    .sort()
}

describe('buy public slugs', () => {
  it('lets the live buyer pages through and 404s unknown one-segment paths', () => {
    expect([...BUY_PUBLIC_SLUGS]).toEqual([
      'first-time-home-buyer',
      'relocation',
      'investment',
      'alerts',
      'concessions',
      'homes-under-500k-central-oregon',
      'leverage',
    ])
    expect(isUnknownBuyPublicPath('/buy')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/leverage')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/alerts')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/concessions')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/homes-under-500k-central-oregon')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/first-time-home-buyer')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/relocation')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/investment')).toBe(false)
    expect(isUnknownBuyPublicPath('/buy/first-time')).toBe(true)
    expect(isUnknownBuyPublicPath('/buy/not-a-real-page')).toBe(true)
    expect(isUnknownBuyPublicPath('/homes-for-sale')).toBe(false)
  })

  it('keeps BUY_INTENT_SLUGS in lockstep with BUY_INTENT_PAGES', () => {
    expect([...BUY_INTENT_SLUGS].sort()).toEqual(Object.keys(BUY_INTENT_PAGES).sort())
  })

  it('keeps BUY_STATIC_SLUGS in lockstep with shipped app/buy/<slug>/page.tsx folders', () => {
    expect([...BUY_STATIC_SLUGS].sort()).toEqual(shippedBuyStaticSlugs())
  })

  it('decodes the slug and ignores nested paths', () => {
    expect(buyPublicSlugFromPath('/buy/First-Time')).toBe('first-time')
    expect(buyPublicSlugFromPath('/buy/leverage/extra')).toBeNull()
    expect(isKnownBuyPublicSlug('leverage')).toBe(true)
    expect(isKnownBuyPublicSlug('alerts')).toBe(true)
    expect(isKnownBuyPublicSlug('concessions')).toBe(true)
    expect(isKnownBuyPublicSlug('homes-under-500k-central-oregon')).toBe(true)
    expect(isKnownBuyPublicSlug('not-a-real-page')).toBe(false)
  })
})
