import { describe, expect, it } from 'vitest'
import { renderCompMatrixHtml, renderUnsoldContrastMatrixHtml } from '@/lib/cma/comp-matrix'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
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
  it('prints a subject column and one column per sale with the RPR facts', () => {
    const html = renderCompMatrixHtml(subject, padSales(comp))
    expect(html).toContain('The sales that set this price')
    expect(html).toContain('class="kv is-wide comp-matrix"')
    expect(html).toContain('648 Douglas')
    expect(html).toContain('1. 947 6th')
    expect(html).toContain('data-comp="1"')
    expect(html).toContain('data-pin="subject"')
    expect(html).toContain('Property type')
    expect(html).toContain('Single Family Residence')
    expect(html).toContain('Sale price / sqft')
    expect(html).toContain('$478/sf')
    expect(html).toContain('List price / sqft')
    expect(html).toContain('Bedrooms')
    expect(html).toContain('Living sqft')
    expect(html).toContain('Lot sqft')
    expect(html).toContain('6,098')
    expect(html).toContain('Garage')
    expect(html).toContain('$495,000')
    expect(html).toContain('$465,744')
    expect(html).toContain('Adjusted close')
    expect(html).toContain('Jun 25, 2026')
    expect(html).not.toContain('Adjusted to subject')
    expect(html).not.toContain('matrix-thumb')
    expect(html).not.toMatch(/[—;]/)
  })

  it('keeps the CMA a seller actually gets to one undivided table', () => {
    // TARGET_COMPS is 5 and MIN_COMPS is 5 (lib/cma/comps.ts), so the priced
    // set renders as a single table with no group captions.
    const html = renderCompMatrixHtml(subject, padSales(comp, 5))
    expect(html.match(/<table class="kv is-wide comp-matrix">/g)).toHaveLength(1)
    expect(html).not.toContain('<h4 class="subhead">')
  })

  it('fails closed below five closed sales — no thin matrix paint', () => {
    expect(renderCompMatrixHtml(subject, [])).toBe('')
    expect(renderCompMatrixHtml(subject, padSales(comp, 1))).toBe('')
    expect(renderCompMatrixHtml(subject, padSales(comp, 4))).toBe('')
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
    expect(twelve.match(/648 Douglas/g)).toHaveLength(3)
    expect(twelve).not.toMatch(/[—;]/)

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
    expect(html).toMatch(/<td class="v(?: is-diff)?">Single Family Residence<\/td>/)
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

  it('labels the adjusted-price row as adjusted close', () => {
    expect(renderCompMatrixHtml(landSubject, padSales(landComp))).toContain('Adjusted close')
    expect(renderCompMatrixHtml(subject, padSales(comp))).toContain('Adjusted close')
    expect(renderCompMatrixHtml(subject, padSales(comp))).not.toMatch(/as your house/i)
  })

  it('prints sale price per square foot on an improved report', () => {
    expect(renderCompMatrixHtml(subject, padSales(comp))).toContain('Sale price / sqft')
    expect(renderCompMatrixHtml(subject, padSales(comp))).toContain('$478/sf')
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

describe('sold matrix DOM + listing history on screen', () => {
  it('emits Days on market and Listing history as visible matrix rows (not title/tooltip)', () => {
    const html = renderCompMatrixHtml(
      {
        ...subject,
        listingHistoryLine: 'Listed Jul 2021 at $445,000 · still listed',
      },
      padSales({
        ...comp,
        originalListPrice: 510000,
        onMarketDate: '2026-05-01',
        listingHistoryLine: 'Listed at $510,000, cut to $499,000, sold at $495,000 · 29 days on market',
      }),
    )
    expect(html).toContain('data-fact="dom"')
    expect(html).toContain('data-fact="listing-history"')
    expect(html).toContain('Days on market')
    expect(html).toContain('Listing history')
    expect(html).toMatch(/data-fact="dom"[^>]*>[\s\S]*?<td class="v n[^"]*">29</)
    expect(html).toContain('Listed at $510,000, cut to $499,000, sold at $495,000 · 29 days on market')
    expect(html).not.toMatch(/title="[^"]*days on market/i)
    // Letter stack also surfaces DOM + history on screen
    expect(html).toContain('data-fact="dom">29 days on market')
    expect(html).toContain('data-fact="listing-history">Listed at $510,000')
  })
})

describe('unsold contrast matrix', () => {
  const peer = {
    listingKey: 'E1',
    address: '88 Wren',
    listPrice: 519000,
    originalListPrice: 549000,
    status: 'Expired',
    daysOnMarket: 97,
    onMarketDate: '2026-01-15',
    photoUrl: null,
    listingHistoryLine: 'Asked $549,000, cut to $519,000, came off expired · 97 days on market',
    beds: 3,
    baths: 2,
    sqft: 1420,
    yearBuilt: 1997,
    lotAcres: 0.22,
    propertySubType: 'Single Family Residence',
    latitude: 43.705,
    longitude: -121.501,
  } as CmaExpiredPeer

  it('emits side-by-side matrix with DOM + listing history when peers exist', () => {
    const html = renderUnsoldContrastMatrixHtml(subject, [peer])
    expect(html).toContain('Expired peers — what happened')
    expect(html).toContain('comp-matrix')
    expect(html).toContain('88 Wren')
    expect(html).toContain('Last ask')
    expect(html).toContain('$519,000')
    expect(html).toContain('Days on market')
    expect(html).toContain('Listing history')
    expect(html).toContain('data-fact="dom"')
    expect(html).toContain('data-fact="listing-history"')
    expect(html).toContain('Asked $549,000, cut to $519,000, came off expired · 97 days on market')
    expect(html).toContain('comp-stack-card')
    expect(html.toLowerCase()).not.toContain('overprice')
    expect(html.toLowerCase()).not.toContain('taught buyers')
  })


  it('excludes the subject listing from peer columns (U1)', () => {
    const subjectAsPeer = {
      ...peer,
      listingKey: 'SUBJ-1',
      address: subject.streetAddress,
      listPrice: 575000,
    }
    const html = renderUnsoldContrastMatrixHtml(
      { ...subject, listingKey: 'SUBJ-1', streetAddress: '648 Douglas' },
      [subjectAsPeer, peer],
    )
    expect(html).toContain('88 Wren')
    expect(html).not.toMatch(/1\.\s*648 Douglas/)
    // Subject column once — not also as peer #1
    expect(html.match(/648 Douglas/g)?.length).toBe(1)
  })

  it('collapses same-address cycles into one peer with both histories (U2)', () => {
    const jan = {
      ...peer,
      listingKey: 'W-JAN',
      address: '15935 Woodchip',
      listPrice: 475000,
      onMarketDate: '2026-01-10',
      listingHistoryLine: 'Listed Jan 10, 2026 at $475,000, came off expired · 80 days on market',
      daysOnMarket: 80,
    }
    const jun = {
      ...peer,
      listingKey: 'W-JUN',
      address: '15935 Woodchip',
      listPrice: 450000,
      onMarketDate: '2026-06-01',
      listingHistoryLine: 'Listed Jun 1, 2026 at $450,000, came off canceled · 40 days on market',
      daysOnMarket: 40,
    }
    const html = renderUnsoldContrastMatrixHtml(subject, [jan, jun])
    expect(html).toContain('15935 Woodchip')
    expect(html).toContain('came off expired · 80 days on market')
    expect(html).toContain('came off canceled · 40 days on market')
    // One peer column (matrix header + mobile stack both say "1." — never a bare twin "2.")
    expect(html).toContain('1. 15935 Woodchip')
    expect(html).not.toContain('2. 15935 Woodchip')
    expect(html.match(/2\.\s*15935 Woodchip/g)).toBeNull()
  })

  it('prints peer DOM and finished history outcome when facts exist (U3)', () => {
    const html = renderUnsoldContrastMatrixHtml(subject, [peer])
    // Matrix DOM row + stack card both carry the peer sit-time (not a dash).
    expect(html).toContain('data-fact="dom"')
    expect(html).toContain('>97<')
    expect(html).toContain('97 days on market')
    expect(html).toContain('came off expired · 97 days on market')
  })

  it('aligns sold subject DOM row with history day count', () => {
    const html = renderCompMatrixHtml(
      {
        ...subject,
        listingHistoryLine: 'Listed Jul 2021 at $445,000, came off canceled · 133 days on market',
        lastListDate: '2026-04-01',
      },
      padSales(comp),
    )
    expect(html).toContain('133 days on market')
    // DOM row uses the history line's day count, not a fresh as-of-now derive.
    expect(html).toContain('>133<')
    expect(html).not.toContain('>137<')
  })

  it('soft-fails when no peers — omit section, invent nothing', () => {

    expect(renderUnsoldContrastMatrixHtml(subject, null)).toBe('')
    expect(renderUnsoldContrastMatrixHtml(subject, [])).toBe('')
    expect(renderUnsoldContrastMatrixHtml(subject, [{ ...peer, address: '', listPrice: 0 }])).toBe('')
  })
})
