import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  V3Chart,
  V3ChartSwitch,
  V3_CHART_CATEGORY_SLOTS,
  v3Text,
  type V3ChartRangeRow,
  type V3ChartSeries,
} from '@/components/site/v3'

/**
 * Locks for the chart-room extension of the series atom (Unit F, 2026-08-19):
 * range rows (lollipop / dumbbell), threshold bands, YoY categorical overlay,
 * per-mark tooltips, and the segmented switch. Same renderToStaticMarkup
 * harness as the base atom locks.
 */

function yearSeries(name: string, values: number[]): V3ChartSeries {
  return {
    name: v3Text(name),
    points: values.map((value, i) => ({
      value,
      tick: v3Text(`M${i + 1}`),
      label: v3Text(`${value.toFixed(2)}%`),
      at: i + 1,
    })),
  }
}

const ROWS: V3ChartRangeRow[] = [
  { tick: v3Text('Sisters'), value: 10, label: v3Text('10 days') },
  { tick: v3Text('Bend'), value: 18, label: v3Text('18 days') },
  { tick: v3Text('Prineville'), value: 60, label: v3Text('60 days') },
]

describe('V3Chart range rows', () => {
  it('renders lollipop rows as HTML dots with the caller labels', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median days to pending by town'),
        kind: 'range',
        rows: ROWS,
      }),
    )
    expect(html).toContain('v3-chart--range')
    expect((html.match(/v3-chart__rangedot/g) ?? []).length).toBe(3)
    expect(html).toContain('18 days')
    // Lollipop rows have no base dot.
    expect(html).not.toContain('v3-chart__rangebase')
    // The hidden reading list still carries every row.
    expect(html).toContain('Sisters: Sisters, 10 days')
  })

  it('renders dumbbell pairs with base dots and a paired reading', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Sale-to-original ask, Q2 2025 to Q2 2026'),
        kind: 'range',
        rows: [
          {
            tick: v3Text('Bend'),
            value: 98.45,
            label: v3Text('98.5%'),
            baseValue: 97.79,
            baseLabel: v3Text('97.8%'),
          },
          {
            tick: v3Text('Black Butte Ranch'),
            value: 90.15,
            label: v3Text('90.2%'),
            baseValue: 96.0,
            baseLabel: v3Text('96.0%'),
          },
        ],
        rangeKeyLabel: v3Text('Q2 2026'),
        rangeBaseKeyLabel: v3Text('Q2 2025'),
      }),
    )
    expect((html.match(/v3-chart__rangebase/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('Q2 2026')
    expect(html).toContain('Q2 2025')
    // Reading pairs current with prior.
    expect(html).toContain('98.5% (97.8%)')
  })

  it('renders x threshold bands with their labels across range rows', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Months of supply by town'),
        kind: 'range',
        rows: [
          { tick: v3Text('Bend'), value: 3.47, label: v3Text('3.5 mo') },
          { tick: v3Text('La Pine'), value: 11.15, label: v3Text('11.2 mo') },
        ],
        bands: [
          { from: 0, to: 4, label: v3Text("Seller's") },
          { from: 4, to: 6, label: v3Text('Balanced') },
          { from: 6, to: 99, label: v3Text("Buyer's") },
        ],
      }),
    )
    expect((html.match(/class="v3-chart__rangeband"/g) ?? []).length).toBe(3)
    expect(html).toContain('Balanced')
  })

  it('clamps an outlier row in the exception ink with its true reading', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Months of supply by town'),
        kind: 'range',
        clampMax: 14,
        rows: [
          { tick: v3Text('Bend'), value: 3.47, label: v3Text('3.5 mo') },
          { tick: v3Text('Terrebonne'), value: 36, label: v3Text('36.0 mo') },
        ],
      }),
    )
    expect(html).toContain('v3-chart__rangedot--clamped')
    expect(html).toContain('v3-chart__rangelabel--clamped')
    // The true reading survives, and the row title names the breach.
    expect(html).toContain('36.0 mo')
    expect(html).toContain('beyond the scale shown')
    // The honest row stays un-clamped.
    expect((html.match(/v3-chart__rangedot--clamped/g) ?? []).length).toBe(1)
  })

  it('draws an in-domain reference rule with its name', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Price-cut share by town'),
        kind: 'range',
        refValue: 8.46,
        refLabel: v3Text('Region 8.5%'),
        rows: [
          { tick: v3Text('Bend'), value: 6.6, label: v3Text('6.6%') },
          { tick: v3Text('Black Butte Ranch'), value: 16.7, label: v3Text('16.7%') },
        ],
      }),
    )
    expect(html).toContain('v3-chart__rangeref')
    expect(html).toContain('Region 8.5%')
  })

  it('carries a row note into the native title and the hidden readings', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median days to pending by town'),
        kind: 'range',
        rows: [
          {
            tick: v3Text('Bend'),
            value: 18,
            label: v3Text('18 days'),
            note: v3Text('167 closed in 30 days'),
          },
        ],
      }),
    )
    expect(html).toContain('Bend: 18 days — 167 closed in 30 days')
  })
})

describe('V3Chart YoY overlay', () => {
  const years = [
    yearSeries('2026', [6.9, 6.8, 6.6]),
    yearSeries('2025', [6.9, 6.7, 6.8]),
    yearSeries('2024', [6.6, 6.9, 7.0]),
  ]

  it('colors each year with a categorical class instead of the dashed ladder', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Weekly 30-year rate, years overlaid'),
        series: years,
        overlay: 'yoy',
      }),
    )
    expect(html).toContain('v3-chart--yoy')
    expect(html).toContain('v3-chart__line--cat0')
    expect(html).toContain('v3-chart__line--cat1')
    expect(html).toContain('v3-chart__line--cat2')
    expect(html).toContain('v3-chart__key--cat2')
  })

  it('keeps the dashed muted ladder without the overlay', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Two series, default ink'),
        series: years.slice(0, 2),
      }),
    )
    expect(html).toContain('v3-chart__line--1')
    expect(html).not.toContain('v3-chart__line--cat')
  })

  it('refuses more series than the categorical run can keep apart', () => {
    const six = Array.from({ length: V3_CHART_CATEGORY_SLOTS + 1 }, (_, i) =>
      yearSeries(`${2021 + i}`, [6.5, 6.6, 6.7]),
    )
    expect(() =>
      renderToStaticMarkup(
        createElement(V3Chart, {
          caption: v3Text('Too many years'),
          series: six,
          overlay: 'yoy',
        }),
      ),
    ).toThrow(/at most 5 series/)
  })
})

describe('V3Chart marks and line bands', () => {
  it('draws per-point marks with a native title reading', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Spread with marks'),
        series: [yearSeries('Spread', [1.4, 2.9, 2.2])],
        marks: true,
      }),
    )
    expect((html.match(/v3-chart__mark v3-chart__mark--/g) ?? []).length).toBe(3)
    expect(html).toContain('<title>Spread — M2: 2.90%</title>')
  })

  it('washes in-domain bands behind the line and lists the band key', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Spread vs norm'),
        series: [yearSeries('Spread', [1.4, 2.9])],
        bands: [{ from: 1.5, to: 2.0, label: v3Text('Norm 1.5–2.0pp') }],
      }),
    )
    expect(html).toContain('v3-chart__band')
    expect(html).toContain('Norm 1.5–2.0pp')
  })
})

describe('V3ChartSwitch', () => {
  const items = [
    { key: '1y', label: v3Text('1Y') },
    { key: 'max', label: v3Text('MAX') },
  ]

  it('renders a tablist with one panel visible and the rest kept in the DOM', () => {
    const html = renderToStaticMarkup(
      createElement(
        V3ChartSwitch,
        { label: v3Text('Range'), items },
        createElement('p', null, 'one-year view'),
        createElement('p', null, 'full-history view'),
      ),
    )
    expect(html).toContain('role="tablist"')
    expect(html).toContain('aria-label="Range"')
    expect((html.match(/role="tab"/g) ?? []).length).toBe(2)
    expect(html).toContain('aria-selected="true"')
    // Both panels server-rendered; the inactive one is hidden, not dropped.
    expect(html).toContain('one-year view')
    expect(html).toContain('full-history view')
    expect(html).toContain('hidden')
  })

  it('opens at defaultKey', () => {
    const html = renderToStaticMarkup(
      createElement(
        V3ChartSwitch,
        { label: v3Text('Range'), items, defaultKey: 'max' },
        createElement('p', null, 'one-year view'),
        createElement('p', null, 'full-history view'),
      ),
    )
    // The MAX tab is the selected one.
    const maxTab = html.slice(html.indexOf('MAX') - 300, html.indexOf('MAX'))
    expect(maxTab).toContain('aria-selected="true"')
  })

  it('refuses a panel count that does not match the items', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(
          V3ChartSwitch,
          { label: v3Text('Range'), items },
          createElement('p', null, 'only one panel'),
        ),
      ),
    ).toThrow(/one panel per item/)
  })
})
