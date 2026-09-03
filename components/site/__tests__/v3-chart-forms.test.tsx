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
    // The hidden reading list still carries every row, and names the town ONCE.
    // On a range chart the series name IS the tick, so prefixing it made a
    // screen reader announce "Sisters: Sisters, 10 days".
    expect(html).toContain('<li>Sisters, 10 days</li>')
    expect(html).not.toContain('Sisters: Sisters')
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
            note: v3Text('small sample'),
          },
        ],
      }),
    )
    expect(html).toContain('Bend: 18 days \u2014 small sample')
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

/**
 * Sample size. The atom draws n ONLY where the caller could hand it the
 * population the figure was computed over; ci:chart-sample-window polices which
 * callers may. These locks cover what the atom itself owes: one written form,
 * its own column so it can never sit on a dot, a name for what it counted, and
 * a refusal when that name is missing.
 */
describe('V3Chart range sample size', () => {
  const SAMPLED: V3ChartRangeRow[] = [
    { tick: v3Text('Bend'), value: 1_285_000, label: v3Text('$1.29M'), sample: { n: 1513 } },
    { tick: v3Text('Camp Sherman'), value: 900_000, label: v3Text('$900K'), sample: { n: 4 } },
  ]

  it('draws each n in its own column, under a key that names what it counted', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close price by town'),
        kind: 'range',
        rows: SAMPLED,
        sampleKey: v3Text('closings in 2025'),
      }),
    )
    expect(html).toContain('v3-chart__range--sampled')
    expect((html.match(/v3-chart__rangesample/g) ?? []).length).toBe(2)
    expect(html).toContain('n = closings in 2025')
    // Thousands separated, so 1513 is never read as 151.3.
    expect(html).toContain('n 1,513')
    expect(html).toContain('n 4')
    // The reading a screen reader gets carries the same n.
    expect(html).toContain('<li>Camp Sherman, $900K \u2014 n 4</li>')
  })

  it('writes a dumbbell sample as current then prior, matching the value pair', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Sale-to-original ask'),
        kind: 'range',
        rows: [
          {
            tick: v3Text('Bend'),
            value: 98.45,
            label: v3Text('98.5%'),
            baseValue: 97.79,
            baseLabel: v3Text('97.8%'),
            sample: { n: 513, baseN: 574 },
          },
        ],
        sampleKey: v3Text('detached closes'),
      }),
    )
    expect(html).toContain('n 513 (574)')
    expect(html).toContain('98.5% (97.8%) \u2014 n 513 (574)')
  })

  it('refuses a sample with no key, because an unnamed count names no population', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(V3Chart, {
          caption: v3Text('Median close price by town'),
          kind: 'range',
          rows: SAMPLED,
        }),
      ),
    ).toThrow(/sampleKey/)
  })

  it('draws no sample column, and no key, when no row carries one', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median days to pending by town'),
        kind: 'range',
        rows: ROWS,
        sampleKey: v3Text('closings in the window'),
      }),
    )
    expect(html).not.toContain('v3-chart__range--sampled')
    expect(html).not.toContain('v3-chart__rangesample')
    expect(html).not.toContain('n = closings in the window')
  })

  it('drops a base sample on a lollipop row rather than pairing it with nothing', () => {
    const html = renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median close price by town'),
        kind: 'range',
        rows: [{ tick: v3Text('Bend'), value: 100, label: v3Text('$100K'), sample: { n: 9, baseN: 7 } }],
        sampleKey: v3Text('closings'),
      }),
    )
    expect(html).toContain('n 9')
    expect(html).not.toContain('n 9 (7)')
  })
})

/**
 * The range plot's reading layer.
 *
 * Those rows shipped with `aria-hidden="true"` over the whole plot and a native
 * `title` as their only reading: nothing for a keyboard, nothing for a finger,
 * and a tooltip a pointer has to wait for. 57 rows across nine call sites could
 * not be interrogated at all — TASTE's "a picture of a chart". The layer below
 * is the same one the line charts already use, turned ninety degrees.
 */
describe('V3Chart range reading layer', () => {
  const render = () =>
    renderToStaticMarkup(
      createElement(V3Chart, {
        caption: v3Text('Median days to pending by town'),
        kind: 'range',
        rows: ROWS,
      }),
    )

  it('mounts the hover layer on the rows, not on the whole plot', () => {
    const html = render()
    expect(html).toContain('v3-chart__rangerows')
    // Sized to the whole range box it sat under the band header too, and a
    // pointer at a given height read a row above the one it was over.
    const rows = html.indexOf('v3-chart__rangerows')
    const layer = html.indexOf('v3-chart__hover')
    expect(rows).toBeGreaterThan(-1)
    expect(layer).toBeGreaterThan(rows)
  })

  it('gives the whole plot ONE tab stop, not one per row', () => {
    const html = render()
    expect((html.match(/tabindex="0"/gi) ?? []).length).toBe(1)
  })

  it('tells the reader the rows run downward', () => {
    expect(render()).toMatch(/Move down the rows or use the arrow keys/)
  })

  it('keeps a live region so the reading is announced, not just drawn', () => {
    expect(render()).toContain('aria-live="polite"')
  })

  it('leaves the drawn plot aria-hidden — the layer is the accessible copy', () => {
    // Two copies of one value read twice. The visual stays decorative and the
    // hover layer plus the reading list carry the meaning.
    expect(render()).toContain('aria-hidden="true"')
    expect(render()).toContain('<li>Sisters, 10 days</li>')
  })
})
