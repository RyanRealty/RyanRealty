import { describe, expect, it } from 'vitest'
import { areaSearchHref, areaShapesToDrawnShapes } from './area-link'
import { decodeMapShapes, buildShapeSetForSearch } from '@/lib/map-polygon'
import type { AreaShape } from '@/lib/data/areas/validation'

const AREA_SHAPES: AreaShape[] = [
  { type: 'polygon', coords: [[-121.40, 44.00], [-121.25, 44.00], [-121.25, 44.12], [-121.40, 44.12]] },
  { type: 'circle', center: [-121.3153, 44.0582], radius_m: 2000, exclude: true },
]

describe('areaSearchHref', () => {
  it('round-trips through the canonical ?shapes= grammar to the same server shape set', () => {
    const href = areaSearchHref(AREA_SHAPES)!
    expect(href.startsWith('/homes-for-sale?shapes=')).toBe(true)
    const encoded = new URLSearchParams(href.split('?')[1]).get('shapes')
    const decoded = decodeMapShapes(encoded)
    expect(decoded).not.toBeNull()
    const set = buildShapeSetForSearch(decoded)
    // Same set algebra the area itself resolves to: box include, circle exclude.
    expect(set?.include).toEqual([
      { type: 'polygon', coords: AREA_SHAPES[0]!.type === 'polygon' ? AREA_SHAPES[0].coords : [] },
    ])
    expect(set?.exclude).toEqual([
      { type: 'circle', center: [-121.3153, 44.0582], radius_m: 2000 },
    ])
  })

  it('returns null when the area has no include shape (never a whole-feed link)', () => {
    expect(areaSearchHref([{ ...AREA_SHAPES[1]! }])).toBeNull()
    expect(areaSearchHref([])).toBeNull()
  })

  it('converts [lng,lat] tuples to {lat,lng} points with exclude flags', () => {
    const drawn = areaShapesToDrawnShapes(AREA_SHAPES)
    expect(drawn[0]).toMatchObject({ type: 'polygon', exclude: false })
    expect(drawn[0]!.type === 'polygon' && drawn[0]!.points[0]).toEqual({ lat: 44.0, lng: -121.4 })
    expect(drawn[1]).toMatchObject({ type: 'circle', exclude: true, radiusM: 2000 })
  })
})
