import { describe, expect, it } from 'vitest'
import {
  PLACE_NOISE_SLUGS,
  resolvePlaceContextFromListing,
} from './resolvePlaceContext'
import { getResortCommunityBySubdivisionName } from '@/lib/data/communities/registry'

describe('resolvePlaceContextFromListing', () => {
  it('builds city → community → plat when the plat is a registry child (Valhalla → NWX)', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      neighborhoodName: 'Northwest Crossing',
      neighborhoodSlug: 'northwest-crossing',
      subdivisionName: 'Valhalla Heights',
      subdivisionSlug: 'valhalla-heights',
    })

    expect(ctx.city?.href).toBe('/cities/bend')
    // Registry lists Valhalla Heights under NorthWest Crossing (curated Community).
    expect(ctx.curatedCommunity?.href).toBe('/communities/northwest-crossing')
    expect(ctx.subdivision?.href).toBe('/subdivisions/valhalla-heights')
    expect(ctx.preferredMarketGrain).toBe('community')
    // Neighborhood deduped against same Community slug.
    expect(ctx.breadcrumb.map((b) => b.type)).toEqual([
      'city',
      'community',
      'subdivision',
    ])
    expect(ctx.identityLine).toContain('Valhalla Heights')
    expect(ctx.identityLine).toContain('Bend')
  })

  it('builds city → neighborhood → subdivision for a non-registry plat', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      neighborhoodName: 'Old Bend',
      neighborhoodSlug: 'old-bend',
      subdivisionName: 'Some Ordinary Plat',
      subdivisionSlug: 'some-ordinary-plat',
    })

    expect(ctx.curatedCommunity).toBeNull()
    expect(ctx.preferredMarketGrain).toBe('subdivision')
    expect(ctx.breadcrumb.map((b) => b.type)).toEqual([
      'city',
      'neighborhood',
      'subdivision',
    ])
    expect(ctx.neighborhood?.href).toBe('/cities/bend/old-bend')
  })

  it('resolves curated Community from MLS subdivision alias (Tetherow)', () => {
    const resort = getResortCommunityBySubdivisionName('Tetherow')
    // Registry must include Tetherow for this product assertion.
    expect(resort?.slug).toBe('tetherow')

    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      subdivisionName: 'Tetherow',
      subdivisionSlug: 'tetherow',
    })

    expect(ctx.curatedCommunity?.type).toBe('community')
    expect(ctx.curatedCommunity?.href).toBe('/communities/tetherow')
    expect(ctx.preferredMarketGrain).toBe('community')
    // Plat label equals community — breadcrumb should not double Tetherow.
    const labels = ctx.breadcrumb.map((b) => b.label.toLowerCase())
    expect(labels.filter((l) => l === 'tetherow').length).toBe(1)
  })

  it('drops noise slugs (N/A, Outside City Limits)', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      subdivisionName: 'N/A',
      subdivisionSlug: 'na',
      neighborhoodName: 'Outside City Limits',
      neighborhoodSlug: 'outside-city-limits',
    })

    expect(PLACE_NOISE_SLUGS.has('na')).toBe(true)
    expect(ctx.subdivision).toBeNull()
    expect(ctx.neighborhood).toBeNull()
    expect(ctx.city?.slug).toBe('bend')
    expect(ctx.preferredMarketGrain).toBe('city')
    expect(ctx.breadcrumb.map((b) => b.type)).toEqual(['city'])
  })

  it('withholds an MLS abbreviation from the plat breadcrumb', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      subdivisionName: 'Qzz 1',
      subdivisionSlug: 'qzz-1',
    })
    expect(ctx.subdivision).toBeNull()
    expect(ctx.identityLine).toBe('Bend')
    expect(ctx.breadcrumb.map((b) => b.label).join(' ')).not.toMatch(/Qzz/i)
  })

  it('climbs a Crr family tag to Crooked River Ranch without printing Crr', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Terrebonne',
      citySlug: 'terrebonne',
      subdivisionName: 'Crr 1',
      subdivisionSlug: 'crr-1',
    })
    expect(ctx.subdivision).toBeNull()
    expect(ctx.curatedCommunity?.label).toBe('Crooked River Ranch')
    expect(ctx.identityLine).toBe('Crooked River Ranch · Terrebonne')
    expect(ctx.breadcrumb.map((b) => b.label).join(' ')).not.toMatch(/Crr/i)
  })

  it('city-only listing has empty parents beyond city leaf', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Redmond',
      citySlug: 'redmond',
    })
    expect(ctx.breadcrumb).toHaveLength(1)
    expect(ctx.parents).toEqual([])
    expect(ctx.identityLine).toBe('Redmond')
  })
})
