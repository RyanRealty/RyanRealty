import { describe, expect, it } from 'vitest'
import registry from '@/data/resort-communities.json'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import {
  isSelfCityCommunity,
  placeInventoryHref,
  selfCityCommunityPath,
  selfCityCommunitySlug,
  selfCitySearchCanonicalPath,
  selfCitySearchHeading,
  selfCitySearchPath,
  selfCitySearchUrlLeavesSitemap,
} from './self-city-community'

function registryList() {
  return (Array.isArray(registry) ? registry : (registry as { communities: unknown[] }).communities) as Array<{
    slug: string
    city_slug: string
  }>
}

describe('self-city community (SITE-187, SITE-184)', () => {
  it('an explicit registry self_city carries evidence, and false excludes (Crooked River Ranch)', () => {
    const overrides = registryList().filter(
      (e) => typeof (e as { self_city?: boolean }).self_city === 'boolean',
    ) as unknown as Array<{ slug: string; self_city: boolean; self_city_evidence?: string }>
    expect(overrides.map((e) => e.slug)).toContain('crooked-river-ranch')
    for (const e of overrides) {
      expect(e.self_city_evidence?.trim().length ?? 0, e.slug).toBeGreaterThan(40)
      expect(isSelfCityCommunity(e.slug), e.slug).toBe(e.self_city)
    }
  })

  it('derives the set from the registry and the city constants, not a hand list', () => {
    const expected = registryList()
      .filter((e) =>
        typeof (e as { self_city?: boolean }).self_city === 'boolean'
          ? (e as { self_city?: boolean }).self_city
          : e.slug === e.city_slug || CENTRAL_OREGON_CITY_SLUGS.has(e.slug),
      )
      .map((e) => e.slug)
    expect(expected).toContain('sunriver')
    expect(expected).toContain('black-butte-ranch')
    for (const slug of expected) expect(isSelfCityCommunity(slug)).toBe(true)
    // And nothing outside that derivation is a member.
    for (const e of registryList()) {
      if (!expected.includes(e.slug)) expect(isSelfCityCommunity(e.slug), e.slug).toBe(false)
    }
  })

  it('Sunriver stays a member via city_slug; Black Butte Ranch joins via its own MLS city slug', () => {
    expect(selfCityCommunitySlug('sunriver')).toBe('sunriver')
    expect(selfCityCommunitySlug('Sunriver')).toBe('sunriver')
    expect(selfCityCommunityPath('sunriver')).toBe('/communities/sunriver')
    // SITE-184: registry city is Sisters, but black-butte-ranch is a site city
    // slug (MLS City 'Black Butte Ranch'), so it is its own city.
    expect(selfCityCommunitySlug('black-butte-ranch')).toBe('black-butte-ranch')
    expect(selfCityCommunityPath('black-butte-ranch')).toBe('/communities/black-butte-ranch')
    expect(isSelfCityCommunity('black-butte-ranch')).toBe(true)
    // Crooked River Ranch matches by slug, but MLS files its homes under
    // Terrebonne / Crooked River, so the registry's self_city: false keeps it out.
    expect(selfCityCommunitySlug('crooked-river-ranch')).toBeNull()
    expect(isSelfCityCommunity('crooked-river-ranch')).toBe(false)
    expect(selfCitySearchPath('crooked-river-ranch')).toBeNull()
  })

  it('the registry parent city is never a key: Sisters and Terrebonne stay their own', () => {
    expect(selfCityCommunitySlug('sisters')).toBeNull()
    expect(selfCityCommunitySlug('terrebonne')).toBeNull()
    expect(selfCityCommunitySlug('bend')).toBeNull()
    expect(selfCityCommunitySlug('tetherow')).toBeNull()
    expect(selfCityCommunitySlug('caldera-springs')).toBeNull()
    expect(isSelfCityCommunity('tetherow')).toBe(false)
    expect(isSelfCityCommunity('')).toBe(false)
    expect(selfCityCommunitySlug(null)).toBeNull()
    expect(selfCityCommunitySlug(undefined)).toBeNull()
  })

  it('routes the plain inventory door to the community page only for a self-city', () => {
    expect(placeInventoryHref('Sunriver')).toBe('/communities/sunriver')
    expect(placeInventoryHref('Black Butte Ranch')).toBe('/communities/black-butte-ranch')
    expect(placeInventoryHref('Sisters')).toBe('/homes-for-sale/sisters')
    expect(placeInventoryHref('Bend')).toBe('/homes-for-sale/bend')
    expect(placeInventoryHref('La Pine')).toBe('/homes-for-sale/la-pine')
  })

  it("the community's own search is /homes-for-sale/<slug>, never the registry city's search", () => {
    expect(selfCitySearchPath('sunriver')).toBe('/homes-for-sale/sunriver')
    expect(selfCitySearchPath('black-butte-ranch')).toBe('/homes-for-sale/black-butte-ranch')
    expect(selfCitySearchPath('tetherow')).toBeNull()
    expect(selfCitySearchPath('sisters')).toBeNull()
  })

  it('canonicals only the plain city search page', () => {
    expect(selfCitySearchCanonicalPath({ citySlug: 'sunriver', hasArea: false, hasPreset: false })).toBe(
      '/communities/sunriver',
    )
    expect(
      selfCitySearchCanonicalPath({ citySlug: 'black-butte-ranch', hasArea: false, hasPreset: false }),
    ).toBe('/communities/black-butte-ranch')
    expect(selfCitySearchCanonicalPath({ citySlug: 'sunriver', hasArea: true, hasPreset: false })).toBeNull()
    expect(selfCitySearchCanonicalPath({ citySlug: 'sunriver', hasArea: false, hasPreset: true })).toBeNull()
    expect(
      selfCitySearchCanonicalPath({ citySlug: 'black-butte-ranch', hasArea: false, hasPreset: true }),
    ).toBeNull()
    expect(selfCitySearchCanonicalPath({ citySlug: 'bend', hasArea: false, hasPreset: false })).toBeNull()
    expect(selfCitySearchCanonicalPath({ citySlug: 'sisters', hasArea: false, hasPreset: false })).toBeNull()
  })

  it('gives the plain self-city search page its own heading so no second page carries the winner h1', () => {
    expect(
      selfCitySearchHeading({ citySlug: 'black-butte-ranch', placeName: 'Black Butte Ranch', hasArea: false, hasPreset: false }),
    ).toBe('Search Black Butte Ranch homes')
    expect(
      selfCitySearchHeading({ citySlug: 'sunriver', placeName: 'Sunriver', hasArea: false, hasPreset: false }),
    ).toBe('Search Sunriver homes')
    // Presets, areas and every other city keep the search frame's heading.
    expect(
      selfCitySearchHeading({ citySlug: 'black-butte-ranch', placeName: 'Black Butte Ranch', hasArea: false, hasPreset: true }),
    ).toBeNull()
    expect(
      selfCitySearchHeading({ citySlug: 'black-butte-ranch', placeName: 'Black Butte Ranch', hasArea: true, hasPreset: false }),
    ).toBeNull()
    expect(selfCitySearchHeading({ citySlug: 'bend', placeName: 'Bend', hasArea: false, hasPreset: false })).toBeNull()
  })

  it('drops the plain city search URL from the sitemap for a self-city', () => {
    expect(selfCitySearchUrlLeavesSitemap('sunriver')).toBe(true)
    expect(selfCitySearchUrlLeavesSitemap('black-butte-ranch')).toBe(true)
    expect(selfCitySearchUrlLeavesSitemap('sisters')).toBe(false)
    expect(selfCitySearchUrlLeavesSitemap('bend')).toBe(false)
  })
})
