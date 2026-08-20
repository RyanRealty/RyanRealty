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

  it('does not print MLS N/A into the grid', () => {
    const html = renderCompMatrixHtml(
      { ...subject, subdivision: 'N/A', propertySubType: 'None' },
      [{ ...comp, subdivision: 'N/A' }],
    )
    expect(html).not.toMatch(/N\/A/i)
    expect(html).not.toMatch(/>None</)
  })
})
