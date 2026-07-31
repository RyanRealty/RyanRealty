import { describe, expect, it } from 'vitest'
import {
  areaCountLabel,
  drawnShapesForArea,
  includeShapeCount,
  matchActiveArea,
  shapeSetSignature,
  type PickerArea,
} from '@/components/search/area-picker'
import { decodeMapShapes, encodeMapShapes, type DrawnShape } from '@/lib/map-polygon'
import type { AreaShape } from '@/lib/data/areas/validation'

/**
 * The in-map named-area picker's contract: a saved area must become the exact
 * same value a hand-drawn shape produces, so it rides `?shapes=` with no
 * special case, and the live map state must equal what the shared URL carries.
 */

const WEST_SIDE: AreaShape[] = [
  {
    type: 'polygon',
    coords: [
      [-121.35, 44.05],
      [-121.3, 44.05],
      [-121.3, 44.1],
      [-121.35, 44.1],
    ],
  },
]

const area = (over: Partial<PickerArea> = {}): PickerArea => ({
  id: 'area-1',
  name: 'Bend west side',
  slug: null,
  shapes: WEST_SIDE,
  scope: 'mine',
  ...over,
})

describe('shapeSetSignature', () => {
  it('is null for an empty or missing set', () => {
    expect(shapeSetSignature([])).toBeNull()
    expect(shapeSetSignature(null)).toBeNull()
    expect(shapeSetSignature(undefined)).toBeNull()
  })

  it('is the ?shapes= encoding, so two equal sets share one signature', () => {
    const drawn = drawnShapesForArea(area())
    expect(shapeSetSignature(drawn)).toBe(encodeMapShapes(drawn))
    expect(shapeSetSignature(drawn)).toBe(shapeSetSignature(drawnShapesForArea(area({ id: 'other' }))))
  })
})

describe('drawnShapesForArea', () => {
  it('converts stored [lng,lat] tuples into map {lat,lng} points', () => {
    const [shape] = drawnShapesForArea(area())
    expect(shape.type).toBe('polygon')
    if (shape.type !== 'polygon') throw new Error('expected polygon')
    expect(shape.points[0]).toEqual({ lat: 44.05, lng: -121.35 })
    expect(shape.exclude).toBe(false)
  })

  it('stamps the area name on every shape so the map pills read it', () => {
    const drawn = drawnShapesForArea(
      area({
        shapes: [
          ...WEST_SIDE,
          { type: 'circle', center: [-121.31, 44.06], radius_m: 1609, exclude: true },
        ],
      }),
    )
    expect(drawn).toHaveLength(2)
    expect(drawn.every((s) => s.name === 'Bend west side')).toBe(true)
    expect(drawn[1].exclude).toBe(true)
  })

  it('carries circle radius through in meters', () => {
    const drawn = drawnShapesForArea(
      area({ shapes: [{ type: 'circle', center: [-121.31, 44.06], radius_m: 4828 }] }),
    )
    const [shape] = drawn
    if (shape.type !== 'circle') throw new Error('expected circle')
    expect(shape.radiusM).toBe(4828)
    expect(shape.center).toEqual({ lat: 44.06, lng: -121.31 })
  })

  it('returns nothing for an all-exclude area rather than searching everything', () => {
    expect(
      drawnShapesForArea(area({ shapes: [{ ...WEST_SIDE[0], exclude: true } as AreaShape] })),
    ).toEqual([])
  })

  it('returns nothing for an empty shape list', () => {
    expect(drawnShapesForArea(area({ shapes: [] }))).toEqual([])
  })

  it('round-trips through the URL grammar, so map state equals the shared link', () => {
    const drawn = drawnShapesForArea(area())
    const encoded = encodeMapShapes(drawn)
    expect(encoded).toBeTruthy()
    const decoded = decodeMapShapes(encoded)
    expect(decoded).not.toBeNull()
    // Names never ride the URL, everything spatial does.
    expect(decoded?.map((s) => ({ ...s, name: 'Bend west side' }))).toEqual(drawn)
  })

  it('simplifies a polygon denser than the URL grammar can carry', () => {
    // 120 vertices around a circle. The URL keeps at most 80 (MAX_POINTS), so
    // applying must ALSO keep 80 or the live search and the shared link would
    // describe two different polygons.
    const coords = Array.from({ length: 120 }, (_, i) => {
      const t = (i / 120) * Math.PI * 2
      return [
        Number((-121.3 + Math.cos(t) * 0.05).toFixed(6)),
        Number((44.05 + Math.sin(t) * 0.05).toFixed(6)),
      ] as [number, number]
    })
    const drawn = drawnShapesForArea(area({ shapes: [{ type: 'polygon', coords }] }))
    const [shape] = drawn
    if (shape.type !== 'polygon') throw new Error('expected polygon')
    expect(shape.points).toHaveLength(80)
    expect(shapeSetSignature(drawn)).toBe(encodeMapShapes(drawn))
  })
})

describe('matchActiveArea', () => {
  const areas = [
    area(),
    area({
      id: 'area-2',
      name: 'Old Bend',
      shapes: [
        {
          type: 'polygon',
          coords: [
            [-121.32, 44.04],
            [-121.31, 44.04],
            [-121.31, 44.05],
          ],
        },
      ],
    }),
  ]

  it('finds the area currently on the map', () => {
    expect(matchActiveArea(areas, drawnShapesForArea(areas[0]))?.id).toBe('area-1')
    expect(matchActiveArea(areas, drawnShapesForArea(areas[1]))?.id).toBe('area-2')
  })

  it('still resolves after a reload, when shapes came back through ?shapes=', () => {
    const encoded = encodeMapShapes(drawnShapesForArea(areas[0]))
    const fromUrl = decodeMapShapes(encoded)
    expect(matchActiveArea(areas, fromUrl)?.name).toBe('Bend west side')
  })

  it('is null for a hand-drawn shape that matches no saved area', () => {
    const handDrawn: DrawnShape[] = [
      {
        type: 'polygon',
        points: [
          { lat: 43.9, lng: -121.9 },
          { lat: 43.95, lng: -121.9 },
          { lat: 43.95, lng: -121.8 },
        ],
        exclude: false,
      },
    ]
    expect(matchActiveArea(areas, handDrawn)).toBeNull()
  })

  it('is null on an empty map', () => {
    expect(matchActiveArea(areas, [])).toBeNull()
    expect(matchActiveArea([], drawnShapesForArea(areas[0]))).toBeNull()
  })
})

describe('includeShapeCount + areaCountLabel', () => {
  it('counts include shapes only', () => {
    const shapes = drawnShapesForArea(
      area({
        shapes: [
          ...WEST_SIDE,
          { type: 'circle', center: [-121.31, 44.06], radius_m: 800, exclude: true },
        ],
      }),
    )
    expect(shapes).toHaveLength(2)
    expect(includeShapeCount(shapes)).toBe(1)
    expect(includeShapeCount([])).toBe(0)
    expect(includeShapeCount(null)).toBe(0)
  })

  it('pluralizes', () => {
    expect(areaCountLabel(1)).toBe('1 area')
    expect(areaCountLabel(3)).toBe('3 areas')
    expect(areaCountLabel(0)).toBe('0 areas')
  })
})
