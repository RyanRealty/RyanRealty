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

  it('holds one table at four sales and chunks past that, subject repeated', () => {
    // The page-contract defect: one table per sale set was thirteen columns
    // wide at twelve comps, ran past the right margin, and `overflow-x: auto`
    // then clipped sales 4 through 12 out of the delivered PDF entirely.
    const four = renderCompMatrixHtml(subject, Array.from({ length: 4 }, () => comp))
    expect(four.match(/<table class="kv is-wide comp-matrix">/g)).toHaveLength(1)
    expect(four).not.toContain('<h4 class="subhead">')

    const twelve = renderCompMatrixHtml(subject, Array.from({ length: 12 }, () => comp))
    expect(twelve.match(/<table class="kv is-wide comp-matrix">/g)).toHaveLength(3)
    expect(twelve).toContain('<h4 class="subhead">Sales 1 through 4</h4>')
    expect(twelve).toContain('<h4 class="subhead">Sales 5 through 8</h4>')
    expect(twelve).toContain('<h4 class="subhead">Sales 9 through 12</h4>')
    // Every sale still reaches the page, and the subject anchors each table.
    expect(twelve).toContain('12. 947 6th')
    expect(twelve.match(/648 Douglas/g)).toHaveLength(3)
    expect(twelve).not.toMatch(/[—;]/)

    // A remainder chunk names its own sale rather than a range.
    const thirteen = renderCompMatrixHtml(subject, Array.from({ length: 13 }, () => comp))
    expect(thirteen).toContain('<h4 class="subhead">Sale 13</h4>')
  })

  it('pins every column width so no cell can push the table past the margin', () => {
    // Fixed layout plus a colgroup is what makes the width independent of how
    // long an address or a subdivision name happens to be.
    const html = renderCompMatrixHtml(subject, Array.from({ length: 4 }, () => comp))
    const cols = html.match(/<col style="width:[\d.]+%">/g) ?? []
    expect(cols).toHaveLength(6) // label + subject + 4 sales
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
