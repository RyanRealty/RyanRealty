import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  V3Chart,
  V3Instrument,
  v3Text,
  type V3ChartPoint,
  type V3ChartSeries,
} from '@/components/site/v3'

/**
 * Locks for the v3 chart atom (D9). The atom takes a series. It draws a line.
 * It does not flatten the series to a figure. Geometry is SVG. Labels are the
 * strings the caller already formatted. No DOM library in this repo, so the
 * render assertions are renderToStaticMarkup, same as the Sheet trap tests.
 */

const CHART_SRC = join(process.cwd(), 'components/site/v3/V3Chart.tsx')
const INDEX_SRC = join(process.cwd(), 'components/site/v3/index.ts')
const INSTRUMENT_SRC = join(process.cwd(), 'components/site/v3/V3Instrument.tsx')

function point(value: number, tick: string, label: string, at?: number): V3ChartPoint {
  return {
    value,
    tick: v3Text(tick),
    label: v3Text(label),
    ...(at != null ? { at } : {}),
  }
}

function series(name: string, points: V3ChartPoint[]): V3ChartSeries {
  return { name: v3Text(name), points }
}

const MEDIAN = series('Median close', [
  point(420_000, 'Jan 2024', '$420K', 1),
  point(455_000, 'Jun 2024', '$455K', 6),
  point(475_000, 'Dec 2024', '$475K', 12),
])

describe('V3Chart atom', () => {
  it('is SVG and CSS, not recharts', () => {
    const src = readFileSync(CHART_SRC, 'utf8')
    expect(src).not.toMatch(/from ['"]recharts['"]/)
    expect(src).toMatch(/<path/)
    expect(src).toMatch(/<svg/)
  })

  // RE-EXPRESSED 2026-08-27. This asserted the index still says "The six patterns
  // are closed" — the rule Matt killed that morning — so it would have blocked the
  // very thing the new rule allows. The distinction it was REALLY guarding
  // survives and still matters: a chart is an ATOM that rides inside a section,
  // not a section type of its own. A page mounts it through V3Instrument's chart
  // slot; it never stands alone as a section.
  it('is exported as an atom that rides inside a section, not as a section itself', () => {
    const index = readFileSync(INDEX_SRC, 'utf8')
    expect(index).toMatch(/export \{ V3Chart \} from '\.\/V3Chart'/)
    expect(index).toMatch(/The series atom/)
    expect(index).toMatch(/Not a seventh/)
    // and it is reached through the Instrument's slot, never mounted bare
    expect(index).toMatch(/V3Instrument\.chart/)
  })

  it('draws straight segments from the series, never a spline', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close, monthly'),
        series: [MEDIAN],
      }),
    )
    expect(html).toContain('v3-chart')
    expect(html).toContain('<path')
    const d = /<path[^>]*d="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(d).toMatch(/^M/)
    expect(d).toMatch(/L/)
    expect(d).not.toMatch(/[CQST]/)
  })

  it('labels axes with the caller strings, not a number this atom formatted', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close, monthly'),
        series: [MEDIAN],
      }),
    )
    expect(html).toContain('$420K')
    expect(html).toContain('$475K')
    expect(html).toContain('Jan 2024')
    expect(html).toContain('Dec 2024')
    expect(html).not.toContain('420000')
    expect(html).not.toContain('475000')
  })

  it('keeps every plotted reading in a hidden list', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close, monthly'),
        series: [MEDIAN],
      }),
    )
    expect(html).toContain('v3-chart__data')
    expect(html).toContain('Median close: Jan 2024, $420K')
    expect(html).toContain('Median close: Jun 2024, $455K')
    expect(html).toContain('Median close: Dec 2024, $475K')
  })

  it('states the reason when the series cannot plot, and draws no path', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close, monthly'),
        series: [series('Median close', [point(475_000, 'Dec 2024', '$475K')])],
        emptyReason: v3Text('Fewer than two closed months in this window'),
      }),
    )
    expect(html).toContain('Fewer than two closed months in this window')
    expect(html).not.toContain('<path')
  })

  it('lifts the line across a non-finite gap instead of inventing a value', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close, monthly'),
        series: [
          series('Median close', [
            point(420_000, 'Jan 2024', '$420K', 1),
            point(Number.NaN, 'Feb 2024', 'n/a', 2),
            point(475_000, 'Mar 2024', '$475K', 3),
          ]),
        ],
      }),
    )
    const d = /<path[^>]*d="([^"]+)"/.exec(html)?.[1] ?? ''
    const moves = d.match(/M/g) ?? []
    expect(moves.length).toBe(2)
    expect(d).not.toMatch(/L/)
  })

  it('draws a mix as rects, not a line through categories', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Closed sales by type, 2024'),
        kind: 'mix',
        series: [
          series('Closed units', [
            point(4850, 'Single-family', '4,850'),
            point(600, 'Land', '600'),
          ]),
        ],
      }),
    )
    expect(html).toContain('v3-chart--mix')
    expect(html).toContain('<rect')
    expect(html).not.toMatch(/<path[^>]*d=/)
    expect(html).toContain('4,850')
  })

  it('distinguishes a second series without a second hue', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close, this year and last'),
        series: [
          MEDIAN,
          series('Prior year', [
            point(400_000, 'Jan 2023', '$400K', 1),
            point(430_000, 'Jun 2023', '$430K', 6),
            point(440_000, 'Dec 2023', '$440K', 12),
          ]),
        ],
      }),
    )
    expect(html).toContain('v3-chart__line--0')
    expect(html).toContain('v3-chart__line--1')
    expect(html).toContain('v3-chart__legend')
    expect(html).toContain('Prior year')
    expect((html.match(/<path/g) ?? []).length).toBe(2)
  })

  it('prints the claim under the caption, once', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close by month'),
        claim: v3Text('Median sale price $475K in Dec 2024, up 13.1% from Dec 2023.'),
        series: [MEDIAN],
      }),
    )
    expect(html).toContain('v3-chart__claim')
    expect((html.match(/up 13\.1% from Dec 2023/g) ?? []).length).toBe(1)
  })

  it('draws a gridline per y tick and drops any tick outside the plotted domain', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close by month'),
        series: [MEDIAN],
        // The plotted range is 420K–475K, padded 6% either way by buildLinePlot.
        // $300K and $900K are outside it and must not draw.
        yTicks: [
          { value: 300_000, label: v3Text('$300K') },
          { value: 425_000, label: v3Text('$425K') },
          { value: 450_000, label: v3Text('$450K') },
          { value: 900_000, label: v3Text('$900K') },
        ],
        xTicks: [
          { at: 1, label: v3Text('Jan') },
          { at: 6, label: v3Text('Jun') },
          { at: 99, label: v3Text('Nope') },
        ],
      }),
    )
    expect(html).toContain('$425K')
    expect(html).toContain('$450K')
    expect(html).not.toContain('$300K')
    expect(html).not.toContain('$900K')
    expect(html).not.toContain('Nope')
    expect((html.match(/v3-chart__grid/g) ?? []).length).toBe(2)
    expect((html.match(/v3-chart__xtick/g) ?? []).length).toBe(2)
  })

  it('emphasize puts one series in ink with marks and the rest in tints', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close by month, recent years'),
        overlay: 'yoy',
        emphasize: 'last',
        series: [
          series('2023', [point(420_000, 'Jan', '$420K', 1), point(440_000, 'Dec', '$440K', 12)]),
          series('2024', [point(450_000, 'Jan', '$450K', 1), point(475_000, 'Dec', '$475K', 12)]),
        ],
      }),
    )
    expect(html).toContain('v3-chart__line--em')
    expect(html).toContain('v3-chart__line--ctx1')
    expect(html).toContain('v3-chart__mark--em')
    // The categorical hue run gives way to the emphasis pattern.
    expect(html).not.toContain('v3-chart__line--cat0')
    // Only the emphasized series carries marks.
    expect(html).not.toContain('v3-chart__mark--ctx1')
  })
})

describe('V3Instrument mounts the chart atom', () => {
  const figures = [
    { value: v3Text('$475K'), label: v3Text('median close') },
  ] as const

  it('renders V3Chart under the figures when a series is passed', () => {
    const src = readFileSync(INSTRUMENT_SRC, 'utf8')
    expect(src).toMatch(/from '\.\/V3Chart'/)
    expect(src).toMatch(/v3-instrument__chart/)

    const html = renderToStaticMarkup(
      createElement(V3Instrument, {
        headline: v3Text('A balanced market'),
        figures,
        source: v3Text('live MLS, Bend single-family, CloseDate rolling 12 months'),
        level: 1,
        chart: {
          caption: v3Text('Median close, monthly'),
          series: [MEDIAN],
        },
      }),
    )
    expect(html).toContain('v3-instrument__chart')
    expect(html).toContain('v3-chart')
    expect(html).toContain('<path')
    expect(html).toContain('$475K')
  })

  it('does not invent a chart when the caller has only figures', () => {
    const html = renderToStaticMarkup(
      createElement(V3Instrument, {
        headline: v3Text('A balanced market'),
        figures,
        source: v3Text('live MLS, Bend single-family, CloseDate rolling 12 months'),
        level: 1,
      }),
    )
    expect(html).not.toContain('v3-chart')
    expect(html).not.toContain('<path')
  })
})
