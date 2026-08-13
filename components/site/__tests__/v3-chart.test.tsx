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

  it('is exported from the barrel as an atom, not a seventh pattern', () => {
    const index = readFileSync(INDEX_SRC, 'utf8')
    expect(index).toMatch(/export \{ V3Chart \} from '\.\/V3Chart'/)
    expect(index).toMatch(/The six patterns are closed/)
    expect(index).toMatch(/Not a seventh/)
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
