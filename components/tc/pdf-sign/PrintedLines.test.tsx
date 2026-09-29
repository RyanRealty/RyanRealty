import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrintedLines } from './PrintedLines'
import { fitTextToBox, helveticaWidth } from '@/lib/tc/text-areas'

const box = { w: 0.2 * 612, h: 0.035 * 792 } // the composer's default text box, in points

function texts(html: string) {
  return [...html.matchAll(/<text x="2" y="([\d.]+)" font-size="([\d.]+)"[^>]*textLength="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => ({
    y: Number(m[1]),
    size: Number(m[2]),
    length: Number(m[3]),
    text: m[4],
  }))
}

describe('PrintedLines', () => {
  it('draws the lines the sealer prints, each at the width it prints at', () => {
    const value = 'Refrigerator and chest freezer stay with the home'
    const html = renderToStaticMarkup(<PrintedLines text={value} widthPts={box.w} heightPts={box.h} />)
    const fit = fitTextToBox(value, box.w, box.h)
    const lines = texts(html)
    expect(lines.map((l) => l.text)).toEqual(fit.lines)
    expect(lines.map((l) => l.text).join(' ')).toBe(value)
    for (const l of lines) {
      expect(l.size).toBeCloseTo(fit.size, 6)
      expect(l.length).toBeCloseTo(helveticaWidth(l.text, fit.size), 6)
      // Inside the sealer's usable width: never past the box edge.
      expect(2 + l.length).toBeLessThanOrEqual(box.w - 2 + 1e-6)
    }
  })

  it('places baselines as the sealer does: one line centred, a paragraph from the top', () => {
    const one = texts(renderToStaticMarkup(<PrintedLines text="Stays" widthPts={box.w} heightPts={box.h} />))
    expect(one).toHaveLength(1)
    expect(one[0].y).toBeCloseTo((box.h + one[0].size) / 2 - 1, 6)

    const many = texts(renderToStaticMarkup(<PrintedLines text="Refrigerator and chest freezer stay with the home" widthPts={box.w} heightPts={box.h} />))
    expect(many.length).toBeGreaterThan(1)
    expect(many[0].y).toBeCloseTo(many[0].size + 1, 6)
    expect(many[1].y - many[0].y).toBeCloseTo(many[0].size + 1.2, 6)
  })

  it('shows a character the font cannot draw as the "?" that prints', () => {
    const lines = texts(renderToStaticMarkup(<PrintedLines text="Keys → kitchen 😀" widthPts={box.w} heightPts={box.h} />))
    expect(lines.map((l) => l.text).join(' ')).toBe('Keys ? kitchen ?')
  })

  it('sizes itself to the box in points, so it scales with the page', () => {
    const html = renderToStaticMarkup(<PrintedLines text="Stays" widthPts={box.w} heightPts={box.h} />)
    expect(html).toContain(`viewBox="0 0 ${box.w} ${box.h}"`)
    expect(html).toContain('aria-hidden="true"')
  })
})
