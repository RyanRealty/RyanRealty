import { describe, expect, it } from 'vitest'
import { inkBounds, markPlacement } from './ink-bounds'

function image(w: number, h: number, ink: Array<[number, number]>, paper: [number, number, number, number] = [0, 0, 0, 0]) {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) px.set(paper, i * 4)
  for (const [x, y] of ink) px.set([16, 39, 66, 255], (y * w + x) * 4)
  return px
}

describe('the ink of a signature', () => {
  it('finds the name in a mostly blank canvas', () => {
    // The old typed signature: 600 x 160, the name in the left half around the middle.
    const px = image(600, 160, [[20, 60], [250, 110]])
    expect(inkBounds(px, 600, 160, 0)).toEqual({ x: 20, y: 60, w: 231, h: 51 })
  })

  it('treats an upload’s white background as paper', () => {
    const px = image(100, 40, [[30, 10], [70, 30]], [255, 255, 255, 255])
    expect(inkBounds(px, 100, 40, 0)).toEqual({ x: 30, y: 10, w: 41, h: 21 })
  })

  it('has nothing to crop in an empty image', () => {
    expect(inkBounds(image(10, 10, []), 10, 10)).toBeNull()
  })
})

describe('where a mark sits in its box', () => {
  it('fills the line’s height and sits on the line', () => {
    // "Matt Ryan" cropped to ink, 231 x 51 px, on the 020's 311 x 17.3 pt signature line.
    const p = markPlacement({ w: 231, h: 51 }, { x: 76, y: 400, w: 311, h: 17.3 })
    expect(p.h).toBeCloseTo(16.3, 1)
    expect(p.y).toBeCloseTo(400.5, 5)
    expect(p.x + p.w).toBeLessThanOrEqual(76 + 311)
  })

  it('never runs past a narrow box', () => {
    const p = markPlacement({ w: 300, h: 40 }, { x: 0, y: 0, w: 31, h: 13 })
    expect(p.w).toBeLessThanOrEqual(29 + 1e-9)
    expect(p.h).toBeLessThanOrEqual(12 + 1e-9)
  })
})
