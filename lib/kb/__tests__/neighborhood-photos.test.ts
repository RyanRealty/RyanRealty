import { describe, it, expect } from 'vitest'
import { assignNeighborhoodPhotos } from '../neighborhood-photos'

// A unit square polygon around (0,0)→(10,10) in [lng,lat] space.
const square = {
  slug: 'sq',
  name: 'Square',
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
}

describe('assignNeighborhoodPhotos', () => {
  it('assigns the highest-priced listing inside the polygon', () => {
    const tiles = [
      { lng: 5, lat: 5, listPrice: 400000, photoUrl: 'cheap.jpg' },
      { lng: 6, lat: 6, listPrice: 900000, photoUrl: 'expensive.jpg' },
      { lng: 50, lat: 50, listPrice: 5000000, photoUrl: 'outside.jpg' }, // outside
    ]
    const map = assignNeighborhoodPhotos([square], tiles)
    expect(map.get('sq')).toBe('expensive.jpg')
  })

  it('omits polygons with no interior listing (caller falls back, no wrong photo)', () => {
    const tiles = [{ lng: 99, lat: 99, listPrice: 1, photoUrl: 'far.jpg' }]
    const map = assignNeighborhoodPhotos([square], tiles)
    expect(map.has('sq')).toBe(false)
  })

  it('ignores listings without coordinates or photos', () => {
    const tiles = [
      { lng: 5, lat: 5, listPrice: 800000, photoUrl: '' }, // no photo
      { lng: null, lat: null, listPrice: 900000, photoUrl: 'nogeo.jpg' }, // no geo
      { lng: 4, lat: 4, listPrice: 300000, photoUrl: 'ok.jpg' },
    ]
    const map = assignNeighborhoodPhotos([square], tiles)
    expect(map.get('sq')).toBe('ok.jpg')
  })

  it('supports MultiPolygon geometries', () => {
    const multi = {
      slug: 'mp',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
          [[[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]]],
        ],
      },
    }
    const tiles = [{ lng: 21, lat: 21, listPrice: 100, photoUrl: 'part2.jpg' }]
    const map = assignNeighborhoodPhotos([multi], tiles)
    expect(map.get('mp')).toBe('part2.jpg')
  })
})
