import { describe, expect, it } from 'vitest'
import {
  BROWSE_PAIR_MIN_LIFETIME_SALES,
  decideBrowsePair,
  isRefusedBrowsePair,
  publishBrowsePairName,
  type BrowsePairFacts,
} from './browse-pair-decision'

function facts(over: Partial<BrowsePairFacts> = {}): BrowsePairFacts {
  return {
    citySlug: 'bend',
    areaSlug: 'cambria',
    inventory: null,
    inventoryKnown: true,
    activeName: null,
    community: null,
    platIndexable: false,
    platLabel: null,
    cityPlat: null,
    ...over,
  }
}

describe('decideBrowsePair — SEO-1: an area no source knows fails CLOSED', () => {
  // The verifier's live repro (2026-09-22) and this agent's (2026-09-23): two
  // garbage slugs under two different cities, both served 200, index,follow,
  // self-canonical, with the slug title-cased into an H1.
  it.each([
    ['bend', 'p1-fixagent-garbage-91'],
    ['prineville', 'p1-no-such-place'],
  ])('refuses /homes-for-sale/%s/%s: noindex, no canonical, no name, not emitted', (citySlug, areaSlug) => {
    const d = decideBrowsePair(facts({ citySlug, areaSlug, inventory: null, activeName: null, platIndexable: false }))
    expect(d.kind).toBe('unresolved')
    expect(isRefusedBrowsePair(d)).toBe(true)
    expect(d.index).toBe(false)
    expect(d.emit).toBe(false)
    expect(d.canonicalPath).toBeNull()
    expect(d.publicName).toBeNull()
    expect(d.filterName).toBeNull()
  })

  it('does not refuse on an unreadable inventory (unknown is not absent), but prints no name and stays out of the index', () => {
    const d = decideBrowsePair(facts({ areaSlug: 'maybe-real', inventoryKnown: false, platIndexable: null }))
    expect(d.kind).toBe('unknown')
    expect(isRefusedBrowsePair(d)).toBe(false)
    expect(d.index).toBe(false)
    expect(d.emit).toBe(false)
    expect(d.publicName).toBeNull()
    expect(d.canonicalPath).toBe('/homes-for-sale/bend/maybe-real')
  })

  it('resolves a subdivision only the active-listing lookup knows (listed after the MV refresh)', () => {
    const d = decideBrowsePair(facts({ areaSlug: 'brand-new-phase-1', activeName: 'Brand New Phase 1' }))
    expect(d.kind).toBe('live-only')
    expect(d.index).toBe(true)
    expect(d.emit).toBe(false)
    expect(d.publicName).toBe('Brand New Phase 1')
  })
})

describe('decideBrowsePair — EXP-4 / SEO-6: one canonical per place', () => {
  it('canonicalizes a plat twin to /subdivisions/{slug} and drops it from the sitemap', () => {
    const d = decideBrowsePair(
      facts({
        areaSlug: 'boulevard',
        inventory: { mlsName: 'Boulevard', closedLifetime: 40, activeNow: 0 },
        platIndexable: true,
        platLabel: 'Boulevard',
        cityPlat: { slug: 'boulevard', label: 'Boulevard' },
      }),
    )
    expect(d.kind).toBe('plat-twin')
    expect(d.canonicalPath).toBe('/subdivisions/boulevard')
    expect(d.index).toBe(true)
    expect(d.emit).toBe(false)
  })

  it('names a plat twin by its recorded plat label when the MLS name is a code', () => {
    const d = decideBrowsePair(
      facts({
        areaSlug: 'aspenb',
        inventory: { mlsName: 'AspenB', closedLifetime: 20, activeNow: 1 },
        platIndexable: true,
        cityPlat: { slug: 'aspenb', label: 'Aspen Rim' },
      }),
    )
    expect(d.kind).toBe('plat-twin')
    expect(d.publicName).toBe('Aspen Rim')
    expect(d.filterName).toBe('AspenB')
  })

  it('never twins without a same-city plat (bend/north-rim is not the Redmond plat north-rim)', () => {
    // The Redmond plat's label is still known (the refusal door is city-blind),
    // but no plat of this city is this place: cityPlat is null.
    const d = decideBrowsePair(
      facts({
        areaSlug: 'north-rim',
        inventory: { mlsName: 'North Rim', closedLifetime: 25, activeNow: 0 },
        platIndexable: false,
        platLabel: 'North Rim',
        cityPlat: null,
      }),
    )
    expect(d.kind).toBe('sold-history')
    expect(d.canonicalPath).toBe('/homes-for-sale/bend/north-rim')
    expect(d.emit).toBe(true)
  })

  it('twins across a word break to the plat slug the county recorded', () => {
    const d = decideBrowsePair(
      facts({
        areaSlug: 'deschutes-riverwoods',
        inventory: { mlsName: 'Deschutes RiverWoods', closedLifetime: 3046, activeNow: 16 },
        platIndexable: true,
        cityPlat: { slug: 'deschutes-river-woods', label: 'Deschutes River Woods' },
      }),
    )
    expect(d.kind).toBe('plat-twin')
    expect(d.canonicalPath).toBe('/subdivisions/deschutes-river-woods')
    expect(d.publicName).toBe('Deschutes RiverWoods')
    expect(d.emit).toBe(false)
  })

  it('canonicalizes a registry community of this city to its community page, ahead of any plat', () => {
    const d = decideBrowsePair(
      facts({
        areaSlug: 'tetherow',
        inventory: { mlsName: 'Tetherow', closedLifetime: 300, activeNow: 12 },
        community: { publicSlug: 'tetherow', label: 'Tetherow' },
        platIndexable: true,
      }),
    )
    expect(d.kind).toBe('community-twin')
    expect(d.canonicalPath).toBe('/communities/tetherow')
    expect(d.emit).toBe(false)
    expect(d.publicName).toBe('Tetherow')
  })

  it('SITE-202: an MLS name that IS the city canonicalizes to the plain city search and is never emitted', () => {
    const cityPlat = { slug: 'sisters', label: 'Sisters' }
    const d = decideBrowsePair(
      facts({
        citySlug: 'sisters',
        areaSlug: 'sisters',
        inventory: { mlsName: 'Sisters', closedLifetime: 400, activeNow: 9 },
        cityPlat,
        platIndexable: true,
      }),
    )
    expect(d.kind).toBe('city-twin')
    expect(d.canonicalPath).toBe('/homes-for-sale/sisters')
    expect(d.index).toBe(true)
    expect(d.emit).toBe(false)
    expect(d.filterName).toBe('Sisters')
  })

  it('SITE-202: a city slug with no MLS name behind it stays a refusal, not a city twin', () => {
    const d = decideBrowsePair(facts({ citySlug: 'bend', areaSlug: 'bend', inventory: null, activeName: null }))
    expect(d.kind).toBe('unresolved')
  })

  it('SITE-202: a self-city community keeps its community canonical ahead of the city twin', () => {
    const d = decideBrowsePair(
      facts({
        citySlug: 'sunriver',
        areaSlug: 'sunriver',
        inventory: { mlsName: 'Sunriver', closedLifetime: 900, activeNow: 30 },
        community: { publicSlug: 'sunriver', label: 'Sunriver' },
      }),
    )
    expect(d.kind).toBe('community-twin')
    expect(d.canonicalPath).toBe('/communities/sunriver')
  })

  it('SITE-202: a name that only starts with the city (culver-heights) is not a city twin', () => {
    const d = decideBrowsePair(
      facts({ citySlug: 'culver', areaSlug: 'culver-heights', inventory: { mlsName: 'Culver Heights', closedLifetime: 40, activeNow: 0 } }),
    )
    expect(d.kind).toBe('sold-history')
    expect(d.emit).toBe(true)
  })
})

describe('decideBrowsePair — EXP-2: only real content is indexed, decided on lifetime depth', () => {
  it(`emits and indexes a pair with >= ${BROWSE_PAIR_MIN_LIFETIME_SALES} closed sales even with nothing for sale`, () => {
    const d = decideBrowsePair(
      facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 0 } }),
    )
    expect(d.kind).toBe('sold-history')
    expect(d.index).toBe(true)
    expect(d.emit).toBe(true)
    expect(d.canonicalPath).toBe('/homes-for-sale/bend/cambria')
    expect(d.publicName).toBe('Cambria')
  })

  it('the emitted set does not move when the last listing sells (lifetime, not live)', () => {
    const live = decideBrowsePair(facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 3 } }))
    const sold = decideBrowsePair(facts({ inventory: { mlsName: 'Cambria', closedLifetime: 25, activeNow: 0 } }))
    expect(live.emit).toBe(true)
    expect(sold.emit).toBe(true)
  })

  it('indexes a thin pair only while it has homes for sale, and never submits it', () => {
    const withListings = decideBrowsePair(
      facts({ areaSlug: 'discovery-west-phase-8-9', inventory: { mlsName: 'Discovery West Phase 8 & 9', closedLifetime: 6, activeNow: 16 } }),
    )
    expect(withListings.kind).toBe('live-only')
    expect(withListings.index).toBe(true)
    expect(withListings.emit).toBe(false)

    const empty = decideBrowsePair(
      facts({ areaSlug: 'amundson', inventory: { mlsName: 'Amundson', closedLifetime: 7, activeNow: 0 } }),
    )
    expect(empty.kind).toBe('thin')
    expect(empty.index).toBe(false)
    expect(empty.emit).toBe(false)
    expect(empty.canonicalPath).toBe('/homes-for-sale/bend/amundson')
  })

  it('a failed plat-set read withdraws nothing (page and sitemap read the same set)', () => {
    const d = decideBrowsePair(
      facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 0 }, platIndexable: null }),
    )
    expect(d.kind).toBe('sold-history')
    expect(d.emit).toBe(true)
  })
})

describe('decideBrowsePair — MLS codes are never printed as place names', () => {
  it.each(['AspenB', 'Cascade Vill Mob HP', 'Oww', '1st Addition Bend Pk'])('withholds %s: noindex, not emitted, no public name', (mlsName) => {
    const d = decideBrowsePair(facts({ areaSlug: 'x', inventory: { mlsName, closedLifetime: 90, activeNow: 4 } }))
    expect(d.kind).toBe('withheld-name')
    expect(d.index).toBe(false)
    expect(d.emit).toBe(false)
    expect(d.publicName).toBeNull()
    // The listings filter still runs on the MLS string.
    expect(d.filterName).toBe(mlsName)
  })

  it('treats the MLS "Out of area; see remarks" sentinel as no name', () => {
    expect(publishBrowsePairName('Out of area; see remarks')).toBeNull()
    expect(publishBrowsePairName('Cambria')).toBe('Cambria')
    expect(publishBrowsePairName('Ridge At Eagle Crest')).toBe('Ridge at Eagle Crest')
  })
})
