import { describe, expect, it } from 'vitest'
import {
  CORE_CITY_SLUGS,
  CORE_COMMUNITY_MARKET_PATHS,
  CORE_MARKET_PATHS,
} from '@/app/housing-market/[...slug]/_v3/geo-constants'
import { cityMarketPath, communityMarketPath, resolveMarketCommunityHop } from './canonical-market-path'

describe('one market URL per place', () => {
  it('the literal community paths equal the resolver (the module that reaches client bundles cannot import it)', () => {
    for (const [slug, path] of Object.entries(CORE_COMMUNITY_MARKET_PATHS)) {
      expect(communityMarketPath(slug)).toBe(path)
      expect(resolveMarketCommunityHop(path), path).toBeNull()
    }
  })

  it('every pre-heated / sitemapped market path is a fixed point of the hop', () => {
    for (const path of CORE_MARKET_PATHS) expect(resolveMarketCommunityHop(path), path).toBeNull()
    for (const slug of CORE_CITY_SLUGS) expect(cityMarketPath(slug)).toBe(`/housing-market/${slug}`)
  })

  it('a community city slug links its community page, never the 301', () => {
    expect(cityMarketPath('black-butte-ranch')).toBe('/housing-market/sisters/black-butte-ranch')
    expect(cityMarketPath('bend')).toBe('/housing-market/bend')
    expect(communityMarketPath('sunriver')).toBe('/housing-market/sunriver')
    expect(communityMarketPath('pronghorn', { followLegacy: false })).toBe('/housing-market/bend/pronghorn')
    expect(communityMarketPath('tetherow')).toBe('/communities/tetherow')
    expect(communityMarketPath('tetherow', { followLegacy: false })).toBe('/housing-market/bend/tetherow')
    expect(communityMarketPath('stevens-ranch')).toBeNull()
  })
})
