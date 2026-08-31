import { describe, expect, it } from 'vitest'
import { geojsonToPaths } from './geojson-paths'

describe('geojsonToPaths', () => {
  it('maps a polygon ring from lng/lat to lat/lng', () => {
    const paths = geojsonToPaths({
      type: 'Polygon',
      coordinates: [
        [
          [-121.32, 44.05],
          [-121.31, 44.05],
          [-121.31, 44.06],
          [-121.32, 44.05],
        ],
      ],
    })
    expect(paths).toHaveLength(1)
    expect(paths[0]![0]).toEqual({ lat: 44.05, lng: -121.32 })
  })

  it('returns empty for a missing or non-polygon geometry', () => {
    expect(geojsonToPaths(null)).toEqual([])
    expect(geojsonToPaths({ type: 'Point', coordinates: [-121, 44] })).toEqual([])
  })
})
