import { describe, expect, it } from 'vitest'
import { TITLE_BUDGET } from '@/lib/site/page-metadata'
import { geoTitle, MARKET_TITLE_YEAR } from './geo-title'

const GEOS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
  'Black Butte Ranch',
  'Eagle Crest',
  'Crooked River Ranch',
  'Tetherow',
  'Caldera Springs',
  'Northwest Crossing',
] as const

const INVENTORY = /homes for sale|active listings/i

function vars(
  rows: Array<{ name: string; value: string | number }> = [],
): ReadonlyArray<{ name: string; value: string | number }> {
  return rows
}

describe('geoTitle — market language, not inventory (SITE-173)', () => {
  it('leads with the median list price, never an inventory count, inside the title budget', () => {
    for (const geo of GEOS) {
      const title = geoTitle({
        geoName: geo,
        datasetVariables: vars([
          { name: 'Active Listings', value: 582 },
          { name: 'Months of Supply', value: 5.2 },
          { name: 'Median List Price', value: 825000 },
        ]),
      })
      expect(title, geo).toMatch(/housing market/)
      expect(title.length, geo).toBeLessThanOrEqual(TITLE_BUDGET)
      expect(title, geo).not.toMatch(INVENTORY)
    }
  })

  it('reads the Bend shape Search Console asked for (2026-10-04)', () => {
    const datasetVariables = vars([
      { name: 'Months of Supply', value: 3.6 },
      { name: 'Median List Price', value: 897000 },
    ])
    expect(geoTitle({ geoName: 'Bend', datasetVariables })).toBe('Bend housing market: $897K median list price')
    expect(geoTitle({ geoName: 'Eagle Crest', datasetVariables })).toBe('Eagle Crest housing market: $897K median list')
    expect(geoTitle({ geoName: 'Crooked River Ranch', datasetVariables })).toBe(
      `Crooked River Ranch housing market ${MARKET_TITLE_YEAR}`,
    )
  })

  it('says list price, never a bare home price that reads as a sale price (§0)', () => {
    const title = geoTitle({ geoName: 'Bend', datasetVariables: vars([{ name: 'Median List Price', value: 1250000 }]) })
    expect(title).toBe('Bend housing market: $1.3M median list price')
    expect(title).not.toMatch(/home price/)
  })

  it('uses months of supply when the price is withheld', () => {
    expect(geoTitle({ geoName: 'Sisters', datasetVariables: vars([{ name: 'Months of Supply', value: 5.2 }]) })).toBe(
      'Sisters housing market: 5.2 months of supply',
    )
  })

  it('falls back to the housing-market query when supply is withheld', () => {
    for (const geo of GEOS) {
      const title = geoTitle({
        geoName: geo,
        datasetVariables: vars([{ name: 'Active Listings', value: 11 }]),
      })
      expect(title, geo).toBe(`${geo} housing market ${MARKET_TITLE_YEAR}`)
      expect(title, geo).not.toMatch(INVENTORY)
    }
  })

  it('formats a numeric supply the same way the Dataset display does', () => {
    expect(
      geoTitle({
        geoName: 'Bend',
        datasetVariables: vars([{ name: 'Months of Supply', value: 4.02 }]),
      }),
    ).toBe('Bend housing market: 4.1 months of supply')
  })

  it('does not bid homes for sale even when that is the only figure on the row', () => {
    const title = geoTitle({
      geoName: 'Bend',
      datasetVariables: vars([{ name: 'Active Listings', value: 582 }]),
    })
    expect(title).not.toMatch(/homes for sale/i)
    expect(title).not.toMatch(/582/)
  })
})
