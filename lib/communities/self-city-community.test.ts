import { describe, expect, it } from 'vitest'
import registry from '@/data/resort-communities.json'
import {
  isSelfCityCommunity,
  placeInventoryHref,
  selfCityCommunityPath,
  selfCityCommunitySlug,
  selfCitySearchCanonicalPath,
  selfCitySearchUrlLeavesSitemap,
} from './self-city-community'

describe('self-city community (SITE-187)', () => {
  it('derives the set from the registry, not a hand list', () => {
    const list = (Array.isArray(registry) ? registry : (registry as { communities: unknown[] }).communities) as Array<{
      slug: string
      city_slug: string
    }>
    const expected = list.filter((e) => e.slug === e.city_slug).map((e) => e.slug)
    expect(expected).toContain('sunriver')
    for (const slug of expected) expect(isSelfCityCommunity(slug)).toBe(true)
  })

  it('Sunriver is a self-city; Tetherow, Bend and Black Butte Ranch are not', () => {
    expect(selfCityCommunitySlug('sunriver')).toBe('sunriver')
    expect(selfCityCommunitySlug('Sunriver')).toBe('sunriver')
    expect(selfCityCommunityPath('sunriver')).toBe('/communities/sunriver')
    expect(selfCityCommunitySlug('bend')).toBeNull()
    expect(selfCityCommunitySlug('tetherow')).toBeNull()
    // Black Butte Ranch lists under Sisters in the registry.
    expect(selfCityCommunitySlug('black-butte-ranch')).toBeNull()
    expect(isSelfCityCommunity('tetherow')).toBe(false)
    expect(isSelfCityCommunity('')).toBe(false)
    expect(selfCityCommunitySlug(null)).toBeNull()
  })

  it('routes the plain inventory door to the community page only for a self-city', () => {
    expect(placeInventoryHref('Sunriver')).toBe('/communities/sunriver')
    expect(placeInventoryHref('Bend')).toBe('/homes-for-sale/bend')
    expect(placeInventoryHref('La Pine')).toBe('/homes-for-sale/la-pine')
  })

  it('canonicals only the plain city search page', () => {
    expect(selfCitySearchCanonicalPath({ citySlug: 'sunriver', hasArea: false, hasPreset: false })).toBe(
      '/communities/sunriver',
    )
    expect(selfCitySearchCanonicalPath({ citySlug: 'sunriver', hasArea: true, hasPreset: false })).toBeNull()
    expect(selfCitySearchCanonicalPath({ citySlug: 'sunriver', hasArea: false, hasPreset: true })).toBeNull()
    expect(selfCitySearchCanonicalPath({ citySlug: 'bend', hasArea: false, hasPreset: false })).toBeNull()
  })

  it('drops the plain city search URL from the sitemap for a self-city', () => {
    expect(selfCitySearchUrlLeavesSitemap('sunriver')).toBe(true)
    expect(selfCitySearchUrlLeavesSitemap('bend')).toBe(false)
  })
})
