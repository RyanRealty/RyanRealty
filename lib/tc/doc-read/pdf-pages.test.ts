import { describe, expect, it } from 'vitest'
import { MAX_RENDER_PIXELS, MAX_RENDER_SIDE, RENDER_SCALE, renderScaleFor } from './pdf-pages'

describe('renderScaleFor', () => {
  it('renders ordinary pages at the reader scale', () => {
    expect(renderScaleFor(612, 792)).toBe(RENDER_SCALE) // letter
    expect(renderScaleFor(612, 1008)).toBe(RENDER_SCALE) // legal
    expect(renderScaleFor(792, 1224)).toBe(RENDER_SCALE) // tabloid
  })

  it('shrinks a poster-size page so one render cannot exhaust memory (2026-09-24 plat, 4.2 GB)', () => {
    for (const [w, h] of [
      [2592, 3456], // 36 x 48 in
      [14400, 14400], // 200 x 200 in
      [30000, 800], // a long strip
    ]) {
      const s = renderScaleFor(w, h)
      expect(s).toBeLessThan(RENDER_SCALE)
      expect(Math.ceil(w * s) * Math.ceil(h * s)).toBeLessThanOrEqual(MAX_RENDER_PIXELS * 1.01)
      expect(Math.max(w, h) * s).toBeLessThanOrEqual(MAX_RENDER_SIDE + 1)
    }
  })

  it('falls back to the reader scale on a page with no size', () => {
    expect(renderScaleFor(0, 0)).toBe(RENDER_SCALE)
    expect(renderScaleFor(Number.NaN, 792)).toBe(RENDER_SCALE)
  })
})
