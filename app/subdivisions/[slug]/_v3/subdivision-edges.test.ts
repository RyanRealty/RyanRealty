import { describe, expect, it } from 'vitest'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'
import type { LifestyleNearItem } from '@/lib/explore/lifestyle-near'
import { subdivisionListingsPath } from '@/lib/slug'
import { buildSubdivisionEdges, type EdgeInput } from './subdivision-edges'

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

const parkItem: LifestyleNearItem = {
  kind: 'park',
  name: 'Farewell Bend Park',
  href: '/parks/farewell-bend-park',
  distanceMiles: 3.9,
  meta: 'City park',
}

const trailItem: LifestyleNearItem = {
  kind: 'trail',
  name: "Phil's Trail",
  href: '/central-oregon/trails/phils-trail',
  distanceMiles: 4.1,
  meta: 'Mountain bike',
}

const golfItem: LifestyleNearItem = {
  kind: 'golf',
  name: 'Tetherow',
  href: '/central-oregon/golf/tetherow-golf-club',
  distanceMiles: 1.9,
  meta: '18 holes · Bend',
}

const eventItem: LifestyleNearItem = {
  kind: 'event',
  name: 'Dirty Half',
  href: '/central-oregon/events/dirty-half',
  distanceMiles: 2.8,
  meta: 'race',
}

function quietEdges(lifestyleItems: readonly LifestyleNearItem[]) {
  const input: EdgeInput = {
    displayName: 'Deschutes River Woods',
    cityName: 'Bend',
    citySlug: 'bend',
    resortLabel: null,
    resortSlug: null,
    placeContext: emptyPlace,
    lifestyleItems,
    peerPlats: [],
    browseHref: '/homes-for-sale/bend/deschutes-river-woods',
    marketHref: '/housing-market/bend/deschutes-river-woods',
    pagePath: '/subdivisions/deschutes-river-woods',
  }
  return buildSubdivisionEdges(input)
}

function proseTerms(items: ReturnType<typeof buildSubdivisionEdges>): string[] {
  return items.flatMap((item) =>
    'term' in item && item.kind === 'prose' && typeof item.term === 'string' ? [item.term] : [],
  )
}

function labels(items: ReturnType<typeof buildSubdivisionEdges>): string[] {
  return items.flatMap((item) =>
    'label' in item && typeof item.label === 'string' ? [item.label] : [],
  )
}

describe('SITE-141 Quiet no longer dumps parks and trails', () => {
  it('keeps golf in Around and drops parks and trails', () => {
    const items = quietEdges([parkItem, trailItem, golfItem])
    const terms = proseTerms(items)
    expect(terms).toContain('Golf nearby')
    expect(terms).not.toContain('Parks, trails, and golf nearby')
    expect(labels(items).some((label) => label.includes('Tetherow'))).toBe(true)
    expect(labels(items).some((label) => label.includes('Farewell Bend'))).toBe(false)
    expect(labels(items).some((label) => label.includes("Phil's Trail"))).toBe(false)
  })

  it('names golf and events when both remain, and still omits parks', () => {
    const items = quietEdges([parkItem, golfItem, eventItem])
    expect(proseTerms(items)).toContain('Golf and events nearby')
    expect(labels(items).some((label) => label.includes('Dirty Half'))).toBe(true)
    expect(labels(items).some((label) => label.includes('Farewell Bend'))).toBe(false)
  })

  it('omits the nearby lifestyle block when only parks and trails were nearby', () => {
    const items = quietEdges([parkItem, trailItem])
    expect(proseTerms(items)).not.toContain('Parks, trails, and golf nearby')
    expect(proseTerms(items)).not.toContain('Golf nearby')
    expect(proseTerms(items)).not.toContain('Events nearby')
    expect(labels(items).some((label) => label.includes('Farewell Bend'))).toBe(false)
    expect(labels(items).some((label) => label.includes("Phil's Trail"))).toBe(false)
  })
})
