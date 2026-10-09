import { describe, expect, it } from 'vitest'
import { SALE_LED_META_PATHS, saleLedGeoDescription } from './geo-description'

const BEND = [
  { name: 'Active Listings', value: 714 },
  { name: 'Median List Price', value: 874750 },
  { name: 'Months of Supply', value: 3.5 },
  { name: 'Median sale price, last 12 months', value: 765000 },
]

describe('saleLedGeoDescription', () => {
  it('leads with the 12-month median sale and its change (brief 2026-10-08 §6.1)', () => {
    const text = saleLedGeoDescription({ geoName: 'Bend', datasetVariables: BEND, yoyMedianPrice: -0.0131 })
    expect(text).toBe(
      'Bend home prices: the median single-family home sold for $765,000 over the last 12 months, down 1.3%. Median list $874,750. 3.5 months of supply.',
    )
    expect(text!.length).toBeLessThanOrEqual(155)
  })

  it('drops the change when the yoy figure is withheld', () => {
    expect(saleLedGeoDescription({ geoName: 'Bend', datasetVariables: BEND, yoyMedianPrice: null })).toBe(
      'Bend home prices: the median single-family home sold for $765,000 over the last 12 months. Median list $874,750. 3.5 months of supply.',
    )
  })

  it('returns null without a 12-month sale median, so the list-led snippet stays', () => {
    expect(
      saleLedGeoDescription({
        geoName: 'Bend',
        datasetVariables: BEND.filter((v) => v.name !== 'Median sale price, last 12 months'),
        yoyMedianPrice: -0.013,
      }),
    ).toBeNull()
  })

  it('never prints a placeholder for a missing list price or supply', () => {
    const text = saleLedGeoDescription({
      geoName: 'Bend',
      datasetVariables: [{ name: 'Median sale price, last 12 months', value: 765000 }],
      yoyMedianPrice: 0.021,
    })
    expect(text).toBe('Bend home prices: the median single-family home sold for $765,000 over the last 12 months, up 2.1%.')
    expect(text).not.toMatch(/NaN|null|undefined|\$0\b/)
  })

  it('is opt-in for Bend only', () => {
    expect([...SALE_LED_META_PATHS]).toEqual(['/housing-market/bend'])
  })
})
