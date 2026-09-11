import { describe, expect, it } from 'vitest'
import { platNewCount30dFromTiles } from './plat-fold-figures'

describe('platNewCount30dFromTiles', () => {
  const now = Date.parse('2026-09-10T12:00:00Z')

  it('counts SFR houses in the inventory set with on-market in the last 30 days', () => {
    const n = platNewCount30dFromTiles(
      [
        {
          listingKey: 'a',
          onMarketDate: '2026-09-01T00:00:00Z',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
        },
        {
          listingKey: 'b',
          onMarketDate: '2026-08-01T00:00:00Z',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
        },
        {
          listingKey: 'c',
          onMarketDate: '2026-09-05T00:00:00Z',
          propertyType: 'D',
          propertySubType: 'Residential Lots',
        },
        {
          listingKey: 'd',
          onMarketDate: '2026-09-02T00:00:00Z',
          propertyType: 'A',
          propertySubType: 'Single Family Residence',
        },
      ],
      new Set(['a', 'b', 'c']),
      now,
    )
    // a in window + inventory; b too old; c land; d not in inventory keys
    expect(n).toBe(1)
  })

  it('returns null when none qualify', () => {
    expect(platNewCount30dFromTiles([], new Set(), now)).toBeNull()
  })
})
