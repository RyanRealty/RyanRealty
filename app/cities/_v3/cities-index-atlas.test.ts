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
  })

  it('keeps unlabeled outlines on the map without a packed name', () => {
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
    const regions = cityAtlasRegions(
      [
        { slug: 'bend', name: 'Bend', geometry: polygon },
        { slug: 'terrebonne', name: 'Terrebonne', geometry: polygon },
      ],
      ['bend'],
    )
    expect(regions.find((r) => r.id === 'city:bend')?.showLabel).toBe(true)
    expect(regions.find((r) => r.id === 'city:terrebonne')?.showLabel).toBe(false)
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
        showLabel: true,
      },
    ])
  })

  it('keeps unlabeled outlines on the map without a packed name', () => {
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
    const regions = cityAtlasRegions(
      [
        { slug: 'bend', name: 'Bend', geometry: polygon },
        { slug: 'terrebonne', name: 'Terrebonne', geometry: polygon },
      ],
      ['bend'],
    )
    expect(regions.find((r) => r.id === 'city:bend')?.showLabel).toBe(true)
    expect(regions.find((r) => r.id === 'city:terrebonne')?.showLabel).toBe(false)
  })
})
