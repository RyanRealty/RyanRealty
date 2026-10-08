/**
 * The data that decides which Atlas polygons are controls (lib/atlas/atlas-doors)
 * and where each one's full-size partner sits (lib/place/rail-fold).
 *
 * CI 2026-10-07 (lint-and-build, ci:tap-targets): on a short listing read
 * /cities/bend framed the whole region, its thirteen districts drew under
 * 44px, and Southern Crossing, Southwest Bend and Summit West, the three rail
 * rows past the fold, had no partner the gate could reach: each folded row
 * carried its own `hidden`, which nothing tied to "Show all". These tests pin
 * the invariant on the same inputs the city page builds, so it holds for
 * every place, at any frame, open or closed, whatever is selected.
 */
import { describe, expect, it } from 'vitest'
import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import { atlasDoorIndices, atlasNextDoor, atlasPlaceDoors } from '@/lib/atlas/atlas-doors'
import { hierarchyChildIdSet } from '@/lib/place/map-hierarchy'
import { subdivisionRailEntries } from '@/lib/place/place-child-stock'
import { RAIL_FOLD_AT, railDoorNames, railFold } from '@/lib/place/rail-fold'

/** ci:tap-targets' own name key (scripts/check-tap-targets.mjs `norm`). */
const gateKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\d]+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

type Place = { id: string; kind: string; name: string; href: string }

/** Bend's districts exactly as app/cities/[slug]/page.tsx makes its child regions. */
const BEND: Place[] = (bendNeighborhoodPolygons.communities as Array<{ slug: string; name?: string }>)
  .filter((c) => c.slug.startsWith('bend-'))
  .map((c) => {
    const slug = c.slug.replace(/^bend-/, '')
    return { id: `neighborhood:${slug}`, kind: 'neighborhood', name: c.name ?? slug, href: `/cities/bend/${slug}` }
  })

/** The rail the city page builds beside them (no stock rows: alphabetical, like a full read). */
const BEND_RAIL = subdivisionRailEntries({
  regions: BEND.map((p) => ({ name: p.name, href: p.href })),
  extras: [],
  rows: [],
})

function pairedDoors(drawn: readonly Place[], rail: readonly { id: string; name: string }[]) {
  return atlasPlaceDoors({
    drawn,
    paired: { childIds: hierarchyChildIdSet(drawn), railNames: railDoorNames(rail) },
    chips: [],
    chipLabel: () => '',
  })
}

describe('paired map (city, neighborhood, community): the rail row is every polygon’s partner', () => {
  it('Bend: thirteen districts, more than the fold, three of them past it', () => {
    expect(BEND).toHaveLength(13)
    expect(BEND_RAIL).toHaveLength(13)
    expect(BEND_RAIL.length).toBeGreaterThan(RAIL_FOLD_AT)
    expect(BEND_RAIL.slice(RAIL_FOLD_AT).map((r) => r.name)).toEqual([
      'Southern Crossing',
      'Southwest Bend',
      'Summit West',
    ])
  })

  it('every drawn district is a door carrying its rail row’s exact name', () => {
    const doors = pairedDoors(BEND, BEND_RAIL)
    expect(doors.size).toBe(BEND.length)
    for (const place of BEND) {
      const row = BEND_RAIL.find((r) => `neighborhood:${r.id}` === place.id)
      expect(row, place.name).toBeDefined()
      expect(doors.get(place.id)).toBe(row!.name)
      expect(gateKey(doors.get(place.id)!)).toBe(gateKey(row!.name))
    }
  })

  it('every rail row is at rest or in the one folded list, once, open or closed, whatever is selected', () => {
    const states = [false, true].flatMap((open) =>
      [null, ...BEND_RAIL.map((r) => r.id)].map((selectedId) => ({ open, selectedId })),
    )
    for (const state of states) {
      const { atRest, folded } = railFold(BEND_RAIL, state)
      expect([...atRest, ...folded].map((r) => r.id).sort()).toEqual(BEND_RAIL.map((r) => r.id).sort())
      expect(new Set([...atRest, ...folded].map((r) => r.id)).size).toBe(BEND_RAIL.length)
      // Closed, a selected row is never folded away from its polygon.
      if (!state.open && state.selectedId) expect(atRest.map((r) => r.id)).toContain(state.selectedId)
      // Open, nothing is folded away.
      if (state.open) expect(atRest.length + folded.length).toBe(BEND_RAIL.length)
    }
    const closed = railFold(BEND_RAIL, { open: false, selectedId: null })
    expect(closed.atRest).toHaveLength(RAIL_FOLD_AT)
    expect(closed.folded.map((r) => r.name)).toEqual(['Southern Crossing', 'Southwest Bend', 'Summit West'])
    const picked = railFold(BEND_RAIL, { open: false, selectedId: 'summit-west' })
    expect(picked.atRest.at(-1)?.name).toBe('Summit West')
    expect(picked.folded.map((r) => r.name)).toEqual(['Southern Crossing', 'Southwest Bend'])
  })

  it('a short rail does not fold', () => {
    const short = BEND_RAIL.slice(0, RAIL_FOLD_AT)
    expect(railFold(short, { open: false, selectedId: null })).toEqual({ atRest: short, folded: [] })
  })

  it('a phase-named plat takes the rail row’s name, not the chip label that drops the phase', () => {
    // /cities/redmond, read 2026-10-07: the rail row reads "Hearthstone Phase 1"
    // and the chip-style door label read "Hearthstone"; the gate pairs neither.
    const plats: Place[] = [
      { id: 'subdivision:hearthstone-phase-1', kind: 'subdivision', name: 'Hearthstone Phase 1', href: '/subdivisions/hearthstone-phase-1' },
      { id: 'subdivision:boulder-brook-phase-5', kind: 'subdivision', name: 'Boulder Brook Phase 5', href: '/subdivisions/boulder-brook-phase-5' },
    ]
    const rail = subdivisionRailEntries({ regions: plats, extras: [], rows: [] })
    const doors = pairedDoors(plats, rail)
    expect(doors.get('subdivision:hearthstone-phase-1')).toBe('Hearthstone Phase 1')
    expect(doors.get('subdivision:boulder-brook-phase-5')).toBe('Boulder Brook Phase 5')
  })

  it('a child the rail does not list, and a place that is not a child, are drawn but are not doors', () => {
    const listed = BEND.slice(0, 2)
    const unlisted = BEND[2]!
    const notAChild = { id: 'community:elsewhere', kind: 'community', name: 'Elsewhere', href: '/communities/elsewhere' }
    const doors = atlasPlaceDoors<{ id: string }>({
      drawn: [...listed, unlisted, notAChild],
      paired: {
        childIds: hierarchyChildIdSet([...listed, unlisted]),
        railNames: railDoorNames(subdivisionRailEntries({ regions: listed, extras: [], rows: [] })),
      },
      chips: [notAChild],
      chipLabel: () => 'Elsewhere',
    })
    expect([...doors.keys()].sort()).toEqual(listed.map((p) => p.id).sort())
  })

  it('a paired map handed no rail names has no doors, never unnamed ones', () => {
    const doors = atlasPlaceDoors({
      drawn: BEND,
      paired: { childIds: hierarchyChildIdSet(BEND), railNames: {} },
      chips: [],
      chipLabel: () => 'x',
    })
    expect(doors.size).toBe(0)
  })
})

describe('unpaired map (homepage, about, type pages): the chip is every polygon’s partner', () => {
  const places = BEND.slice(0, 4)
  const label = (p: { id: string }) => places.find((x) => x.id === p.id)?.name ?? ''

  it('a polygon is a door only when it has a chip, named as the chip prints it', () => {
    const doors = atlasPlaceDoors({ drawn: places, chips: places.slice(0, 3), chipLabel: label })
    expect([...doors.entries()]).toEqual(places.slice(0, 3).map((p) => [p.id, p.name]))
  })

  it('a short read prints no chips, so no polygon is a door', () => {
    expect(atlasPlaceDoors({ drawn: places, chips: [], chipLabel: label }).size).toBe(0)
  })

  it('a chip with no printable name makes no door', () => {
    const doors = atlasPlaceDoors({ drawn: places, chips: places, chipLabel: (p) => (p.id === places[0]!.id ? ' ' : label(p)) })
    expect(doors.has(places[0]!.id)).toBe(false)
    expect(doors.size).toBe(3)
  })
})

describe('the one tab stop walks doors only', () => {
  const drawn = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
  const doors = new Map([
    ['a', 'A'],
    ['c', 'C'],
    ['d', 'D'],
  ])
  const at = atlasDoorIndices(drawn, doors)

  it('lists the paint indices that are doors', () => {
    expect(at).toEqual([0, 2, 3])
  })

  it('arrows skip a drawn non-door and wrap; Home and End land on doors', () => {
    expect(atlasNextDoor(at, 0, 'next')).toBe(2)
    expect(atlasNextDoor(at, 3, 'next')).toBe(0)
    expect(atlasNextDoor(at, 0, 'prev')).toBe(3)
    expect(atlasNextDoor(at, 2, 'prev')).toBe(0)
    expect(atlasNextDoor(at, 2, 'first')).toBe(0)
    expect(atlasNextDoor(at, 0, 'last')).toBe(3)
    expect(atlasNextDoor([], 0, 'next')).toBe(-1)
  })
})
