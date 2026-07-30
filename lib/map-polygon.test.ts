import { describe, it, expect } from 'vitest'
import {
  isPointInPolygon,
  isInsideAnyRing,
  getPolygonBounds,
  encodeMapPolygon,
  decodeMapPolygon,
  encodeMapShapes,
  decodeMapShapes,
  buildShapeSetForSearch,
  MAX_SHAPES,
  type DrawnShape,
  type MapPolygonPoint,
} from './map-polygon'

// A unit square (lng 0..1, lat 0..1).
const SQUARE: MapPolygonPoint[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 1, lng: 1 },
  { lat: 1, lng: 0 },
]

// A second, disjoint square (lng 10..11, lat 10..11) — for the MultiPolygon case.
const FAR_SQUARE: MapPolygonPoint[] = [
  { lat: 10, lng: 10 },
  { lat: 10, lng: 11 },
  { lat: 11, lng: 11 },
  { lat: 11, lng: 10 },
]

describe('isPointInPolygon', () => {
  it('returns true for a point inside the polygon', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, SQUARE)).toBe(true)
  })
  it('returns false for a point outside the polygon', () => {
    expect(isPointInPolygon({ lat: 5, lng: 5 }, SQUARE)).toBe(false)
  })
  it('returns false for a degenerate polygon (< 3 points)', () => {
    expect(isPointInPolygon({ lat: 0.5, lng: 0.5 }, [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }])).toBe(false)
  })
})

describe('isInsideAnyRing (pin clipping)', () => {
  it('shows all pins when there is no boundary (empty rings)', () => {
    expect(isInsideAnyRing({ lat: 999, lng: 999 }, [])).toBe(true)
  })
  it('keeps a pin inside the single ring', () => {
    expect(isInsideAnyRing({ lat: 0.25, lng: 0.75 }, [SQUARE])).toBe(true)
  })
  it('drops a pin outside the single ring (the "homes outside the polygon" bug)', () => {
    expect(isInsideAnyRing({ lat: 5, lng: 5 }, [SQUARE])).toBe(false)
  })
  it('keeps a pin inside the second ring of a MultiPolygon', () => {
    expect(isInsideAnyRing({ lat: 10.5, lng: 10.5 }, [SQUARE, FAR_SQUARE])).toBe(true)
  })
  it('drops a pin that is outside every ring of a MultiPolygon', () => {
    expect(isInsideAnyRing({ lat: 5, lng: 5 }, [SQUARE, FAR_SQUARE])).toBe(false)
  })

  it('clips a realistic pin set down to only the in-boundary homes', () => {
    const pins = [
      { lat: 0.1, lng: 0.1 }, // in
      { lat: 0.9, lng: 0.9 }, // in
      { lat: 2.0, lng: 2.0 }, // out
      { lat: -1.0, lng: 0.5 }, // out
    ]
    const clipped = pins.filter((p) => isInsideAnyRing(p, [SQUARE]))
    expect(clipped).toHaveLength(2)
    expect(clipped).toEqual([
      { lat: 0.1, lng: 0.1 },
      { lat: 0.9, lng: 0.9 },
    ])
  })
})

describe('getPolygonBounds', () => {
  it('computes the bounding box of a ring', () => {
    expect(getPolygonBounds(SQUARE)).toEqual({ west: 0, south: 0, east: 1, north: 1 })
  })
})

// ── ?shapes= URL codec (Phase 2 multi-shape draw) ───────────────────────────

const POLY_SHAPE: DrawnShape = {
  type: 'polygon',
  points: [
    { lat: 44.05, lng: -121.3 },
    { lat: 44.06, lng: -121.31 },
    { lat: 44.04, lng: -121.32 },
  ],
  exclude: false,
}

const CIRCLE_SHAPE: DrawnShape = {
  type: 'circle',
  center: { lat: 44.1, lng: -121.25 },
  radiusM: 1609,
  exclude: false,
}

describe('encodeMapShapes / decodeMapShapes round-trip', () => {
  it('round-trips a mixed set of polygons + circles with exclude flags', () => {
    const shapes: DrawnShape[] = [
      POLY_SHAPE,
      { ...CIRCLE_SHAPE, exclude: true },
      {
        type: 'polygon',
        points: [
          { lat: 44.2, lng: -121.4 },
          { lat: 44.21, lng: -121.4 },
          { lat: 44.21, lng: -121.39 },
          { lat: 44.2, lng: -121.39 },
        ],
        exclude: true,
      },
    ]
    const encoded = encodeMapShapes(shapes)
    expect(encoded).toBeTruthy()
    const decoded = decodeMapShapes(encoded)
    expect(decoded).toEqual(shapes)
  })

  it('round-trips a single include circle', () => {
    const decoded = decodeMapShapes(encodeMapShapes([CIRCLE_SHAPE]))
    expect(decoded).toEqual([CIRCLE_SHAPE])
  })

  it('encodes the documented wire format', () => {
    expect(encodeMapShapes([POLY_SHAPE, { ...CIRCLE_SHAPE, exclude: true }])).toBe(
      'p;44.05,-121.3;44.06,-121.31;44.04,-121.32*xc;44.1,-121.25;1609'
    )
  })

  it('rounds coords to 6 decimals and radius to integer meters', () => {
    const decoded = decodeMapShapes(
      encodeMapShapes([
        {
          type: 'circle',
          center: { lat: 44.123456789, lng: -121.987654321 },
          radiusM: 803.7,
          exclude: false,
        },
      ])
    )
    expect(decoded).toEqual([
      { type: 'circle', center: { lat: 44.123457, lng: -121.987654 }, radiusM: 804, exclude: false },
    ])
  })

  it('returns undefined for an empty or all-degenerate set', () => {
    expect(encodeMapShapes([])).toBeUndefined()
    expect(
      encodeMapShapes([{ type: 'polygon', points: [{ lat: 0, lng: 0 }], exclude: false }])
    ).toBeUndefined()
  })

  it('decodes null/empty/whitespace to null', () => {
    expect(decodeMapShapes(null)).toBeNull()
    expect(decodeMapShapes(undefined)).toBeNull()
    expect(decodeMapShapes('')).toBeNull()
    expect(decodeMapShapes('   ')).toBeNull()
  })

  it('STRICTLY rejects malformed input (whole set → null, no silent widening)', () => {
    expect(decodeMapShapes('z;1,2;3,4;5,6')).toBeNull() // unknown tag
    expect(decodeMapShapes('p;1,2;3,4')).toBeNull() // polygon under 3 points
    expect(decodeMapShapes('p;1,2;3,4;junk')).toBeNull() // non-numeric point
    expect(decodeMapShapes('p;91,0;0,1;1,1')).toBeNull() // lat out of range
    expect(decodeMapShapes('p;0,181;0,1;1,1')).toBeNull() // lng out of range
    expect(decodeMapShapes('c;44.1,-121.25')).toBeNull() // circle missing radius
    expect(decodeMapShapes('c;44.1,-121.25;0')).toBeNull() // zero radius
    expect(decodeMapShapes('c;44.1,-121.25;-5')).toBeNull() // negative radius
    expect(decodeMapShapes('c;44.1,-121.25;12.5')).toBeNull() // fractional radius
    expect(decodeMapShapes('c;44.1,-121.25;200001')).toBeNull() // over the 200 km cap
    // One bad shape poisons the whole set — a dropped EXCLUDE would return
    // homes the user explicitly carved out.
    const good = encodeMapShapes([POLY_SHAPE])
    expect(decodeMapShapes(`${good}*z;bad`)).toBeNull()
  })

  it('rejects a set over the MAX_SHAPES cap', () => {
    const many = Array.from({ length: MAX_SHAPES + 1 }, () => 'c;44.1,-121.25;100').join('*')
    expect(decodeMapShapes(many)).toBeNull()
  })

  it('legacy ?poly= codec still round-trips (read-forever contract)', () => {
    const encoded = encodeMapPolygon(POLY_SHAPE.points)
    expect(encoded).toBeTruthy()
    expect(decodeMapPolygon(encoded)).toEqual(POLY_SHAPE.points)
    expect(decodeMapPolygon('junk')).toBeNull()
    expect(decodeMapPolygon(null)).toBeNull()
  })
})

describe('buildShapeSetForSearch (UI shapes → PostGIS contract)', () => {
  const BOUNDS = { west: -121.5, south: 44.0, east: -121.0, north: 44.3 }

  it('maps include/exclude shapes to [lng,lat] server order', () => {
    const set = buildShapeSetForSearch([POLY_SHAPE, { ...CIRCLE_SHAPE, exclude: true }], BOUNDS)
    expect(set).toEqual({
      include: [
        {
          type: 'polygon',
          coords: [
            [-121.3, 44.05],
            [-121.31, 44.06],
            [-121.32, 44.04],
          ],
        },
      ],
      exclude: [{ type: 'circle', center: [-121.25, 44.1], radius_m: 1609 }],
    })
  })

  it('omits the exclude key when nothing is excluded', () => {
    const set = buildShapeSetForSearch([CIRCLE_SHAPE], BOUNDS)
    expect(set).toEqual({ include: [{ type: 'circle', center: [-121.25, 44.1], radius_m: 1609 }] })
  })

  it('synthesizes the viewport bbox as the include ring for an exclude-only set', () => {
    const set = buildShapeSetForSearch([{ ...CIRCLE_SHAPE, exclude: true }], BOUNDS)
    expect(set?.include).toEqual([
      {
        type: 'polygon',
        coords: [
          [-121.5, 44.0],
          [-121.0, 44.0],
          [-121.0, 44.3],
          [-121.5, 44.3],
          [-121.5, 44.0],
        ],
      },
    ])
    expect(set?.exclude).toEqual([{ type: 'circle', center: [-121.25, 44.1], radius_m: 1609 }])
  })

  it('returns null for empty input or an exclude-only set without viewport bounds', () => {
    expect(buildShapeSetForSearch([], BOUNDS)).toBeNull()
    expect(buildShapeSetForSearch(null, BOUNDS)).toBeNull()
    expect(buildShapeSetForSearch([{ ...CIRCLE_SHAPE, exclude: true }], null)).toBeNull()
  })
})
