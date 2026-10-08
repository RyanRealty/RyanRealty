/**
 * THE ONE GROUND DECISION (reader review 2026-10-08, lib/pricing/plat-ground.ts).
 *
 * The cases are the reader's: 1355 Jacksonville (one recorded plat, two MLS
 * spellings), 915 Saginaw (an area plat and its addition), 2382 Jackson
 * (Holliday Park and its additions), and the namesakes across town that a
 * family by name alone would pull in. Coordinates are the homes' own MLS
 * points, read 2026-10-08; plats are the polygons public.boundaries puts them
 * in (geo_assign_batch / ST_Contains, same day).
 */
import { describe, expect, it } from 'vitest'
import { samePlat, sameSubdivisionFamily } from '@/lib/pricing/price-anchor'
import {
  onPlatGround,
  parentOf,
  platGround,
  platGroundReach,
  platReach,
  relatedPlats,
  subdivisionScopeTrace,
  subjectPlatGround,
} from '@/lib/pricing/plat-ground'

const JACKSONVILLE = { latitude: 44.058868, longitude: -121.331289 }
const MILWAUKEE_1367 = { latitude: 44.061276, longitude: -121.331492 }
const SAGINAW_915 = { latitude: 44.06569, longitude: -121.32545 }
const SAGINAW_733 = { latitude: 44.065697, longitude: -121.322645 }
const TRENTON_1340 = { latitude: 44.06695, longitude: -121.331249 }
// Plat centroids (ST_Centroid over public.boundaries, 2026-10-08).
const NW_TOWNSITE_FIRST = { latitude: 44.05321, longitude: -121.29633 }
const PARK_PLACE_PHASE_I = { latitude: 44.02324, longitude: -121.32792 }
const HALL_2020 = { latitude: 44.0764, longitude: -121.273521 }
const JACKSON_2382 = { latitude: 44.075079, longitude: -121.268868 }

describe('the subject ground: one recorded plat, every MLS spelling (1355 Jacksonville)', () => {
  const ground = subjectPlatGround({
    subdivision: 'Northwest Townsite',
    subdivisionSlug: 'northwest-townsite-second-addition',
    city: 'Bend',
    ...JACKSONVILLE,
  })

  it('sits in River West, the parent wall a family member must share', () => {
    expect(ground.parent).toBe('bend-river-west')
    expect(ground.platSlugs).toEqual(['northwest-townsite-second-addition'])
  })

  it('1367 Milwaukee is on the ground: same polygon, "Co 2nd Addt" spelling', () => {
    expect(
      platGroundReach(ground, {
        platSlug: 'northwest-townsite-second-addition',
        subdivision: 'Northwest Townsite Co 2nd Addt',
        ...MILWAUKEE_1367,
      }),
    ).toBe('plat')
  })

  it('a row named "Northwest Townsite" in another subdivision\'s polygon is not: the polygon decides', () => {
    expect(onPlatGround(ground, { platSlug: 'bonne-home', subdivision: 'Northwest Townsite', ...JACKSONVILLE })).toBe(false)
  })

  it('a row no polygon holds is read by its MLS name, and only that name', () => {
    expect(platGroundReach(ground, { platSlug: null, subdivision: 'Northwest Townsite' })).toBe('name')
    expect(platGroundReach(ground, { platSlug: undefined, subdivision: 'northwest townsite' })).toBe('name')
    expect(platGroundReach(ground, { platSlug: null, subdivision: 'Northwest Townsite Co 2nd Addt' })).toBeNull()
  })

  it('Northwest Townsite First Addition is family by name, and in Larkspur, so it is not this ground', () => {
    expect(parentOf(NW_TOWNSITE_FIRST.latitude, NW_TOWNSITE_FIRST.longitude)).toBe('bend-larkspur')
    expect(
      platGroundReach(ground, { platSlug: 'northwest-townsite-first-addition', subdivision: 'Northwest Townsite Co 1st Addt', ...NW_TOWNSITE_FIRST }),
    ).toBeNull()
  })

  it('names its scope for the source line', () => {
    expect(subdivisionScopeTrace('Northwest Townsite', ground)).toBe(
      "inside the recorded plat northwest-townsite-second-addition under any MLS spelling, or plats of its subdivision family inside bend-river-west, or SubdivisionName='Northwest Townsite' where no polygon holds the row",
    )
  })
})

describe('an area ground: plats and their additions inside the parent (915 Saginaw)', () => {
  const area = platGround({
    platSlugs: ['park-place', 'miller-heights-phase-ii', 'kenwood', 'west-hills-fifth-addition', 'bend-view-addition'],
    parent: parentOf(SAGINAW_915.latitude, SAGINAW_915.longitude),
  })

  it('733 Saginaw (MLS "Kenwood", recorded Kenwood First Addition) is family of Kenwood', () => {
    expect(platReach(area, 'kenwood-first-addition', SAGINAW_733)).toBe('family')
  })

  it('1340 Trenton (recorded West Hills) is family of West Hills Fifth Addition', () => {
    expect(platReach(area, 'west-hills', TRENTON_1340)).toBe('family')
  })

  it('Park Place Phase I is Park Place by name and sits in Southwest Bend, so it is not', () => {
    expect(parentOf(PARK_PLACE_PHASE_I.latitude, PARK_PLACE_PHASE_I.longitude)).toBe('bend-southwest-bend')
    expect(platReach(area, 'park-place-phase-i', PARK_PLACE_PHASE_I)).toBeNull()
  })

  it('a family member with no point to test is not admitted inside a parent wall', () => {
    expect(platReach(area, 'kenwood-first-addition')).toBeNull()
  })

  it('a different subdivision is never family (Kenwood Gardens is not Kenwood)', () => {
    expect(platReach(area, 'kenwood-gardens', SAGINAW_733)).toBeNull()
  })
})

describe('phases and additions (2382 Jackson, Holliday Park)', () => {
  const ground = platGround({
    platSlugs: ['holliday-park-third-addition-phase-iii'],
    parent: parentOf(JACKSON_2382.latitude, JACKSON_2382.longitude),
  })

  it('a phase of the same ordinary subdivision is the plat itself, wherever it sits', () => {
    expect(platReach(ground, 'holliday-park-third-addition-phase-i')).toBe('plat')
  })

  it('2020 Hall, in the Holliday Park base plat, is family inside Mountain View', () => {
    expect(ground.parent).toBe('bend-mountain-view')
    expect(platReach(ground, 'holliday-park', HALL_2020)).toBe('family')
  })
})

describe('the reviewed alias map files sibling plats under one MLS name', () => {
  it('a Sunrise Village plat brings its siblings and its MLS name', () => {
    const g = platGround({ platSlugs: ['sunrise-village-outback'], city: 'Bend' })
    expect(g.platSlugs).toEqual(expect.arrayContaining(['sunrise-village-river-bluff', 'sunrise-village-east-knoll-section']))
    expect(g.names).toContain('sunrise village')
    expect(platReach(g, 'sunrise-village-west-knoll-section')).toBe('plat')
  })

  it('an alias name in another town is not expanded', () => {
    expect(platGround({ names: ['Sunrise Village'], city: 'Redmond' }).platSlugs).toEqual([])
    expect(platGround({ names: ['Sunrise Village'], city: 'Bend' }).platSlugs.length).toBeGreaterThan(1)
  })
})

describe('a ground with no recorded plat decides by name, as every read did before', () => {
  const g = platGround({ names: ['Diamond Bar Ranch'], city: 'Redmond' })
  it('a row inside some polygon still counts by name', () => {
    expect(platGroundReach(g, { platSlug: 'diamond-bar-ranch-phase-2', subdivision: 'Diamond Bar Ranch' })).toBe('name')
    expect(onPlatGround(g, { platSlug: 'x', subdivision: 'Other' })).toBe(false)
  })
})

describe('the precomputed matcher is the pairwise tests, exactly', () => {
  const slugs = [
    'kenwood',
    'kenwood-first-addition',
    'kenwood-gardens',
    'west-hills',
    'west-hills-fifth-addition',
    'holliday-park',
    'holliday-park-third-addition-phase-i',
    'holliday-park-third-addition-phase-iii',
    'northwest-townsite-second-addition',
    'northwest-townsite-first-addition',
    'park-place',
    'park-place-phase-i',
    'park-place-phase-ii',
    'tetherow-phase-1',
    'tetherow-phase-2',
    'bend-golf-club-addition',
    'bend-golf-club-2nd-addition',
    'ridge-at-eagle-crest-36',
    'ridge-at-eagle-crest-37',
  ]
  it('plat is samePlat; family is sameSubdivisionFamily and not samePlat; otherwise none', () => {
    for (const a of slugs) {
      // No parent: the family test reads no point.
      const g = { platSlugs: [a], names: [], unplattedNames: [], parent: null }
      for (const b of slugs) {
        const expected = samePlat({ subdivisionSlug: a }, { subdivisionSlug: b })
          ? 'plat'
          : sameSubdivisionFamily(a, b)
            ? 'family'
            : null
        expect([a, b, platReach(g, b)]).toEqual([a, b, expected])
      }
    }
  })

  it('relatedPlats splits a list the same way', () => {
    const g = platGround({ platSlugs: ['kenwood'] })
    expect(relatedPlats(g, ['kenwood', 'kenwood-first-addition', 'kenwood-gardens', 'west-hills'])).toEqual({
      plat: ['kenwood'],
      family: ['kenwood-first-addition'],
    })
  })
})
