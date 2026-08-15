import { describe, expect, it } from 'vitest'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'
import { subdivisionListingsPath } from '@/lib/slug'
import { buildSubdivisionEdges } from './subdivision-edges'

const emptyPlace: PlaceContext = {
  city: null,
  neighborhood: null,
  subdivision: null,
  curatedCommunity: null,
  preferredMarketGrain: 'subdivision',
  breadcrumb: [],
  parents: [],
  identityLine: 'Sunrise Village',
}

describe('plat place follows', () => {
  it('Homes and Market keep the plat filter', () => {
    const browseHref = subdivisionListingsPath('Bend', 'Sunrise Village')
    const items = buildSubdivisionEdges({
      displayName: 'Sunrise Village',
      cityName: 'Bend',
      citySlug: 'bend',
      resortLabel: 'Tetherow',
      resortSlug: 'tetherow',
      placeContext: emptyPlace,
      lifestyleItems: [],
      peerPlats: [],
      browseHref,
      marketHref: '/housing-market/bend/sunrise-village',
      pagePath: '/subdivisions/sunrise-village',
    })
    const byLabel = new Map(items.flatMap((item) => ('href' in item ? [[item.label, item.href]] : [])))
    expect(browseHref).toBe('/homes-for-sale/bend/sunrise-village')
    expect(byLabel.get('Sunrise Village homes for sale')).toBe('/homes-for-sale/bend/sunrise-village')
    expect(byLabel.get('Sunrise Village market report')).toBe('/housing-market/bend/sunrise-village')
    expect(byLabel.get('Sunrise Village homes for sale')).not.toBe('/search')
  })

  it('carries the registry resort list', () => {
    const items = buildSubdivisionEdges({
      displayName: 'Sunrise Village',
      cityName: 'Bend',
      citySlug: 'bend',
      resortLabel: 'Tetherow',
      resortSlug: 'tetherow',
      placeContext: emptyPlace,
      lifestyleItems: [],
      peerPlats: [],
      browseHref: '/homes-for-sale/bend/sunrise-village',
      marketHref: '/housing-market/bend/sunrise-village',
      pagePath: '/subdivisions/sunrise-village',
    })
    const hrefs = items.flatMap((item) => ('href' in item ? [item.href] : []))
    expect(hrefs).toContain('/communities/tetherow')
    expect(hrefs).toContain('/communities/sunriver')
    expect(hrefs).toContain('/communities/caldera-springs')
  })
})
