import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Ledger, type V3LedgerFigureRow } from '@/components/site/v3/V3Ledger'
import { nearestMark, readoutText } from '@/components/site/v3/V3LedgerReveal.client'
import { v3Text } from '@/components/site/v3/atoms'

/**
 * SITE-92 round 5 on the Ledger: the live numeral in the value column, the
 * scrubbable reveal, and the drawn head. What these hold is honesty and
 * shape: the served figure is the caller's from the first byte; the scrub
 * exists only when every month is named; the readout joins two caller
 * strings and computes nothing.
 */

const SERIES = [120, 131, 118, null, 140, 152, 149, 160, 171, 165, 178, 180]
const POINTS = SERIES.map((v, i) => ({
  label: v3Text(`M${i}`),
  value: v == null ? null : v3Text(`${v} closed`),
}))

function row(over: Partial<V3LedgerFigureRow> = {}): V3LedgerFigureRow {
  return {
    href: '/cities/bend',
    what: v3Text('Bend'),
    value: v3Text('614 for sale'),
    ...over,
  } as V3LedgerFigureRow
}

function render(rows: readonly V3LedgerFigureRow[], extra: Record<string, unknown> = {}) {
  const [first, ...rest] = rows
  return renderToStaticMarkup(
    createElement(V3Ledger, {
      heading: v3Text('Central Oregon cities, A to Z'),
      source: v3Text('live MLS'),
      rows: [first!, ...rest],
      ...extra,
    } as never),
  )
}

describe('V3Ledger numeral', () => {
  it('serves the caller’s digits settled inside the value column, with the rest of the figure beside them', () => {
    const html = render([row({ numeral: { value: 614, formatted: v3Text('614'), rest: v3Text('for sale') } })])
    expect(html).toMatch(/v3-ledger__value[^>]*>.*data-settled="614"[^>]*>614<\/span> for sale/)
    expect(html).not.toMatch(/data-settled="614"[^>]*>0</)
  })

  it('prints the plain figure when the row carries no numeral', () => {
    const html = render([row()])
    expect(html).toContain('614 for sale')
    expect(html).not.toContain('data-settled')
  })
})

describe('V3Ledger reveal scrub', () => {
  it('draws one mark per published point, a cursor and a readout, and carries the months on the run', () => {
    const html = render([
      row({
        reveal: {
          line: v3Text('Seller’s market · 3.5 months of supply'),
          series: SERIES,
          seriesLabel: v3Text('Closed detached sales by month'),
          points: POINTS,
        },
      }),
    ])
    expect(html).toContain('v3-ledger__spark-cursor')
    expect(html).toContain('v3-ledger__readout')
    // Eleven published points: the null month has no mark.
    expect(html.match(/v3-ledger__spark-pt/g)?.length).toBe(11)
    expect(html).not.toContain('data-i="3"')
    expect(html).toContain('data-i="11"')
    // The months ride on the run for the island; no figure is printed in the plot.
    expect(html).toContain('data-points=')
    expect(html).toContain('M11')
    expect(html).toContain('180 closed')
  })

  it('draws no scrub when the caller did not name every month', () => {
    const html = render([
      row({
        reveal: {
          line: v3Text('Seller’s market'),
          series: SERIES,
          seriesLabel: v3Text('Closed detached sales by month'),
          points: POINTS.slice(0, 5),
        },
      }),
    ])
    expect(html).not.toContain('v3-ledger__spark-cursor')
    expect(html).not.toContain('v3-ledger__readout')
    expect(html).not.toContain('data-points=')
    // The run itself still draws.
    expect(html).toContain('v3-ledger__spark')
  })

  it('names the nearest published mark and joins the caller’s two strings for the readout', () => {
    const marks = [
      { cx: 4, i: 0 },
      { cx: 44, i: 2 },
      { cx: 84, i: 4 },
    ]
    expect(nearestMark(marks, 30)).toEqual({ cx: 44, i: 2 })
    expect(nearestMark(marks, 90)).toEqual({ cx: 84, i: 4 })
    expect(nearestMark([], 10)).toBeNull()
    expect(readoutText(['Aug 2026', '180 closed'])).toBe('Aug 2026 · 180 closed')
    expect(readoutText(['Nov 2025', null])).toBe('Nov 2025')
    expect(readoutText(undefined)).toBe('')
  })
})

describe('V3Ledger headLayout', () => {
  it('marks the drawn head only when there is a drawing to set beside the words', () => {
    const drawing = createElement('div', { 'data-drawing': '' })
    expect(render([row()], { headLayout: 'beside', drawing })).toContain('v3-ledger--head-beside')
    expect(render([row()], { headLayout: 'beside' })).not.toContain('v3-ledger--head-beside')
    expect(render([row()], { drawing })).not.toContain('v3-ledger--head-beside')
  })
})
