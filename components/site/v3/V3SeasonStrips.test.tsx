import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  V3SeasonStrips,
  type V3SeasonCell,
  type V3SeasonStripsProps,
} from './V3SeasonStrips.client'
import { v3Text } from './atoms'

/**
 * V3SeasonStrips is a second series drawn as a second FORM (the monthly
 * report's supply beside its median line). What these tests hold is that the
 * form stays honest in the served HTML, before any script runs: the resting
 * reading is printed, every month's reading is in the page in time order, the
 * full-ink part of a column is only the part past the threshold, and a value
 * the domain cannot hold refuses the drawing instead of standing on the top of
 * its row.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function cell(year: number, month: number, value: number): V3SeasonCell {
  const call = value <= 4 ? "a seller's market" : value < 6 ? 'a balanced market' : "a buyer's market"
  return {
    value,
    tick: v3Text(`${MONTHS[month]} ${year}`),
    label: v3Text(`${value.toFixed(1)} months`),
    note: v3Text(call),
  }
}

function props(over: Partial<V3SeasonStripsProps> = {}): V3SeasonStripsProps {
  const y2026 = [2.4, 2.8, 3.6, 4.4, 4.8, 4.5, 4.2, 4.0]
  const y2025 = [2.2, 2.7, 3.2, 3.9, 4.5, 4.5, 4.2, 3.7, 3.3, 3.0, 2.7, 2.3]
  return {
    caption: v3Text('Central Oregon months of supply by month, January 2025 to August 2026'),
    claim: v3Text("4.0 months of supply at the end of August 2026: a seller's market by our measure."),
    rows: [
      {
        name: v3Text('2026'),
        cells: Array.from({ length: 12 }, (_, m) => (m < y2026.length ? cell(2026, m, y2026[m]!) : null)),
      },
      { name: v3Text('2025'), cells: y2025.map((v, m) => cell(2025, m, v)) },
    ],
    columns: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((c) => v3Text(c)),
    max: 6,
    bands: [{ from: 4, to: 6, label: v3Text('Balanced: above 4 and under 6 months') }],
    threshold: 4,
    id: 'supply',
    ...over,
  }
}

function render(p: V3SeasonStripsProps): string {
  return renderToStaticMarkup(createElement(V3SeasonStrips, p))
}

describe('V3SeasonStrips, served HTML', () => {
  it('prints the resting reading, the newest month, before any script runs', () => {
    const html = render(props())
    expect(html).toContain('v3-seasons__read-tick">Aug 2026<')
    expect(html).toContain('v3-seasons__read-value">4.0 months<')
    expect(html).toContain('aria-live="polite">Aug 2026: 4.0 months, a seller&#x27;s market<')
  })

  it('carries every month in time order for a reader who cannot see the columns', () => {
    const html = render(props())
    const list = html.match(/<ol class="v3-seasons__data">([\s\S]*?)<\/ol>/)![1]!
    const items = [...list.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]!)
    expect(items).toHaveLength(20)
    expect(items[0]).toBe('Jan 2025, 2.2 months, a seller&#x27;s market')
    expect(items[11]).toBe('Dec 2025, 2.3 months, a seller&#x27;s market')
    expect(items[12]).toBe('Jan 2026, 2.4 months, a seller&#x27;s market')
    expect(items.at(-1)).toBe('Aug 2026, 4.0 months, a seller&#x27;s market')
  })

  it('stands every column on zero and inks only the part past the threshold', () => {
    const html = render(props())
    const bars = [...html.matchAll(/class="v3-seasons__bar" style="height:([\d.]+)%"/g)].map((m) => Number(m[1]))
    expect(bars).toHaveLength(20)
    expect(bars[0]).toBeCloseTo((2.4 / 6) * 100, 2)
    // Past 4 months: Apr to Jul 2026 and May to Jul 2025. Aug 2026 sits ON the line.
    const caps = [...html.matchAll(/class="v3-seasons__cap" style="height:([\d.]+)%"/g)].map((m) => Number(m[1]))
    expect(caps).toHaveLength(7)
    expect(caps[1]).toBeCloseTo(((4.8 - 4) / 4.8) * 100, 2)
    // The band sits from the 4-month line to the top of the domain.
    expect(html).toMatch(/class="v3-seasons__band v3-seasons__band--top" style="bottom:66\.667%;height:33\.333%"/)
  })

  it('marks the resting month and its year, and names the surface for the keyboard', () => {
    const html = render(props())
    expect(html.match(/v3-seasons__cell is-active/g)).toHaveLength(1)
    expect(html).toMatch(/v3-seasons__row is-active"><span class="v3-seasons__name">2026</)
    expect(html).toContain('role="group" tabindex="0"')
    expect(html).toContain('aria-labelledby="supply-caption"')
  })

  it('refuses a value past the domain and says why instead', () => {
    const bad = props()
    const rows = [{ ...bad.rows[0]!, cells: bad.rows[0]!.cells.map((c, i) => (i === 4 && c ? { ...c, value: 6.4 } : c)) }, bad.rows[1]!]
    const html = render({ ...bad, rows, emptyReason: v3Text('Too few sales in these months for a supply reading.') })
    expect(html).not.toContain('v3-seasons__bar')
    expect(html).toContain('Too few sales in these months for a supply reading.')
    expect(render({ ...bad, rows })).toBe('')
  })
})
