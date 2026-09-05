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

describe('renderCompMatrixHtml', () => {
  it('prints a subject column and one column per sale with the RPR facts', () => {
    const html = renderCompMatrixHtml(subject, [comp])
    expect(html).toContain('Side by side')
    expect(html).toContain('class="kv is-wide comp-matrix"')
    expect(html).toContain('648 Douglas')
    expect(html).toContain('1. 947 6th')
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
    expect(html).toContain('This sale as your house')
    expect(html).toContain('Jun 25, 2026')
    expect(html).not.toContain('Adjusted to subject')
    expect(html).not.toMatch(/[—;]/)
  })

  it('keeps the CMA a seller actually gets to one undivided table', () => {
    // TARGET_COMPS is 5 and MIN_COMPS is 3 (lib/cma/comps.ts), so the whole
    // ordinary range must render as a single table with no group captions.
    for (const n of [3, 4, 5]) {
      const html = renderCompMatrixHtml(subject, Array.from({ length: n }, () => comp))
      expect(html.match(/<table class="kv is-wide comp-matrix">/g)).toHaveLength(1)
      expect(html).not.toContain('<h4 class="subhead">')
    }
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
      [{ ...comp, subdivision: 'N/A' }],
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
    const html = renderCompMatrixHtml(landSubject, [landComp])
    expect(html).not.toMatch(/>0</)
  })

  it('leaves the per-sqft rows blank rather than dividing by zero', () => {
    const html = renderCompMatrixHtml(landSubject, [landComp])
    expect(html).not.toMatch(/Infinity/)
    expect(html).not.toMatch(/NaN/)
  })

  it('still carries the lot size, which is the size that matters for land', () => {
    const html = renderCompMatrixHtml(landSubject, [landComp])
    // 0.72 acres -> 31,363 sqft
    expect(html).toMatch(/31,363/)
  })

  it('labels the adjusted-price row for the product', () => {
    expect(renderCompMatrixHtml(landSubject, [landComp])).toMatch(/This sale as your lot/)
    expect(renderCompMatrixHtml(landSubject, [landComp])).not.toMatch(/as your house/)
    expect(renderCompMatrixHtml(subject, [comp])).toMatch(/This sale as your house/)
  })

  it('prints sale price per square foot on an improved report', () => {
    expect(renderCompMatrixHtml(subject, [comp])).toContain('Sale price / sqft')
    expect(renderCompMatrixHtml(subject, [comp])).toContain('$478/sf')
  })

  it('does not lecture the per-square-foot formula', () => {
    expect(renderCompMatrixHtml(subject, [comp])).not.toMatch(
      /Sale price per square foot is close price over living area/,
    )
    expect(renderCompMatrixHtml(landSubject, [landComp])).not.toMatch(
      /Sale price per square foot is close price over living area/,
    )
  })

  it('never says "as your home" — the document idiom is "as your house"', () => {
    expect(renderCompMatrixHtml(subject, [comp])).not.toMatch(/as your home/i)
    expect(renderCompMatrixHtml(landSubject, [landComp])).not.toMatch(/as your home/i)
  })

  it('still prints living area for an improved comp', () => {
    const html = renderCompMatrixHtml(subject, [comp])
    expect(html).toMatch(/1,036/)
  })
})
