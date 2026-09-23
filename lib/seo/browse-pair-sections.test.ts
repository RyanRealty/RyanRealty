/**
 * The two bodies the shared browse-pair decision drives on the search route
 * (visibility audit 2026-09-22): the SEO-1 refusal's plat door and the EXP-2
 * sold-history section. Pure models, so what each page says is pinned without
 * rendering React.
 */
import { describe, expect, it } from 'vitest'
import { areaSoldHistoryModel } from '@/app/search/[...slug]/sections/AreaSoldHistory'
import {
  refusalPlatDoor,
  searchAreaUnavailableBody,
  searchAreaUnavailableHeading,
} from '@/app/search/[...slug]/sections/AreaUnavailable'
import { decideBrowsePair, type BrowsePairFacts } from './browse-pair-decision'

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

function model(f: BrowsePairFacts) {
  return areaSoldHistoryModel({ decision: decideBrowsePair(f), facts: f, city: 'Bend', pagePath: `/homes-for-sale/bend/${f.areaSlug}` })
}

describe('EXP-2: no submitted pair is a one-line page', () => {
  it('a sold-history pair with nothing for sale gets its closed count, named, with its source row', () => {
    const m = model(facts({ inventory: { mlsName: 'Cambria', closedLifetime: 22, activeNow: 0 } }))
    expect(m).toEqual({ name: 'Cambria', city: 'Bend', closed: 22, filedAs: 'Cambria', plat: null, pagePath: '/homes-for-sale/bend/cambria' })
  })

  it('links the recorded plat when one exists for the slug', () => {
    const m = model(
      facts({
        areaSlug: 'awbrey-terrace',
        inventory: { mlsName: 'Awbrey Terrace', closedLifetime: 6, activeNow: 0 },
        cityPlat: { slug: 'awbrey-terrace', label: 'Awbrey Terrace' },
      }),
    )
    expect(m?.plat).toEqual({ label: 'Awbrey Terrace', href: '/subdivisions/awbrey-terrace' })
  })

  it('never opens a door to a plat of the same words in another city', () => {
    const m = model(
      facts({ areaSlug: 'north-rim', inventory: { mlsName: 'North Rim', closedLifetime: 25, activeNow: 0 }, platLabel: 'North Rim', cityPlat: null }),
    )
    expect(m?.closed).toBe(25)
    expect(m?.plat).toBeNull()
  })

  it('links the plat across a word break, at the slug the county recorded', () => {
    const m = model(
      facts({
        areaSlug: 'deschutes-riverwoods',
        inventory: { mlsName: 'Deschutes RiverWoods', closedLifetime: 3046, activeNow: 16 },
        platIndexable: true,
        cityPlat: { slug: 'deschutes-river-woods', label: 'Deschutes River Woods' },
      }),
    )
    expect(m?.plat).toEqual({ label: 'Deschutes River Woods', href: '/subdivisions/deschutes-river-woods' })
    expect(m?.filedAs).toBe('Deschutes RiverWoods')
  })

  it('never says the MLS filed sales under a plat name it did not use (an MLS code named by its plat)', () => {
    const m = model(
      facts({
        areaSlug: 'aspenb',
        inventory: { mlsName: 'AspenB', closedLifetime: 40, activeNow: 0 },
        platIndexable: true,
        cityPlat: { slug: 'aspenb', label: 'Aspen Rim' },
      }),
    )
    expect(m?.name).toBe('Aspen Rim')
    expect(m?.filedAs).toBeNull()
  })

  it('says nothing it cannot name: no section for an MLS code, an unresolved area, or an unknown read', () => {
    expect(model(facts({ areaSlug: 'aspenb', inventory: { mlsName: 'AspenB', closedLifetime: 40, activeNow: 0 } }))).toBeNull()
    expect(model(facts({ areaSlug: 'nowhere-9' }))).toBeNull()
    expect(model(facts({ areaSlug: 'maybe', inventoryKnown: false }))).toBeNull()
  })

  it('every EMITTED pair renders the section (the emit floor guarantees a closed count)', () => {
    for (const closedLifetime of [10, 11, 250]) {
      const f = facts({ inventory: { mlsName: 'Cambria', closedLifetime, activeNow: 0 } })
      expect(decideBrowsePair(f).emit).toBe(true)
      expect(model(f)?.closed).toBe(closedLifetime)
    }
  })
})

describe('SEO-1 refusal: a recorded plat the MLS never files under still gets its door', () => {
  it('offers the plat page when the refused slug is a printable plat', () => {
    expect(refusalPlatDoor({ areaSlug: 'tennis-tracts-at-broken-top', platLabel: 'Tennis Tracts At Broken Top' })).toEqual({
      label: 'Tennis Tracts at Broken Top',
      href: '/subdivisions/tennis-tracts-at-broken-top',
    })
    expect(refusalPlatDoor({ areaSlug: 'p1-no-such-place', platLabel: null })).toBeNull()
    expect(refusalPlatDoor(null)).toBeNull()
  })
})

describe('SEO-1 refusal copy claims only what was read', () => {
  it('a service-area city: no listing under this name in that city (not a claim about Central Oregon)', () => {
    const body = searchAreaUnavailableBody('Redmond', false)
    expect(body).toContain('no listing under this name in Redmond')
    expect(body).not.toMatch(/Central Oregon is recorded|Nothing in Central Oregon/)
  })

  it('any other first segment: only homes for sale were checked, and no city is printed', () => {
    const body = searchAreaUnavailableBody(null, false)
    expect(body).toMatch(/^No home is for sale under this name here/)
    expect(searchAreaUnavailableBody(null, true)).toMatch(/Its recorded plat is below\.$/)
  })

  it('a plat slug is a real place: the heading names it instead of "no area"', () => {
    expect(searchAreaUnavailableHeading({ label: 'South Bend Vacation Plat' })).toBe('South Bend Vacation Plat has its own page')
    expect(searchAreaUnavailableHeading(null)).toBe('No area at this address')
  })
})
