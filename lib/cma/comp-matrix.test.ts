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
    expect(html).toContain('listed $445,000<br/>1,056 sqft')
    // The sale's number is the MAP PIN's badge, not an ordinal typed into the
    // address: sorting the grid reorders the columns, and "3. 947 6th" sitting
    // first read as a broken sort rather than as the key to pin 3.
    // And it sits OUTSIDE the anchor, so innerText reads "947 6th" and a
    // copy-paste carries no rank (tasteReview round three, §4 item 6).
    expect(html).toMatch(
      /<span class="pin-badge" aria-hidden="true">1<\/span><a class="matrix-addr"[^>]*>947 6th<\/a>/,
    )
    expect(html).not.toContain('1. 947 6th')
    expect(html).toContain('data-comp="1"')
    expect(html).toContain('data-pin="subject"')
    // Seven rows, and only these. The identity rows (property type, beds and
    // baths, year built) fold into one sentence when the whole table shares a
    // value, which on this fixture they do.
    for (const row of ['Sold for', 'Sold', 'Size', 'Days to offer', 'Sale price today']) {
      expect(html, row).toContain(row)
    }
    // ONE sentence, not one per folded row (tasteReview round three, §3).
    expect(html).toContain(
      'Every home here is a single family residence, 3 bd / 1 ba, built in 1978.',
    )
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
    // A CONTINUATION label, never a range of positions. "Sales 5 through 8"
    // forced the sort to run inside each table so the heading stayed true, and
    // a reader who asked for price order then got two descending runs.
    expect(twelve.match(/<h4 class="subhead matrix-group-h">The sales that set this price, continued<\/h4>/g) ?? []).toHaveLength(2)
    expect(twelve).not.toMatch(/Sales \d+ through \d+/)
    // The defect this whole shape exists to prevent: sales falling off the page.
    expect(twelve).toMatch(
      /<span class="pin-badge" aria-hidden="true">12<\/span><a class="matrix-addr"[^>]*>947 6th<\/a>/,
    )
    // Three table heads, plus the phone stack's own "Your home" card, which
    // the desktop grid had and the phone drawing did not (tasteReview item 1).
    expect(twelve.match(/Your home/g)).toHaveLength(4)
    expect(twelve.replace(/&[a-z]+;/g, '')).not.toMatch(/[—;]/)

    const thirteen = renderCompMatrixHtml(subject, Array.from({ length: 13 }, () => comp))
    expect(thirteen.match(/matrix-group-h/g) ?? []).toHaveLength(2)
    expect(thirteen).not.toMatch(/Sales \d+ through \d+/)
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
    expect(html).toContain('Every home here is a single family residence,')
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

describe('the adjustment grid, line by line', () => {
  // Research item 1 (docs/research/cma-professional-practice-2026-09-07.md):
  // Form 1004 prints each adjustment on its own labelled line with a signed
  // dollar amount, then the net, the net %, the gross %, and the adjusted
  // price. This document collapsed three itemized adjustments the engine
  // already computes into one arrow.
  const sale = {
    listingKey: 'K-730',
    address: '730 Quince',
    city: 'Redmond',
    closePrice: 457000,
    closeDate: '2026-07-06',
    listPrice: 465000,
    sqft: 1665,
    beds: 3,
    baths: 2,
    yearBuilt: 2005,
    daysToOffer: 1,
    domTotal: 25,
    concessions: 0,
    timeAdjustment: -39211,
    sizeAdjustment: -28229,
    storyAdjustment: 0,
    adjustedPrice: 389560,
    propertySubType: 'Single Family Residence',
    photoUrl: null,
  } as unknown as CmaAdjustedComp

  const five = (base: CmaAdjustedComp) =>
    Array.from({ length: 5 }, (_, i) => ({
      ...base,
      listingKey: `K-${i}`,
      address: `${100 + i} Quince`,
    })) as CmaAdjustedComp[]

  const subj = {
    streetAddress: '2465 7th',
    city: 'Redmond',
    sqft: 1440,
    beds: 3,
    baths: 2,
    yearBuilt: 2004,
    lastListPrice: 460000,
    propertySubType: 'Single Family Residence',
  } as unknown as CmaSubject

  it('itemizes date, size and the net, both as dollars and as a share', () => {
    const html = renderCompMatrixHtml(subj, five(sale))
    expect(html).toContain('Adjusted for date')
    expect(html).toContain('−$39,211')
    expect(html).toContain('Adjusted for size')
    expect(html).toContain('−$28,229')
    expect(html).toContain('Net adjustment')
    expect(html).toContain('−$67,440')
    expect(html).toContain('−14.8%')
    expect(html).toContain('Every adjustment added up')
    expect(html).toContain('14.8%')
    expect(html).toContain('Sale price today')
    expect(html).toContain('$389,560')
  })

  it('prints the concession line the 1004 puts first among the value adjustments', () => {
    const withConcession = five(sale).map((c, i) => (i === 0 ? { ...c, concessions: 4000 } : c))
    const html = renderCompMatrixHtml(subj, withConcession)
    expect(html).toContain('Seller concessions')
    expect(html).toContain('$4,000')
    expect(html).toContain('none')
  })

  it('drops an adjustment row nobody adjusted rather than printing five zeros', () => {
    const html = renderCompMatrixHtml(subj, five(sale))
    expect(html).not.toContain('Adjusted for style')
  })

  it('prints the weight per sale when the reconciliation carries one', () => {
    const html = renderCompMatrixHtml(
      subj,
      five(sale),
      '',
      null,
      new Map([['K-0', { weight: 28.8, grossAdjustmentPct: 17 }]]),
    )
    expect(html).toContain('Weight in this price')
    expect(html).toContain('28.8%')
    // The stored gross wins over the one derived from the printed lines.
    expect(html).toContain('17.0%')
  })

  it('draws each sale its price path ONCE, as a column of the grid', () => {
    const html = renderCompMatrixHtml(subj, five(sale))
    // The stacked "How each of these sales was priced" block is gone: every
    // path was drawn twice, once in the card and once again under the grid
    // (tasteReview item 3).
    expect(html).not.toContain('How each of these sales was priced')
    expect(html).toContain('Price history')
    expect(html).toContain('class="pp-spark"')
    expect(html).toContain('class="price-path"')
    // The cell holds a drawing, not an escaped string.
    expect(html).toContain('<td class="v is-draw"><span class="pp-spark"')
  })

  it('leads the phone stack with their own home, then the sales', () => {
    const html = renderCompMatrixHtml(subj, five(sale))
    const first = html.split('comp-stack-card')[1] ?? ''
    expect(first).toContain('is-yours')
    expect(first).toContain('Your home · 2465 7th')
    const card = html.split('comp-stack-card')[2] ?? ''
    expect(card).toContain('Net adjustment')
    expect(card).toContain('Sale price today')
    expect(card).toContain('class="price-path"')
  })
})

/**
 * tasteReview round three, §4 item 6: the badge sat inside the address anchor,
 * so `innerText` gave "31737 7th" and "42485 7th". It stays aria-hidden; it is
 * now also out of the anchor's text, in both the grid and the phone card.
 */
describe('the pin badge is not part of the address', () => {
  it('keeps the badge outside every address anchor', () => {
    const html = renderCompMatrixHtml(subject, padSales(comp))
    for (const m of html.matchAll(/<a class="(?:matrix-addr|comp-stack-addr)"[^>]*>([\s\S]*?)<\/a>/g)) {
      expect(m[1]).not.toContain('pin-badge')
      // The anchor's whole text is the address — no leading pin number.
      expect(m[1]).toMatch(/^(?:947 6th|10\d Pad St)$/)
    }
    expect(html).toContain('class="addr-row')
  })
})
