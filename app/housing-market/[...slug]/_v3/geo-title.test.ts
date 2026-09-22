import { describe, expect, it } from 'vitest'
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
  it('uses months of supply when the Dataset publishes it, never an inventory count', () => {
    for (const geo of GEOS) {
      const title = geoTitle({
        geoName: geo,
        datasetVariables: vars([
          { name: 'Active Listings', value: 582 },
          { name: 'Months of Supply', value: 5.2 },
          { name: 'Median List Price', value: 825000 },
        ]),
      })
      expect(title, geo).toBe(`${geo} housing market ${MARKET_TITLE_YEAR}: 5.2 months of supply`)
      expect(title, geo).not.toMatch(INVENTORY)
    }
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
    ).toBe(`Bend housing market ${MARKET_TITLE_YEAR}: 4.1 months of supply`)
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
