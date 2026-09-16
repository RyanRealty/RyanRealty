import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Ledger, type V3LedgerFigureRow } from '@/components/site/v3/V3Ledger'
import { v3Text } from '@/components/site/v3/atoms'
import { placeFigureRows } from '@/app/cities/[slug]/_v3/city-sections'

/**
 * The ledger draws a figure as a length as well as a number. Six towns whose
 * inventories run 699 to 43 printed that 16-to-1 spread in a value column 7% of
 * the row wide — TASTE's "table wearing hairlines".
 *
 * What these tests hold is the honesty of the length, not its looks: a bar the
 * caller did not compute must not appear, a bar must never be drawn from a
 * weight the primitive invented, and the number stays the accessible value.
 */

function row(over: Partial<V3LedgerFigureRow> = {}): V3LedgerFigureRow {
  return {
    href: '/cities/bend',
    what: v3Text('Bend'),
    value: v3Text('699 active'),
    ...over,
  } as V3LedgerFigureRow
}

function render(rows: readonly V3LedgerFigureRow[], encode?: 'bar') {
  const [first, ...rest] = rows
  return renderToStaticMarkup(
    createElement(V3Ledger, {
      heading: v3Text('Where the homes are'),
      source: v3Text('live MLS'),
      rows: [first!, ...rest],
      ...(encode ? { encode } : {}),
    }),
  )
}

const widths = (html: string) =>
  [...html.matchAll(/class="v3-ledger__bar[^"]*"[^>]*style="width:([^"]+)"/g)].map((m) => m[1]!)

describe('V3Ledger encode="bar"', () => {
  it('draws no bar at all unless the caller asks for one', () => {
    const html = render([row({ weight: 1 }), row({ href: '/cities/redmond', weight: 0.5 })])
    expect(html).not.toContain('v3-ledger__bar')
    expect(html).not.toContain('v3-ledger__track')
    // The figure is untouched.
    expect(html).toContain('699 active')
  })

  it('draws each bar at the share the caller computed', () => {
    const html = render(
      [row({ weight: 1 }), row({ href: '/cities/redmond', weight: 0.33 }), row({ href: '/cities/sisters', weight: 0.5 })],
      'bar',
    )
    expect(widths(html)).toEqual(['100.00%', '33.00%', '50.00%'])
  })

  it('marks the largest as the reference, and marks EXACTLY one', () => {
    const html = render(
      [row({ href: '/cities/redmond', weight: 0.4 }), row({ href: '/cities/sisters', weight: 1 }), row({ href: '/cities/sunriver', weight: 0.2 })],
      'bar',
    )
    expect(html.match(/v3-ledger__bar--lead/g)).toHaveLength(1)
    // Marked by weight, never by position: these lists run in the caller's own
    // order, so the first row is usually not the biggest.
    const lead = html.indexOf('v3-ledger__bar--lead')
    expect(html.slice(0, lead)).toContain('/cities/redmond')
  })

  it('refuses a weight outside 0..1 rather than clamping it to a full bar', () => {
    const html = render([row({ weight: 1.4 }), row({ href: '/cities/redmond', weight: -0.2 })], 'bar')
    expect(widths(html)).toEqual([])
    // The track still renders, so the row does not lose its column and read as
    // a different shape from its neighbours.
    expect(html).toContain('v3-ledger__track')
  })

  it('gives a real but tiny share a visible mark instead of a blank cell', () => {
    const html = render([row({ weight: 0.001 }), row({ href: '/cities/redmond', weight: 1 })], 'bar')
    expect(widths(html)[0]).toBe('1.50%')
  })

  it('draws nothing for a row with no weight — an unmeasured place gets no length', () => {
    const html = render([row({ weight: 1 }), row({ href: '/cities/redmond', value: v3Text('not measured') })], 'bar')
    expect(widths(html)).toEqual(['100.00%'])
    expect(html).toContain('not measured')
  })

  it('keeps the NUMBER as the accessible value and hides the bar from assistive tech', () => {
    const html = render([row({ weight: 1 }), row({ href: '/cities/redmond', weight: 0.5 })], 'bar')
    expect(html).toContain('aria-hidden="true"')
    // The bar sits inside the aria-hidden track, the figure outside it.
    const track = html.indexOf('v3-ledger__track')
    const value = html.indexOf('v3-ledger__value')
    expect(track).toBeLessThan(value)
    expect(html).toContain('699 active')
  })
})

describe('placeFigureRows weights', () => {
  const items = [
    { name: 'Bend', activeCount: 699, medianPrice: 949000, href: '/cities/bend', img: '' },
    { name: 'Redmond', activeCount: 231, medianPrice: 599900, href: '/cities/redmond', img: '' },
    { name: 'Terrebonne', activeCount: 43, medianPrice: 824900, href: '/cities/terrebonne', img: '' },
  ]

  it('scales every row against the busiest place in the SAME list', () => {
    const rows = placeFigureRows(items, 'City')
    expect(rows[0]!.weight).toBe(1)
    expect(rows[1]!.weight).toBeCloseTo(231 / 699, 6)
    expect(rows[2]!.weight).toBeCloseTo(43 / 699, 6)
  })

  it('gives an unmeasured place NO weight, matching what its figure says', () => {
    const rows = placeFigureRows([...items, { name: 'Alfalfa', activeCount: null, medianPrice: null, href: '/cities/sisters', img: '' }], 'City')
    expect(rows[3]!.value).toContain('not measured')
    expect(rows[3]!.weight).toBeUndefined()
  })

  it('gives a MEASURED zero a weight of zero — none listed is a fact, not a gap', () => {
    const rows = placeFigureRows([...items, { name: 'Vandevert Ranch', activeCount: 0, medianPrice: null, href: '/cities/terrebonne', img: '' }], 'City')
    expect(rows[3]!.value).toContain('none listed now')
    expect(rows[3]!.weight).toBe(0)
  })

  it('weights nothing when no place in the list was measured', () => {
    const rows = placeFigureRows(
      [{ name: 'A', activeCount: null, medianPrice: null, href: '/cities/la-pine', img: '' }],
      'City',
    )
    expect(rows[0]!.weight).toBeUndefined()
  })
})

/**
 * SITE-52: what the primitive does past the bar. Media is all-or-none per
 * list, a reveal band sits in every row of a list that reveals (hidden at
 * rest by CSS, one height per row), a drawing seats under the note, and the
 * twelve-month run obeys the small-n floor.
 */
describe('V3Ledger media: all or none per list', () => {
  it('puts the glyph on every photo-less row once any row has a photo', () => {
    const html = render([
      row({ media: { src: '/images/bend.jpg' } }),
      row({ href: '/cities/redmond', what: v3Text('Redmond') }),
      row({ href: '/cities/sisters', what: v3Text('Sisters') }),
    ])
    expect(html.match(/v3-ledger__thumb/g)).toHaveLength(1)
    expect(html.match(/v3-ledger__glyph/g)).toHaveLength(2)
    expect(html).toMatch(/v3-ledger__glyph" aria-hidden="true">R</)
    expect(html).toMatch(/v3-ledger__glyph" aria-hidden="true">S</)
    // Every row carries the media column, so the name column keeps one edge.
    expect(html.match(/v3-ledger__what--media/g)).toHaveLength(3)
  })

  it('draws no glyph in a list with no photos at all', () => {
    const html = render([row(), row({ href: '/cities/redmond' })])
    expect(html).not.toContain('v3-ledger__glyph')
    expect(html).not.toContain('v3-ledger__what--media')
  })
})

describe('V3Ledger reveal', () => {
  const twelve = [40, 38, 52, 61, 70, 66, 58, 49, 44, 51, 47, 45]

  it('renders the reveal on the row that has one, and the island once per list', () => {
    const html = render([
      row({ reveal: { line: v3Text("Seller's market · 3.8 months of supply"), series: twelve, seriesLabel: v3Text('closes by month') } }),
      row({ href: '/cities/redmond' }),
    ])
    expect(html.match(/class="v3-ledger__reveal"/g)).toHaveLength(1)
    expect(html.match(/v3-ledger__hold/g)).toHaveLength(1)
    expect(html).toContain('v3-ledger--reveal')
    expect(html).toContain("Seller&#x27;s market · 3.8 months of supply")
    expect(html.match(/<svg class="v3-ledger__spark"/g)).toHaveLength(1)
    expect(html).toMatch(/<path d="M[\d.]+ [\d.]+ L/)
    expect(html).toContain('<circle')
  })

  it('renders no band, no island and no class when nothing reveals', () => {
    const html = render([row(), row({ href: '/cities/redmond' })])
    expect(html).not.toContain('v3-ledger__reveal')
    expect(html).not.toContain('v3-ledger__hold')
    expect(html).not.toContain('v3-ledger--reveal')
  })

  it('draws no run under the small-n floor and never draws a null as zero', () => {
    const thin = [40, null, null, 61, null, null, 58, null, null, 51, null, null]
    const html = render([row({ reveal: { line: v3Text('No published months-of-supply reading'), series: thin } })])
    expect(html).toContain('No published months-of-supply reading')
    expect(html).not.toContain('v3-ledger__spark')
  })
})

describe('V3Ledger drawing slot', () => {
  it('seats a drawing under the note, before the rows', () => {
    const html = renderToStaticMarkup(
      createElement(V3Ledger, {
        heading: v3Text('Central Oregon cities'),
        note: v3Text('Every city with live inventory.'),
        drawing: createElement('div', { className: 'stub-drawing' }, 'two bars'),
        source: v3Text('live MLS'),
        rows: [row({ weight: 1 })],
        encode: 'bar',
      }),
    )
    const drawing = html.indexOf('v3-ledger__drawing')
    expect(drawing).toBeGreaterThan(html.indexOf('v3-ledger__note'))
    expect(drawing).toBeLessThan(html.indexOf('v3-ledger__list'))
    expect(html).toContain('stub-drawing')
  })
})

/**
 * SITE-92 round 4: the scale said on the drawing, the designed mark, and the
 * run as a small chart. What these hold is the honesty of each: the ruler only
 * prints the caller's ticks at the caller's positions and drops one it cannot
 * place; a mark never replaces a photo; a label never appears the caller did
 * not hand over.
 */
describe('V3Ledger scale (the ruler over the bars)', () => {
  const scale = {
    note: v3Text('Bars are on a square-root scale.'),
    ticks: [
      { at: 0.09, label: v3Text('5') },
      { at: 0.64, label: v3Text('250') },
      { at: 1, label: v3Text('616') },
    ],
  }

  it('prints the note and one tick per caller position, only with encode="bar"', () => {
    const html = renderToStaticMarkup(
      createElement(V3Ledger, {
        heading: v3Text('Cities'),
        source: v3Text('live MLS'),
        rows: [row({ weight: 1 }), row({ href: '/cities/redmond', weight: 0.3 })],
        encode: 'bar',
        scale,
      }),
    )
    expect(html).toContain('v3-ledger--ruled')
    expect(html).toContain('Bars are on a square-root scale.')
    const ticks = [...html.matchAll(/class="v3-ledger__tick" style="left:([^"]+)"/g)].map((m) => m[1]!)
    expect(ticks).toEqual(['9.00%', '64.00%', '100.00%'])
    // The ruler sits between the head and the list, and is hidden from assistive tech.
    expect(html.indexOf('v3-ledger__ruler')).toBeLessThan(html.indexOf('v3-ledger__list'))
    expect(html).toMatch(/v3-ledger__ruler-measure" aria-hidden="true"/)

    const plain = renderToStaticMarkup(
      createElement(V3Ledger, {
        heading: v3Text('Cities'),
        source: v3Text('live MLS'),
        rows: [row({ weight: 1 })],
        scale,
      }),
    )
    expect(plain).not.toContain('v3-ledger__ruler')
    expect(plain).not.toContain('v3-ledger--ruled')
  })

  it('drops a tick it cannot place rather than clamping it onto the track', () => {
    const html = renderToStaticMarkup(
      createElement(V3Ledger, {
        heading: v3Text('Cities'),
        source: v3Text('live MLS'),
        rows: [row({ weight: 1 })],
        encode: 'bar',
        scale: { note: scale.note, ticks: [{ at: 1.4, label: v3Text('900') }, { at: 0.5, label: v3Text('154') }] },
      }),
    )
    expect(html).not.toContain('>900<')
    expect(html).toContain('>154<')
  })
})

describe('V3Ledger mark (a drawn place where there is no photograph)', () => {
  it('draws the caller mark in the media square instead of the glyph, and never over a photo', () => {
    const html = render([
      row({ media: { src: '/images/bend.jpg' }, mark: createElement('svg', { className: 'stub-mark-bend' }) }),
      row({ href: '/cities/metolius', what: v3Text('Metolius'), mark: createElement('svg', { className: 'stub-mark' }) }),
      row({ href: '/cities/camp-sherman', what: v3Text('Camp Sherman') }),
    ])
    expect(html.match(/v3-ledger__thumb/g)).toHaveLength(1)
    expect(html).not.toContain('stub-mark-bend')
    expect(html.match(/v3-ledger__mark" aria-hidden="true"/g)).toHaveLength(1)
    expect(html).toContain('stub-mark')
    // The row with neither still carries the glyph, so the column keeps one edge.
    expect(html.match(/v3-ledger__glyph/g)).toHaveLength(1)
    expect(html.match(/v3-ledger__what--media/g)).toHaveLength(3)
  })

  it('draws no mark in a list with no photos at all — the column does not exist', () => {
    const html = render([row({ mark: createElement('svg', { className: 'stub-mark' }) }), row({ href: '/cities/redmond' })])
    expect(html).not.toContain('stub-mark')
    expect(html).not.toContain('v3-ledger__what--media')
  })
})

describe('V3Ledger reveal run as a small chart', () => {
  const twelve = [40, 38, 52, 61, 70, 66, 58, 49, 44, 51, 47, 45]

  it('names the window at both ends and labels the endpoint with the caller string, when given', () => {
    const html = render([
      row({
        reveal: {
          line: v3Text("Seller's market · 3.8 months of supply"),
          series: twelve,
          seriesLabel: v3Text('Closed detached sales by month'),
          seriesEnds: { first: v3Text('Sep 2025'), last: v3Text('Aug 2026') },
          seriesLast: v3Text('45'),
        },
      }),
    ])
    expect(html).toContain('v3-ledger__run-ends')
    expect(html).toMatch(/<span>Sep 2025<\/span><span>Aug 2026<\/span>/)
    expect(html).toMatch(/<text class="v3-ledger__spark-end"[^>]*>45<\/text>/)
    expect(html).toContain('v3-ledger__spark-base')
    // The SVG scales to its column: a viewBox and no fixed pixel width.
    expect(html).toMatch(/<svg class="v3-ledger__spark" viewBox="0 0 \d+ \d+" aria-hidden="true">/)
    expect(html).not.toMatch(/<svg class="v3-ledger__spark"[^>]*width=/)
  })

  it('prints no end labels and no endpoint value the caller did not hand over', () => {
    const html = render([
      row({ reveal: { line: v3Text("Seller's market · 3.8 months of supply"), series: twelve, seriesLabel: v3Text('closes by month') } }),
    ])
    expect(html).not.toContain('v3-ledger__run-ends')
    expect(html).not.toContain('v3-ledger__spark-end')
    // The line's own points are never written on screen.
    expect(html).not.toMatch(/>70</)
  })
})
