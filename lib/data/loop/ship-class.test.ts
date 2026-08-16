import { describe, expect, it } from 'vitest'
import {
  extractUrlFromObjective,
  selectShipClass,
  SHIP_CLASS_MAX,
  shipClassKey,
  surfaceFamilyFromUrl,
} from './ship-class'

function fleetNode(
  id: string,
  url: string,
  extras?: { domain?: string; title?: string; viewport?: string },
): {
  id: string
  domain: string
  title: string
  objective: string
  versionGap: string | null
} {
  const viewport = extras?.viewport ? ` [${extras.viewport}]` : ''
  return {
    id,
    domain: extras?.domain ?? 'public-ux',
    title: extras?.title ?? 'Fleet finding [p0]: counts disagree',
    objective: `fleet:abc — bot stats-truth (case core-1) at ${url}${viewport}: expected "match" but observed "mismatch".`,
    versionGap: null,
  }
}

describe('ship class (same-category fleet findings share one rebuild)', () => {
  it('reads the intake URL even when a viewport sits after it', () => {
    expect(
      extractUrlFromObjective(
        'fleet:x — bot walker-mobile (case ad-hoc) at https://ryan-realty.com/communities/tetherow [390]: expected "35" but observed "19".',
      ),
    ).toBe('https://ryan-realty.com/communities/tetherow')
  })

  it('groups community, city, neighborhood, and housing-market URLs as place-pages', () => {
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/communities/tetherow')).toBe('place-pages')
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/cities/la-pine')).toBe('place-pages')
    expect(surfaceFamilyFromUrl('/neighborhoods/awbrey-butte')).toBe('place-pages')
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/housing-market/bend')).toBe('place-pages')
  })

  it('keeps listing detail and search off the place-page class', () => {
    expect(
      surfaceFamilyFromUrl('https://ryan-realty.com/homes-for-sale/bend/tetherow/123-main-st-220189422'),
    ).toBe('listing-detail')
    expect(surfaceFamilyFromUrl('https://ryan-realty.com/homes-for-sale/bend')).toBe('search')
  })

  it('batches Tetherow + Awbrey + La Pine fleet findings into one place-page class', () => {
    const a = fleetNode('1', 'https://ryan-realty.com/communities/tetherow')
    const b = fleetNode('2', 'https://ryan-realty.com/communities/awbrey-glen')
    const c = fleetNode('3', 'https://ryan-realty.com/cities/la-pine')
    expect(shipClassKey(a)).toBe('fleet:public-ux:place-pages')
    expect(shipClassKey(b)).toBe(shipClassKey(a))
    expect(shipClassKey(c)).toBe(shipClassKey(a))
    const batch = selectShipClass([a, b, c], a)
    expect(batch.nodes.map((n) => n.id)).toEqual(['1', '2', '3'])
    expect(batch.remaining).toBe(0)
  })

  it('does not batch a place-page finding with a listing finding or a planned gap', () => {
    const place = fleetNode('1', 'https://ryan-realty.com/communities/tetherow')
    const listing = fleetNode('2', 'https://ryan-realty.com/homes-for-sale/listing/220189422')
    const gap = {
      id: '3',
      domain: 'public-ux' as const,
      title: 'G32 xAI-only gen',
      objective: 'Put generate calls through lib/grok-*.ts',
      versionGap: 'G32',
    }
    expect(shipClassKey(place)).not.toBe(shipClassKey(listing))
    expect(shipClassKey(place)).not.toBe(shipClassKey(gap))
    expect(selectShipClass([place, listing, gap], place).nodes.map((n) => n.id)).toEqual(['1'])
    expect(selectShipClass([place, listing, gap], gap).nodes.map((n) => n.id)).toEqual(['3'])
  })

  it('caps a class so one session can finish, and reports leftovers for the next ship', () => {
    const nodes = Array.from({ length: SHIP_CLASS_MAX + 3 }, (_, i) =>
      fleetNode(String(i + 1), `https://ryan-realty.com/communities/place-${i}`),
    )
    const batch = selectShipClass(nodes, nodes[0])
    expect(batch.nodes).toHaveLength(SHIP_CLASS_MAX)
    expect(batch.nodes[0].id).toBe('1')
    expect(batch.remaining).toBe(3)
  })
})
