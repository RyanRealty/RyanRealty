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
