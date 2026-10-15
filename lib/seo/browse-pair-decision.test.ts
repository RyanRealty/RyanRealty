import { describe, expect, it } from 'vitest'
import {
  BROWSE_PAIR_MIN_ACTIVE,
  BROWSE_PAIR_MIN_LIFETIME_SALES,
  browsePairSitemapPath,
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
    expect(d.emit).toBe(false)
    expect(d.index).toBe(false)
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
    expect(d.emit).toBe(false)
  })
})

describe('decideBrowsePair — EXP-2: only real content is indexed, decided on lifetime depth', () => {
  it(`drops a sold-history pair with >= ${BROWSE_PAIR_MIN_LIFETIME_SALES} sales when fewer than ${BROWSE_PAIR_MIN_ACTIVE} homes are for sale`, () => {
    const d = decideBrowsePair(
      facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 0 } }),
    )
    expect(d.kind).toBe('sold-history')
    expect(d.index).toBe(false)
    expect(d.emit).toBe(false)
    expect(d.canonicalPath).toBe('/homes-for-sale/bend/cambria')
    expect(d.publicName).toBe('Cambria')
  })

  it(`emits and indexes sold history only while ${BROWSE_PAIR_MIN_ACTIVE} or more homes are for sale`, () => {
    const live = decideBrowsePair(facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 3 } }))
    const sold = decideBrowsePair(facts({ inventory: { mlsName: 'Cambria', closedLifetime: 25, activeNow: 0 } }))
    expect(live.emit).toBe(true)
    expect(live.index).toBe(true)
    expect(sold.emit).toBe(false)
    expect(sold.index).toBe(false)
  })

  it(`indexes and submits a live-only pair at the ${BROWSE_PAIR_MIN_ACTIVE}-active floor`, () => {
    const withListings = decideBrowsePair(
      facts({ areaSlug: 'discovery-west-phase-8-9', inventory: { mlsName: 'Discovery West Phase 8 & 9', closedLifetime: 6, activeNow: 16 } }),
    )
    expect(withListings.kind).toBe('live-only')
    expect(withListings.index).toBe(true)
    expect(withListings.emit).toBe(true)

    const empty = decideBrowsePair(
      facts({ areaSlug: 'amundson', inventory: { mlsName: 'Amundson', closedLifetime: 7, activeNow: 0 } }),
    )
    expect(empty.kind).toBe('thin')
    expect(empty.index).toBe(false)
    expect(empty.emit).toBe(false)
    expect(empty.canonicalPath).toBe('/homes-for-sale/bend/amundson')
  })

  it('a failed plat-set read still agrees with the page: thin sold-history is not emitted', () => {
    const d = decideBrowsePair(
      facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 0 }, platIndexable: null }),
    )
    expect(d.kind).toBe('sold-history')
    expect(d.emit).toBe(false)
    expect(d.index).toBe(false)
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

describe('browsePairSitemapPath — the sitemap submits the URL the page is canonical at (2026-10-14)', () => {
  // Live 2026-10-14 23:10Z: /sitemaps/geo.xml listed /homes-for-sale/la-pine/black-bear-meadows
  // and /homes-for-sale/bend/lazy-river-west, whose pages serve rel=canonical to
  // /subdivisions/black-bear-meadows and /subdivisions/lazy-river-west. 69 of the
  // 225 pairs in the file did the same.
  const twin = (areaSlug: string, platSlug: string, citySlug = 'bend') =>
    facts({
      citySlug,
      areaSlug,
      inventory: { mlsName: areaSlug, closedLifetime: 40, activeNow: 6 },
      platIndexable: true,
      cityPlat: { slug: platSlug, label: platSlug },
    })

  it('submits a pair whose page canonicalizes to /subdivisions/{slug} as that URL, never as the pair', () => {
    for (const [city, area] of [['bend', 'lazy-river-west'], ['la-pine', 'black-bear-meadows']] as const) {
      const f = twin(area, area, city)
      expect(decideBrowsePair(f).canonicalPath).toBe(`/subdivisions/${area}`)
      expect(browsePairSitemapPath(f)).toBe(`/subdivisions/${area}`)
      expect(browsePairSitemapPath(f)).not.toBe(`/homes-for-sale/${city}/${area}`)
    }
  })

  it('submits the plat slug the county recorded when the MLS name differs across a word break', () => {
    const f = twin('deschutes-riverwoods', 'deschutes-river-woods')
    expect(browsePairSitemapPath(f)).toBe('/subdivisions/deschutes-river-woods')
  })

  it('leaves a self-canonical pair unchanged: the pair itself', () => {
    const sold = facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 3 } })
    expect(browsePairSitemapPath(sold)).toBe('/homes-for-sale/bend/cambria')
    const live = facts({
      areaSlug: 'discovery-west-phase-8-9',
      inventory: { mlsName: 'Discovery West Phase 8 & 9', closedLifetime: 6, activeNow: 16 },
    })
    expect(browsePairSitemapPath(live)).toBe('/homes-for-sale/bend/discovery-west-phase-8-9')
  })

  it('a pair that has a plat of its own city but is not in the indexable plat set stays self-canonical and is submitted as itself', () => {
    // bend/desert-skies and bend/river-bend-estate on production: a plat exists, but the
    // page serves a self canonical (the plat is not an indexable twin of this pair).
    const f = facts({
      areaSlug: 'desert-skies',
      inventory: { mlsName: 'Desert Skies', closedLifetime: 30, activeNow: 5 },
      platIndexable: false,
      cityPlat: { slug: 'desert-skies', label: 'Desert Skies' },
    })
    expect(decideBrowsePair(f).canonicalPath).toBe('/homes-for-sale/bend/desert-skies')
    expect(browsePairSitemapPath(f)).toBe('/homes-for-sale/bend/desert-skies')
  })

  it('submits nothing it cannot prove self-canonical while the plat set is unreadable (the page fails open, the sitemap fails closed)', () => {
    // The same pair as the twin above, with the plat set unreadable: the page
    // keeps a self canonical and the index slot, so a healthy page and this one
    // disagree about the canonical. The sitemap withholds the pair.
    const unreadable = facts({
      citySlug: 'la-pine',
      areaSlug: 'black-bear-meadows',
      inventory: { mlsName: 'Black Bear Meadows', closedLifetime: 40, activeNow: 6 },
      platIndexable: null,
      cityPlat: { slug: 'black-bear-meadows', label: 'Black Bear Meadows' },
    })
    const d = decideBrowsePair(unreadable)
    expect(d.kind).toBe('sold-history')
    expect(d.index).toBe(true)
    expect(d.canonicalPath).toBe('/homes-for-sale/la-pine/black-bear-meadows')
    expect(d.emit).toBe(false)
    expect(browsePairSitemapPath(unreadable)).toBeNull()
    // A live-only pair too: no pair is emitted on an unreadable set.
    const live = facts({
      areaSlug: 'discovery-west-phase-8-9',
      inventory: { mlsName: 'Discovery West Phase 8 & 9', closedLifetime: 6, activeNow: 16 },
      platIndexable: null,
    })
    expect(decideBrowsePair(live).kind).toBe('live-only')
    expect(decideBrowsePair(live).emit).toBe(false)
    expect(browsePairSitemapPath(live)).toBeNull()
  })

  it('submits nothing for a community twin, a city twin, a thin pair, a withheld name or an unresolved area', () => {
    const cases: BrowsePairFacts[] = [
      facts({ areaSlug: 'tetherow', community: { publicSlug: 'tetherow', label: 'Tetherow' }, inventory: { mlsName: 'Tetherow', closedLifetime: 300, activeNow: 12 } }),
      facts({ citySlug: 'sisters', areaSlug: 'sisters', inventory: { mlsName: 'Sisters', closedLifetime: 80, activeNow: 9 } }),
      facts({ areaSlug: 'amundson', inventory: { mlsName: 'Amundson', closedLifetime: 7, activeNow: 0 } }),
      facts({ areaSlug: 'aspenb', inventory: { mlsName: 'AspenB', closedLifetime: 40, activeNow: 4 } }),
      facts({ areaSlug: 'p1-no-such-place' }),
    ]
    for (const f of cases) expect(browsePairSitemapPath(f), f.areaSlug).toBeNull()
  })

  it('the URL it returns is always the canonical the page serves, over a matrix of every kind', () => {
    // One function decides both: a submitted URL is the decision's canonicalPath
    // (so the page that is submitted points its canonical at itself).
    const inventories = [
      null,
      { mlsName: 'Cambria', closedLifetime: 3, activeNow: 0 },
      { mlsName: 'Cambria', closedLifetime: 3, activeNow: 5 },
      { mlsName: 'Cambria', closedLifetime: 40, activeNow: 0 },
      { mlsName: 'Cambria', closedLifetime: 40, activeNow: 5 },
    ]
    for (const inventory of inventories) {
      for (const platIndexable of [true, false, null] as const) {
        for (const cityPlat of [null, { slug: 'cambria', label: 'Cambria' }]) {
          for (const activeName of [null, 'Cambria']) {
            const f = facts({ inventory, platIndexable, cityPlat, activeName })
            const d = decideBrowsePair(f)
            const url = browsePairSitemapPath(f)
            if (url === null) continue
            expect(url, JSON.stringify(f)).toBe(d.canonicalPath)
            // Never a URL that canonicalizes away: either the page's own URL
            // (self canonical, indexable) or the plat page a twin points to.
            if (d.kind === 'plat-twin') expect(url.startsWith('/subdivisions/')).toBe(true)
            else {
              expect(url).toBe('/homes-for-sale/bend/cambria')
              expect(d.index).toBe(true)
            }
          }
        }
      }
    }
  })
})
