import { describe, expect, it } from 'vitest'
import { geoJsonToDrawnShapes, publishPlaceSplitSeed } from './publish-place-split-seed'

const square = {
  type: 'Polygon',
  coordinates: [[
    [-121.4, 44.0],
    [-121.3, 44.0],
    [-121.3, 44.1],
    [-121.4, 44.1],
    [-121.4, 44.0],
  ]],
}

describe('publishPlaceSplitSeed', () => {
  it('turns a polygon into one include shape and a bbox', () => {
    const seed = publishPlaceSplitSeed(square)
    expect(seed).not.toBeNull()
    expect(seed?.shapes).toHaveLength(1)
    expect(seed?.shapes[0]?.type).toBe('polygon')
    expect(seed?.shapes[0] && seed.shapes[0].type === 'polygon' && seed.shapes[0].exclude).toBe(false)
    expect(seed?.bounds.west).toBe(-121.4)
    expect(seed?.bounds.east).toBe(-121.3)
  })

  it('returns null for empty or unusable geometry', () => {
    expect(publishPlaceSplitSeed(null)).toBeNull()
    expect(geoJsonToDrawnShapes({ type: 'Point', coordinates: [-121, 44] })).toBeNull()
  })
})
