import { describe, expect, it } from 'vitest'
import {
  atlasFramePad,
  childAtlasRegions,
  childZoomBounds,
  hierarchyChildIdSet,
  DEFAULT_ATLAS_FRAME_PAD,
  defaultHighlightOverlays,
  isRecordedRing,
  isSubjectGrain,
  recordedRingBounds,
  selectedChildHighlight,
  SUBJECT_FRAME_PAD,
  subjectAtlasRegions,
} from './map-hierarchy'

/** Fixture ring only — not a Central Oregon place. */
const SQUARE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
}

const CHILD = {
  type: 'Polygon',
  coordinates: [
    [
      [0.2, 0.2],
      [0.4, 0.2],
      [0.4, 0.4],
      [0.2, 0.4],
      [0.2, 0.2],
    ],
  ],
}

describe('recorded geom — never invent', () => {
  it('accepts a Polygon / MultiPolygon with coordinates', () => {
    expect(isRecordedRing(SQUARE)).toBe(true)
    expect(
      isRecordedRing({
        type: 'MultiPolygon',
        coordinates: [SQUARE.coordinates],
      }),
    ).toBe(true)
  })

  it('refuses missing, empty, or non-area geom', () => {
    expect(isRecordedRing(null)).toBe(false)
    expect(isRecordedRing({ type: 'Polygon', coordinates: [] })).toBe(false)
    expect(isRecordedRing({ type: 'LineString', coordinates: [[0, 0], [1, 1]] })).toBe(false)
    expect(isRecordedRing({ type: 'Point', coordinates: [0, 0] })).toBe(false)
  })

  it('bounds a recorded ring and refuses a collapsed one', () => {
    expect(recordedRingBounds(SQUARE)).toEqual({ minLon: 0, minLat: 0, maxLon: 1, maxLat: 1 })
    expect(
      recordedRingBounds({
        type: 'Polygon',
        coordinates: [
          [
            [2, 2],
            [2, 2],
            [2, 2],
          ],
        ],
      }),
    ).toBeNull()
  })
})

describe('subject highlight — not twenty child plats', () => {
  it('keeps only the town ring as the default Atlas highlight', () => {
    const regions = [
      { kind: 'town', name: 'Old Bend' },
      { kind: 'neighborhood', name: 'Plat A' },
      { kind: 'neighborhood', name: 'Plat B' },
    ]
    expect(subjectAtlasRegions(regions)).toEqual([{ kind: 'town', name: 'Old Bend' }])
    expect(childAtlasRegions(regions)).toHaveLength(2)
    expect(hierarchyChildIdSet([]).size).toBe(0)
    expect(hierarchyChildIdSet([{ id: 'subdivision:a' }]).has('city:bend')).toBe(false)
  })

  it('highlights nothing when the subject has no recorded geom', () => {
    const children = [{ id: 'subdivision:a', href: '/subdivisions/a', geojson: CHILD }]
    const look = defaultHighlightOverlays(null, children)
    expect(look.subject).toBeNull()
    expect(look.selected).toBeNull()
  })

  it('does not fall back to children as the place highlight', () => {
    const children = Array.from({ length: 20 }, (_, i) => ({
      id: `subdivision:${i}`,
      href: `/subdivisions/${i}`,
      geojson: CHILD,
    }))
    expect(defaultHighlightOverlays(undefined, children).selected).toBeNull()
    expect(defaultHighlightOverlays(SQUARE, children).subject).toEqual(SQUARE)
  })
})

describe('child select → that boundary fills the frame', () => {
  it('returns recorded bounds for the selected child only', () => {
    const children = [
      { id: 'subdivision:a', href: '/subdivisions/a', geojson: CHILD },
      { id: 'subdivision:b', href: '/subdivisions/b', geojson: SQUARE },
    ]
    const hit = selectedChildHighlight(children, 'subdivision:a')
    expect(hit?.id).toBe('subdivision:a')
    expect(childZoomBounds(hit!.geojson)).toEqual({
      south: 0.2,
      west: 0.2,
      north: 0.4,
      east: 0.4,
    })
  })

  it('refuses a selected child with no recorded geom', () => {
    const children = [{ id: 'subdivision:x', href: '/subdivisions/x', geojson: { type: 'Point', coordinates: [0, 0] } }]
    expect(selectedChildHighlight(children, 'subdivision:x')).toBeNull()
    expect(childZoomBounds(children[0]!.geojson)).toBeNull()
  })
})

describe('subdivision grain', () => {
  it('uses a tight frame pad so the plat fills the stage', () => {
    expect(isSubjectGrain('subdivision')).toBe(true)
    expect(isSubjectGrain('neighborhood')).toBe(false)
    expect(atlasFramePad(true)).toBe(SUBJECT_FRAME_PAD)
    expect(atlasFramePad(false)).toBe(DEFAULT_ATLAS_FRAME_PAD)
    expect(SUBJECT_FRAME_PAD).toBeLessThan(DEFAULT_ATLAS_FRAME_PAD)
  })
})
