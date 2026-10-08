/**
 * EVERY COLUMN OF THE ADJUSTMENT GRID ADDS UP, ON THE SHEET AND ON THE PHONE.
 *
 * Reader review of cma-2382-jackson, 2026-10-08: on "The sales that set this
 * price" the grid printed 2224 Indigo as date −$6,884 and size +$49,181 over a
 * Net adjustment of +$31,047. The net was right, but the $11,250 seller credit
 * that made it right sat above the date row as an unsigned amount, and on the
 * phone card it was dropped as a repeat of the fact row's label, so the column
 * did not add up from what it printed. cma-3037-purcell read the same way
 * (2124 Carrie: date $0, size +$5,601, net −$8,049).
 *
 * The fixture is the Jackson sales, with one sale whose concession was never
 * recorded so the third convention is held too: a credit prints signed, a
 * sale that reported none prints none, and a sale with nothing on record
 * says so and takes nothing off.
 *
 * What is pinned, for every sale, on the desktop grid AND on the phone card:
 *   Sold for + every printed move = Sale price today
 *   Net adjustment = the sum of the printed moves
 * and the sold rate row, the caption over the table and the status table all
 * read the same after-credit figure under words that say so.
 */
import { describe, expect, it } from 'vitest'
import {
  ADJUSTMENT_MOVE_ROW_LABELS,
  CONCESSION_ADJUSTMENT_ROW_LABEL,
  CONCESSION_NONE_CELL,
  CONCESSION_NOT_RECORDED_CELL,
  DAYS_TO_OFFER_ROW_LABEL,
  SOLD_PPSF_NET_ROW_LABEL,
  renderCompMatrixHtml,
} from '@/lib/cma/comp-matrix'
import { closedEntries } from '@/lib/cma/matrix-entry'
import { salesThatSetItPage } from '@/lib/cma/render-pricing-page'
import { statusPriceSummaries } from '@/lib/cma/status-price-summary'
import type { CmaAdjustedComp, CmaMarketContext, CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '2382 Jackson',
  city: 'Redmond',
  propertySubType: 'Single Family Residence',
  beds: 3,
  baths: 2.5,
  sqft: 2016,
  lotAcres: 0.12,
  yearBuilt: 2017,
  lastListPrice: 639000,
  lastListDate: '2026-02-17',
  standardStatus: 'Canceled',
  listingHistoryLine: 'Listed Feb 17, 2026 at $699,000, cut to $639,000, came off Oct 2, 2026 · 227 days on market',
} as unknown as CmaSubject

type Sale = {
  address: string
  close: number
  sqft: number
  /** A recorded amount, a reported zero, or nothing on record (null, before 2024). */
  concessions: number | null
  date: number
  size: number
  story?: number
  closeDate: string
  daysToOffer: number
}

const SALES: Sale[] = [
  { address: '2224 Indigo', close: 503_000, sqft: 1676, concessions: 11_250, date: -6_884, size: 49_181, closeDate: '2026-02-10', daysToOffer: 47 },
  { address: '2254 Indigo', close: 670_000, sqft: 2091, concessions: 0, date: -9_380, size: -11_848, closeDate: '2026-01-23', daysToOffer: 146 },
  { address: '2799 Baroness', close: 645_000, sqft: 1633, concessions: 15_000, date: -13_986, size: 72_239, closeDate: '2025-07-24', daysToOffer: 13 },
  { address: '2266 Jackson', close: 690_000, sqft: 2002, concessions: 15_000, date: -55_552, size: 2_166, closeDate: '2025-04-07', daysToOffer: 27 },
  // Nothing recorded: a 2023 close with no amount and no yes-or-no on the row.
  { address: '2591 Purcell', close: 575_000, sqft: 1655, concessions: null, date: -35_247, size: 58_867, story: 5_000, closeDate: '2023-11-22', daysToOffer: 45 },
]

function adjusted(s: Sale): number {
  return s.close - (s.concessions ?? 0) + s.date + s.size + (s.story ?? 0)
}

function compOf(s: Sale, i: number): CmaAdjustedComp {
  return {
    listingKey: `J${i + 1}`,
    address: s.address,
    city: 'Redmond',
    propertySubType: 'Single Family Residence',
    closePrice: s.close,
    listPrice: s.close + 10_000,
    closeDate: s.closeDate,
    onMarketDate: null,
    sqft: s.sqft,
    beds: 3,
    baths: 2.5,
    yearBuilt: 2016,
    daysToOffer: s.daysToOffer,
    domTotal: s.daysToOffer + 30,
    concessionsAmount: s.concessions,
    concessionsYn: null,
    timeAdjustment: s.date,
    sizeAdjustment: s.size,
    storyAdjustment: s.story ?? null,
    adjustedPrice: adjusted(s),
    photoUrl: null,
  } as unknown as CmaAdjustedComp
}

const comps = SALES.map(compOf)

/**
 * The dollar a cell prints. The words for no move, and the table's blank (a
 * line no move was made on, like style on a sale the engine did not adjust
 * for it), read as zero. Anything else that is not a dollar is NaN and fails.
 */
function dollars(cell: string): number {
  const t = cell.replace(/&minus;|−/g, '-').trim()
  if (t === CONCESSION_NONE_CELL || t === CONCESSION_NOT_RECORDED_CELL || t === '-') return 0
  const m = /^([+-])?\$([\d,]+)$/.exec(t)
  if (!m) return Number.NaN
  return (m[1] === '-' ? -1 : 1) * Number(m[2]!.replace(/,/g, ''))
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The desktop grid, as label → one cell per sale (the reader's column dropped). */
function gridRows(html: string): Array<{ label: string; cells: string[] }> {
  const start = html.indexOf('is-adjustments')
  const table = html.slice(start, html.indexOf('</table>', start))
  const body = table.slice(table.indexOf('<tbody>'))
  return [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((tr) => {
    const cells = [...tr[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => text(m[1]!))
    return { label: cells[0]!, cells: cells.slice(2) }
  })
}

/** The first table on the page: the facts, as label → every column's cell. */
function factRows(html: string): Map<string, string[]> {
  const start = html.indexOf('<table')
  const table = html.slice(start, html.indexOf('</table>', start))
  const body = table.slice(table.indexOf('<tbody>'))
  const out = new Map<string, string[]>()
  for (const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => text(m[1]!))
    out.set(cells[0]!, cells.slice(1))
  }
  return out
}

/** Each phone card, as its lines in order. Index 0 is the reader's own home. */
function phoneCards(html: string): Array<Array<{ k: string; v: string }>> {
  const stack = html.slice(html.indexOf('class="comp-stack"'))
  return stack
    .split('<article class="comp-stack-card')
    .slice(1)
    .map((card) =>
      [...card.matchAll(/<span class="k">([\s\S]*?)<\/span><span class="v[^"]*">([\s\S]*?)<\/span><\/div>/g)].map(
        (m) => ({ k: text(m[1]!), v: text(m[2]!) }),
      ),
    )
}

describe('the adjustment grid foots, every column (reader review, cma-2382-jackson)', () => {
  const html = renderCompMatrixHtml(subject, comps)
  const rows = gridRows(html)
  const row = (label: string) => rows.find((r) => r.label === label)

  it('prints the credit as a signed move straight under the sale price', () => {
    const labels = rows.map((r) => r.label)
    const soldFor = labels.indexOf('Sold for')
    expect(soldFor).toBeGreaterThan(-1)
    expect(labels[soldFor + 1]).toBe(CONCESSION_ADJUSTMENT_ROW_LABEL)
    expect(labels.indexOf('Adjusted for date')).toBe(soldFor + 2)
    // Every printed row between the sale price and the net is a move, in the
    // order the math runs (or the room sentence, which moves nothing).
    const between = labels.slice(soldFor + 1, labels.indexOf('Net adjustment'))
    for (const label of between) {
      expect(
        ADJUSTMENT_MOVE_ROW_LABELS.includes(label) || label.startsWith('Adjusted for rooms'),
        label,
      ).toBe(true)
    }
    expect(row(CONCESSION_ADJUSTMENT_ROW_LABEL)!.cells).toEqual([
      '−$11,250',
      CONCESSION_NONE_CELL,
      '−$15,000',
      '−$15,000',
      CONCESSION_NOT_RECORDED_CELL,
    ])
  })

  it('lands Sold for plus every printed move on Sale price today, and the net is their sum', () => {
    const soldFor = row('Sold for')!.cells.map(dollars)
    const net = row('Net adjustment')!.cells.map(dollars)
    const today = row('Sale price today')!.cells.map(dollars)
    const moves = rows.filter((r) => ADJUSTMENT_MOVE_ROW_LABELS.includes(r.label))
    expect(moves.map((r) => r.label)).toContain('Adjusted for style (theirs vs yours)')
    SALES.forEach((s, i) => {
      const sum = moves.reduce((acc, r) => acc + dollars(r.cells[i] ?? '-'), 0)
      expect(Number.isNaN(sum), s.address).toBe(false)
      expect(net[i], s.address).toBe(sum)
      expect(soldFor[i]! + sum, s.address).toBe(today[i])
      expect(today[i], s.address).toBe(adjusted(s))
    })
    // The reader's three: the printed lines now add to the printed net.
    expect(net.slice(0, 4)).toEqual([31_047, -21_228, 43_253, -68_386])
  })

  it('foots the same on each phone card: the card\'s Sold, the moves under it, the net', () => {
    const cards = phoneCards(html).slice(1)
    expect(cards).toHaveLength(SALES.length)
    cards.forEach((lines, i) => {
      const s = SALES[i]!
      const get = (k: string) => lines.find((l) => l.k === k)?.v
      const moves = lines.filter((l) => ADJUSTMENT_MOVE_ROW_LABELS.includes(l.k))
      // The credit is in the working, not only in the facts above it.
      expect(moves[0]?.k, s.address).toBe(CONCESSION_ADJUSTMENT_ROW_LABEL)
      const sum = moves.reduce((acc, l) => acc + dollars(l.v), 0)
      expect(dollars(get('Net adjustment')!), s.address).toBe(sum)
      expect(dollars(get('Sold')!) + sum, s.address).toBe(dollars(get('Sale price today')!))
    })
  })

  it('names the sold rate for the after-credit figure it prints, and the caption and the status table agree', () => {
    const facts = factRows(html)
    expect(facts.has('Sold $/sqft')).toBe(false)
    const rates = facts.get(SOLD_PPSF_NET_ROW_LABEL)!.slice(1).map(dollars)
    // (503,000 - 11,250) / 1,676 = 293.4: the net, not the $300 the close gives.
    expect(rates).toEqual(
      SALES.map((s) => Math.round((s.close - (s.concessions ?? 0)) / s.sqft)),
    )
    expect(rates[0]).toBe(293)
    const low = Math.min(...rates)
    const high = Math.max(...rates)
    const caption = text(/<p class="small ppsf-status-caption"[^>]*>([\s\S]*?)<\/p>/.exec(html)![1]!)
    expect(caption).toContain(`sold at $${low} to $${high} a foot`)
    expect(caption).toContain('net of seller concessions')
    const closed = statusPriceSummaries({ closed: closedEntries(comps) })[0]!
    expect(closed.ppsf?.low).toBe(low)
    expect(closed.ppsf?.high).toBe(high)
  })

  it('names the days row for what a sale counts, and the reader\'s own count for what it is', () => {
    const facts = factRows(html)
    expect(facts.has('Days on market')).toBe(false)
    const days = facts.get(DAYS_TO_OFFER_ROW_LABEL)!
    expect(days[0]).toBe('227 days on market')
    expect(days.slice(1)).toEqual(SALES.map((s) => `${s.daysToOffer} days`))
    const [yours, first] = phoneCards(html)
    expect(yours!.find((l) => l.k === 'Days on market')?.v).toBe('227 days')
    expect(yours!.some((l) => l.k === DAYS_TO_OFFER_ROW_LABEL)).toBe(false)
    expect(first!.find((l) => l.k === DAYS_TO_OFFER_ROW_LABEL)?.v).toBe('47 days')
  })
})

describe('the caption under the grid points at the line that carries the credit', () => {
  const pricing = {
    recommended: 610_000,
    valueLow: 598_620,
    valueHigh: 688_253,
    confidence: 'High',
    notes: [],
  } as unknown as CmaPricing

  it('names the line, and says what a sale with nothing on record shows', () => {
    const page = salesThatSetItPage({
      subject,
      comps,
      market: { geoLabel: 'Redmond' } as CmaMarketContext,
      pricing,
    })
    const body = text(page!.body)
    expect(body).toContain(
      `In the adjustments, a recorded credit comes off the sale price first, on the ${CONCESSION_ADJUSTMENT_ROW_LABEL} line, before date and size.`,
    )
    expect(body).toContain('A sale that reported none shows none.')
    expect(body).toContain(`A sale with nothing on record shows ${CONCESSION_NOT_RECORDED_CELL}, and nothing comes off it.`)
    expect(body).not.toContain('\u2014')
  })

  it('leaves the not-recorded sentence off when every sale has a record', () => {
    const page = salesThatSetItPage({
      subject,
      comps: comps.slice(0, 4).concat(compOf({ ...SALES[4]!, concessions: 0 }, 4)),
      market: { geoLabel: 'Redmond' } as CmaMarketContext,
      pricing,
    })
    expect(text(page!.body)).not.toContain(CONCESSION_NOT_RECORDED_CELL)
  })
})

describe('a table where no sale carried a credit', () => {
  const plain = SALES.map((s) => ({ ...s, concessions: 0 }))
  const html = renderCompMatrixHtml(subject, plain.map(compOf))

  it('keeps the plain row name and caption, since the net is the sold price', () => {
    const facts = factRows(html)
    expect(facts.has('Sold $/sqft')).toBe(true)
    expect(facts.has(SOLD_PPSF_NET_ROW_LABEL)).toBe(false)
    expect(html).not.toContain('net of seller concessions')
    const rows = gridRows(html)
    expect(rows.find((r) => r.label === CONCESSION_ADJUSTMENT_ROW_LABEL)?.cells).toEqual(
      plain.map(() => CONCESSION_NONE_CELL),
    )
  })
})
