import { describe, expect, it } from 'vitest'
import { CAPTION_STYLE, SAFE_AREA, captionBox, captionCss, styleProblems } from './captionStyle'

describe('CAPTION_STYLE', () => {
  it('meets the brief: big cream type with a navy outline, centred in the lower middle, inside the safe area', () => {
    expect(styleProblems(CAPTION_STYLE)).toEqual([])
    expect(CAPTION_STYLE.sizePx).toBeGreaterThanOrEqual(72)
    expect(CAPTION_STYLE.sizePx).toBeLessThanOrEqual(96)
    expect(CAPTION_STYLE.color.fill).toBe('#faf8f4')
    expect(CAPTION_STYLE.color.outline).toBe('#102742')
    expect(CAPTION_STYLE.anchor.y).toBeGreaterThanOrEqual(1180)
    expect(CAPTION_STYLE.anchor.y).toBeLessThanOrEqual(1340)
    expect(CAPTION_STYLE.anchor.x).toBe(540)
  })

  it('keeps the whole text box off the platform edges (nothing right of x 960 or below y 1640)', () => {
    const box = captionBox()
    expect(box.x).toBeGreaterThanOrEqual(SAFE_AREA.left)
    expect(box.x + box.w).toBeLessThanOrEqual(SAFE_AREA.right)
    expect(box.y + box.h).toBeLessThanOrEqual(SAFE_AREA.bottom)
    // The box is centred on the anchor.
    expect(box.x + box.w / 2).toBe(CAPTION_STYLE.anchor.x)
    expect(box.y + box.h / 2).toBe(CAPTION_STYLE.anchor.y)
  })

  it('uses Geist Bold from the design system folder, and a type layer family name', () => {
    expect(CAPTION_STYLE.font.weight).toBe(700)
    expect(CAPTION_STYLE.font.file).toBe('design_system/ryan-realty/fonts/geist/Geist-Bold.woff2')
    expect(CAPTION_STYLE.font.family).toBe("'RR Geist'")
  })

  it('hard-cuts cards and leaves the active-word highlight off', () => {
    expect(CAPTION_STYLE.transition).toBe('cut')
    expect(CAPTION_STYLE.activeWord.enabled).toBe(false)
  })

  it('returns a copy of the box, not the style itself', () => {
    const box = captionBox()
    box.x = 0
    expect(CAPTION_STYLE.box.x).toBe(120)
  })
})

describe('styleProblems', () => {
  it('flags a style that leaves the brief', () => {
    expect(styleProblems({ ...CAPTION_STYLE, sizePx: 60 })).toContainEqual(expect.stringContaining('outside 72 to 96'))
    expect(styleProblems({ ...CAPTION_STYLE, box: { x: 200, y: 1160, w: 800, h: 200 } })).toContainEqual(expect.stringContaining('past x 960'))
    expect(styleProblems({ ...CAPTION_STYLE, box: { x: 120, y: 1500, w: 840, h: 200 } })).toContainEqual(expect.stringContaining('below y 1640'))
    expect(styleProblems({ ...CAPTION_STYLE, box: { x: 50, y: 1160, w: 840, h: 200 } })).toContainEqual(expect.stringContaining('safe area'))
    expect(styleProblems({ ...CAPTION_STYLE, anchor: { x: 540, y: 1500 } })).toContainEqual(expect.stringContaining('1180 to 1340'))
    expect(styleProblems({ ...CAPTION_STYLE, color: { ...CAPTION_STYLE.color, fill: '#ffffff' } })).toContainEqual(expect.stringContaining('brand cream'))
    expect(styleProblems({ ...CAPTION_STYLE, box: { x: 120, y: 1160, w: 840, h: 100 } })).toContainEqual(expect.stringContaining('cannot hold'))
  })
})

describe('captionCss', () => {
  const css = captionCss()

  it('draws the outline behind the fill so the letters keep their weight', () => {
    expect(css).toContain('paint-order:stroke fill')
    // The visible outline is half of the CSS stroke, which straddles the edge.
    expect(css).toContain(`-webkit-text-stroke:${CAPTION_STYLE.outlinePx * 2}px #102742`)
    expect(css).toContain('color:#faf8f4')
  })

  it('carries the size, weight and family', () => {
    expect(css).toContain('font-size:84px')
    expect(css).toContain('font-weight:700')
    expect(css).toContain("font-family:'RR Geist', Geist, system-ui, sans-serif")
  })

  it('uses only the two brand colours (plus the navy shadow)', () => {
    const colours = css.match(/#[0-9a-f]{3,8}\b/gi) ?? []
    expect(new Set(colours.map((c) => c.toLowerCase()))).toEqual(new Set(['#faf8f4', '#102742']))
    expect(css).toContain('rgba(16,39,66,0.55)')
  })
})
