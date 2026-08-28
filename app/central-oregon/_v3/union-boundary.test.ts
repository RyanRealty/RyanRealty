import { describe, expect, it } from 'vitest'
import { unionBoundaryGeometry } from './union-boundary'

const bend: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-121.4, 44.0],
      [-121.2, 44.0],
      [-121.2, 44.1],
      [-121.4, 44.1],
      [-121.4, 44.0],
    ],
  ],
}

const redmond: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-121.2, 44.2],
      [-121.1, 44.2],
      [-121.1, 44.3],
      [-121.2, 44.3],
      [-121.2, 44.2],
    ],
  ],
}

describe('unionBoundaryGeometry', () => {
  it('returns null when nothing arrived', () => {
    expect(unionBoundaryGeometry([])).toBeNull()
    expect(unionBoundaryGeometry([null, undefined])).toBeNull()
  })

  it('keeps a single polygon as a polygon', () => {
    expect(unionBoundaryGeometry([bend])).toEqual(bend)
  })

  it('concatenates two city polygons into a MultiPolygon', () => {
    expect(unionBoundaryGeometry([bend, redmond])).toEqual({
      type: 'MultiPolygon',
      coordinates: [bend.coordinates, redmond.coordinates],
    })
  })
})
