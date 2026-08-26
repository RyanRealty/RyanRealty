import { describe, expect, it } from 'vitest'
import {
  PLACE_NOISE_SLUGS,
  resolvePlaceContextFromListing,
} from './resolvePlaceContext'
import { getResortCommunityBySubdivisionName } from '@/lib/data/communities/registry'

describe('resolvePlaceContextFromListing', () => {
  // Was spelled "Valhalla Heights → NorthWest Crossing" until 2026-08-26. Valhalla
  // Heights is its own recorded Deschutes County plat (CSNUM 10269-14653) that the
  // old proximity-based alias list had claimed for NWX, and it was removed. Elkai
  // Woods is a verified Widgi Creek child (100% of its listings inside the Widgi
  // polygon), so the case under test — a plat that IS a registry child — is unchanged.
  it('builds city → community → plat when the plat is a registry child (Elkai Woods → Widgi Creek)', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Bend',
      citySlug: 'bend',
      neighborhoodName: 'Widgi Creek',
      neighborhoodSlug: 'widgi-creek',
      subdivisionName: 'Elkai Woods',
      subdivisionSlug: 'elkai-woods',
    })

    expect(ctx.city?.href).toBe('/cities/bend')
    // Registry lists Elkai Woods under Widgi Creek (curated Community).
    expect(ctx.curatedCommunity?.href).toBe('/communities/widgi-creek')
    expect(ctx.subdivision?.href).toBe('/subdivisions/elkai-woods')
    expect(ctx.preferredMarketGrain).toBe('community')
    // Neighborhood deduped against same Community slug.
    expect(ctx.breadcrumb.map((b) => b.type)).toEqual([
      'city',
      'community',
      'subdivision',
    ])
    expect(ctx.identityLine).toContain('Elkai Woods')
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
      subdivisionName: 'Crr 1',
      subdivisionSlug: 'crr-1',
    })
    expect(ctx.subdivision).toBeNull()
    expect(ctx.identityLine).toBe('Bend')
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
