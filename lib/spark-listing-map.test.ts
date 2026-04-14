import { describe, expect, it } from 'vitest'
import { sparkListingToSupabaseRow, type SparkListingResult } from './spark'

function closedFixture(closePrice: number, originalListPrice?: number): SparkListingResult {
  return {
    Id: 'test-key-1',
    ResourceUri: '/listings/test-key-1',
    StandardFields: {
      ListingKey: 'test-key-1',
      ListingId: '12345',
      ListPrice: 599000,
      ClosePrice: closePrice,
      OriginalListPrice: originalListPrice ?? 625000,
      DaysOnMarket: 42,
      CumulativeDaysOnMarket: 55,
      StandardStatus: 'Closed',
      CloseDate: '2025-11-01T00:00:00Z',
      ListDate: '2025-06-01T00:00:00Z',
      OnMarketDate: '2025-06-01T00:00:00Z',
      City: 'Bend',
      StateOrProvince: 'OR',
    },
  }
}

describe('sparkListingToSupabaseRow', () => {
  it('maps ClosePrice and OriginalListPrice for a closed listing', () => {
    const row = sparkListingToSupabaseRow(closedFixture(575000, 599000))
    expect(row.ClosePrice).toBe(575000)
    expect(row.OriginalListPrice).toBe(599000)
    expect(row.ListPrice).toBe(599000)
    expect(row.DaysOnMarket).toBe(42)
    expect(row.CumulativeDaysOnMarket).toBe(55)
  })

  it('maps ClosePrice when OriginalListPrice is absent', () => {
    const f = closedFixture(400000)
    const { OriginalListPrice: _olp, ...sfRest } = f.StandardFields
    void _olp
    const base: SparkListingResult = { ...f, StandardFields: { ...sfRest } }
    const row = sparkListingToSupabaseRow(base)
    expect(row.ClosePrice).toBe(400000)
    expect(row.OriginalListPrice).toBeNull()
  })

  it('nulls ClosePrice for masked Spark values', () => {
    const f = closedFixture(0)
    f.StandardFields.ClosePrice = '********' as unknown as number
    const row = sparkListingToSupabaseRow(f)
    expect(row.ClosePrice).toBeNull()
  })
})
