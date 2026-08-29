import { describe, expect, it } from 'vitest'
import { publishPlaceListThumb, readPlaceListThumbGeo } from './publish-place-list-thumb'

const smith = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-121.15, 44.36],
      [-121.13, 44.36],
      [-121.13, 44.38],
      [-121.15, 44.38],
      [-121.15, 44.36],
    ],
  ],
}

const path = {
  type: 'LineString' as const,
  coordinates: [
    [-121.32, 44.06],
    [-121.31, 44.07],
    [-121.3, 44.065],
  ],
}

describe('publishPlaceListThumb', () => {
  it('always returns a thumb, even with no geometry', () => {
    const thumb = publishPlaceListThumb({ lat: 44.0582, lng: -121.3153 })
    expect(thumb.kind).toBe('point')
    expect(thumb.svg).toContain('viewBox')
    expect(thumb.svg).toContain('var(--v3-cream)')
    expect(thumb.svg).toContain('var(--v3-navy)')
    expect(thumb.svg).not.toContain('L-121')
  })

  it('draws a provided boundary and does not invent one', () => {
    const thumb = publishPlaceListThumb({ lat: 44.37, lng: -121.14, geometry: smith })
    expect(thumb.kind).toBe('boundary')
    expect(thumb.svg).toContain('<path')
    expect(readPlaceListThumbGeo({ type: 'Polygon', coordinates: [] })).toBeNull()
    expect(publishPlaceListThumb({ lat: 44.37, lng: -121.14, geometry: { type: 'Polygon', coordinates: [] } }).kind).toBe(
      'point',
    )
  })

  it('draws a provided trail path', () => {
    const thumb = publishPlaceListThumb({ lat: 44.06, lng: -121.31, geometry: path })
    expect(thumb.kind).toBe('path')
    expect(thumb.svg).toContain('stroke-linecap')
  })

  it('falls back to a point when the geometry is not a real ring or line', () => {
    expect(publishPlaceListThumb({ lat: 44, lng: -121, geometry: { type: 'Point', coordinates: [-121, 44] } }).kind).toBe(
      'point',
    )
    const blank = publishPlaceListThumb({ lat: Number.NaN, lng: -121 })
    expect(blank.kind).toBe('point')
    expect(blank.svg).not.toContain('<path')
  })
})
