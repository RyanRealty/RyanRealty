import { describe, expect, it } from 'vitest'
import { asCityGeometry, cityAtlasRegions } from './cities-index-atlas'

describe('cities-index-atlas', () => {
  it('unwraps a Feature and skips empty rows', () => {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-121.3, 44.0],
          [-121.2, 44.0],
          [-121.2, 44.1],
          [-121.3, 44.1],
          [-121.3, 44.0],
        ],
      ],
    }
    expect(asCityGeometry({ type: 'Feature', geometry: polygon, properties: {} })).toEqual(polygon)
    expect(asCityGeometry(null)).toBeNull()
    expect(asCityGeometry({ type: 'Nope' })).toBeNull()
    expect(
      cityAtlasRegions([
        { slug: 'bend', name: 'Bend', geometry: polygon },
        { slug: 'ghost', name: 'Ghost', geometry: null },
      ]),
    ).toEqual([
      {
        id: 'city:bend',
        kind: 'town',
        kindLabel: 'City',
        name: 'Bend',
        href: '/cities/bend',
        geometry: polygon,
      },
    ])
  })
})
