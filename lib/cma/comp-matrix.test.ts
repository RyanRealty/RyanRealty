import { describe, expect, it } from 'vitest'
import { renderCompMatrixHtml } from '@/lib/cma/comp-matrix'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

const subject = {
  streetAddress: '648 Douglas',
  city: 'Bend',
  subdivision: 'Clear Sky Estates',
  propertySubType: 'Single Family Residence',
  beds: 3,
  baths: 1,
  sqft: 1056,
  lotAcres: 0.16,
  yearBuilt: 1978,
  garageSpaces: 1,
  lastListPrice: 445000,
  lastListDate: '2021-07-01',
} as CmaSubject

const comp = {
  address: '947 6th',
  propertySubType: 'Single Family Residence',
  closePrice: 495000,
  listPrice: 499000,
  closeDate: '2026-06-25',
  beds: 3,
  baths: 1,
  sqft: 1036,
  lotAcres: 0.14,
  yearBuilt: 1978,
  garageSpaces: 1,
  domTotal: 29,
  daysToOffer: 8,
  proximity: '0.19 miles S',
  subdivision: 'Clear Sky Estates',
  timeAdjustment: -33709,
  sizeAdjustment: 4453,
  adjustedPrice: 465744,
} as CmaAdjustedComp

function padSales(seed: CmaAdjustedComp, n = 5): CmaAdjustedComp[] {
  return Array.from({ length: n }, (_, i) => ({
    ...seed,
    address: i === 0 ? seed.address : `${100 + i} Pad St`,
    listingKey: `P${i + 1}`,
    adjustedPrice: seed.adjustedPrice + i * 1000,
  }))
}

describe('renderCompMatrixHtml', () => {
  it('prints your home first, then one column per sale, with the blueprint rows', () => {
    const html = renderCompMatrixHtml(subject, padSales(comp))
    expect(html).toContain('The sales that set this price')
    expect(html).toContain('class="kv is-wide comp-matrix"')
    // The seller's column is headed "Your home", with their ask and size under
    // it — never a price in a "Sold for" cell on a home that has not sold.
    expect(html).toContain('Your home')
    expect(html).toContain('listed $445,000 · 1,056 sqft')
    expect(html).toContain('1. 947 6th')
    expect(html).toContain('data-comp="1"')
    expect(html).toContain('data-pin="subject"')
    // Seven rows, and only these. The identity rows (property type, beds and
    // baths, year built) fold into one sentence when the whole table shares a
    // value, which on this fixture they do.
    for (const row of ['Sold for', 'Sold', 'Size', 'Days to offer', 'Sale price today']) {
      expect(html, row).toContain(row)
    }
    expect(html).toContain('Every home here is a single family residence.')
    expect(html).toContain('Every home here is 3 bd / 1 ba.')
    expect(html).toContain('Every home here was built in 1978.')
    expect(html).toContain('$495,000')
    expect(html).toContain('$465,744')
    expect(html).toContain('Jun 25, 2026')
    expect(html).not.toContain('Adjusted to subject')
    expect(html).not.toContain('matrix-thumb')
    // Punctuation law over the visible text; `&amp;` in a tracked URL is markup.
    expect(html.replace(/&[a-z]+;/g, '')).not.toMatch(/[—;]/)
  })

  it('keeps the CMA a seller actually gets to one undivided table', () => {
    // TARGET_COMPS is 5 and MIN_COMPS is 5 (lib/cma/comps.ts), so the priced
    // set renders as a single table with no group captions.
    const html = renderCompMatrixHtml(subject, padSales(comp, 5))
    expect(html.match(/<table class="kv is-wide comp-matrix">/g)).toHaveLength(1)
    expect(html).not.toContain('<h4 class="subhead">')
  })

  // The floor is the pricing unit's floor (PRICING_MIN_COMPS = 3), not the
  // selector's target of five. At five, cma-19968 and cma-1617-nw-8th shipped
  // a recommended list with no comparable sales anywhere in the document
  // (2026-09-07). A thin matrix is honest; an invisible one is not.
  it('shows the set the pricing unit priced from, and nothing thinner', () => {
    expect(renderCompMatrixHtml(subject, [])).toBe('')
    expect(renderCompMatrixHtml(subject, padSales(comp, 1))).toBe('')
    expect(renderCompMatrixHtml(subject, padSales(comp, 2))).toBe('')
    expect(renderCompMatrixHtml(subject, padSales(comp, 3))).toContain('The sales that set this price')
    expect(renderCompMatrixHtml(subject, padSales(comp, 5))).toContain('The sales that set this price')
  })

  it('never strands a table holding a single sale', () => {
    // Filling greedily to the ceiling would print 5 then a lone column at six
    // comps, which reads as an error on a page a seller studies. Sizes may
    // never differ by more than one, and no table may hold one sale unless the
    // whole CMA has one.
    for (let n = 6; n <= 13; n++) {
      const html = renderCompMatrixHtml(subject, Array.from({ length: n }, () => comp))
      const sizes = [...html.matchAll(/<colgroup>(.*?)<\/colgroup>/g)].map(
        // minus the label column and the repeated subject column
        (m) => (m[1]!.match(/<col /g) ?? []).length - 2,
      )
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
      expect(Math.max(...sizes)).toBeLessThanOrEqual(5)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
      expect(Math.min(...sizes)).toBeGreaterThan(1)
      expect(sizes).toHaveLength(Math.ceil(n / 5))
    }
  })

  it('captions each table with the sales it holds, and loses none of them', () => {
    const twelve = renderCompMatrixHtml(subject, Array.from({ length: 12 }, () => comp))
    expect(twelve.match(/<table class="kv is-wide comp-matrix">/g)).toHaveLength(3)
    expect(twelve).toContain('<h4 class="subhead">Sales 1 through 4</h4>')
    expect(twelve).toContain('<h4 class="subhead">Sales 5 through 8</h4>')
    expect(twelve).toContain('<h4 class="subhead">Sales 9 through 12</h4>')
    // The defect this whole shape exists to prevent: sales falling off the page.
    expect(twelve).toContain('12. 947 6th')
    expect(twelve.match(/Your home/g)).toHaveLength(3)
    expect(twelve.replace(/&[a-z]+;/g, '')).not.toMatch(/[—;]/)

    const thirteen = renderCompMatrixHtml(subject, Array.from({ length: 13 }, () => comp))
    expect(thirteen).toContain('<h4 class="subhead">Sales 1 through 5</h4>')
    expect(thirteen).toContain('<h4 class="subhead">Sales 10 through 13</h4>')
  })

  it('pins every column width so no cell can push the table past the margin', () => {
    // Fixed layout plus a colgroup is what makes the width independent of how
    // long an address or a subdivision name happens to be.
    const html = renderCompMatrixHtml(subject, Array.from({ length: 5 }, () => comp))
    const cols = html.match(/<col style="width:[\d.]+%">/g) ?? []
    expect(cols).toHaveLength(7) // label + subject + 5 sales
    const widths = cols.map((c) => Number(c.match(/([\d.]+)%/)![1]))
    expect(widths[0]).toBe(20)
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100)
    // Figures never wrap; free text does. Both classes must actually be emitted.
    expect(html).toMatch(/<td class="v n[^"]*">\$495,000<\/td>/)
    // Property type is identical across the table, so it folds into a
    // sentence above it rather than repeating one value six times.
    expect(html).toContain('Every home here is a single family residence.')
  })

  it('does not print MLS N/A into the grid', () => {
    const html = renderCompMatrixHtml(
      { ...subject, subdivision: 'N/A', propertySubType: 'None' },
      padSales({ ...comp, subdivision: 'N/A' }),
    )
    expect(html).not.toMatch(/N\/A/i)
    expect(html).not.toMatch(/>None</)
  })
})

describe('land columns', () => {
  const landSubject = {
    streetAddress: '1 Elkwood', city: 'Chiloquin', subdivision: null,
    propertySubType: 'Residential Lots', beds: null, baths: null, sqft: null,
    lotAcres: 0.69, yearBuilt: null, garageSpaces: null,
    lastListPrice: null, lastListDate: null,
  } as unknown as CmaSubject

  const landComp = {
    address: '2 Elkwood', propertySubType: 'Residential Lots',
    closePrice: 210_000, listPrice: 219_000, closeDate: '2026-06-25',
    beds: null, baths: null,
    // rowToComp sets a land comp's living area to 0 — CmaComp.sqft is not nullable.
    sqft: 0,
    lotAcres: 0.72, yearBuilt: null, garageSpaces: null,
    domTotal: 40, daysToOffer: null, proximity: '0.2 miles S', subdivision: null,
    timeAdjustment: 0, sizeAdjustment: 0, adjustedPrice: 210_000,
  } as unknown as CmaAdjustedComp

  it('never prints a living area of 0 for a land comp', () => {
    const html = renderCompMatrixHtml(landSubject, padSales(landComp))
    expect(html).not.toMatch(/>0</)
  })

  it('leaves the per-sqft rows blank rather than dividing by zero', () => {
    const html = renderCompMatrixHtml(landSubject, padSales(landComp))
    expect(html).not.toMatch(/Infinity/)
    expect(html).not.toMatch(/NaN/)
  })

  it('still carries the lot size, which is the size that matters for land', () => {
    const html = renderCompMatrixHtml(landSubject, padSales(landComp))
    // 0.72 acres -> 31,363 sqft
    expect(html).toMatch(/31,363/)
  })

  it('labels the adjusted-price row as sale price today', () => {
    expect(renderCompMatrixHtml(landSubject, padSales(landComp))).toContain('Sale price today')
    expect(renderCompMatrixHtml(subject, padSales(comp))).toContain('Sale price today')
    expect(renderCompMatrixHtml(subject, padSales(comp))).not.toMatch(/as your house/i)
  })

  it('cuts the per-square-foot rows the blueprint does not name', () => {
    // CMA_REIMAGINED_2026-09-07.md chapter 3: seven rows, and only these. Sale
    // price / sqft is the sale price stated a second way.
    const html = renderCompMatrixHtml(subject, padSales(comp))
    expect(html).not.toContain('Sale price / sqft')
    expect(html).not.toContain('$478/sf')
    expect(html).not.toContain('List price')
  })

  it('does not lecture the per-square-foot formula', () => {
    expect(renderCompMatrixHtml(subject, padSales(comp))).not.toMatch(
      /Sale price per square foot is close price over living area/,
    )
    expect(renderCompMatrixHtml(landSubject, padSales(landComp))).not.toMatch(
      /Sale price per square foot is close price over living area/,
    )
  })

  it('never says "as your house"', () => {
    expect(renderCompMatrixHtml(subject, padSales(comp))).not.toMatch(/as your house/i)
    expect(renderCompMatrixHtml(landSubject, padSales(landComp))).not.toMatch(/as your house/i)
  })

  it('puts a thumbnail above each column when a photo exists', () => {
    const html = renderCompMatrixHtml(
      { ...subject, photoUrl: 'https://cdn.example/subject.jpg' },
      padSales({ ...comp, photoUrl: 'https://cdn.example/comp.jpg' }),
    )
    expect(html).toContain('matrix-thumb')
    expect(html).toContain('https://cdn.example/subject.jpg')
    expect(html).toContain('https://cdn.example/comp.jpg')
  })

  it('still prints living area for an improved comp', () => {
    const html = renderCompMatrixHtml(subject, padSales(comp))
    expect(html).toMatch(/1,036/)
  })
})

describe('the rows the blueprint cuts', () => {
  it('drops days on market and the listing-history paragraph', () => {
    // CMA_REIMAGINED_2026-09-07.md chapter 3. Days to offer is the days figure
    // a seller reads; days on market beside it is the same question twice, and
    // a listing-history sentence inside a table cell is a paragraph in a grid.
    const html = renderCompMatrixHtml(
      { ...subject, listingHistoryLine: 'Listed Jul 2021 at $445,000 · still listed' },
      padSales({
        ...comp,
        originalListPrice: 510000,
        onMarketDate: '2026-05-01',
        listingHistoryLine: 'Listed at $510,000, cut to $499,000, sold at $495,000 · 29 days on market',
      }),
    )
    expect(html).not.toContain('data-fact="dom"')
    expect(html).not.toContain('data-fact="listing-history"')
    expect(html).not.toContain('Days on market')
    expect(html).not.toContain('Listing history')
    expect(html).not.toContain('Listed at $510,000, cut to $499,000')
    // Days to offer stays, because that is the days figure chapter 2 argues on.
    expect(html).toContain('Days to offer')
  })
})
