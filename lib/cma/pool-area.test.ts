import { describe, expect, it } from 'vitest'
import { compAreaContains } from '@/lib/pricing/comp-area'
import {
  POOL_CAP,
  POOL_EXPIRED_MONTHS,
  POOL_QUERY_HI,
  POOL_QUERY_LO,
  bathCountGap,
  isCondoPlat,
  keepHousePoolPlats,
  poolCompArea,
  poolCompetitionSentence,
  poolExpiredSentence,
  poolPlace,
  platLabelFromSlug,
  wholeCountGap,
} from '@/lib/cma/pool-area'

describe('pool area', () => {
  const own = { slug: 'park-addition', label: 'Park Addition' }
  const adjacent = [{ slug: 'riverside', label: 'Riverside' }]
  const next = [{ slug: 'next-plat', label: 'Next Plat' }]
  const centre = { lat: 44.06, lng: -121.31 }

  it('admits own and touching slugs, and the next row only after it is opened', () => {
    const closed = poolCompArea({ own, adjacent, next, openedNext: false, centre })
    expect(closed.kind).toBe('subdivisions')
    expect(closed.radiusMiles).toBeNull()
    expect(closed.names).toEqual(['Park Addition', 'Riverside'])
    expect(closed.platSlugs).toEqual(['park-addition', 'riverside'])
    expect(compAreaContains(closed, { platSlug: 'park-addition', subdivision: 'Other' })).toBe(true)
    expect(compAreaContains(closed, { platSlug: 'riverside' })).toBe(true)
    expect(compAreaContains(closed, { platSlug: 'next-plat', subdivision: 'Next Plat' })).toBe(false)
    expect(compAreaContains(closed, { city: 'Bend', subdivision: 'Bend' })).toBe(false)

    const opened = poolCompArea({ own, adjacent, next, openedNext: true, centre })
    expect(opened.platSlugs).toEqual(['park-addition', 'riverside', 'next-plat'])
    expect(compAreaContains(opened, { platSlug: 'next-plat' })).toBe(true)
  })

  it('does not cap touching plats and drops condo plats for a house', () => {
    const plats = [
      { slug: 'a', label: 'Alpha' },
      { slug: 'b', label: 'Beta' },
      { slug: 'c', label: 'Gamma' },
      { slug: 'd', label: 'Delta' },
      { slug: 'condo', label: 'River Condominiums' },
      { slug: 'park-addition', label: 'Park Addition Condos' },
    ]
    const kept = keepHousePoolPlats(plats, 'Single Family Residence', 'park-addition')
    expect(kept.map((plat) => plat.slug)).toEqual(['a', 'b', 'c', 'd', 'park-addition'])
    expect(keepHousePoolPlats(plats, 'Condominium', 'park-addition')).toHaveLength(plats.length)
    expect(isCondoPlat('River Condos', 'river-condos')).toBe(true)
    expect(platLabelFromSlug('next-plat')).toBe('Next Plat')
    expect(POOL_QUERY_LO).toBe(1)
    expect(POOL_QUERY_HI).toBe(50_000_000)
    expect(POOL_CAP).toBe(5)
    expect(POOL_EXPIRED_MONTHS).toBe(36)
  })

  it('states an empty set and a set of five without a price band', () => {
    expect(
      poolCompetitionSentence({ ownLabel: 'Park Addition', openedNext: false, activeCount: 0, pendingCount: 0 }),
    ).toBe('No home like yours is for sale or under contract in Park Addition or the plats that touch it.')
    expect(
      poolCompetitionSentence({ ownLabel: 'Park Addition', openedNext: true, activeCount: 5, pendingCount: 0 }),
    ).toBe(
      '5 homes like yours are for sale in Park Addition, the plats that touch it, and the plats that touch those. None are under contract right now.',
    )
    expect(poolExpiredSentence({ ownLabel: 'Park Addition', openedNext: false, count: 0 })).toBe(
      'No home like yours in Park Addition or the plats that touch it came off the market without selling in the last 36 months.',
    )
    expect(poolExpiredSentence({ area: poolCompArea({ own, adjacent: [], next: [], openedNext: false, centre }), count: 5 })).toBe(
      'Five homes like yours in Park Addition came off the market without selling in the last 36 months.',
    )
    expect(poolCompetitionSentence({ ownLabel: 'Park Addition', openedNext: false, activeCount: 5, pendingCount: 0 })).not.toMatch(
      /[—–]|between \$/,
    )
    expect(
      poolCompetitionSentence({
        ownLabel: 'Park Addition',
        openedNext: false,
        activeCount: 4,
        pendingCount: 1,
        heldBack: 7,
      }),
    ).toBe(
      '4 homes like yours are for sale in Park Addition and the plats that touch it. 1 other home like yours is under contract. Seven more homes like yours were in that pool.',
    )
    expect(poolExpiredSentence({ ownLabel: 'Park Addition', openedNext: false, count: 5, heldBack: 3 })).toBe(
      'Five homes like yours in Park Addition and the plats that touch it came off the market without selling in the last 36 months. Three more homes like yours were in that pool.',
    )
  })

  it('places a home on its plat and counts whole rooms only when both are known', () => {
    expect(wholeCountGap(3, 5)).toBe(2)
    expect(wholeCountGap(3, null)).toBe(0)
    expect(bathCountGap({ baths: 2, bathsFull: 2 }, { baths: 3, bathsFull: 3 })).toBe(1)
    expect(bathCountGap({ baths: 2 }, { baths: null })).toBe(0)
    const sets = {
      ownPlat: false,
      ownSlugs: new Set(['park-addition']),
      ownNames: new Set(['park addition']),
      adjacentSlugs: new Set(['riverside']),
      adjacentNames: new Set(['riverside']),
      nextSlugs: new Set(['next-plat']),
      nextNames: new Set(['next plat']),
      openedNext: true,
    }
    expect(poolPlace({ ...sets, slug: 'park-addition' })).toBe('own')
    expect(poolPlace({ ...sets, slug: 'riverside' })).toBe('adjacent')
    expect(poolPlace({ ...sets, slug: 'next-plat' })).toBe('next')
  })
})
